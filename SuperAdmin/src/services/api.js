import axios from 'axios'
import logger from '../utils/logger'
import { parseError } from '../utils/errorCodes'
import rateLimiter from '../utils/rateLimiter'

// PRODUCTION-GRADE: Use environment variable, no hardcoded fallbacks for production
// In development, Vite proxy will handle /api requests (empty string = relative path)
// In production, use the full API URL from environment variable
//
// NOTE: import.meta.env.PROD and import.meta.env.DEV are BUILT-IN Vite variables
// They are automatically set by Vite based on build mode:
// - PROD = true when running "npm run build" (production)
// - DEV = true when running "npm run dev" (development)
// You DON'T need to (and can't) set these in .env file
const isProduction = import.meta.env.PROD;
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'http://localhost:3000');

// Debug logging to help diagnose environment variable issues
if (isProduction) {
  console.log('🔍 Environment Check:', {
    PROD: import.meta.env.PROD,
    MODE: import.meta.env.MODE,
    VITE_API_URL: import.meta.env.VITE_API_URL ? '✅ Set' : '❌ Missing',
    API_BASE_URL: API_BASE_URL || '❌ Not configured'
  });
}

// Validate production configuration
if (isProduction && !import.meta.env.VITE_API_URL) {
  const errorMessage = [
    '❌ ERROR: VITE_API_URL is required for production builds!',
    '',
    '📋 To fix this issue:',
    '1. Go to your Vercel project dashboard',
    '2. Navigate to Settings → Environment Variables',
    '3. Add VITE_API_URL with your API URL (e.g., https://your-api-domain.com)',
    '4. Make sure it\'s set for "Production" environment',
    '5. Redeploy your application',
    '',
    '⚠️  Note: Vite environment variables must be set BEFORE building.',
    '   If you set it after deployment, you must redeploy for it to take effect.'
  ].join('\n');
  
  logger.error(errorMessage);
  console.error(errorMessage);
  throw new Error('VITE_API_URL environment variable is required for production builds. Please set it in Vercel and redeploy.');
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // Increased timeout to 15 seconds
  headers: {
    'Content-Type': 'application/json',
  },
})

// CSRF token management
let csrfToken = null

const getCsrfToken = async () => {
  try {
    // Only fetch CSRF token if user is authenticated
    const token = localStorage.getItem('founder_token')
    if (!token) {
      return null
    }

    if (!csrfToken) {
      // Try to get CSRF token from cookie first (if set by backend)
      const cookies = document.cookie.split(';')
      const csrfCookie = cookies.find(c => c.trim().startsWith('csrf-token='))
      if (csrfCookie) {
        csrfToken = csrfCookie.split('=')[1]
        return csrfToken
      }
      
      // If not in cookie, try to fetch from backend endpoint (if exists)
      // Only if we have an auth token
      try {
        const response = await api.get('/api/v1/superadmin/csrf-token', {
          skipAuthRedirect: true,
          skipRateLimit: true
        })
        if (response?.data?.csrfToken) {
          csrfToken = response.data.csrfToken
        }
      } catch (err) {
        // Silently fail - endpoint might not exist or user not authenticated
        // Don't log as error to avoid console spam
        if (err.response?.status !== 401) {
          logger.debug('CSRF token endpoint not available, using cookie-based CSRF if configured')
        }
      }
    }
    return csrfToken
  } catch (error) {
    // Only log non-401 errors
    if (error.response?.status !== 401) {
      logger.warn('Failed to fetch CSRF token:', error)
    }
    return null
  }
}

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    // Skip rate limiting for certain endpoints
    const skipRateLimit = config.skipRateLimit || 
      config.url?.includes('/verify-2fa') || 
      config.url?.includes('/resend-2fa') ||
      config.url?.includes('/login')
    
    // Check rate limit
    if (!skipRateLimit) {
      const endpoint = config.url || 'default'
      if (!rateLimiter.isAllowed(endpoint)) {
        const error = new Error('Rate limit exceeded. Please wait before making more requests.')
        error.code = 'RATE_5001'
        error.response = {
          status: 429,
          data: {
            error: {
              code: 'RATE_5001',
              message: 'Too many requests. Please wait before making more requests.'
            }
          }
        }
        logger.warn('Rate limit exceeded for:', endpoint)
        return Promise.reject(error)
      }
    }
    
    // Don't add Authorization header for 2FA endpoints
    const is2FAEndpoint = config.url?.includes('/verify-2fa') || config.url?.includes('/resend-2fa') || config.url?.includes('/login')
    
    if (!is2FAEndpoint) {
      const token = localStorage.getItem('founder_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    
    // Add CSRF token for state-changing requests (POST, PUT, PATCH, DELETE)
    // Only if user is authenticated
    if (!config.skipCsrf && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
      const authToken = localStorage.getItem('founder_token')
      if (authToken) {
        const token = await getCsrfToken()
        if (token) {
          config.headers['X-CSRF-Token'] = token
        }
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
  async (error) => {
    // Skip logging for canceled requests (AbortController)
    const isCanceled = error.code === 'ERR_CANCELED' || 
                      error.message === 'canceled' || 
                      error.message?.toLowerCase().includes('canceled') ||
                      error.name === 'CanceledError' ||
                      error.name === 'AbortError'
    
    if (isCanceled) {
      // Silently ignore canceled requests - they're intentional
      return Promise.reject(error)
    }
    
    const parsedError = parseError(error)
    logger.error('API Error:', parsedError.code, parsedError.message, error.config?.url)
    
    if (error.response?.status === 401) {
      // Don't redirect for 2FA endpoints - let the frontend handle the error
      const is2FAEndpoint = error.config?.url?.includes('/verify-2fa') || 
                           error.config?.url?.includes('/resend-2fa') ||
                           error.config?.url?.includes('/login')
      
      if (!is2FAEndpoint) {
        // Clear token and auth header
        localStorage.removeItem('founder_token')
        delete api.defaults.headers.common['Authorization']
        csrfToken = null // Clear CSRF token on auth failure
        
        // Only redirect if not already on login page to prevent infinite loops
        if (window.location.pathname !== '/login') {
          // Use a small delay to ensure state is cleared
          setTimeout(() => {
            window.location.href = '/login'
          }, 100)
        }
      }
    }
    
    // Handle CSRF token errors
    if (error.response?.status === 403 && error.response?.data?.message?.includes('CSRF')) {
      logger.warn('CSRF token invalid, fetching new token')
      csrfToken = null // Force refresh on next request
    }
    
    // Handle token expiration specifically
    if (error.response?.status === 401 && error.response?.data?.message?.includes('expired')) {
      logger.warn('Token expired, redirecting to login')
    }
    
    // Attach parsed error to the error object for easier handling
    error.parsedError = parsedError
    return Promise.reject(error)
  }
)

export default api
