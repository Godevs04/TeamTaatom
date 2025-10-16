import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import { getSettings, updateSettings, updateSettingCategory, resetSettings, UserSettings } from '../services/settings';

interface SettingsContextType {
  settings: UserSettings | null;
  loading: boolean;
  updateSetting: (category: 'privacy' | 'notifications' | 'account', key: string, value: any) => Promise<void>;
  updateAllSettings: (settings: Partial<UserSettings>) => Promise<void>;
  resetAllSettings: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settingsData = await getSettings();
      setSettings(settingsData.settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (category: 'privacy' | 'notifications' | 'account', key: string, value: any) => {
    if (!settings) return;
    
    try {
      const updatedSettings = {
        ...settings[category],
        [key]: value
      };
      
      const response = await updateSettingCategory(category, updatedSettings);
      setSettings(response.settings);
    } catch (error) {
      console.error('Failed to update setting:', error);
      Alert.alert('Error', 'Failed to update setting');
      throw error;
    }
  };

  const updateAllSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      const response = await updateSettings(newSettings);
      setSettings(response.settings);
    } catch (error) {
      console.error('Failed to update settings:', error);
      Alert.alert('Error', 'Failed to update settings');
      throw error;
    }
  };

  const resetAllSettings = async () => {
    try {
      const response = await resetSettings();
      setSettings(response.settings);
    } catch (error) {
      console.error('Failed to reset settings:', error);
      Alert.alert('Error', 'Failed to reset settings');
      throw error;
    }
  };

  const refreshSettings = async () => {
    await loadSettings();
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const value: SettingsContextType = {
    settings,
    loading,
    updateSetting,
    updateAllSettings,
    resetAllSettings,
    refreshSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
