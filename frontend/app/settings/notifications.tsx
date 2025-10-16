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
import CustomAlert, { CustomAlertButton } from '../../components/CustomAlert';

export default function NotificationsSettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
    buttons: [{ text: 'OK' }] as CustomAlertButton[],
  });
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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settingsData = await getSettings();
      setSettings(settingsData.settings);
    } catch (error) {
      Alert.alert('Error', 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    if (!settings) return;
    
    setUpdating(true);
    try {
      const updatedSettings = {
        ...settings.notifications,
        [key]: value
      };
      
      const response = await updateSettingCategory('notifications', updatedSettings);
      setSettings(response.settings);
    } catch (error) {
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setUpdating(false);
    }
  };

  const toggleAllNotifications = (value: boolean) => {
    if (!settings) return;
    
    const updatedSettings = {
      pushNotifications: value,
      emailNotifications: value,
      likesNotifications: value,
      commentsNotifications: value,
      followsNotifications: value,
      messagesNotifications: value
    };
    
    updateSettingCategory('notifications', updatedSettings).then(response => {
      setSettings(response.settings);
    }).catch(error => {
      Alert.alert('Error', 'Failed to update settings');
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title="Notifications" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  const allNotificationsEnabled = settings?.notifications?.pushNotifications && 
                                 settings?.notifications?.emailNotifications &&
                                 settings?.notifications?.likesNotifications &&
                                 settings?.notifications?.commentsNotifications &&
                                 settings?.notifications?.followsNotifications &&
                                 settings?.notifications?.messagesNotifications;

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
              disabled={updating}
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
              onValueChange={(value) => updateSetting('pushNotifications', value)}
              disabled={updating}
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
              onValueChange={(value) => updateSetting('emailNotifications', value)}
              disabled={updating}
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
              onValueChange={(value) => updateSetting('likesNotifications', value)}
              disabled={updating}
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
              onValueChange={(value) => updateSetting('commentsNotifications', value)}
              disabled={updating}
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
              onValueChange={(value) => updateSetting('followsNotifications', value)}
              disabled={updating}
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
              onValueChange={(value) => updateSetting('messagesNotifications', value)}
              disabled={updating}
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
