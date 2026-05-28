import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
  Dimensions,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
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
import { showConsentForm } from '../../services/admob';
import AlertService from '../../services/alertService';

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
  const { settings, loading: settingsLoading, updateSetting, updateAllSettings, refreshSettings } = useSettings();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
  });
  const [customOptionsVisible, setCustomOptionsVisible] = useState(false);
  const [isOpeningConsentForm, setIsOpeningConsentForm] = useState(false);
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

  // [BUG-060] Privacy: User Data Visibility Toggle
  // Triggers API patch, updates local state optimistically, and provides AlertService feedback
  const handleToggleVisibility = useCallback(async (profileVisibility: 'public' | 'followers' | 'private', requireFollowApproval: boolean, allowFollowRequests: boolean) => {
    if (!settings) return;
    
    const key = 'profileVisibility';
    if (updatingKeysRef.current.has(key)) {
      logger.debug('Profile visibility update already in progress, skipping');
      return;
    }
    
    updatingKeysRef.current.add(key);
    
    try {
      // Optimistic update of multiple related settings at once to prevent race condition
      await updateAllSettings({
        privacy: {
          ...settings.privacy,
          profileVisibility,
          requireFollowApproval,
          allowFollowRequests
        }
      });
      
      if (isMountedRef.current) {
        // Show success message using AlertService
        AlertService.showSuccess('Visibility Updated', `Your account visibility has been set to ${profileVisibility}.`);
        
        // Cross-Module Consistency: Refresh profile to reflect privacy changes
        try {
          const user = await getUserFromStorage();
          if (user?._id) {
            await getProfile(user._id);
          }
        } catch (profileError) {
          logger.warn('Failed to refresh profile after privacy update', profileError);
        }
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        logger.error('Failed to update profile visibility', error);
        AlertService.showError('Update Failed', error.message || 'Failed to update profile visibility');
      }
    } finally {
      updatingKeysRef.current.delete(key);
    }
  }, [settings, updateAllSettings]);

  const handleProfileVisibilityChange = () => {
    const options: CustomOption[] = [
      {
        text: 'Public',
        icon: 'globe-outline',
        onPress: () => {
          setCustomOptionsVisible(false);
          handleToggleVisibility('public', false, true);
        }
      },
      {
        text: 'Followers Only',
        icon: 'people-outline',
        onPress: () => {
          setCustomOptionsVisible(false);
          handleToggleVisibility('followers', false, true);
        }
      },
      {
        text: 'Private (Require Approval)',
        icon: 'shield-checkmark-outline',
        onPress: () => {
          setCustomOptionsVisible(false);
          handleToggleVisibility('private', true, true);
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

  const handleRouteVisibilityChange = () => {
    const options: CustomOption[] = [
      {
        text: 'Everyone',
        icon: 'globe-outline',
        onPress: () => {
          setCustomOptionsVisible(false);
          handleUpdateSetting('routeVisibility', 'everyone');
        }
      },
      {
        text: 'Approved Users Only',
        icon: 'people-outline',
        onPress: () => {
          setCustomOptionsVisible(false);
          handleUpdateSetting('routeVisibility', 'approved_only');
        }
      },
      {
        text: 'Private (Owner Only)',
        icon: 'lock-closed-outline',
        onPress: () => {
          setCustomOptionsVisible(false);
          handleUpdateSetting('routeVisibility', 'private');
        }
      }
    ];

    setCustomOptionsConfig({
      title: 'Route Visibility',
      message: 'Control who can view your completed traveling routes',
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
          <LoadingGlobe size="large" color={theme.colors.primary} />
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
      
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
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
              trackColor={{ false: 'rgba(28, 115, 180, 0.20)', true: '#50C878' }}
              thumbColor="#FFFFFF"
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
              trackColor={{ false: 'rgba(28, 115, 180, 0.20)', true: '#50C878' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleRouteVisibilityChange}
            disabled={updatingKeysRef.current.has('routeVisibility')}
          >
            <View style={styles.settingContent}>
              <Ionicons name="map-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Route Visibility
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Control who can see your travel routes
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                {(() => {
                  const visibility = settings?.privacy?.routeVisibility;
                  if (visibility === 'everyone') return 'Everyone';
                  if (visibility === 'approved_only') return 'Approved Only';
                  if (visibility === 'private') return 'Private (Owner Only)';
                  return 'Everyone';
                })()}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>

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
              trackColor={{ false: 'rgba(28, 115, 180, 0.20)', true: '#50C878' }}
              thumbColor="#FFFFFF"
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
              <Ionicons name="time-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Account Activity
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  View your account activity
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {(isIOS || isAndroid) && (
            <TouchableOpacity
              style={styles.settingItem}
              disabled={isOpeningConsentForm}
              onPress={async () => {
                if (isOpeningConsentForm) return;
                try {
                  setIsOpeningConsentForm(true);
                  const opened = await showConsentForm();
                  if (!opened) {
                    showAlert(
                      'Privacy options are not available right now for your region/session.',
                      'Not Available',
                      'info'
                    );
                  }
                } catch {
                  showError('Unable to open privacy settings. Please try again.');
                } finally {
                  if (isMountedRef.current) {
                    setIsOpeningConsentForm(false);
                  }
                }
              }}
            >
              <View style={styles.settingContent}>
                <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.text} />
                <View style={styles.settingText}>
                  <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                    Manage Privacy Settings
                  </Text>
                  <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                    Update your ad personalization and consent choices
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Requests & Approvals */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Requests & Approvals
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              router.push('/settings/follow-requests');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="person-add-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Manage Follow Requests
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  View and manage pending follow requests
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              router.push('/settings/route-access-requests');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="git-pull-request-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Manage Route Access Requests
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Approve or decline requests to view your routes
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
              <Ionicons name="ban-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
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
    marginHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    marginTop: isTablet ? theme.spacing.md : 8,
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  sectionTitle: {
    fontSize: isTablet ? theme.typography.h3.fontSize : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
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
    borderBottomColor: 'rgba(28, 115, 180, 0.15)',
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
