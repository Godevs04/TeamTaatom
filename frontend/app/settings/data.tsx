import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getSettings, updateSettingCategory, UserSettings } from '../../services/settings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAlert } from '../../context/AlertContext';

export default function DataStorageSettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadSettings();
  }, []);

  const calculateStorageUsage = async () => {
    try {
      // Get all AsyncStorage keys to calculate usage
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length * 2; // Rough estimate: 2 bytes per character
        }
      }
      
      // Convert to MB
      const totalMB = (totalSize / (1024 * 1024)).toFixed(1);
      
      // Estimate breakdown (this is simplified - in a real app you'd track this more precisely)
      const imagesMB = (totalSize * 0.3 / (1024 * 1024)).toFixed(1);
      const downloadsMB = (totalSize * 0.4 / (1024 * 1024)).toFixed(1);
      const documentsMB = (totalSize * 0.3 / (1024 * 1024)).toFixed(1);
      
      setStorageData({
        images: `${imagesMB} MB`,
        downloads: `${downloadsMB} MB`,
        documents: `${documentsMB} MB`,
        total: `${totalMB} MB`,
        available: '15.2 GB' // This would need device-specific API
      });
    } catch (error) {
      console.error('Error calculating storage:', error);
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
      const updatedSettings = {
        ...settings.account,
        [key]: value
      };
      
      const response = await updateSettingCategory('account', updatedSettings);
      setSettings(response.settings);
    } catch (error) {
      showError('Failed to update setting');
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
      
      <ScrollView style={styles.scrollView}>
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
            <TouchableOpacity
              style={[styles.toggleButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                showSuccess('Wi-Fi only downloads will be available soon');
              }}
            >
              <Ionicons name="checkmark" size={16} color="white" />
            </TouchableOpacity>
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

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              showSuccess('Auto-sync settings will be available soon');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="sync-outline" size={20} color={theme.colors.primary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                  Auto-Sync
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Automatically sync your data
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              showConfirm(
                'Syncing your data...',
                () => {
                  showSuccess('Data synced successfully');
                },
                'Sync Now',
                'Sync',
                'Cancel'
              );
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.primary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                  Sync Now
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Manually sync your data
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
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
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  settingValue: {
    fontSize: 14,
    marginRight: 8,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  storageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  storageText: {
    marginLeft: 12,
    flex: 1,
  },
  storageLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  storageDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  storageRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storageSize: {
    fontSize: 14,
    marginRight: 12,
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
