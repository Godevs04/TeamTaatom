import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getApiBaseUrl, WS_PATH } from '../utils/config';
import logger from '../utils/logger';

// Suppress WebSocket errors in console for development (both web and mobile)
if (typeof window !== 'undefined' || typeof global !== 'undefined') {
  const originalError = console.error;
  const wsErrorSuppressed = new Set<string>();
  
  // Override console.error to filter out noisy WebSocket errors
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    const firstArg = args[0];
    
    // Check if this is a WebSocket/Socket.IO connection error
    // Check message string
    const messageCheck = 
      message.includes('WebSocket connection to') ||
      message.includes('TransportError') ||
      message.includes('websocket error') ||
      message.includes('ERR_CONNECTION_REFUSED') ||
      message.includes('construct.js') ||
      message.includes('_construct') ||
      message.includes('engine.io-client') ||
      message.includes('socket.io-client') ||
      message.includes('[socketService.connect]') ||
      message.includes('socketService.connect');
    
    // Check first argument (could be error object or string)
    const firstArgCheck = 
      (typeof firstArg === 'string' && (
        firstArg.includes('[socketService.connect]') ||
        firstArg.includes('socketService.connect') ||
        firstArg.includes('construct.js')
      )) ||
      (firstArg && typeof firstArg === 'object' && (
        firstArg.stack?.includes('construct.js') ||
        firstArg.stack?.includes('TransportError') ||
        firstArg.stack?.includes('engine.io-client') ||
        firstArg.stack?.includes('socket.io-client') ||
        firstArg.message?.includes('TransportError') ||
        firstArg.message?.includes('ECONNREFUSED')
      ));
    
    const isWebSocketError = messageCheck || firstArgCheck;
    
    // Filter out common WebSocket connection errors that are expected in development
    if (isWebSocketError) {
      // Only log once per unique error to avoid spam
      const errorKey = message.substring(0, 200); // Use first 200 chars as key
      if (!wsErrorSuppressed.has(errorKey)) {
        wsErrorSuppressed.add(errorKey);
        // Only show suppressed message in development, and only once
        if (process.env.NODE_ENV === 'development' && Platform.OS === 'web') {
          originalError('[WebSocket] Connection errors suppressed. Backend may not be running.');
        }
        // Clear after 30 seconds to allow new errors
        setTimeout(() => {
          wsErrorSuppressed.delete(errorKey);
        }, 30000);
      }
      return; // Suppress the error
    }
    originalError.apply(console, args);
  };
}

let socket: Socket | null = null;
let lastConnectedUrl: string | null = null; // Track the URL used for the last connection
const listeners: Record<string, Set<(...args: any[]) => void>> = {};

// Message queue for offline/connection issues
const messageQueue: Array<{ event: string; args: any[]; timestamp: number }> = [];
const MAX_QUEUE_SIZE = 100;
const MAX_QUEUE_AGE = 5 * 60 * 1000; // 5 minutes

// Connection state tracking
let connectionState: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' = 'disconnected';
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

const getToken = async () => {
  // For web: Socket.io cannot access httpOnly cookies, so we need to get token from AsyncStorage
  // The token should be stored in AsyncStorage during sign-in (for socket.io compatibility)
  // For mobile: Get from AsyncStorage
  try {
    const token = await AsyncStorage.getItem('authToken');
    return token;
  } catch (e) {
    // AsyncStorage might not be available
    logger.debug('Failed to get token from AsyncStorage for socket:', e);
    return null;
  }
};
  
