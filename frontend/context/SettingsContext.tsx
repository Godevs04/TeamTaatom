import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { getSettings, updateSettings, updateSettingCategory, resetSettings, UserSettings } from '../services/settings';
import logger from '../utils/logger';

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
  
  // Navigation & Lifecycle Safety: Track mounted state
  const isMountedRef = useRef(true);
  
  // Prevent Redundant API Calls: Track last known server values per setting
  const lastKnownServerValuesRef = useRef<Map<string, any>>(new Map());
  
  // Toggle Interaction Safety: Track in-flight updates per setting key
  const updatingKeysRef = useRef<Set<string>>(new Set());
  
  // Abort controller for canceling requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadSettings = useCallback(async () => {
    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      const settingsData = await getSettings();
      
      if (!isMountedRef.current) return;
      
      setSettings(settingsData.settings);
      
      // Store last known server values for all settings
      if (settingsData.settings) {
        const map = new Map<string, any>();
        // Privacy settings
        Object.keys(settingsData.settings.privacy || {}).forEach(key => {
          map.set(`privacy.${key}`, settingsData.settings.privacy[key as keyof typeof settingsData.settings.privacy]);
        });
        // Notification settings
        Object.keys(settingsData.settings.notifications || {}).forEach(key => {
          map.set(`notifications.${key}`, settingsData.settings.notifications[key as keyof typeof settingsData.settings.notifications]);
        });
        // Account settings
        Object.keys(settingsData.settings.account || {}).forEach(key => {
          map.set(`account.${key}`, settingsData.settings.account[key as keyof typeof settingsData.settings.account]);
        });
        lastKnownServerValuesRef.current = map;
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.debug('loadSettings aborted');
        return;
      }
      if (!isMountedRef.current) return;
      logger.error('Failed to load settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Settings State Single Source of Truth: Optimistic update with rollback
  const updateSetting = useCallback(async (category: 'privacy' | 'notifications' | 'account', key: string, value: any) => {
    if (!settings) return;
    
    const settingKey = `${category}.${key}`;
    
    // Prevent Redundant API Calls: Skip if value hasn't changed
    const lastKnownValue = lastKnownServerValuesRef.current.get(settingKey);
    if (lastKnownValue === value) {
      logger.debug(`Skipping redundant update for ${settingKey}: value unchanged`);
      return;
    }
    
    // Toggle Interaction Safety: Block re-entry while API call is in-flight
    if (updatingKeysRef.current.has(settingKey)) {
      logger.debug(`Update already in progress for ${settingKey}, skipping`);
      return;
    }
    
    updatingKeysRef.current.add(settingKey);
    
    // Optimistic Update: Apply UI change immediately
    let previousValue: any;
    if (category === 'privacy') {
      previousValue = (settings.privacy as any)[key];
    } else if (category === 'notifications') {
      previousValue = (settings.notifications as any)[key];
    } else {
      previousValue = (settings.account as any)[key];
    }
    
    const optimisticSettings = {
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value
      }
    } as UserSettings;
    setSettings(optimisticSettings);
    
    try {
      const updatedSettings = {
        ...settings[category],
        [key]: value
      };
      
      const response = await updateSettingCategory(category, updatedSettings);
      
      if (!isMountedRef.current) return;
      
      // Update with server response (single source of truth)
      setSettings(response.settings);
      
      // Update last known server value
      lastKnownServerValuesRef.current.set(settingKey, value);
    } catch (error: any) {
      if (!isMountedRef.current) return;
      
      // Rollback: Revert to previous value on failure
      logger.error(`Failed to update setting ${settingKey}`, error);
      const rollbackSettings = {
        ...settings,
        [category]: {
          ...settings[category],
          [key]: previousValue
        }
      } as UserSettings;
      setSettings(rollbackSettings);
      
      Alert.alert('Error', 'Failed to update setting');
      throw error;
    } finally {
      updatingKeysRef.current.delete(settingKey);
    }
  }, [settings]);

  const updateAllSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    if (!settings) return;
    
    // Optimistic update
    const previousSettings = settings;
    setSettings({ ...settings, ...newSettings } as UserSettings);
    
    try {
      const response = await updateSettings(newSettings);
      if (!isMountedRef.current) return;
      setSettings(response.settings);
      
      // Update last known server values
      Object.keys(newSettings).forEach(category => {
        const categorySettings = newSettings[category as keyof UserSettings];
        if (categorySettings && typeof categorySettings === 'object') {
          Object.keys(categorySettings).forEach(key => {
            lastKnownServerValuesRef.current.set(
              `${category}.${key}`,
              categorySettings[key as keyof typeof categorySettings]
            );
          });
        }
      });
    } catch (error) {
      if (!isMountedRef.current) return;
      // Rollback on failure
      setSettings(previousSettings);
      logger.error('Failed to update settings:', error);
      Alert.alert('Error', 'Failed to update settings');
      throw error;
    }
  }, [settings]);

  const resetAllSettings = useCallback(async () => {
    try {
      const response = await resetSettings();
      if (!isMountedRef.current) return;
      setSettings(response.settings);
      
      // Reset last known server values
      lastKnownServerValuesRef.current.clear();
      if (response.settings) {
        const map = new Map<string, any>();
        Object.keys(response.settings.privacy || {}).forEach(key => {
          map.set(`privacy.${key}`, response.settings.privacy[key as keyof typeof response.settings.privacy]);
        });
        Object.keys(response.settings.notifications || {}).forEach(key => {
          map.set(`notifications.${key}`, response.settings.notifications[key as keyof typeof response.settings.notifications]);
        });
        Object.keys(response.settings.account || {}).forEach(key => {
          map.set(`account.${key}`, response.settings.account[key as keyof typeof response.settings.account]);
        });
        lastKnownServerValuesRef.current = map;
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      logger.error('Failed to reset settings:', error);
      Alert.alert('Error', 'Failed to reset settings');
      throw error;
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    await loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    isMountedRef.current = true;
    loadSettings();
    
    return () => {
      isMountedRef.current = false;
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadSettings]);

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
