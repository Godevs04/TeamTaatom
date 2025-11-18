import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_BASE_URL, WS_PATH } from '../utils/config';
import logger from '../utils/logger';

let socket: Socket | null = null;
const listeners: Record<string, Set<(...args: any[]) => void>> = {};

const getToken = async () => {
  // For web, get token from sessionStorage (fallback) or cookies (sent automatically)
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const token = window.sessionStorage.getItem('authToken');
      if (token) {
        return token;
      }
    }
    // For web, try to get from AsyncStorage as well (might be stored there)
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token && typeof window !== 'undefined' && window.sessionStorage) {
        // Store in sessionStorage for socket.io access
        window.sessionStorage.setItem('authToken', token);
        return token;
      }
    } catch (e) {
      // AsyncStorage might not be available on web
    }
    // For web, token should be in cookies (httpOnly), but socket.io can't access httpOnly cookies
    // So we need to get it from sessionStorage or pass it explicitly
    return null;
  }
  // For mobile, get from AsyncStorage
  return await AsyncStorage.getItem('authToken');
};
  
const connectSocket = async () => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Socket service - Attempting to connect...');
  }
  if (socket && socket.connected) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Socket service - Already connected');
    }
    return socket;
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
  
  // Clean up existing socket if any
  if (socket) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Socket service - Disconnecting existing socket');
    }
    socket.disconnect();
    socket = null;
  }
  
  socket = io(API_BASE_URL + '/app', {
    path: WS_PATH,
    transports: ['websocket', 'polling'], // Add polling as fallback for web
    autoConnect: false,
    auth: { token },
    query: { auth: token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    forceNew: true,
    timeout: 20000,
    extraHeaders: Platform.OS === 'web' 
      ? { Authorization: `Bearer ${token}` } 
      : { Authorization: `Bearer ${token}` },
  });

  socket.on('connect', () => {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Socket service - Connected successfully to /app namespace');
    }
  });
  socket.on('disconnect', (reason) => {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Socket service - Disconnected:', reason);
    }
  });
  socket.on('connect_error', (err) => {
    // Only log if it's not an auth error (which is expected if no token)
    if (process.env.NODE_ENV === 'development' && err.message !== 'Invalid token') {
      logger.error('Socket service - Connect error:', err);
    }
  });

  // Forward all events to listeners
  socket.onAny((event, ...args) => {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Socket event received:', event, args);
    }
    if (listeners[event]) {
      listeners[event].forEach((cb) => cb(...args));
    }
  });

  socket.connect();
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Socket service - Connection initiated');
  }
  return socket;
};

export const socketService = {
  async connect() {
    return connectSocket();
  },
  async disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },
  async emit(event: string, ...args: any[]) {
    if (!socket) await connectSocket();
    socket?.emit(event, ...args);
  },
  async subscribe(event: string, cb: (...args: any[]) => void) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Socket service - Subscribing to event:', event);
    }
    if (!listeners[event]) listeners[event] = new Set();
    listeners[event].add(cb);
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Socket service - Total listeners for', event, ':', listeners[event].size);
    }
    if (!socket) await connectSocket();
  },
  async unsubscribe(event: string, cb: (...args: any[]) => void) {
    if (listeners[event]) listeners[event].delete(cb);
  },
  isConnected() {
    return !!(socket && socket.connected);
  },
};

// Usage example:
// socketService.subscribe('invalidate:feed', () => refetchFeed());
// socketService.subscribe('invalidate:profile:123', () => refetchProfile('123'));
