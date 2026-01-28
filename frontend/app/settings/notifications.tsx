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
  Dimensions,
  TextInput,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { useSettings } from '../../context/SettingsContext';
import CustomAlert from '../../components/CustomAlert';
import { createLogger } from '../../utils/logger';
import { theme } from '../../constants/theme';
import { Linking } from 'react-native';
import { fcmService } from '../../services/fcm';

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

const logger = createLogger('NotificationsSettings');

export default function NotificationsSettingsScreen() {
  // Settings State Single Source of Truth: Use SettingsContext
  const { settings, loading: settingsLoading, updateSetting, refreshSettings } = useSettings();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
  });
  
  // Navigation & Lifecycle Safety: Track mounted state
  const isMountedRef = useRef(true);
  
  // Toggle Interaction Safety: Per-toggle guards to prevent multiple API calls
  const updatingKeysRef = useRef<Set<string>>(new Set());
  const [updatingKeys, setUpdatingKeys] = useState<Set<string>>(new Set());
  
  const [pushPermissionStatus, setPushPermissionStatus] = useState<string>('unknown');
  const [quietHoursModalVisible, setQuietHoursModalVisible] = useState(false);
  const [quietHoursConfig, setQuietHoursConfig] = useState({
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
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

  // Navigation & Lifecycle Safety: Setup and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Check push notification permission status (using FCM)
  const checkPushPermissionStatus = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        // Web doesn't support push notifications the same way
        setPushPermissionStatus('not-applicable');
        return;
      }
      
      // Use FCM to check permission status (without requesting)
      try {
        const messaging = require('@react-native-firebase/messaging').default;
        if (messaging) {
          // Check current permission status (don't request)
          const authStatus = await messaging().hasPermission();
          // Map FCM permission status to string format
          if (authStatus === messaging.AuthorizationStatus.AUTHORIZED || 
              authStatus === messaging.AuthorizationStatus.PROVISIONAL) {
            setPushPermissionStatus('granted');
          } else if (authStatus === messaging.AuthorizationStatus.DENIED) {
            setPushPermissionStatus('denied');
          } else {
            setPushPermissionStatus('unknown');
          }
        } else {
          setPushPermissionStatus('unknown');
        }
      } catch (fcmError: any) {
        // FCM not available - try alternative method
        logger.debug('FCM not available, trying alternative method', fcmError);
        try {
          // Try using expo-notifications as fallback
          const { getPermissionsAsync } = require('expo-notifications');
          const { status } = await getPermissionsAsync();
          if (status === 'granted') {
            setPushPermissionStatus('granted');
          } else if (status === 'denied') {
            setPushPermissionStatus('denied');
          } else {
            setPushPermissionStatus('unknown');
          }
        } catch (expoError) {
          // Both methods failed - fallback to unknown
          setPushPermissionStatus('unknown');
        }
      }
    } catch (error) {
      logger.error('Error checking push permission status', error);
      setPushPermissionStatus('unknown');
    }
  }, []);

  // Navigation & Lifecycle Safety: Refresh settings on focus
  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      refreshSettings();
      checkPushPermissionStatus();
      return () => {
        // Screen blurred - cleanup
      };
    }, [refreshSettings, checkPushPermissionStatus])
  );

  // Request push notification permission (using FCM)
  const requestPushPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        showAlert('Push notifications are not available on web', 'Not Available', 'info');
        return;
      }
      
      // Use FCM to request permission
      try {
        const messaging = require('@react-native-firebase/messaging').default;
        if (messaging) {
          const authStatus = await messaging().requestPermission();
          const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                         authStatus === messaging.AuthorizationStatus.PROVISIONAL;
          
          setPushPermissionStatus(enabled ? 'granted' : 'denied');
          
          if (enabled) {
            // Re-initialize FCM to get token
            await fcmService.initialize();
            // Refresh permission status
            await checkPushPermissionStatus();
            showAlert('Push notifications enabled!', 'Success', 'success');
          } else {
            // Refresh permission status
            await checkPushPermissionStatus();
            showAlert('Push notifications permission denied. You can enable it in your device settings.', 'Permission Denied', 'warning');
          }
        } else {
          setPushPermissionStatus('unknown');
          showAlert('Push notifications are not available. Use a development build for FCM support.', 'Not Available', 'warning');
        }
      } catch (fcmError: any) {
        logger.error('Error requesting push permission via FCM', fcmError);
        setPushPermissionStatus('unknown');
        showError('Failed to request push notification permission');
      }
    } catch (error: any) {
      logger.error('Error requesting push permission', error);
      showError('Failed to request push notification permission');
    }
  }, [showAlert, showError]);

  // Open system settings
  const openSystemSettings = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else if (Platform.OS === 'android') {
        await Linking.openSettings();
      } else {
        showAlert('Please enable push notifications in your browser settings', 'Settings', 'info');
      }
    } catch (error) {
      logger.error('Error opening system settings', error);
      showError('Failed to open system settings');
    }
  }, [showAlert, showError]);

  // Load quiet hours from settings
  useEffect(() => {
    if (settings?.notifications?.quietHours) {
      setQuietHoursConfig(settings.notifications.quietHours);
    }
  }, [settings?.notifications?.quietHours]);

  // Save quiet hours
  const saveQuietHours = useCallback(async () => {
    try {
      await updateSetting('notifications', 'quietHours', quietHoursConfig);
      setQuietHoursModalVisible(false);
      showAlert('Quiet hours updated successfully', 'Success', 'success');
    } catch (error: any) {
      showError(error.message || 'Failed to update quiet hours');
    }
  }, [quietHoursConfig, updateSetting, showAlert, showError]);

  // Toggle Interaction Safety: Wrapper with per-toggle guard
  const handleUpdateSetting = useCallback(async (key: string, value: any) => {
    if (!settings) return;
    
    // Prevent re-entry while API call is in-flight
    if (updatingKeysRef.current.has(key)) {
      logger.debug(`Update already in progress for ${key}, skipping`);
      return;
    }
    
    updatingKeysRef.current.add(key);
    setUpdatingKeys(new Set(updatingKeysRef.current));
    
    try {
      await updateSetting('notifications', key, value);
      // Success feedback handled by context
    } catch (error: any) {
      if (isMountedRef.current) {
        logger.error(`Failed to update setting ${key}`, error);
        Alert.alert('Error', 'Failed to update setting');
      }
    } finally {
      updatingKeysRef.current.delete(key);
      setUpdatingKeys(new Set(updatingKeysRef.current));
    }
  }, [settings, updateSetting]);

  // Toggle Interaction Safety: Handle bulk toggle with guards
  const toggleAllNotifications = useCallback(async (value: boolean) => {
    if (!settings) return;
    
    const key = 'allNotifications';
    if (updatingKeysRef.current.has(key)) {
      logger.debug('Bulk notification update already in progress, skipping');
      return;
    }
    
    updatingKeysRef.current.add(key);
    setUpdatingKeys(new Set(updatingKeysRef.current));
    
    try {
      // Update all notification settings in parallel
      await Promise.all([
        updateSetting('notifications', 'pushNotifications', value),
        updateSetting('notifications', 'emailNotifications', value),
        updateSetting('notifications', 'likesNotifications', value),
        updateSetting('notifications', 'commentsNotifications', value),
        updateSetting('notifications', 'followsNotifications', value),
        updateSetting('notifications', 'messagesNotifications', value)
      ]);
    } catch (error: any) {
      if (isMountedRef.current) {
        logger.error('Failed to update all notifications', error);
        Alert.alert('Error', 'Failed to update settings');
      }
    } finally {
      updatingKeysRef.current.delete(key);
      setUpdatingKeys(new Set(updatingKeysRef.current));
    }
  }, [settings, updateSetting]);

  // Screen Load Performance: Memoize loading state and derived values
  const isLoading = useMemo(() => settingsLoading || !settings, [settingsLoading, settings]);
  
  const allNotificationsEnabled = useMemo(() => {
    if (!settings?.notifications) return false;
    return settings.notifications.pushNotifications && 
           settings.notifications.emailNotifications &&
           settings.notifications.likesNotifications &&
           settings.notifications.commentsNotifications &&
           settings.notifications.followsNotifications &&
           settings.notifications.messagesNotifications;
  }, [settings?.notifications]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title="Notifications" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar 
        title="Notifications" 
        showBack={true}
        onBack={() => router.back()}
      />
      
      <ScrollView 
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Notification Overview */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Notification Overview
          </Text>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="notifications-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  All Notifications
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Enable or disable all notifications
                </Text>
              </View>
            </View>
            <Switch
              value={allNotificationsEnabled || false}
              onValueChange={toggleAllNotifications}
              disabled={updatingKeys.has('allNotifications')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
              thumbColor={allNotificationsEnabled ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>
        </View>

        {/* Push Notifications */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Push Notifications
          </Text>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="phone-portrait-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Push Notifications
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Receive notifications on your device
                </Text>
              </View>
            </View>
            <Switch
              value={settings?.notifications?.pushNotifications || false}
              onValueChange={(value) => handleUpdateSetting('pushNotifications', value)}
              disabled={updatingKeys.has('pushNotifications')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
              thumbColor={settings?.notifications?.pushNotifications ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="mail-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Email Notifications
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Receive notifications via email
                </Text>
              </View>
            </View>
            <Switch
              value={settings?.notifications?.emailNotifications || false}
              onValueChange={(value) => handleUpdateSetting('emailNotifications', value)}
              disabled={updatingKeys.has('emailNotifications')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
              thumbColor={settings?.notifications?.emailNotifications ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>
        </View>

        {/* Activity Notifications */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Activity Notifications
          </Text>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="heart-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Likes
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  When someone likes your posts
                </Text>
              </View>
            </View>
            <Switch
              value={settings?.notifications?.likesNotifications || false}
              onValueChange={(value) => handleUpdateSetting('likesNotifications', value)}
              disabled={updatingKeys.has('likesNotifications')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
              thumbColor={settings?.notifications?.likesNotifications ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="chatbubble-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Comments
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  When someone comments on your posts
                </Text>
              </View>
            </View>
            <Switch
              value={settings?.notifications?.commentsNotifications || false}
              onValueChange={(value) => handleUpdateSetting('commentsNotifications', value)}
              disabled={updatingKeys.has('commentsNotifications')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
              thumbColor={settings?.notifications?.commentsNotifications ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="person-add-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Follows
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  When someone follows you
                </Text>
              </View>
            </View>
            <Switch
              value={settings?.notifications?.followsNotifications || false}
              onValueChange={(value) => handleUpdateSetting('followsNotifications', value)}
              disabled={updatingKeys.has('followsNotifications')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
              thumbColor={settings?.notifications?.followsNotifications ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="chatbubbles-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Messages
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  When you receive new messages
                </Text>
              </View>
            </View>
            <Switch
              value={settings?.notifications?.messagesNotifications || false}
              onValueChange={(value) => handleUpdateSetting('messagesNotifications', value)}
              disabled={updatingKeys.has('messagesNotifications')}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
              thumbColor={settings?.notifications?.messagesNotifications ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>
        </View>

        {/* Notification Settings */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Notification Settings
          </Text>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="moon-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Quiet Hours
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  {quietHoursConfig.enabled 
                    ? `${quietHoursConfig.startTime} - ${quietHoursConfig.endTime}`
                    : 'Set times when you don\'t want notifications'}
                </Text>
              </View>
            </View>
            <Switch
              value={quietHoursConfig.enabled}
              onValueChange={(value) => {
                setQuietHoursConfig(prev => ({ ...prev, enabled: value }));
                if (value) {
                  setQuietHoursModalVisible(true);
                } else {
                  handleUpdateSetting('quietHours', { ...quietHoursConfig, enabled: false });
                }
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '40' }}
              thumbColor={quietHoursConfig.enabled ? theme.colors.primary : theme.colors.textSecondary}
            />
          </View>

          {quietHoursConfig.enabled && (
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => setQuietHoursModalVisible(true)}
            >
              <View style={styles.settingContent}>
                <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                  Configure Quiet Hours
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="notifications-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Push Notification Permission
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  {pushPermissionStatus === 'granted' 
                    ? 'Notifications enabled'
                    : pushPermissionStatus === 'denied'
                    ? 'Notifications disabled'
                    : pushPermissionStatus === 'not-applicable'
                    ? 'Not available on web'
                    : 'Check permission status'}
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              {pushPermissionStatus === 'granted' ? (
                <View style={[styles.permissionBadge, { backgroundColor: theme.colors.success + '20' }]}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.success || '#4CAF50'} />
                  <Text style={[styles.permissionText, { color: theme.colors.success || '#4CAF50' }]}>
                    Enabled
                  </Text>
                </View>
              ) : pushPermissionStatus === 'denied' ? (
                <TouchableOpacity
                  style={[styles.permissionButton, { backgroundColor: theme.colors.primary }]}
                  onPress={openSystemSettings}
                >
                  <Text style={styles.permissionButtonText}>Open Settings</Text>
                </TouchableOpacity>
              ) : pushPermissionStatus !== 'not-applicable' ? (
                <TouchableOpacity
                  style={[styles.permissionButton, { backgroundColor: theme.colors.primary }]}
                  onPress={requestPushPermission}
                >
                  <Text style={styles.permissionButtonText}>Enable</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              Alert.alert('Coming Soon', 'Notification sound settings will be available soon');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="volume-high-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Notification Sound
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Customize notification sounds
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              <View style={[styles.comingSoonBadge, { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
                <Text style={[styles.comingSoonText, { color: theme.colors.primary }]}>
                  Coming Soon
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
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

      {/* Quiet Hours Modal */}
      <Modal
        visible={quietHoursModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setQuietHoursModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Quiet Hours
              </Text>
              <TouchableOpacity onPress={() => setQuietHoursModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <View style={styles.timeInputContainer}>
                <Text style={[styles.timeLabel, { color: theme.colors.text }]}>Start Time</Text>
                <TextInput
                  style={[styles.timeInput, { 
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: theme.colors.border
                  }]}
                  value={quietHoursConfig.startTime}
                  onChangeText={(text) => {
                    // Validate time format HH:MM
                    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(text) || text === '') {
                      setQuietHoursConfig(prev => ({ ...prev, startTime: text }));
                    }
                  }}
                  placeholder="22:00"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>

              <View style={styles.timeInputContainer}>
                <Text style={[styles.timeLabel, { color: theme.colors.text }]}>End Time</Text>
                <TextInput
                  style={[styles.timeInput, { 
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: theme.colors.border
                  }]}
                  value={quietHoursConfig.endTime}
                  onChangeText={(text) => {
                    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(text) || text === '') {
                      setQuietHoursConfig(prev => ({ ...prev, endTime: text }));
                    }
                  }}
                  placeholder="08:00"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>

              <Text style={[styles.daysLabel, { color: theme.colors.text }]}>Active Days</Text>
              <View style={styles.daysContainer}>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      {
                        backgroundColor: quietHoursConfig.days.includes(day)
                          ? theme.colors.primary
                          : theme.colors.background,
                        borderColor: theme.colors.border
                      }
                    ]}
                    onPress={() => {
                      setQuietHoursConfig(prev => ({
                        ...prev,
                        days: prev.days.includes(day)
                          ? prev.days.filter(d => d !== day)
                          : [...prev.days, day]
                      }));
                    }}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        {
                          color: quietHoursConfig.days.includes(day)
                            ? '#FFFFFF'
                            : theme.colors.text
                        }
                      ]}
                    >
                      {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.border }]}
                onPress={() => setQuietHoursModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={saveQuietHours}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comingSoonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  comingSoonText: {
    fontSize: 10,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  permissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  permissionText: {
    fontSize: 10,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  permissionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    ...(isWeb && {
      maxWidth: 500,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: isTablet ? theme.typography.h3.fontSize : 20,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  modalBody: {
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  timeInputContainer: {
    marginBottom: isTablet ? theme.spacing.lg : 16,
  },
  timeLabel: {
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    padding: isTablet ? theme.spacing.md : 12,
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 18,
    fontFamily: getFontFamily('500'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  daysLabel: {
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  dayButtonText: {
    fontSize: 12,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  modalFooter: {
    flexDirection: 'row',
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});
