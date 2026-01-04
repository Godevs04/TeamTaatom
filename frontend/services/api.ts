import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createPerformanceInterceptor } from '../utils/performance';
import { getApiBaseUrl } from '../utils/config';
import logger from '../utils/logger';
import { parseError } from '../utils/errorCodes';

// Request throttling to prevent rate limiting
const requestQueue = new Map();
const REQUEST_DELAY = 100; // 100ms delay between requests

// Store CSRF token in memory (updated from response headers)
let csrfToken: string | null = null;

// Create axios instance - baseURL will be updated dynamically in interceptor
// Use getApiBaseUrl() to ensure fresh URL on every request
const initialBaseUrl = getApiBaseUrl();
const api = axios.create({
  baseURL: initialBaseUrl, // Get fresh URL at creation time
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies for web (httpOnly cookies)
});

// Log initial baseURL for debugging
if (Platform.OS === 'web') {
  logger.debug(`[API] 🚀 Initialized with baseURL: ${initialBaseUrl}`);
  logger.debug(`[API] 🚀 Environment check - EXPO_PUBLIC_API_BASE_URL:`, process.env.EXPO_PUBLIC_API_BASE_URL);
}

// Add performance monitoring interceptor
const performanceInterceptor = createPerformanceInterceptor();
api.interceptors.request.use(performanceInterceptor.request);
api.interceptors.response.use(performanceInterceptor.response, performanceInterceptor.error);

