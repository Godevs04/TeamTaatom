import api from './api';

export interface UserSettings {
  privacy: {
    profileVisibility: 'public' | 'followers' | 'private';
    showEmail: boolean;
    showLocation: boolean;
    allowMessages: 'everyone' | 'followers' | 'none';
  };
  notifications: {
    pushNotifications: boolean;
    emailNotifications: boolean;
    likesNotifications: boolean;
    commentsNotifications: boolean;
    followsNotifications: boolean;
    messagesNotifications: boolean;
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
    const response = await api.put(`/settings/${category}`, settings);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update settings');
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
