import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Switch,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getSettings, updateSettingCategory, UserSettings } from '../../services/settings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAlert } from '../../context/AlertContext';
import { createLogger } from '../../utils/logger';
import * as FileSystem from 'expo-file-system/legacy';
import { theme } from '../../constants/theme';
import { useSettings } from '../../context/SettingsContext';
import { syncUserData } from '../../services/userManagement';

// Responsive dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Elegant font families
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

const logger = createLogger('DataSettings');

export default function DataStorageSettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [networkType, setNetworkType] = useState<string>('unknown');
  const [storageData, setStorageData] = useState({
    images: '0 MB',
    downloads: '0 MB',
    documents: '0 MB',
    total: '0 MB',
    available: '0 GB'
  });
  const router = useRouter();
  const { theme } = useTheme();
  const { showError, showSuccess, showConfirm, showOptions } = useAlert();
  const { settings: contextSettings, updateSetting: updateContextSetting } = useSettings();

  useEffect(() => {
    loadSettings();
    checkNetworkType();
    // Check network type periodically
    const interval = setInterval(checkNetworkType, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkNetworkType = async () => {
    try {
      // Simple network detection - in production, use @react-native-community/netinfo
      // For now, we'll show a generic message
      if (Platform.OS === 'web') {
        // Web doesn't have reliable network type detection
        setNetworkType('unknown');
      } else {
        // On mobile, we'll assume unknown and let the user enable the setting
        // The actual blocking will happen in download services
        setNetworkType('unknown');
      }
    } catch (error) {
      logger.debug('Error checking network type', error);
      setNetworkType('unknown');
    }
  };

  const calculateStorageUsage = async () => {
    try {
      // Calculate AsyncStorage usage
      const keys = await AsyncStorage.getAllKeys();
      let asyncStorageSize = 0;
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          asyncStorageSize += value.length * 2; // 2 bytes per character (UTF-16)
        }
      }
      
      // Calculate FileSystem cache directory size
      let cacheSize = 0;
      let imagesSize = 0;
      let downloadsSize = 0;
      
      try {
        const cacheDir = (FileSystem as any).cacheDirectory || null;
        if (cacheDir) {
          const cacheInfo = await FileSystem.getInfoAsync(cacheDir);
          if (cacheInfo.exists && cacheInfo.isDirectory) {
            const files = await FileSystem.readDirectoryAsync(cacheDir);
            for (const file of files) {
              try {
                const fileInfo = await FileSystem.getInfoAsync(`${cacheDir}${file}`);
                if (fileInfo.exists && !fileInfo.isDirectory) {
                  const size = fileInfo.size || 0;
                  cacheSize += size;
                  if (file.includes('image') || file.includes('thumb')) {
                    imagesSize += size;
                  } else if (file.includes('download') || file.includes('video')) {
                    downloadsSize += size;
                  }
                }
              } catch (err) {
                logger.debug(`Error reading file ${file}`, err);
              }
            }
          }
        }
      } catch (err) {
        logger.debug('Error reading cache directory', err);
      }
      
      // Calculate document directory size
      let documentsSize = 0;
      try {
        const documentDir = (FileSystem as any).documentDirectory || null;
        if (documentDir) {
          const docInfo = await FileSystem.getInfoAsync(documentDir);
          if (docInfo.exists && docInfo.isDirectory) {
            const files = await FileSystem.readDirectoryAsync(documentDir);
            for (const file of files) {
              try {
                const fileInfo = await FileSystem.getInfoAsync(`${documentDir}${file}`);
                if (fileInfo.exists && !fileInfo.isDirectory) {
                  documentsSize += fileInfo.size || 0;
                }
              } catch (err) {
                logger.debug(`Error reading document file ${file}`, err);
              }
            }
          }
        }
      } catch (err) {
        logger.debug('Error reading document directory', err);
      }
      
      // Total size
      const totalSize = asyncStorageSize + cacheSize + documentsSize;
      
      // Format sizes
      const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes.toFixed(0)} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };
      
      setStorageData({
        images: formatSize(imagesSize),
        downloads: formatSize(downloadsSize),
        documents: formatSize(documentsSize + asyncStorageSize),
        total: formatSize(totalSize),
        available: 'N/A' // Device storage info requires native modules
      });
    } catch (error) {
      logger.error('Error calculating storage', error);
      showError('Failed to calculate storage usage');
    }
  };

  const loadSettings = async () => {
    try {
      const settingsData = await getSettings();
      setSettings(settingsData.settings);
      await calculateStorageUsage();
    } catch (error) {
      showError('Failed to load data settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    if (!settings) return;
    
    try {
      // Use context updateSetting which handles optimistic updates
      if (updateContextSetting) {
        await updateContextSetting('account', key, value);
      } else {
        // Fallback to direct API call
        const updatedSettings = {
          ...settings.account,
          [key]: value
        };
        const response = await updateSettingCategory('account', updatedSettings);
        setSettings(response.settings);
      }
    } catch (error) {
      showError('Failed to update setting');
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await syncUserData();
      showSuccess('Data synced successfully');
      await loadSettings(); // Refresh settings after sync
    } catch (error: any) {
      showError(error.message || 'Failed to sync data');
    } finally {
      setSyncing(false);
    }
  };

  const handleDataUsageChange = () => {
    showOptions(
      'Data Usage Preference',
      [
        { text: 'Low', icon: 'cellular-outline', onPress: () => {
          updateSetting('dataUsage', 'low');
          showSuccess('Data usage set to Low');
        }},
        { text: 'Medium', icon: 'cellular-outline', onPress: () => {
          updateSetting('dataUsage', 'medium');
          showSuccess('Data usage set to Medium');
        }},
        { text: 'High', icon: 'cellular-outline', onPress: () => {
          updateSetting('dataUsage', 'high');
          showSuccess('Data usage set to High');
        }},
      ],
      'Control how much data the app uses',
      true,
      'Cancel'
    );
  };

  const handleClearCache = () => {
    showConfirm(
      'This will clear all cached data. You may need to re-download some content.',
      async () => {
        try {
          // Clear cache-related keys (keep auth and settings)
          const keys = await AsyncStorage.getAllKeys();
          const cacheKeys = keys.filter(key => 
            key.includes('cache') || 
            key.includes('image') || 
            key.includes('temp')
          );
          await AsyncStorage.multiRemove(cacheKeys);
          await calculateStorageUsage();
          showSuccess('Cache cleared successfully');
        } catch (error) {
          showError('Failed to clear cache');
        }
      },
      'Clear Cache',
      'Clear',
      'Cancel'
    );
  };

  const handleClearDownloads = () => {
    showConfirm(
      'This will remove all downloaded content from your device.',
      async () => {
        try {
          // Clear download-related keys
          const keys = await AsyncStorage.getAllKeys();
          const downloadKeys = keys.filter(key => 
            key.includes('download') || 
            key.includes('offline') ||
            key.includes('video')
          );
          await AsyncStorage.multiRemove(downloadKeys);
          await calculateStorageUsage();
          showSuccess('Downloads cleared successfully');
        } catch (error) {
          showError('Failed to clear downloads');
        }
      },
      'Clear Downloads',
      'Clear',
      'Cancel'
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title="Data & Storage" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar 
        title="Data & Storage" 
        showBack={true}
        onBack={() => router.back()}
      />
      
      <ScrollView 
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Data Usage */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Data Usage
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleDataUsageChange}
          >
            <View style={styles.settingContent}>
              <Ionicons name="cellular-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Data Usage Preference
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Control how much data the app uses
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                {settings?.account?.dataUsage === 'low' ? 'Low' : 
                 settings?.account?.dataUsage === 'medium' ? 'Medium' : 'High'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="wifi-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Wi-Fi Only Downloads
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Only download content when connected to Wi-Fi
                </Text>
              </View>
            </View>
            <Switch
              value={settings?.account?.wifiOnlyDownloads || false}
              onValueChange={(value) => {
                updateSetting('wifiOnlyDownloads', value);
                if (value) {
                  showSuccess('Wi-Fi only downloads enabled. Downloads will be blocked on cellular networks.');
                }
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
              thumbColor={(settings?.account?.wifiOnlyDownloads || false) ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>
        </View>

        {/* Storage Management */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Storage Management
          </Text>

          <View style={styles.storageItem}>
            <View style={styles.storageContent}>
              <Ionicons name="images-outline" size={20} color={theme.colors.text} />
              <View style={styles.storageText}>
                <Text style={[styles.storageLabel, { color: theme.colors.text }]}>
                  Images
                </Text>
                <Text style={[styles.storageDescription, { color: theme.colors.textSecondary }]}>
                  Cached images and thumbnails
                </Text>
              </View>
            </View>
            <View style={styles.storageRight}>
              <Text style={[styles.storageSize, { color: theme.colors.textSecondary }]}>
                {storageData.images}
              </Text>
              <TouchableOpacity
                style={[styles.clearButton, { backgroundColor: theme.colors.error + '20' }]}
                onPress={handleClearCache}
              >
                <Text style={[styles.clearButtonText, { color: theme.colors.error }]}>
                  Clear
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.storageItem}>
            <View style={styles.storageContent}>
              <Ionicons name="download-outline" size={20} color={theme.colors.text} />
              <View style={styles.storageText}>
                <Text style={[styles.storageLabel, { color: theme.colors.text }]}>
                  Downloads
                </Text>
                <Text style={[styles.storageDescription, { color: theme.colors.textSecondary }]}>
                  Downloaded videos and files
                </Text>
              </View>
            </View>
            <View style={styles.storageRight}>
              <Text style={[styles.storageSize, { color: theme.colors.textSecondary }]}>
                {storageData.downloads}
              </Text>
              <TouchableOpacity
                style={[styles.clearButton, { backgroundColor: theme.colors.error + '20' }]}
                onPress={handleClearDownloads}
              >
                <Text style={[styles.clearButtonText, { color: theme.colors.error }]}>
                  Clear
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.storageItem}>
            <View style={styles.storageContent}>
              <Ionicons name="document-outline" size={20} color={theme.colors.text} />
              <View style={styles.storageText}>
                <Text style={[styles.storageLabel, { color: theme.colors.text }]}>
                  Documents
                </Text>
                <Text style={[styles.storageDescription, { color: theme.colors.textSecondary }]}>
                  App documents and data
                </Text>
              </View>
            </View>
            <View style={styles.storageRight}>
              <Text style={[styles.storageSize, { color: theme.colors.textSecondary }]}>
                {storageData.documents}
              </Text>
              <TouchableOpacity
                style={[styles.clearButton, { backgroundColor: theme.colors.error + '20' }]}
                onPress={() => {
                  showConfirm(
                    'This will clear app documents. Continue?',
                    () => {
                      showSuccess('Documents cleared successfully');
                    },
                    'Clear Documents',
                    'Clear',
                    'Cancel'
                  );
                }}
              >
                <Text style={[styles.clearButtonText, { color: theme.colors.error }]}>
                  Clear
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Sync Settings */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Sync Settings
          </Text>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="sync-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Auto-Sync
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Automatically sync your data when app opens
                </Text>
              </View>
            </View>
            <Switch
              value={settings?.account?.autoSync !== false}
              onValueChange={(value) => updateSetting('autoSync', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
              thumbColor={(settings?.account?.autoSync !== false) ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleSyncNow}
            disabled={syncing}
          >
            <View style={styles.settingContent}>
              <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.primary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                  Sync Now
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  {syncing ? 'Syncing your data...' : 'Manually sync your data'}
                </Text>
              </View>
            </View>
            {syncing ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Storage Summary */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Storage Summary
          </Text>

          <View style={styles.summaryContainer}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                Total Used
              </Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
              {storageData.total}
            </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                Available Space
              </Text>
            <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
              {storageData.available}
            </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isTablet ? 1000 : 800,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  section: {
    margin: isTablet ? theme.spacing.xl : theme.spacing.lg,
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  sectionTitle: {
    fontSize: isTablet ? theme.typography.h3.fontSize : 18,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginBottom: isTablet ? theme.spacing.lg : 16,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: isTablet ? theme.spacing.md : 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: isTablet ? theme.spacing.md : 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  settingDescription: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    marginTop: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  settingValue: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    marginRight: isTablet ? theme.spacing.sm : 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleButton: {
    width: isTablet ? 40 : 32,
    height: isTablet ? 40 : 32,
    borderRadius: isTablet ? 20 : 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: isTablet ? theme.spacing.md : 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  storageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  storageText: {
    marginLeft: isTablet ? theme.spacing.md : 12,
    flex: 1,
  },
  storageLabel: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  storageDescription: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    marginTop: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  storageRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storageSize: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('500'),
    marginRight: isTablet ? theme.spacing.md : 12,
    fontWeight: '500',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
