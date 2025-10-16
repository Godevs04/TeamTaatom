import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { UserType } from '../types/user';
import { Platform } from 'react-native';

export interface SignUpData {
  fullName: string;
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
    const response = await api.post('/auth/signup', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Sign up failed');
  }
};

// Verify OTP
export const verifyOTP = async (data: VerifyOTPData): Promise<AuthResponse> => {
  try {
    const response = await api.post('/auth/verify-otp', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'OTP verification failed');
  }
};

// Resend OTP
export const resendOTP = async (email: string): Promise<AuthResponse> => {
  try {
    const response = await api.post('/auth/resend-otp', { email });
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
    console.log('API_BASE_URL:', require('./api').default.defaults.baseURL);
    const response = await api.post('/auth/signin', data);
    const { token, user } = response.data;
    
    // Store token and user data
    if (token) {
      await AsyncStorage.setItem('authToken', token);
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
    const token = await AsyncStorage.getItem('authToken');
    console.log('[getCurrentUser] Token in storage:', token);
    if (!token) {
      console.log('[getCurrentUser] No token found');
      return null;
    }
    
    const response = await api.get('/auth/me');
    console.log('[getCurrentUser] /auth/me response:', response.data);
    const user = response.data.user;
    await AsyncStorage.setItem('userData', JSON.stringify(user));
    lastAuthError = null;
    return user;
  } catch (error: any) {
    if (error?.response) {
      console.log('[getCurrentUser] /auth/me error:', error.response.status, error.response.data);
    } else {
      console.log('[getCurrentUser] /auth/me network or unknown error:', error?.message || error);
    }
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      // Token is invalid
      lastAuthError = 'Session expired. Please sign in again.';
      return null;
    }
    // Network or other error - don't sign out, just return network error
    lastAuthError = error?.message || 'Network or unknown error';
    console.warn('Network or unknown error in getCurrentUser:', error?.message || error);
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
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      console.log('[isAuthenticated] No token found');
      return false;
    }
    
    // First check if we have stored user data
    const storedUser = await getUserFromStorage();
    if (storedUser) {
      console.log('[isAuthenticated] Found stored user, returning true');
      return true;
    }
    
    // If no stored user, validate token with server
    const user = await getCurrentUser();
    if (user === 'network-error') {
      // Network error - still consider authenticated if we have token
      console.log('[isAuthenticated] Network error but have token, returning true');
      return true;
    }
    return !!user;
  } catch (error) {
    console.error('[isAuthenticated] Error:', error);
    // Don't automatically sign out on error, just return false
    return false;
  }
};

// Initialize auth state on app launch
export const initializeAuth = async (): Promise<UserType | null | 'network-error'> => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    console.log('[initializeAuth] Token in storage:', token);
    if (!token) return null;
    
    // First, try to get user from storage
    const storedUser = await getUserFromStorage();
    if (storedUser) {
      console.log('[initializeAuth] Found stored user, keeping signed in');
      // Return stored user immediately, then validate in background
      getCurrentUser().catch(error => {
        console.log('[initializeAuth] Background validation failed:', error);
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
    console.error('Auth initialization error:', error);
    // Don't sign out on initialization error, try to get from storage
    const storedUser = await getUserFromStorage();
    if (storedUser) {
      console.log('[initializeAuth] Fallback to stored user after error');
      return storedUser;
    }
    return null;
  }
};

// Sign out user
export const signOut = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('userData');
  } catch (error) {
    console.error('Error signing out:', error);
  }
};

// Forgot password
export const forgotPassword = async (email: string): Promise<AuthResponse> => {
  try {
    console.log("Forgot password request for email:", email);
    api.defaults.headers['User-Agent'] = Platform.OS === 'ios' ? 'iOS-App/1.0' : 'Android-App/1.0';
    const response = await api.post('/auth/forgot-password', { email });
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
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      console.log('[refreshAuthState] No token found');
      return null;
    }
    
    const user = await getCurrentUser();
    if (user && user !== 'network-error') {
      console.log('[refreshAuthState] Successfully refreshed auth state');
      return user;
    }
    
    // If network error, return stored user
    if (user === 'network-error') {
      const storedUser = await getUserFromStorage();
      console.log('[refreshAuthState] Network error, returning stored user');
      return storedUser;
    }
    
    return null;
  } catch (error) {
    console.error('[refreshAuthState] Error:', error);
    return null;
  }
};