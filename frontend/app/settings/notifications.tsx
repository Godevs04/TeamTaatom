import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { useSettings } from '../../context/SettingsContext';
import CustomAlert, { CustomAlertButton } from '../../components/CustomAlert';
import { createLogger } from '../../utils/logger';

const logger = createLogger('NotificationsSettings');

export default function NotificationsSettingsScreen() {
  // Settings State Single Source of Truth: Use SettingsContext
  const { settings, loading: settingsLoading, updateSetting, refreshSettings } = useSettings();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
    buttons: [{ text: 'OK' }] as CustomAlertButton[],
  });
  
  // Navigation & Lifecycle Safety: Track mounted state
  const isMountedRef = useRef(true);
  
  // Toggle Interaction Safety: Per-toggle guards to prevent multiple API calls
  const updatingKeysRef = useRef<Set<string>>(new Set());
  
  const router = useRouter();
  const { theme } = useTheme();

  const showAlert = (message: string, title?: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', buttons: CustomAlertButton[] = [{ text: 'OK' }]) => {
    setAlertConfig({ title: title || '', message, type, buttons });
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

  // Navigation & Lifecycle Safety: Refresh settings on focus
  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      refreshSettings();
      return () => {
        // Screen blurred - cleanup
      };
    }, [refreshSettings])
  );

  // Toggle Interaction Safety: Wrapper with per-toggle guard
  const handleUpdateSetting = useCallback(async (key: string, value: any) => {
    if (!settings) return;
    
    // Prevent re-entry while API call is in-flight
    if (updatingKeysRef.current.has(key)) {
      logger.debug(`Update already in progress for ${key}, skipping`);
      return;
    }
    
    updatingKeysRef.current.add(key);
    
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
      
      <ScrollView style={styles.scrollView}>
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
              disabled={updatingKeysRef.current.has('allNotifications')}
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
              disabled={updatingKeysRef.current.has('pushNotifications')}
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
              disabled={updatingKeysRef.current.has('emailNotifications')}
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
              disabled={updatingKeysRef.current.has('likesNotifications')}
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
              disabled={updatingKeysRef.current.has('commentsNotifications')}
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
              disabled={updatingKeysRef.current.has('followsNotifications')}
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
              disabled={updatingKeysRef.current.has('messagesNotifications')}
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

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              Alert.alert('Coming Soon', 'Quiet hours feature will be available soon');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="moon-outline" size={20} color={theme.colors.primary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                  Quiet Hours
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Set times when you don't want notifications
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              Alert.alert('Coming Soon', 'Notification sound settings will be available soon');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="volume-high-outline" size={20} color={theme.colors.primary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                  Notification Sound
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Customize notification sounds
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
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
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
});