const connectSocket = async () => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Socket service - Attempting to connect...');
  }
  
  // CRITICAL: Get API URL dynamically FIRST (important for web auto-detection)
  // Always get fresh URL to ensure correct IP - call getApiBaseUrl() fresh every time
  const apiBaseUrl = getApiBaseUrl();
  const fullUrl = apiBaseUrl + '/app';
  
  // CRITICAL: Check if socket is connected to the CORRECT URL
  // If URL changed (e.g., IP changed), we MUST disconnect and reconnect
  if (socket && socket.connected) {
    if (lastConnectedUrl === fullUrl) {
      // Same URL, socket is good - but ensure event forwarding is set up
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Socket service - Already connected to correct URL, ensuring event forwarding');
      }
      // Ensure onAny handler is set up even if socket was already connected
      // Remove existing handler first to avoid duplicates
      socket.offAny();
      socket.onAny((event, ...args) => {
        if (process.env.NODE_ENV === 'development') {
          logger.debug(`[Socket] Event received (existing connection): ${event}`, { 
            hasListeners: !!listeners[event],
            listenerCount: listeners[event]?.size || 0,
            argsLength: args.length
          });
        }
        if (listeners[event]) {
          listeners[event].forEach((cb) => {
            try {
              // CRITICAL: Socket.io sends payload as first argument, not spread
              cb(args[0]);
            } catch (error) {
              logger.error(`Error in socket event handler for ${event}:`, error);
            }
          });
        }
      });
      return socket;
    } else {
      // URL changed! Must disconnect and reconnect
      if (Platform.OS === 'web') {
        logger.debug(`[Socket] 🔄 [WEB] URL changed! Disconnecting old socket (${lastConnectedUrl}) and reconnecting to: ${fullUrl}`);
      }
      socket.disconnect();
      socket = null;
      lastConnectedUrl = null;
    }
  }
  
  const token = await getToken();
  
  if (!token) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Socket service - No token available, skipping connection');
    }
    return null;
  }
  
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Socket service - Token retrieved:', !!token);
  }
  
  // Clean up existing socket if any (if not already cleaned above)
  if (socket) {
    if (Platform.OS === 'web') {
      logger.debug(`[Socket] 🧹 [WEB] Disconnecting existing socket before reconnecting`);
    }
    socket.disconnect();
    socket = null;
    lastConnectedUrl = null;
  }
  
  // Always log for web to help debug connection issues
  if (Platform.OS === 'web') {
    logger.debug(`[Socket] 🔌 [WEB] Connecting to: ${fullUrl}`);
    logger.debug(`[Socket] 🔌 [WEB] Full WebSocket URL will be: ws://${apiBaseUrl.replace('http://', '')}/socket.io/`);
  } else if (process.env.NODE_ENV === 'development') {
    logger.debug(`Socket service - Connecting to: ${fullUrl}`);
  }
  
  socket = io(fullUrl, {
    path: WS_PATH,
    transports: ['websocket', 'polling'], // Add polling as fallback for web
    autoConnect: false,
    auth: { token },
    query: { auth: token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    forceNew: true, // CRITICAL: Force new connection to prevent URL caching
    timeout: 20000,
    extraHeaders: Platform.OS === 'web' 
      ? { Authorization: `Bearer ${token}` } 
      : { Authorization: `Bearer ${token}` },
  });
  
  // Store the URL we're connecting to
  lastConnectedUrl = fullUrl;

  socket.on('connect', async () => {
    connectionState = 'connected';
    reconnectAttempts = 0;
    
    if (Platform.OS === 'web') {
      logger.debug(`[Socket] ✅ [WEB] Connected successfully to: ${lastConnectedUrl}`);
    } else if (process.env.NODE_ENV === 'development') {
      logger.debug('Socket service - Connected successfully to /app namespace');
    }

    // CRITICAL: Join user room immediately after connection
    // Backend emits messages to 'user:${userId}' rooms, so we must join it
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        const userId = user._id;
        if (userId) {
          socket.emit('join', `user:${userId}`);
          if (process.env.NODE_ENV === 'development') {
            logger.debug(`[Socket] Joined user room: user:${userId}`);
          }
        }
      }
    } catch (e) {
      logger.error('Error joining user room on connect:', e);
    }

    // Process queued messages
    processMessageQueue();
  });

  socket.on('disconnect', (reason) => {
    connectionState = 'disconnected';
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Socket service - Disconnected:', reason);
    }

    // Attempt reconnection for certain disconnect reasons
    if (reason === 'io server disconnect' || reason === 'transport close') {
      connectionState = 'reconnecting';
      reconnectAttempts++;
      
      if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        setTimeout(() => {
          if (connectionState === 'reconnecting') {
            connectSocket();
          }
        }, Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)); // Exponential backoff, max 30s
      }
    }
  });

  socket.on('connect_error', (err: any) => {
    connectionState = 'disconnected';
    
    // Check if this is an expected connection error (backend not running, network issues)
    const errType = (err as any)?.type;
    const errName = err.name || (err as any)?.name;
    const errMessage = err.message || String(err);
    
    const isConnectionRefused = errMessage?.includes('ECONNREFUSED') || 
                               errMessage?.includes('connection refused') ||
                               errMessage?.includes('TransportError') ||
                               errMessage?.includes('xhr poll error') ||
                               errMessage?.includes('websocket error') ||
                               errType === 'TransportError' ||
                               errName === 'TransportError';
    
    // Check if error stack contains construct.js (Babel runtime helper errors)
    const errStack = err.stack || String(err);
    const hasConstructError = errStack?.includes('construct.js') || 
                              errStack?.includes('_construct') ||
                              errMessage?.includes('construct.js');
    
    // Suppress expected connection errors (backend not running, network issues)
    // Only log unexpected errors (auth errors, etc.)
    if (process.env.NODE_ENV === 'development') {
      if (isConnectionRefused || hasConstructError) {
        // Suppress these expected errors - only log once on first attempt
        if (reconnectAttempts === 0 && Platform.OS === 'web') {
          logger.debug('Socket connection error (backend may not be running). Will retry silently.');
        }
        // Don't log these errors - they're expected when backend is down
      } else if (errMessage !== 'Invalid token') {
        // Log unexpected errors (but not auth errors)
        logger.error('socketService.connect', {
          message: errMessage,
          type: errType,
          name: errName,
          // Don't include full stack trace for connection errors
        });
      }
    }

    // Retry connection with exponential backoff
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      setTimeout(() => {
        if (connectionState === 'disconnected') {
          connectionState = 'reconnecting';
          connectSocket();
        }
      }, Math.min(1000 * Math.pow(2, reconnectAttempts), 30000));
    }
  });

  // CRITICAL: Set up event forwarding BEFORE connecting
  // This ensures we catch all events, even if socket was already connected
  // Remove any existing onAny handler first to avoid duplicates
  if ((socket as any)._onAnyHandlers) {
    socket.offAny();
  }
  
  // Forward all events to listeners
  socket.onAny((event, ...args) => {
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`[Socket] Event received: ${event}`, { 
        hasListeners: !!listeners[event],
        listenerCount: listeners[event]?.size || 0,
        args: args.length > 0 ? 'present' : 'empty'
      });
    }
    if (listeners[event]) {
      listeners[event].forEach((cb) => {
        try {
          // Call with first argument (payload) - socket.io sends single payload object
          cb(args[0]);
        } catch (error) {
          logger.error(`Error in socket event handler for ${event}:`, error);
        }
      });
    } else {
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`[Socket] No listeners registered for event: ${event}`);
      }
    }
  });

  connectionState = 'connecting';
  socket.connect();
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Socket service - Connection initiated');
  }
  return socket;
};

