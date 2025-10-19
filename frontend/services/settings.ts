import api from './api';

export interface UserSettings {
  privacy: {
    profileVisibility: 'public' | 'followers' | 'private';
    showEmail: boolean;
    showLocation: boolean;
    allowMessages: 'everyone' | 'followers' | 'none';
    requireFollowApproval: boolean;
    allowFollowRequests: boolean;
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
  };
  account: {
    language: string;
    theme: 'light' | 'dark' | 'auto';
    dataUsage: 'low' | 'medium' | 'high';
  };
}

export interface SettingsResponse {
  settings: UserSettings;
}

// Check network connectivity
const checkNetworkConnectivity = async (): Promise<boolean> => {
  try {
    // Try a simple ping to the server
    const response = await api.get('/auth/me', { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    console.log('Network connectivity check failed:', error);
    return false;
  }
};

// Get user settings
export const getSettings = async (): Promise<SettingsResponse> => {
  try {
    const response = await api.get('/settings');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch settings');
  }
};

// Update user settings
export const updateSettings = async (settings: Partial<UserSettings>): Promise<SettingsResponse> => {
  try {
    const response = await api.put('/settings', { settings });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update settings');
  }
};

// Update specific settings category
export const updateSettingCategory = async (category: 'privacy' | 'notifications' | 'account', settings: any): Promise<SettingsResponse> => {
  try {
    console.log(`Updating ${category} settings:`, settings);
    
    // Check network connectivity first
    const isConnected = await checkNetworkConnectivity();
    if (!isConnected) {
      throw new Error('No internet connection. Please check your network and try again.');
    }
    
    const response = await api.put(`/settings/${category}`, settings, {
      timeout: 10000, // 10 second timeout
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log(`Successfully updated ${category} settings:`, response.data);
    return response.data;
  } catch (error: any) {
    console.error(`Error updating ${category} settings:`, error);
    
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
      throw new Error(error.response?.data?.message || 'Failed to update settings');
    }
  }
};

// Reset settings to default
export const resetSettings = async (): Promise<SettingsResponse> => {
  try {
    const response = await api.post('/settings/reset');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to reset settings');
  }
};
