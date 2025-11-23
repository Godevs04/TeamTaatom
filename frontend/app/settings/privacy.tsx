import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getSettings, updateSettingCategory, UserSettings } from '../../services/settings';
import CustomAlert from '../../components/CustomAlert';
import CustomOptions, { CustomOption } from '../../components/CustomOptions';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PrivacySettings');

export default function PrivacySettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
  });
  const [customOptionsVisible, setCustomOptionsVisible] = useState(false);
  const [customOptionsConfig, setCustomOptionsConfig] = useState({
    title: '',
    message: '',
    options: [] as CustomOption[],
  });
  const router = useRouter();
  const { theme } = useTheme();

  const showAlert = (message: string, title?: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setAlertConfig({ title: title || '', message, type });
    setAlertVisible(true);
  };

  const showError = (message: string, title?: string) => {
    showAlert(message, title || 'Error', 'error');
  };

  const showSuccess = (message: string, title?: string) => {
    showAlert(message, title || 'Success', 'success');
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settingsData = await getSettings();
      setSettings(settingsData.settings);
    } catch (error) {
      showError('Failed to load privacy settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    if (!settings) return;
    
    setUpdating(true);
    try {
      const updatedSettings = {
        ...settings.privacy,
        [key]: value
      };
      
      const response = await updateSettingCategory('privacy', updatedSettings);
      setSettings(response.settings);
      showSuccess('Setting updated successfully');
      logger.debug(`Setting ${key} updated successfully`);
    } catch (error: any) {
      logger.error(`Failed to update setting ${key}`, error);
      showError(error.message || 'Failed to update setting');
    } finally {
      setUpdating(false);
    }
  };

  const updateProfileVisibilitySettings = async (profileVisibility: string, requireFollowApproval: boolean, allowFollowRequests: boolean) => {
    if (!settings) return;
    
    setUpdating(true);
    try {
      const updatedSettings = {
        ...settings.privacy,
        profileVisibility,
        requireFollowApproval,
        allowFollowRequests
      };
      
      const response = await updateSettingCategory('privacy', updatedSettings);
      setSettings(response.settings);
      showSuccess('Profile visibility updated successfully');
      logger.debug('Profile visibility updated successfully');
    } catch (error: any) {
      logger.error('Failed to update profile visibility', error);
      showError(error.message || 'Failed to update profile visibility');
    } finally {
      setUpdating(false);
    }
  };

  const handleProfileVisibilityChange = () => {
    const options: CustomOption[] = [
      {
        text: 'Public',
        icon: 'globe-outline',
        onPress: () => {
          setCustomOptionsVisible(false);
          updateProfileVisibilitySettings('public', false, true);
        }
      },
      {
        text: 'Followers Only',
        icon: 'people-outline',
        onPress: () => {
          setCustomOptionsVisible(false);
          updateProfileVisibilitySettings('followers', false, true);
        }
      },
      {
        text: 'Private (Require Approval)',
        icon: 'shield-checkmark-outline',
        onPress: () => {
          setCustomOptionsVisible(false);
          updateProfileVisibilitySettings('private', true, true);
        }
      }
    ];

    setCustomOptionsConfig({
      title: 'Profile Visibility',
      message: 'Control who can see your profile and how they can follow you',
      options
    });
    setCustomOptionsVisible(true);
  };

  const handleAllowMessagesChange = () => {
    const options: CustomOption[] = [
      {
        text: 'Everyone',
        icon: 'globe-outline',
        onPress: () => {
          setCustomOptionsVisible(false);
          updateSetting('allowMessages', 'everyone');
        }
      },
      {
        text: 'Followers Only',
        icon: 'people-outline',
        onPress: () => {
          setCustomOptionsVisible(false);
          updateSetting('allowMessages', 'followers');
        }
      },
      {
        text: 'No One',
        icon: 'lock-closed-outline',
        onPress: () => {
          setCustomOptionsVisible(false);
          updateSetting('allowMessages', 'none');
        }
      }
    ];

    setCustomOptionsConfig({
      title: 'Message Permissions',
      message: 'Who can send you messages?',
      options
    });
    setCustomOptionsVisible(true);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title="Privacy & Security" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar 
        title="Privacy & Security" 
        showBack={true}
        onBack={() => router.back()}
      />
      
      <ScrollView style={styles.scrollView}>
        {/* Profile Privacy */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Profile Privacy
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleProfileVisibilityChange}
            disabled={updating}
          >
            <View style={styles.settingContent}>
              <Ionicons name="eye-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Profile Visibility
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Control who can see your profile
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                {(() => {
                  const visibility = settings?.privacy?.profileVisibility;
                  const requiresApproval = settings?.privacy?.requireFollowApproval;
                  const allowsRequests = settings?.privacy?.allowFollowRequests;
                  
                  if (visibility === 'public') return 'Public';
                  if (visibility === 'followers') return 'Followers Only';
                  if (visibility === 'private' && requiresApproval) return 'Private (Require Approval)';
                  if (visibility === 'private' && !allowsRequests) return 'Private (No Follow Requests)';
                  return 'Private';
                })()}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="mail-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Show Email
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Display your email on your profile
                </Text>
              </View>
            </View>
            <Switch
              value={settings?.privacy?.showEmail || false}
              onValueChange={(value) => updateSetting('showEmail', value)}
              disabled={updating}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
              thumbColor={settings?.privacy?.showEmail ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="location-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Show Location
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Display your location on posts
                </Text>
              </View>
            </View>
            <Switch
              value={settings?.privacy?.showLocation || true}
              onValueChange={(value) => updateSetting('showLocation', value)}
              disabled={updating}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
              thumbColor={settings?.privacy?.showLocation ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>

        </View>

        {/* Communication */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Communication
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleAllowMessagesChange}
            disabled={updating}
          >
            <View style={styles.settingContent}>
              <Ionicons name="chatbubbles-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Allow Messages
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Control who can send you messages
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                {settings?.privacy?.allowMessages === 'everyone' ? 'Everyone' : 
                 settings?.privacy?.allowMessages === 'followers' ? 'Followers Only' : 'No One'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="share-social-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Share Activity
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Allow your activities to appear in friends' feeds
                </Text>
              </View>
            </View>
            <Switch
              value={settings?.privacy?.shareActivity !== false}
              onValueChange={(value) => updateSetting('shareActivity', value)}
              disabled={updating}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
              thumbColor={settings?.privacy?.shareActivity !== false ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>
        </View>

        {/* Data & Security */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Data & Security
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              showAlert('Data download feature will be available soon', 'Coming Soon', 'info');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="download-outline" size={20} color={theme.colors.primary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                  Download Your Data
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Get a copy of your data
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              showAlert('Account activity feature will be available soon', 'Coming Soon', 'info');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                  Account Activity
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  View your account activity
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Follow Requests */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Follow Requests
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              router.push('/settings/follow-requests');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="person-add-outline" size={20} color={theme.colors.primary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                  Manage Follow Requests
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  View and manage pending follow requests
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Blocked Users */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Blocked Users
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              showAlert('Blocked users management will be available soon', 'Coming Soon', 'info');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="ban-outline" size={20} color={theme.colors.primary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                  Manage Blocked Users
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  View and manage blocked users
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
      />
      
      <CustomOptions
        visible={customOptionsVisible}
        title={customOptionsConfig.title}
        message={customOptionsConfig.message}
        options={customOptionsConfig.options}
        onClose={() => setCustomOptionsVisible(false)}
      />
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
});
