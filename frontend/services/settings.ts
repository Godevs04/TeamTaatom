import api from './api';
import logger from '../utils/logger';
import { parseError } from '../utils/errorCodes';

export interface UserSettings {
  privacy: {
    profileVisibility: 'public' | 'followers' | 'private';
    showEmail: boolean;
    showLocation: boolean;
    allowMessages: 'everyone' | 'followers' | 'none';
    requireFollowApproval: boolean;
    allowFollowRequests: boolean;
    shareActivity?: boolean;
  };
  notifications: {
    pushNotifications: boolean;
    emailNotifications: boolean;
    likesNotifications: boolean;
    commentsNotifications: boolean;
    followsNotifications: boolean;
    messagesNotifications: boolean;
    followRequestNotifications: boolean;
    followApprovalNotifications: boolean;
    quietHours?: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      days: string[];
    };
  };
  account: {
    language: string;
    theme: 'light' | 'dark' | 'auto';
    dataUsage: 'low' | 'medium' | 'high';
    wifiOnlyDownloads?: boolean;
    autoSync?: boolean;
  };
}

export interface SettingsResponse {
  settings: UserSettings;
}

// Check network connectivity
const checkNetworkConnectivity = async (): Promise<boolean> => {
  try {
    // Try a simple ping to the server
    const response = await api.get('/api/v1/auth/me', { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    logger.debug('Network connectivity check failed:', error);
    return false;
  }
};

// Get user settings
export const getSettings = async (): Promise<SettingsResponse> => {
  try {
    const response = await api.get('/api/v1/settings');
    return response.data;
  } catch (error: any) {
    // Handle 401 gracefully - session expired
    if (error.response?.status === 401) {
      logger.debug('Settings fetch failed: Session expired');
      throw new Error('Session expired. Please log in again.');
    }
    
    // Handle network errors gracefully
    if (!error.response) {
      logger.debug('Settings fetch failed: Network error');
      throw new Error('Network error. Please check your connection.');
    }
    
    const parsedError = parseError(error);
    logger.error('Failed to load settings:', parsedError.userMessage);
    throw new Error(parsedError.userMessage);
  }
};

// Update user settings
export const updateSettings = async (settings: Partial<UserSettings>): Promise<SettingsResponse> => {
  try {
    const response = await api.put('/api/v1/settings', { settings });
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Update specific settings category
export const updateSettingCategory = async (category: 'privacy' | 'notifications' | 'account', settings: any): Promise<SettingsResponse> => {
  try {
    logger.debug(`Updating ${category} settings:`, settings);
    
    // Check network connectivity first
    const isConnected = await checkNetworkConnectivity();
    if (!isConnected) {
      throw new Error('No internet connection. Please check your network and try again.');
    }
    
    const response = await api.put(`/api/v1/settings/${category}`, settings, {
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    logger.debug(`Successfully updated ${category} settings:`, response.data);
    return response.data;
  } catch (error: any) {
    logger.error('updateSettingCategory', error);
    
    // Handle different types of errors
    if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
      throw new Error('Network connection failed. Please check your internet connection and try again.');
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('Request timed out. Please try again.');
    } else if (error.response?.status === 401) {
      throw new Error('Session expired. Please log in again.');
    } else if (error.response?.status === 500) {
      throw new Error('Server error. Please try again later.');
    } else {
      const parsedError = parseError(error);
      throw new Error(parsedError.userMessage);
    }
  }
};

// Reset settings to default
export const resetSettings = async (): Promise<SettingsResponse> => {
  try {
    const response = await api.post('/api/v1/settings/reset');
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};
