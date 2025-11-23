import { io } from 'socket.io-client'
import logger from '../utils/logger'

class SocketService {
  constructor() {
    this.socket = null
    this.listeners = {}
    this.isConnected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 2000
  }

  async connect() {
    if (this.socket && this.socket.connected) {
      logger.debug('✅ Socket already connected')
      return this.socket
    }

    try {
      const token = localStorage.getItem('founder_token')
      if (!token) {
        // Don't log as warning - this is expected when user is not logged in
        logger.debug('No authentication token found, skipping socket connection')
        return null
      }

      logger.debug('🔌 Attempting to connect socket...')
      this.socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
        path: '/socket.io/',
        transports: ['websocket', 'polling'], // Add polling as fallback
        autoConnect: false,
        auth: { token },
        query: { auth: token },
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 10000,
        forceNew: true,
        timeout: 20000,
      })

      this.setupEventHandlers()
      this.socket.connect()

      // Don't throw error on connection failure, just log it
      this.socket.once('connect', () => {
        logger.debug('✅ Socket connection established')
      })

      this.socket.once('connect_error', (error) => {
        logger.warn('⚠️ Socket connection failed, will retry:', error.message)
      })

      return this.socket
    } catch (error) {
      logger.warn('⚠️ Socket connection setup failed:', error)
      return null
    }
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      logger.debug('✅ Socket connected successfully')
      this.isConnected = true
      this.reconnectAttempts = 0
      this.emit('connect')
    })

    this.socket.on('disconnect', (reason) => {
      logger.warn('⚠️ Socket disconnected:', reason)
      this.isConnected = false
      this.emit('disconnect', reason)
    })

    this.socket.on('connect_error', (error) => {
      logger.error('❌ Socket connection error:', error.message)
      this.reconnectAttempts++
      this.emit('connect_error', error)
    })

    this.socket.on('reconnect', (attemptNumber) => {
      logger.debug('✅ Socket reconnected after', attemptNumber, 'attempts')
      this.isConnected = true
      this.emit('reconnect', attemptNumber)
    })

    this.socket.on('reconnect_error', (error) => {
      logger.error('❌ Socket reconnection error:', error.message)
      this.emit('reconnect_error', error)
    })

    this.socket.on('reconnect_failed', () => {
      logger.warn('⚠️ Socket reconnection failed')
      this.emit('reconnect_failed')
    })

    // Forward all custom events to registered listeners
    this.socket.onAny((event, ...args) => {
      logger.debug('📡 Socket event received:', event, args)
      this.emit(event, ...args)
    })
  }

  // Event listener management
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
    }
  }

  emit(event, ...args) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(...args)
        } catch (error) {
          logger.error('Error in socket event callback:', error)
        }
      })
    }
  }

  // Send data to server
  send(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data)
    } else {
      logger.warn('Socket not connected, cannot send data')
    }
  }

  // Join a room/channel
  join(room) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join', room)
    }
  }

  // Leave a room/channel
  leave(room) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave', room)
    }
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      logger.debug('🔌 Disconnecting socket...')
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
      this.listeners = {}
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      socketId: this.socket?.id
    }
  }

  // Subscribe to real-time updates
  subscribeToUpdates() {
    if (this.socket && this.isConnected) {
      this.socket.emit('subscribe', 'admin_updates')
    }
  }

  // Unsubscribe from updates
  unsubscribeFromUpdates() {
    if (this.socket && this.isConnected) {
      this.socket.emit('unsubscribe', 'admin_updates')
    }
  }
}

// Create singleton instance
export const socketService = new SocketService()
