import axios from 'axios'
import logger from '../utils/logger'
import { parseError } from '../utils/errorCodes'

// Use environment variable if set, otherwise use relative path for Vite proxy
// In development, Vite proxy will handle /api requests
// In production, use the full API URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'http://localhost:3000')

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // Increased timeout to 15 seconds
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Don't add Authorization header for 2FA endpoints
    const is2FAEndpoint = config.url?.includes('/verify-2fa') || config.url?.includes('/resend-2fa') || config.url?.includes('/login')
    
    if (!is2FAEndpoint) {
      const token = localStorage.getItem('founder_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    
    logger.debug('API Request:', config.method?.toUpperCase(), config.url)
    return config
  },
  (error) => {
    logger.error('Request interceptor error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    logger.debug('API Response:', response.status, response.config.url)
    return response
  },
  (error) => {
    const parsedError = parseError(error)
    logger.error('API Error:', parsedError.code, parsedError.message, error.config?.url)
    
    if (error.response?.status === 401) {
      localStorage.removeItem('founder_token')
      // Only redirect if not already on login page to prevent infinite loops
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    
    // Attach parsed error to the error object for easier handling
    error.parsedError = parsedError
    return Promise.reject(error)
  }
)

export default api
