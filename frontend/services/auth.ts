import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { UserType } from '../types/user';
import logger from '../utils/logger';
import { Platform } from 'react-native';
import { isRateLimitError, handleRateLimitError } from '../utils/rateLimitHandler';
import { parseError } from '../utils/errorCodes';

const isWeb = Platform.OS === 'web';

export interface SignUpData {
  fullName: string;
  username: string;
  email: string;
  password: string;
  termsAccepted?: boolean;
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
    // Use error code parser for user-friendly messages
    const parsedError = parseError(error);
    // Preserve the error code and original error so it can be detected upstream
    const newError = new Error(parsedError.userMessage);
    (newError as any).parsedError = parsedError;
    (newError as any).originalError = error;
    throw newError;
  }
};

// Check username availability
export const checkUsernameAvailability = async (username: string): Promise<{ available?: boolean; error?: string }> => {
  try {
    const response = await api.get('/api/v1/auth/check-username', { params: { username } });
    
    // Backend returns { success: boolean, available: boolean }
    const data = response.data;
    
    // Handle both response formats
    if (data && typeof data.available === 'boolean') {
      return { available: data.available };
    }
    
    // If response has success but no available, assume not available
    if (data && data.success === false) {
      return { available: false, error: data.error || 'Username check failed' };
    }
    
    // Fallback - assume not available if we can't determine
    return { available: false, error: 'Unable to determine username availability' };
  } catch (error: any) {
    // Handle different error types
    if (error.response) {
      // Server responded with an error status
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 400) {
        // Bad request - username validation failed
        const errorMessage = data?.error || 'Invalid username format';
        return { available: false, error: errorMessage };
      }
      
      // Check if error response has availability info
      if (data && typeof data.available === 'boolean') {
        return { available: data.available };
      }
      
      // Server error with message
      const errorMessage = data?.error || data?.message || 'Unable to check username';
      return { error: errorMessage };
    }
    
    // Network error (no response) - don't show availability status
    // This prevents false "available" messages
    const parsedError = parseError(error);
    return { error: parsedError.userMessage || 'Unable to check username. Please check your connection.' };
  }
};

