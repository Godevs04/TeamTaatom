import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { UserType } from '../types/user';

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
    return !!token;
  } catch (error) {
    return false;
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

// Forgot password (if needed for future)
export const forgotPassword = async (email: string): Promise<AuthResponse> => {
  try {
    // This endpoint would need to be implemented in the backend
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to send password reset email');
  }
};