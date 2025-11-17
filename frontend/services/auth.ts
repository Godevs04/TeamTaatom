import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { UserType } from '../types/user';
import logger from '../utils/logger';
import { Platform } from 'react-native';
import { isRateLimitError, handleRateLimitError } from '../utils/rateLimitHandler';

const isWeb = Platform.OS === 'web';

export interface SignUpData {
  fullName: string;
  username: string;
  email: string;
  password: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface VerifyOTPData {
  email: string;
  otp: string;
}

export interface AuthResponse {
  message: string;
  token?: string;
  user?: UserType;
  email?: string;
}

// Sign up user
export const signUp = async (data: SignUpData): Promise<AuthResponse> => {
  try {
    const response = await api.post('/api/v1/auth/signup', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Sign up failed');
  }
};

// Check username availability
export const checkUsernameAvailability = async (username: string): Promise<{ available: boolean }> => {
  try {
    const response = await api.get('/api/v1/auth/check-username', { params: { username } });
    return response.data;
  } catch (error: any) {
    // On network/server error, treat as not available to be safe
    return { available: false };
  }
};

// Verify OTP
export const verifyOTP = async (data: VerifyOTPData): Promise<AuthResponse> => {
  try {
    const response = await api.post('/api/v1/auth/verify-otp', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'OTP verification failed');
  }
};

// Resend OTP
export const resendOTP = async (email: string): Promise<AuthResponse> => {
  try {
    const response = await api.post('/api/v1/auth/resend-otp', { email });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to resend OTP');
  }
};

// Sign in user
export const signIn = async (data: SignInData): Promise<AuthResponse> => {
  try {
    // Debug: Log the API base URL being used
    // @ts-ignore
    logger.debug('API_BASE_URL:', require('./api').default.defaults.baseURL);
    const response = await api.post('/api/v1/auth/signin', data);
    const { token, user } = response.data;
    
    // Store token and user data
    // For web: Store in both sessionStorage (for socket.io) and AsyncStorage (for consistency)
    // For mobile: Store in AsyncStorage
    if (token) {
      if (isWeb) {
        // Web: Store in sessionStorage for socket.io access (can't read httpOnly cookies)
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem('authToken', token);
        }
        // Also store in AsyncStorage for consistency
        await AsyncStorage.setItem('authToken', token);
      } else {
        // Mobile: Store in AsyncStorage
        await AsyncStorage.setItem('authToken', token);
      }
    }
    
    if (user) {
      await AsyncStorage.setItem('userData', JSON.stringify(user));
    }
    
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Sign in failed');
  }
};

let lastAuthError: string | null = null;

// Get current user
export const getCurrentUser = async (): Promise<UserType | null | 'network-error'> => {
  try {
    // For web, check sessionStorage (fallback for cross-origin) or cookies (same origin)
    // For mobile, check AsyncStorage
    if (!isWeb) {
      // Mobile: Check AsyncStorage
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        return null;
      }
    }
    
    const response = await api.get('/api/v1/auth/me');
    const user = response.data.user;
    await AsyncStorage.setItem('userData', JSON.stringify(user));
    lastAuthError = null;
    return user;
  } catch (error: any) {
    // Handle rate limiting specifically
    if (isRateLimitError(error)) {
      const rateLimitInfo = handleRateLimitError(error, 'getCurrentUser');
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Rate limited in getCurrentUser:', rateLimitInfo.message);
      }
      return 'network-error';
    }
    
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      // Token is invalid
      lastAuthError = 'Session expired. Please sign in again.';
      return null;
    }
    // Network or other error - don't sign out, just return network error
    lastAuthError = error?.message || 'Network or unknown error';
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Network error in getCurrentUser:', error?.message || error);
    }
    return 'network-error';
  }
};

// Get user from storage
export const getUserFromStorage = async (): Promise<UserType | null> => {
  try {
    const userData = await AsyncStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    return null;
  }
};

