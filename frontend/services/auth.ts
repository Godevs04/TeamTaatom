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

// Get current user
export const getCurrentUser = async (): Promise<UserType | null> => {
  try {
    const response = await api.get('/auth/me');
    const user = response.data.user;
    
    // Update stored user data
    await AsyncStorage.setItem('userData', JSON.stringify(user));
    
    return user;
  } catch (error) {
    return null;
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
    if (!token) return false;
    
    // Validate token with server
    const user = await getCurrentUser();
    return !!user;
  } catch (error) {
    // If token is invalid, clear storage
    await signOut();
    return false;
  }
};

// Initialize auth state on app launch
export const initializeAuth = async (): Promise<UserType | null> => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) return null;
    
    // Validate token and get current user
    const user = await getCurrentUser();
    if (!user) {
      // Token is invalid, clear storage
      await signOut();
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Auth initialization error:', error);
    await signOut();
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