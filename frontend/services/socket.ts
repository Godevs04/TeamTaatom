import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getApiBaseUrl, WS_PATH } from '../utils/config';
import logger from '../utils/logger';

// Suppress WebSocket errors in web console for development
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const originalError = console.error;
  const wsErrorSuppressed = new Set<string>();
  
  // Override console.error to filter out noisy WebSocket errors
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    // Filter out common WebSocket connection errors that are expected in development
    if (
      message.includes('WebSocket connection to') ||
      message.includes('TransportError') ||
      message.includes('websocket error') ||
      message.includes('ERR_CONNECTION_REFUSED') ||
      message.includes('construct.js')
    ) {
      // Only log once per unique error to avoid spam
      const errorKey = message.substring(0, 100); // Use first 100 chars as key
      if (!wsErrorSuppressed.has(errorKey)) {
        wsErrorSuppressed.add(errorKey);
        originalError('[WebSocket] Connection errors suppressed. Backend may not be running.');
        // Clear after 10 seconds to allow new errors
        setTimeout(() => {
          wsErrorSuppressed.delete(errorKey);
        }, 10000);
      }
      return;
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
      // Same URL, socket is good
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Socket service - Already connected to correct URL');
      }
      return socket;
    } else {
      // URL changed! Must disconnect and reconnect
      if (Platform.OS === 'web') {
        console.log(`[Socket] 🔄 [WEB] URL changed! Disconnecting old socket (${lastConnectedUrl}) and reconnecting to: ${fullUrl}`);
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
      console.log(`[Socket] 🧹 [WEB] Disconnecting existing socket before reconnecting`);
    }
    socket.disconnect();
    socket = null;
    lastConnectedUrl = null;
  }
  
  // Always log for web to help debug connection issues
  if (Platform.OS === 'web') {
    console.log(`[Socket] 🔌 [WEB] Connecting to: ${fullUrl}`);
    console.log(`[Socket] 🔌 [WEB] Full WebSocket URL will be: ws://${apiBaseUrl.replace('http://', '')}/socket.io/`);
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

  socket.on('connect', () => {
    connectionState = 'connected';
    reconnectAttempts = 0;
    
    if (Platform.OS === 'web') {
      console.log(`[Socket] ✅ [WEB] Connected successfully to: ${lastConnectedUrl}`);
    } else if (process.env.NODE_ENV === 'development') {
      logger.debug('Socket service - Connected successfully to /app namespace');
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

  socket.on('connect_error', (err) => {
    connectionState = 'disconnected';
    
    // Only log if it's not an auth error (which is expected if no token)
    // For web: Suppress connection refused errors in development (common when backend is not running)
    const isConnectionRefused = err.message?.includes('ECONNREFUSED') || 
                               err.message?.includes('connection refused') ||
                               err.message?.includes('TransportError');
    
    if (process.env.NODE_ENV === 'development' && err.message !== 'Invalid token') {
      if (Platform.OS === 'web' && isConnectionRefused) {
        // For web, only log once to avoid spam
        if (reconnectAttempts === 0) {
          logger.debug('Socket connection refused (backend may not be running). Will retry silently.');
        }
      } else {
        logger.error('socketService.connect', err);
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

  // Forward all events to listeners
  socket.onAny((event, ...args) => {
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Socket event received: ${event}`, { args });
    }
    if (listeners[event]) {
      listeners[event].forEach((cb) => cb(...args));
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
