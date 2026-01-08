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
    this.isConnecting = false // Track if connection is in progress
  }

  async connect() {
    // If already connected, return existing socket
    if (this.socket && this.socket.connected) {
      logger.debug('✅ Socket already connected')
      return this.socket
    }

    // If connection is already in progress, wait for it
    if (this.isConnecting) {
      logger.debug('⏳ Connection already in progress, waiting...')
      // Wait for connection to complete or fail
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isConnecting) {
            clearInterval(checkInterval)
            resolve(this.socket)
          }
        }, 100)
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval)
          resolve(this.socket)
        }, 5000)
      })
    }

    // If socket exists but not connected, clean it up first
    if (this.socket && !this.socket.connected) {
      logger.debug('🧹 Cleaning up existing socket before reconnecting...')
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }

    try {
      const token = localStorage.getItem('founder_token')
      if (!token) {
        // Don't log as warning - this is expected when user is not logged in
        logger.debug('No authentication token found, skipping socket connection')
        return null
      }

      logger.debug('🔌 Attempting to connect socket...')
      this.isConnecting = true
      
      // PRODUCTION-GRADE: Use environment variable, no hardcoded fallback
      const apiUrl = import.meta.env.VITE_API_URL || '';
      if (!apiUrl && import.meta.env.PROD) {
        logger.error('❌ VITE_API_URL is required for production!');
        throw new Error('VITE_API_URL environment variable is required for production builds');
      }
      
      // Create socket with autoConnect enabled to avoid race conditions
      this.socket = io(apiUrl || 'http://localhost:3000', {
        path: '/socket.io/',
        transports: ['websocket', 'polling'], // Add polling as fallback
        autoConnect: true, // Enable autoConnect to prevent premature disconnection
        auth: { token },
        query: { auth: token },
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 10000,
        forceNew: false, // Don't force new connection if one exists
        timeout: 20000,
      })

      this.setupEventHandlers()

      // Don't throw error on connection failure, just log it
      this.socket.once('connect', () => {
        logger.debug('✅ Socket connection established')
        this.isConnected = true
        this.isConnecting = false
      })

      this.socket.once('connect_error', (error) => {
        this.isConnecting = false
        // Only log if it's not a normal connection attempt or WebSocket closed error
        // Use debug instead of warn to prevent Sentry reporting (connection errors are expected)
        if (error.message && 
            !error.message.includes('xhr poll error') && 
            !error.message.includes('WebSocket is closed')) {
          logger.debug('⚠️ Socket connection failed, will retry:', error.message)
        }
      })

      // Set timeout to clear isConnecting flag
      setTimeout(() => {
        if (this.isConnecting) {
          this.isConnecting = false
        }
      }, 10000)

      return this.socket
    } catch (error) {
      // Use debug instead of warn to prevent Sentry reporting (connection failures are expected)
      logger.debug('⚠️ Socket connection setup failed:', error)
      return null
    }
  }

  setupEventHandlers() {
    // Remove existing handlers to prevent duplicates
    this.socket.removeAllListeners('connect')
    this.socket.removeAllListeners('disconnect')
    this.socket.removeAllListeners('connect_error')
    this.socket.removeAllListeners('reconnect')
    this.socket.removeAllListeners('reconnect_error')
    this.socket.removeAllListeners('reconnect_failed')

    this.socket.on('connect', () => {
      logger.debug('✅ Socket connected successfully')
      this.isConnected = true
      this.reconnectAttempts = 0
      this.emit('connect')
    })

    this.socket.on('disconnect', (reason) => {
      // Socket disconnections are expected (network issues, server timeouts, etc.)
      // The socket library automatically handles reconnection
      // Use debug level to avoid sending to Sentry (never use warn/error for disconnects)
      if (reason !== 'io client disconnect') {
        // Use debug instead of warn to prevent Sentry reporting
        logger.debug('Socket disconnected:', reason, '- Will attempt to reconnect automatically')
      }
      this.isConnected = false
      this.emit('disconnect', reason)
    })

    this.socket.on('connect_error', (error) => {
      // Don't log WebSocket closed errors as they're often transient
      // Use debug instead of error to prevent Sentry reporting (connection errors are expected)
      if (error.message && !error.message.includes('WebSocket is closed')) {
        logger.debug('❌ Socket connection error (will retry):', error.message)
      }
      this.reconnectAttempts++
      this.emit('connect_error', error)
    })

    this.socket.on('reconnect', (attemptNumber) => {
      logger.debug('✅ Socket reconnected after', attemptNumber, 'attempts')
      this.isConnected = true
      this.emit('reconnect', attemptNumber)
    })

    this.socket.on('reconnect_error', (error) => {
      // Use debug instead of error to prevent Sentry reporting (reconnection errors are expected)
      logger.debug('❌ Socket reconnection error (will retry):', error.message)
      this.emit('reconnect_error', error)
    })

    this.socket.on('reconnect_failed', () => {
      // Use debug instead of warn to prevent Sentry reporting (reconnection failures are expected)
      logger.debug('⚠️ Socket reconnection failed (max attempts reached)')
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
      // Use debug instead of warn to prevent Sentry reporting (not connected is expected)
      logger.debug('Socket not connected, cannot send data')
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
      // Remove all listeners before disconnecting to prevent errors
      this.socket.removeAllListeners()
      // Only disconnect if socket is actually connected or connecting
      if (this.socket.connected || this.socket.connecting) {
        this.socket.disconnect()
      }
      this.socket = null
      this.isConnected = false
      this.isConnecting = false
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
