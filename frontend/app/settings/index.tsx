import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getUserFromStorage } from '../../services/auth';
import { getSettings, updateSettings, resetSettings, UserSettings } from '../../services/settings';
import { useAlert } from '../../context/AlertContext';

interface SettingsSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  route: string;
}

const settingsSections: SettingsSection[] = [
  {
    id: 'account',
    title: 'Account',
    icon: 'person-circle-outline',
    description: 'Profile info, language, data usage, and account actions',
    route: '/settings/account'
  },
  {
    id: 'privacy',
    title: 'Privacy & Security',
    icon: 'shield-checkmark-outline',
    description: 'Profile visibility, communication controls, and security',
    route: '/settings/privacy'
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: 'notifications-outline',
    description: 'Push notifications, email alerts, and activity settings',
    route: '/settings/notifications'
  },
  {
    id: 'appearance',
    title: 'Appearance & Theme',
    icon: 'color-palette-outline',
    description: 'Theme settings, display options, and visual effects',
    route: '/settings/appearance'
  },
  {
    id: 'data',
    title: 'Data & Storage',
    icon: 'cloud-outline',
    description: 'Storage usage, cache management, and sync settings',
    route: '/settings/data'
  },
  {
    id: 'about',
    title: 'About',
    icon: 'information-circle-outline',
    description: 'App version, support, and legal information',
    route: '/settings/about'
  }
];

export default function SettingsScreen() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { showSuccess, showError, showConfirm, showOptions } = useAlert();

  const loadUserData = useCallback(async () => {
    try {
      const userData = await getUserFromStorage();
      if (!userData) {
        router.replace('/(auth)/signin');
        return;
      }
      setUser(userData);
      
      // Load settings
      const settingsData = await getSettings();
      setSettings(settingsData.settings);
    } catch (error: any) {
      console.error('Failed to load settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  }, [loadUserData]);

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetSettings();
              await loadUserData();
              Alert.alert('Success', 'Settings have been reset to default');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset settings');
            }
          },
        },
      ]
    );
  };

  const navigateToSection = (section: SettingsSection) => {
    router.push(section.route as any);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title="Settings" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar 
        title="Settings" 
        showBack={true}
        onBack={() => router.back()}
        rightComponent={
          <TouchableOpacity
            style={[styles.themeToggle, { backgroundColor: theme.colors.primary }]}
            onPress={toggleTheme}
          >
            <Ionicons name="contrast-outline" size={20} color="white" />
          </TouchableOpacity>
        }
      />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* User Info Header */}
        <View style={[styles.headerContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: theme.colors.text }]}>
              {user?.fullName || 'User'}
            </Text>
            <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>
              {user?.email}
            </Text>
          </View>
        </View>

        {/* Settings Sections */}
        <View style={styles.sectionsContainer}>
          {settingsSections.map((section) => (
            <TouchableOpacity
              key={section.id}
              style={[styles.sectionItem, { backgroundColor: theme.colors.surface }]}
              onPress={() => navigateToSection(section)}
            >
              <View style={styles.sectionContent}>
                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Ionicons 
                    name={section.icon as any} 
                    size={24} 
                    color={theme.colors.primary} 
                  />
                </View>
                <View style={styles.sectionText}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    {section.title}
                  </Text>
                  <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary }]}>
                    {section.description}
                  </Text>
                </View>
                <Ionicons 
                  name="chevron-forward" 
                  size={20} 
                  color={theme.colors.textSecondary} 
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Reset Settings */}
        <View style={styles.resetContainer}>
          <TouchableOpacity
            style={[styles.resetButton, { backgroundColor: theme.colors.error + '20' }]}
            onPress={handleResetSettings}
          >
            <Ionicons name="refresh-outline" size={20} color={theme.colors.error} />
            <Text style={[styles.resetButtonText, { color: theme.colors.error }]}>
              Reset All Settings
            </Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: theme.colors.textSecondary }]}>
            Taatom v1.0.0
          </Text>
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
  headerContainer: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  sectionsContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionItem: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  sectionText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  resetContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 12,
  },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
