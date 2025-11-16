import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createPerformanceInterceptor } from '../utils/performance';

// Request throttling to prevent rate limiting
const requestQueue = new Map();
const REQUEST_DELAY = 100; // 100ms delay between requests

// Store CSRF token in memory (updated from response headers)
let csrfToken: string | null = null;

// Create axios instance
const API_BASE_URL =
  Constants.expoConfig?.extra?.API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies for web (httpOnly cookies)
});

// Add performance monitoring interceptor
const performanceInterceptor = createPerformanceInterceptor();
api.interceptors.request.use(performanceInterceptor.request);
api.interceptors.response.use(performanceInterceptor.response, performanceInterceptor.error);

// Request interceptor to add auth token and throttling
api.interceptors.request.use(
  async (config) => {
    try {
      // Only log in development and for non-GET requests or errors
      if (process.env.NODE_ENV === 'development' && config.method?.toUpperCase() !== 'GET') {
        console.log('API Request:', config.method?.toUpperCase(), config.url);
      }
      
      // Add throttling to prevent rate limiting
      const requestKey = `${config.method}-${config.url}`;
      const lastRequestTime = requestQueue.get(requestKey) || 0;
      const timeSinceLastRequest = Date.now() - lastRequestTime;
      
      if (timeSinceLastRequest < REQUEST_DELAY) {
        const delay = REQUEST_DELAY - timeSinceLastRequest;
        // Only log throttling in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`Throttling request to ${config.url}, waiting ${delay}ms`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      requestQueue.set(requestKey, Date.now());
      
      // For web, try cookies first (sent automatically), fallback to sessionStorage
      // For mobile, get token from AsyncStorage
      if (Platform.OS === 'web') {
        // Check sessionStorage as fallback if cookie didn't work (cross-origin)
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const token = window.sessionStorage.getItem('authToken');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        // Cookies are sent automatically with withCredentials: true
      } else {
        // Mobile: Get from AsyncStorage
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      
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
          if (process.env.NODE_ENV === 'development') {
            console.warn('CSRF token not found for', config.method, config.url);
          }
        }
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
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
    
    // Only log errors or non-200 responses in development
    if (process.env.NODE_ENV === 'development' && response.status !== 200) {
      console.log('API Response:', response.status, response.config.url);
    }
    
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Only log non-400 and non-409 errors to reduce noise
    if (error.response?.status !== 400 && error.response?.status !== 409) {
      console.error('API Error:', error.response?.status, error.config?.url, error.message);
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
        console.log(`Rate limited, retrying in ${delay}ms (attempt ${originalRequest._retryCount}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return api(originalRequest);
      } else {
        console.error('Max retries reached for rate limiting');
        return Promise.reject(new Error('Too many requests. Please try again later.'));
      }
    }
    
    if (
      error.response?.status === 401 &&
      error.config?.url &&
      (error.config.url.endsWith('/auth/me') || error.config.url.endsWith('/auth/refresh'))
    ) {
      // Token expired or invalid, clear storage
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
    }
    return Promise.reject(error);
  }
);

export default api;
