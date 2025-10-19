import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createPerformanceInterceptor } from '../utils/performance';

// Request throttling to prevent rate limiting
const requestQueue = new Map();
const REQUEST_DELAY = 100; // 100ms delay between requests

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
});

// Add performance monitoring interceptor
const performanceInterceptor = createPerformanceInterceptor();
api.interceptors.request.use(performanceInterceptor.request);
api.interceptors.response.use(performanceInterceptor.response, performanceInterceptor.error);

// Request interceptor to add auth token and throttling
api.interceptors.request.use(
  async (config) => {
    try {
      console.log('API Request:', config.method?.toUpperCase(), config.url);
      
      // Add throttling to prevent rate limiting
      const requestKey = `${config.method}-${config.url}`;
      const lastRequestTime = requestQueue.get(requestKey) || 0;
      const timeSinceLastRequest = Date.now() - lastRequestTime;
      
      if (timeSinceLastRequest < REQUEST_DELAY) {
        const delay = REQUEST_DELAY - timeSinceLastRequest;
        console.log(`Throttling request to ${config.url}, waiting ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      requestQueue.set(requestKey, Date.now());
      
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors and retry logic
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
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