// Check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    // For web, check sessionStorage or cookies via API call
    // For mobile, check AsyncStorage
    if (isWeb) {
      // Check sessionStorage first (fallback for cross-origin)
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const token = window.sessionStorage.getItem('authToken');
        if (token) {
          // Token exists, verify with API
          const user = await getCurrentUser();
          return user !== null && user !== 'network-error';
        }
      }
      // No token in sessionStorage, try API call (cookies should be sent)
      const user = await getCurrentUser();
      return user !== null && user !== 'network-error';
    }
    
    // Mobile: Check AsyncStorage
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      return false;
    }
    
    // First check if we have stored user data
    const storedUser = await getUserFromStorage();
    if (storedUser) {
      return true;
    }
    
    // If no stored user, validate token with server
    const user = await getCurrentUser();
    if (user === 'network-error') {
      // Network error - still consider authenticated if we have token
      return true;
    }
    return !!user;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      logger.error('[isAuthenticated] Error:', error);
    }
    // Don't automatically sign out on error, just return false
    return false;
  }
};

// Initialize auth state on app launch
export const initializeAuth = async (): Promise<UserType | null | 'network-error'> => {
  try {
    // For web, sync token from AsyncStorage to sessionStorage for socket.io access
    if (isWeb) {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token && typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem('authToken', token);
        }
      } catch (e) {
        // Ignore errors
      }
      return await getCurrentUser();
    }
    
    const token = await AsyncStorage.getItem('authToken');
    if (process.env.NODE_ENV === 'development') {
      logger.debug('[initializeAuth] Token in storage:', token ? 'exists' : 'missing');
    }
    if (!token) return null;
    
    // First, try to get user from storage
    const storedUser = await getUserFromStorage();
    if (storedUser) {
      // Found stored user, keeping signed in
      // Return stored user immediately, then validate in background
      getCurrentUser().catch(error => {
        if (process.env.NODE_ENV === 'development') {
          logger.warn('[initializeAuth] Background validation failed:', error);
        }
        // Don't sign out on background validation failure
      });
      return storedUser;
    }
    
    // If no stored user, try to get from server
    const user = await getCurrentUser();
    if (user === null) {
      // Token is invalid, clear storage
      await signOut();
      return null;
    }
    if (user === 'network-error') {
      // Network error, keep user signed in (return special value)
      return 'network-error';
    }
    return user;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      logger.error('Auth initialization error:', error);
    }
    // Don't sign out on initialization error, try to get from storage
    const storedUser = await getUserFromStorage();
    if (storedUser) {
      // Fallback to stored user after error
      return storedUser;
    }
    return null;
  }
};

// Sign out user
export const signOut = async (): Promise<void> => {
  try {
    // For web, call logout endpoint to clear httpOnly cookie
    if (isWeb) {
      try {
        await api.post('/api/v1/auth/logout');
      } catch (error) {
        // Continue even if logout endpoint fails
        logger.warn('Logout endpoint failed, clearing local storage');
      }
      
      // Clear sessionStorage (fallback for cross-origin)
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem('authToken');
      }
    }
    
    // Clear local storage (mobile) or as fallback (web)
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('userData');
  } catch (error) {
    console.error('Error signing out:', error);
  }
};

// Forgot password
export const forgotPassword = async (email: string): Promise<AuthResponse> => {
  try {
    // Forgot password request
    api.defaults.headers['User-Agent'] = Platform.OS === 'ios' ? 'iOS-App/1.0' : 'Android-App/1.0';
    const response = await api.post('/api/v1/auth/forgot-password', { email });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('Email not found');
    }
    console.error("Error in forgotPassword:", error);
    throw new Error(error.response?.data?.message || 'An error occurred while processing your request');
  }
};

export const getLastAuthError = () => lastAuthError;

// Force refresh authentication state
export const refreshAuthState = async (): Promise<UserType | null> => {
  try {
    // For web, check sessionStorage or cookies (via API call)
    // For mobile, check AsyncStorage
    if (isWeb) {
      // On web, tokens are in httpOnly cookies or sessionStorage
      // Just call getCurrentUser - it will use cookies automatically
      const user = await getCurrentUser();
      if (user && user !== 'network-error') {
        // Successfully refreshed auth state
        return user;
      }
      
      // If network error, return stored user
      if (user === 'network-error') {
        const storedUser = await getUserFromStorage();
        // Network error, returning stored user
        return storedUser;
      }
      
      return null;
    }
    
    // Mobile: Check AsyncStorage
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      // No token found
      return null;
    }
    
    const user = await getCurrentUser();
    if (user && user !== 'network-error') {
      // Successfully refreshed auth state
      return user;
    }
    
    // If network error, return stored user
    if (user === 'network-error') {
      const storedUser = await getUserFromStorage();
      // Network error, returning stored user
      return storedUser;
    }
    
    return null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[refreshAuthState] Error:', error);
    }
    return null;
  }
};