import { io } from 'socket.io-client'

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
      return this.socket
    }

    try {
      const token = localStorage.getItem('founder_token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      this.socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
        path: '/socket.io/',
        transports: ['websocket'],
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

      return this.socket
    } catch (error) {
      console.error('Socket connection failed:', error)
      throw error
    }
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Socket connected successfully')
      this.isConnected = true
      this.reconnectAttempts = 0
      this.emit('connect')
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      this.isConnected = false
      this.emit('disconnect', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      this.reconnectAttempts++
      this.emit('connect_error', error)
    })

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts')
      this.isConnected = true
      this.emit('reconnect', attemptNumber)
    })

    this.socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error)
      this.emit('reconnect_error', error)
    })

    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed')
      this.emit('reconnect_failed')
    })

    // Forward all custom events to registered listeners
    this.socket.onAny((event, ...args) => {
      console.log('Socket event received:', event, args)
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
          console.error('Error in socket event callback:', error)
        }
      })
    }
  }

  // Send data to server
  send(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data)
    } else {
      console.warn('Socket not connected, cannot send data')
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