/**
 * Process queued messages when connection is restored
 */
const processMessageQueue = () => {
  if (!socket || !socket.connected || messageQueue.length === 0) {
    return;
  }

  const now = Date.now();
  const validMessages = messageQueue.filter(msg => {
    // Remove messages older than MAX_QUEUE_AGE
    return (now - msg.timestamp) < MAX_QUEUE_AGE;
  });

  // Clear old messages
  messageQueue.length = 0;
  messageQueue.push(...validMessages);

  // Emit queued messages
  validMessages.forEach(({ event, args }) => {
    try {
      socket?.emit(event, ...args);
    } catch (error) {
      logger.error('emitQueuedMessage', error);
    }
  });

  if (process.env.NODE_ENV === 'development') {
    logger.debug(`Socket service - Processed ${validMessages.length} queued messages`);
  }
};

/**
 * Queue message for later emission when connection is restored
 */
const queueMessage = (event: string, ...args: any[]) => {
  // Remove old messages
  const now = Date.now();
  const validMessages = messageQueue.filter(msg => (now - msg.timestamp) < MAX_QUEUE_AGE);
  messageQueue.length = 0;
  messageQueue.push(...validMessages);

  // Add new message if queue not full
  if (messageQueue.length < MAX_QUEUE_SIZE) {
    messageQueue.push({ event, args, timestamp: now });
  } else {
    logger.warn('Socket service - Message queue full, dropping oldest message');
    messageQueue.shift();
    messageQueue.push({ event, args, timestamp: now });
  }
};

export const socketService = {
  async connect() {
    return connectSocket();
  },
  async disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
      lastConnectedUrl = null; // Clear stored URL
      connectionState = 'disconnected';
      reconnectAttempts = 0;
    }
  },
  async emit(event: string, ...args: any[]) {
    if (!socket || !socket.connected) {
      // Queue message if not connected
      queueMessage(event, ...args);
      // Try to connect
      if (connectionState === 'disconnected') {
        await connectSocket();
      }
      return;
    }
    socket.emit(event, ...args);
  },
  async subscribe(event: string, cb: (...args: any[]) => void) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Socket service - Subscribing to event:', event);
    }
    if (!listeners[event]) listeners[event] = new Set();
    listeners[event].add(cb);
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Socket service - Total listeners for ${event}: ${listeners[event].size}`);
    }
    if (!socket) await connectSocket();
  },
  async unsubscribe(event: string, cb: (...args: any[]) => void) {
    if (listeners[event]) listeners[event].delete(cb);
  },
  isConnected() {
    return !!(socket && socket.connected);
  },
  getConnectionState() {
    return connectionState;
  },
  getQueueSize() {
    return messageQueue.length;
  },
  clearQueue() {
    messageQueue.length = 0;
  },
};

// Usage example:
// socketService.subscribe('invalidate:feed', () => refetchFeed());
// socketService.subscribe('invalidate:profile:123', () => refetchProfile('123'));
