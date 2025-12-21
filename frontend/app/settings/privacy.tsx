import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Switch,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { useSettings } from '../../context/SettingsContext';
import { getUserFromStorage } from '../../services/auth';
import CustomAlert from '../../components/CustomAlert';
import CustomOptions, { CustomOption } from '../../components/CustomOptions';
import { createLogger } from '../../utils/logger';
import { getProfile } from '../../services/profile';
import { theme } from '../../constants/theme';

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

const logger = createLogger('PrivacySettings');

export default function PrivacySettingsScreen() {
  // Settings State Single Source of Truth: Use SettingsContext
  const { settings, loading: settingsLoading, updateSetting, refreshSettings } = useSettings();
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
  
  // Navigation & Lifecycle Safety: Track mounted state
  const isMountedRef = useRef(true);
  
  // Toggle Interaction Safety: Per-toggle guards to prevent multiple API calls
  const updatingKeysRef = useRef<Set<string>>(new Set());
  
  const router = useRouter();
  const { theme } = useTheme();

  const showAlert = (message: string, title?: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setAlertConfig({ title: title || '', message, type });
    setAlertVisible(true);
  };

  const showError = useCallback((message: string, title?: string) => {
    showAlert(message, title || 'Error', 'error');
  }, []);

  const showSuccess = useCallback((message: string, title?: string) => {
    showAlert(message, title || 'Success', 'success');
  }, []);

  // Navigation & Lifecycle Safety: Setup and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Navigation & Lifecycle Safety: Refresh settings on focus (e.g., after returning from other screens)
  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      // Refresh settings to ensure we have latest server state
      refreshSettings();
      return () => {
        // Screen blurred - cleanup
      };
    }, [refreshSettings])
  );

  // Toggle Interaction Safety: Wrapper with per-toggle guard and optimistic update
  const handleUpdateSetting = useCallback(async (key: string, value: any) => {
    if (!settings) return;
    
    // Prevent re-entry while API call is in-flight
    if (updatingKeysRef.current.has(key)) {
      logger.debug(`Update already in progress for ${key}, skipping`);
      return;
    }
    
    updatingKeysRef.current.add(key);
    
    try {
      await updateSetting('privacy', key, value);
      if (isMountedRef.current) {
        showSuccess('Setting updated successfully');
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        // Error already shown by context (rollback handled there)
        logger.error(`Failed to update setting ${key}`, error);
      }
    } finally {
      updatingKeysRef.current.delete(key);
    }
  }, [settings, updateSetting, showSuccess]);

  // Cross-Module Consistency: Refresh profile after privacy settings update
  const updateProfileVisibilitySettings = useCallback(async (profileVisibility: string, requireFollowApproval: boolean, allowFollowRequests: boolean) => {
    if (!settings) return;
    
    const key = 'profileVisibility';
    if (updatingKeysRef.current.has(key)) {
      logger.debug('Profile visibility update already in progress, skipping');
      return;
    }
    
    updatingKeysRef.current.add(key);
    
    try {
      // Update all three related settings
      await Promise.all([
        updateSetting('privacy', 'profileVisibility', profileVisibility),
        updateSetting('privacy', 'requireFollowApproval', requireFollowApproval),
        updateSetting('privacy', 'allowFollowRequests', allowFollowRequests)
      ]);
      
      if (isMountedRef.current) {
        showSuccess('Profile visibility updated successfully');
        
        // Cross-Module Consistency: Refresh profile to reflect privacy changes
        try {
          const user = await getUserFromStorage();
          if (user?._id) {
            await getProfile(user._id);
            // Profile will refresh on next focus (handled in profile.tsx useFocusEffect)
          }
        } catch (profileError) {
          logger.warn('Failed to refresh profile after privacy update', profileError);
          // Non-critical - profile will refresh on next navigation
        }
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        logger.error('Failed to update profile visibility', error);
        showError(error.message || 'Failed to update profile visibility');
      }
    } finally {
      updatingKeysRef.current.delete(key);
    }
  }, [settings, updateSetting, showSuccess, showError]);

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
          handleUpdateSetting('allowMessages', 'everyone');
        }
      },
      {
        text: 'Followers Only',
        icon: 'people-outline',
        onPress: () => {
          setCustomOptionsVisible(false);
          handleUpdateSetting('allowMessages', 'followers');
        }
      },
      {
        text: 'No One',
        icon: 'lock-closed-outline',
        onPress: () => {
          setCustomOptionsVisible(false);
          handleUpdateSetting('allowMessages', 'none');
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

  // Screen Load Performance: Memoize loading state
  const isLoading = useMemo(() => settingsLoading || !settings, [settingsLoading, settings]);

  if (isLoading) {
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
            disabled={updatingKeysRef.current.has('profileVisibility')}
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
              onValueChange={(value) => handleUpdateSetting('showEmail', value)}
              disabled={updatingKeysRef.current.has('showEmail')}
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
              value={settings?.privacy?.showLocation !== false}
              onValueChange={(value) => handleUpdateSetting('showLocation', value)}
              disabled={updatingKeysRef.current.has('showLocation')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
              thumbColor={settings?.privacy?.showLocation !== false ? theme.colors.primary : theme.colors.textSecondary}
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
            disabled={updatingKeysRef.current.has('allowMessages')}
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
              onValueChange={(value) => handleUpdateSetting('shareActivity', value)}
              disabled={updatingKeysRef.current.has('shareActivity')}
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
              router.push('/settings/account-activity');
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
              router.push('/settings/blocked-users');
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
});