// Request interceptor to add auth token and throttling
api.interceptors.request.use(
  async (config) => {
    try {
      // CRITICAL: Update baseURL dynamically on every request for web auto-detection
      // This ensures we always use the correct IP, even if it changes
      const dynamicBaseUrl = getApiBaseUrl();
      if (config.baseURL !== dynamicBaseUrl) {
        config.baseURL = dynamicBaseUrl;
        if (process.env.NODE_ENV === 'development' && Platform.OS === 'web') {
          logger.debug(`[API] 🔄 Updated baseURL to: ${dynamicBaseUrl}`);
        }
      }
      
      // Log requests in development
      logger.debug('API Request', { method: config.method?.toUpperCase(), url: config.url, baseURL: config.baseURL });
      
      // Add throttling to prevent rate limiting
      const requestKey = `${config.method}-${config.url}`;
      const lastRequestTime = requestQueue.get(requestKey) || 0;
      const timeSinceLastRequest = Date.now() - lastRequestTime;
      
      if (timeSinceLastRequest < REQUEST_DELAY) {
        const delay = REQUEST_DELAY - timeSinceLastRequest;
        logger.debug(`Throttling request to ${config.url}, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      requestQueue.set(requestKey, Date.now());
      
      // For web: httpOnly cookies are sent automatically with withCredentials: true
      // For mobile: Get token from AsyncStorage
      if (Platform.OS !== 'web') {
        // Mobile: Get from AsyncStorage
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      // Web: Cookies are sent automatically with withCredentials: true - no manual token needed
      
      // Add platform header for backend to detect web vs mobile
      config.headers['X-Platform'] = Platform.OS;
      
      // Add CSRF token for web (always read from cookie - it's updated on every response)
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        // Always read from cookie (backend updates it on every response)
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('csrf-token='))
          ?.split('=')[1];
        
        // Fallback to memory if cookie not available
        const finalToken = token || csrfToken;
        
        if (finalToken) {
          config.headers['X-CSRF-Token'] = finalToken;
        } else if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase() || '')) {
          // For state-changing requests, we need CSRF token
          // If not found, log warning (but don't block - backend will handle it)
          logger.warn('CSRF token not found', { method: config.method, url: config.url });
        }
      }
    } catch (error) {
      logger.error('Error getting auth token:', error);
    }
    return config;
  },
  async (error) => {
    // Report errors to crash reporting
    if (error.response) {
      // Server responded with error
      const { captureException } = await import('./crashReporting');
      captureException(new Error(`API Error: ${error.response.status} - ${error.config?.url}`), {
        status: error.response.status,
        url: error.config?.url,
        method: error.config?.method,
        data: error.response.data,
      });
    } else if (error.request) {
      // Request made but no response
      const { captureException } = await import('./crashReporting');
      captureException(new Error(`Network Error: ${error.config?.url}`), {
        url: error.config?.url,
        method: error.config?.method,
      });
    }
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors and retry logic
api.interceptors.response.use(
  (response) => {
    // Store CSRF token from response header for web
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const tokenFromHeader = response.headers['x-csrf-token'];
      if (tokenFromHeader) {
        // Store in memory for immediate use
        csrfToken = tokenFromHeader;
        // Also store in cookie as backup
        document.cookie = `csrf-token=${tokenFromHeader}; path=/; SameSite=Lax; max-age=3600`;
      }
    }
    
    // Log non-200 responses
    if (response.status !== 200) {
      logger.debug('API Response', { status: response.status, url: response.config.url });
    }
    
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401 && !originalRequest._retry && !(originalRequest as any)._skipAuthRefresh) {
      // Don't try to refresh if this IS the refresh endpoint (prevent infinite loop)
      if (originalRequest.url?.includes('/auth/refresh')) {
        // Refresh endpoint failed - clear auth
        // Clear token from AsyncStorage (mobile) or rely on backend to clear httpOnly cookie (web)
        await AsyncStorage.removeItem('authToken');
        await AsyncStorage.removeItem('userData');
        return Promise.reject(error);
      }
      
      // Don't try to refresh if endpoint doesn't exist (404)
      if (error.response?.status === 404 && originalRequest.url?.includes('/auth/refresh')) {
        // Refresh endpoint doesn't exist - don't retry
        return Promise.reject(error);
      }
      
      // Don't retry delete account requests - password errors should fail immediately
      if (originalRequest.url?.includes('/users/me') && originalRequest.method?.toLowerCase() === 'delete') {
        // This is likely a password error, not an auth error - don't retry
        return Promise.reject(error);
      }
      
      originalRequest._retry = true;
      
      // Try to refresh token (only for non-auth endpoints that need auth)
      if (!originalRequest.url?.includes('/auth/')) {
        try {
          // Try to refresh token (mark config to prevent infinite loop)
          const refreshConfig: any = { _skipAuthRefresh: true };
          const refreshResponse = await api.post('/api/v1/auth/refresh', {}, refreshConfig);
          const { token } = refreshResponse.data;
          
          if (token) {
            // Update token in storage
            // For web: Backend should set httpOnly cookie, but store in AsyncStorage for socket.io compatibility
            // For mobile: Store in AsyncStorage
            await AsyncStorage.setItem('authToken', token);
            
            // Update socket token if connected
            try {
              const { socketService } = await import('./socket');
              // Reconnect socket with new token
              await socketService.disconnect();
              await socketService.connect();
            } catch (socketError) {
              // Ignore socket errors
            }
            
            // Retry original request with new token
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            originalRequest._retry = false; // Reset retry flag for the retry
            return api(originalRequest);
          }
        } catch (refreshError: any) {
          // If refresh endpoint doesn't exist (404), don't clear auth - just reject
          if (refreshError.response?.status === 404) {
            // Refresh endpoint not implemented - just reject without clearing auth
            return Promise.reject(error);
          }
          
          // Refresh failed - clear auth
          // For web: Backend should clear httpOnly cookie, but also clear AsyncStorage
          // For mobile: Clear AsyncStorage
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('userData');
          
          // Disconnect socket
          try {
            const { socketService } = await import('./socket');
            await socketService.disconnect();
          } catch (socketError) {
            // Ignore socket errors
          }
          
          // Don't redirect here - let the app handle it
          return Promise.reject(error);
        }
      }
      
      // For auth endpoints or if refresh failed, just reject
      return Promise.reject(error);
    }
    
    // Parse and log errors (skip 400, 409, and 401 on refresh to reduce noise)
    const isRefresh401 = error.response?.status === 401 && error.config?.url?.includes('/auth/refresh');
    const isAuth401 = error.response?.status === 401 && error.config?.url?.includes('/auth/');
    
    if (error.response?.status !== 400 && error.response?.status !== 409 && !isRefresh401) {
      const parsedError = parseError(error);
      // Only log as error if it's not an expected auth error
      if (!isAuth401) {
        // Create proper Error instance with meaningful message for Sentry tracking
        const errorMessage = `${parsedError.code}: ${parsedError.message}`;
        const errorToLog = new Error(errorMessage);
        logger.error('API Error:', errorToLog, {
          code: parsedError.code,
          message: parsedError.message,
          userMessage: parsedError.userMessage,
          url: error.config?.url,
          status: error.response?.status,
        });
      } else {
        // Log auth errors as debug to reduce noise
        logger.debug('API Auth Error:', { code: parsedError.code, url: error.config?.url });
      }
      error.parsedError = parsedError;
    } else {
      // Still parse errors for 400/409/refresh-401 but don't log as errors
      const parsedError = parseError(error);
      error.parsedError = parsedError;
      if (isRefresh401) {
        // Refresh token expired - this is expected, just debug log
        logger.debug('Refresh token expired or invalid:', error.config?.url);
      }
    }
    
    // Handle rate limiting (429) with retry logic
    if (error.response?.status === 429 && !originalRequest._retry) {
      originalRequest._retry = true;
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      
      // Maximum retry attempts
      const maxRetries = 3;
      if (originalRequest._retryCount <= maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, originalRequest._retryCount - 1) * 1000;
        logger.debug(`Rate limited, retrying in ${delay}ms (attempt ${originalRequest._retryCount}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return api(originalRequest);
      } else {
        logger.error('Max retries reached for rate limiting');
        return Promise.reject(new Error('Too many requests. Please try again later.'));
      }
    }
    
    // Handle server errors (5xx) with retry logic for GET requests
    if (error.response?.status >= 500 && error.response?.status < 600 && !originalRequest._retry) {
      // Only retry GET requests (safe to retry)
      const isGetRequest = originalRequest.method?.toUpperCase() === 'GET';
      if (isGetRequest) {
        originalRequest._retry = true;
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
        
        const maxRetries = 2; // Fewer retries for server errors
        if (originalRequest._retryCount <= maxRetries) {
          // Exponential backoff: 2s, 4s
          const delay = Math.pow(2, originalRequest._retryCount) * 1000;
          logger.debug(`Server error ${error.response.status}, retrying in ${delay}ms (attempt ${originalRequest._retryCount}/${maxRetries})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return api(originalRequest);
        }
      }
    }
    
    // Handle network errors (no response) with retry logic
    if (!error.response && error.request && !originalRequest._retry) {
      // Network error - retry for all request types
      originalRequest._retry = true;
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      
      const maxRetries = 2; // Retry network errors
      if (originalRequest._retryCount <= maxRetries) {
        // Exponential backoff: 1s, 2s
        const delay = Math.pow(2, originalRequest._retryCount - 1) * 1000;
        logger.debug(`Network error, retrying in ${delay}ms (attempt ${originalRequest._retryCount}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return api(originalRequest);
      } else {
        // After max retries, provide user-friendly error
        const parsedError = parseError(error);
        return Promise.reject(new Error(parsedError.userMessage || 'Unable to connect to the server. Please check your internet connection.'));
      }
    }
    
    // Handle 401 for auth endpoints (after refresh attempt failed)
    if (
      error.response?.status === 401 &&
      error.config?.url &&
      (error.config.url.includes('/auth/me') || error.config.url.includes('/auth/refresh'))
    ) {
      // Token expired or invalid, clear storage
      // For web: Backend should clear httpOnly cookie, but also clear AsyncStorage
      // For mobile: Clear AsyncStorage
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
    }
    return Promise.reject(error);
  }
);

export default api;