// Verify OTP
export const verifyOTP = async (data: VerifyOTPData): Promise<AuthResponse> => {
  try {
    const response = await api.post('/api/v1/auth/verify-otp', data);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Resend OTP
export const resendOTP = async (email: string): Promise<AuthResponse> => {
  try {
    const response = await api.post('/api/v1/auth/resend-otp', { email });
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
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
    // For web: Rely on httpOnly cookies set by backend (most secure)
    // For mobile: Store in AsyncStorage
    // NOTE: We no longer use sessionStorage as it's XSS vulnerable
    // Socket.io will need to read token from cookies or use a different auth mechanism
    if (token) {
      if (!isWeb) {
        // Mobile: Store in AsyncStorage
        await AsyncStorage.setItem('authToken', token);
      }
      // Web: Token is stored in httpOnly cookie by backend, no client-side storage needed
    }
    
    if (user) {
      await AsyncStorage.setItem('userData', JSON.stringify(user));
    }
    
    return response.data;
  } catch (error: any) {
    // Use error code parser for user-friendly messages
    const parsedError = parseError(error);
    // Preserve the error code in the thrown error so it can be detected upstream
    const newError = new Error(parsedError.userMessage);
    (newError as any).parsedError = parsedError;
    (newError as any).originalError = error;
    throw newError;
  }
};

let lastAuthError: string | null = null;

// Get current user
export const getCurrentUser = async (): Promise<UserType | null | 'network-error'> => {
  try {
    // For web: Rely solely on httpOnly cookies (set by backend)
    // For mobile: Check AsyncStorage
    if (!isWeb) {
      // Mobile: Check AsyncStorage
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        return null;
      }
    }
    // Web: No token check needed - backend uses httpOnly cookies
    
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
    // Extract error message safely to avoid serialization issues
    let errorMessage = 'Network or unknown error';
    if (error) {
      if (error instanceof Error) {
        errorMessage = error.message || 'Network or unknown error';
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message && typeof error.message === 'string') {
        errorMessage = error.message;
      } else {
        // Try to stringify safely
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = 'Network or unknown error';
        }
      }
    }
    
    // Check for stack overflow errors - these shouldn't be logged as network errors
    const isStackOverflow = errorMessage.includes('Maximum call stack size exceeded') || 
                            errorMessage.includes('call stack size exceeded') ||
                            errorMessage.includes('stack overflow');
    
    lastAuthError = errorMessage;
    
    if (process.env.NODE_ENV === 'development') {
      if (isStackOverflow) {
        // Log stack overflow as error, not warning, and don't include the full error object
        logger.error('Stack overflow in getCurrentUser:', errorMessage);
      } else {
        logger.warn('Network error in getCurrentUser:', errorMessage);
      }
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
    // For web: Rely solely on httpOnly cookies (set by backend)
    // For mobile: Check AsyncStorage
    if (isWeb) {
      // Web: Just call API - backend uses httpOnly cookies
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
      logger.error('isAuthenticated', error);
    }
    // Don't automatically sign out on error, just return false
    return false;
  }
};

// Initialize auth state on app launch
export const initializeAuth = async (): Promise<UserType | null | 'network-error'> => {
  try {
    // For web: Rely solely on httpOnly cookies (set by backend)
    // For mobile: Check AsyncStorage
    if (isWeb) {
      // Web: Just call API - backend uses httpOnly cookies
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
      // Network error - try to get stored user as fallback
      // This ensures app can still work with cached data when offline
      const fallbackUser = await getUserFromStorage();
      if (fallbackUser) {
        // Return stored user so app can continue working
        logger.debug('[initializeAuth] Network error, using stored user as fallback');
        return fallbackUser;
      }
      // No stored user available - return network error
      return 'network-error';
    }
    return user;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      logger.error('initializeAuth', error);
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
    // Disconnect socket first
    try {
      const { socketService } = await import('./socket');
      await socketService.disconnect();
    } catch (error) {
      // Continue even if socket disconnect fails
      logger.warn('Socket disconnect failed during signout:', error);
    }
    
    // For web, call logout endpoint to clear httpOnly cookie
    if (isWeb) {
      try {
        await api.post('/api/v1/auth/logout');
      } catch (error) {
        // Continue even if logout endpoint fails
        logger.warn('Logout endpoint failed, clearing local storage');
      }
    }
    
    // Clear local storage (mobile) or as fallback (web)
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('userData');
    
    // Clear any other auth-related data
    await AsyncStorage.removeItem('onboarding_completed');
    await AsyncStorage.removeItem('taatom_shorts_liked_ids');
    await AsyncStorage.removeItem('taatom_posts_liked_ids');
    
    // Clear last auth error
    lastAuthError = null;
    
    // On web, trigger storage event to notify other tabs/windows
    if (isWeb && typeof window !== 'undefined') {
      // Trigger a custom event that can be listened to
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'authToken',
        newValue: null,
        oldValue: null,
        storageArea: window.localStorage,
      }));
    }
    
    logger.debug('Sign out completed successfully');
  } catch (error) {
    logger.error('signOut error:', error);
    // Still try to clear storage even if other operations fail
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('onboarding_completed');
      await AsyncStorage.removeItem('taatom_shorts_liked_ids');
      await AsyncStorage.removeItem('taatom_posts_liked_ids');
      lastAuthError = null;
    } catch (clearError) {
      logger.error('Failed to clear storage during signout:', clearError);
    }
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
    logger.error('forgotPassword', error);
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getLastAuthError = () => lastAuthError;

// Force refresh authentication state
export const refreshAuthState = async (): Promise<UserType | null> => {
  try {
    // For web: Rely solely on httpOnly cookies (set by backend)
    // For mobile: Check AsyncStorage
    if (isWeb) {
      // Web: Just call API - backend uses httpOnly cookies
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
      logger.error('refreshAuthState', error);
    return null;
  }
};