import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createPerformanceInterceptor } from '../utils/performance';

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

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      console.log('API Request:', config.method?.toUpperCase(), config.url);
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

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  async (error) => {
    // Only log non-400 errors to reduce noise
    if (error.response?.status !== 400) {
      console.error('API Error:', error.response?.status, error.config?.url, error.message);
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
