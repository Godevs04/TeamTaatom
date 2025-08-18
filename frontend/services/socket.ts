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
  if (socket && socket.connected) return socket;
  const token = await getToken();
  socket = io(API_BASE_URL + '/app', {
    path: WS_PATH,
    transports: ['websocket'],
    autoConnect: false,
    auth: { token },
    query: { auth: token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    forceNew: true,
    extraHeaders: Platform.OS === 'web' ? {} : { Authorization: `Bearer ${token}` },
  });

  socket.on('connect', () => {
    console.log('Socket connected');
  });
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
  socket.on('connect_error', (err) => {
    console.error('Socket connect error:', err);
  });

  // Forward all events to listeners
  socket.onAny((event, ...args) => {
    if (listeners[event]) {
      listeners[event].forEach((cb) => cb(...args));
    }
  });

  socket.connect();
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
    if (!listeners[event]) listeners[event] = new Set();
    listeners[event].add(cb);
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
