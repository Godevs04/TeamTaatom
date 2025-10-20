import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
const WS_PATH = '/socket.io';

let socket: Socket | null = null;
const listeners: Record<string, Set<(...args: any[]) => void>> = {};

const getToken = async () => {
  return await AsyncStorage.getItem('authToken');
};
  
const connectSocket = async () => {
  console.log('Socket service - Attempting to connect...');
  if (socket && socket.connected) {
    console.log('Socket service - Already connected');
    return socket;
  }
  const token = await getToken();
  console.log('Socket service - Token retrieved:', !!token);
  
  // Clean up existing socket if any
  if (socket) {
    console.log('Socket service - Disconnecting existing socket');
    socket.disconnect();
    socket = null;
  }
  
  socket = io(API_BASE_URL + '/app', {
    path: WS_PATH,
    transports: ['websocket'],
    autoConnect: false,
    auth: { token },
    query: { auth: token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    forceNew: true,
    timeout: 20000,
    extraHeaders: Platform.OS === 'web' ? {} : { Authorization: `Bearer ${token}` },
  });

  socket.on('connect', () => {
    console.log('Socket service - Connected successfully to /app namespace');
  });
  socket.on('disconnect', (reason) => {
    console.log('Socket service - Disconnected:', reason);
  });
  socket.on('connect_error', (err) => {
    console.error('Socket service - Connect error:', err);
  });

  // Forward all events to listeners
  socket.onAny((event, ...args) => {
    console.log('Socket event received:', event, args);
    if (listeners[event]) {
      listeners[event].forEach((cb) => cb(...args));
    }
  });

  socket.connect();
  console.log('Socket service - Connection initiated');
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
    console.log('Socket service - Subscribing to event:', event);
    if (!listeners[event]) listeners[event] = new Set();
    listeners[event].add(cb);
    console.log('Socket service - Total listeners for', event, ':', listeners[event].size);
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
