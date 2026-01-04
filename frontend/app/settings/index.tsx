import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  RefreshControl,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getUserFromStorage } from '../../services/auth';
import { useSettings } from '../../context/SettingsContext';
import { useAlert } from '../../context/AlertContext';
import { createLogger } from '../../utils/logger';
import { theme } from '../../constants/theme';

// Responsive dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Elegant font families for each platform
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) {
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    return 'System';
  }
  return 'Roboto';
};

// Get version from package.json
let appVersion = '1.0.0';
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const packageJson = require('../../../package.json');
  appVersion = packageJson.version || '1.0.0';
} catch {
  // Fallback if package.json is not accessible
  appVersion = '1.0.0';
}

const logger = createLogger('SettingsScreen');

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
    id: 'collections',
    title: 'Collections',
    icon: 'albums-outline',
    description: 'Organise your trips and posts',
    route: '/collections'
  },
  {
    id: 'activity',
    title: 'Activity Feed',
    icon: 'pulse-outline',
    description: 'See what your friends are up to',
    route: '/activity'
  },
  {
    id: 'manage-posts',
    title: 'Manage Posts',
    icon: 'library-outline',
    description: 'View and restore archived or hidden posts',
    route: '/settings/manage-posts'
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
  
  // Settings State Single Source of Truth: Use SettingsContext
  const { settings, loading: settingsLoading, resetAllSettings, refreshSettings } = useSettings();
  
  // Navigation & Lifecycle Safety: Track mounted state
  const isMountedRef = useRef(true);
  
  const router = useRouter();
  const { theme, setMode, mode } = useTheme();
  const { showSuccess, showError, showConfirm, showOptions } = useAlert();

  const loadUserData = useCallback(async () => {
    try {
      const userData = await getUserFromStorage();
      if (!userData) {
        router.replace('/(auth)/signin');
        return;
      }
      if (isMountedRef.current) {
        setUser(userData);
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        logger.error('Failed to load user data', error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [router]);

  // Navigation & Lifecycle Safety: Setup and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    loadUserData();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadUserData]);

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

  const handleRefresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setRefreshing(true);
    try {
      await Promise.all([loadUserData(), refreshSettings()]);
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [loadUserData, refreshSettings]);

  const handleResetSettings = useCallback(() => {
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
              await resetAllSettings();
              if (isMountedRef.current) {
                Alert.alert('Success', 'Settings have been reset to default');
              }
            } catch (error) {
              if (isMountedRef.current) {
                Alert.alert('Error', 'Failed to reset settings');
              }
            }
          },
        },
      ]
    );
  }, [resetAllSettings]);

  // Screen Load Performance: Memoize navigation handler
  const navigateToSection = useCallback((section: SettingsSection) => {
    router.push(section.route as any);
  }, [router]);

  // Screen Load Performance: Memoize sections list (static data)
  const memoizedSections = useMemo(() => settingsSections, []);

  // Screen Load Performance: Memoize loading state
  const isLoading = useMemo(() => loading || settingsLoading, [loading, settingsLoading]);

  if (isLoading) {
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
        // rightComponent={
        //   <View style={{ flexDirection: 'row', gap: 8 }}>
        //     <TouchableOpacity
        //       style={[styles.themeToggle, { backgroundColor: mode==='dark'? theme.colors.primary : 'transparent', borderWidth:1, borderColor: theme.colors.primary }]}
        //       onPress={() => setMode('dark')}
        //     >
        //       <Ionicons name="moon" size={18} color={theme.colors.primary} />
        //     </TouchableOpacity>
        //     <TouchableOpacity
        //       style={[styles.themeToggle, { backgroundColor: mode==='light'? theme.colors.primary : 'transparent', borderWidth:1, borderColor: theme.colors.primary }]}
        //       onPress={() => setMode('light')}
        //     >
        //       <Ionicons name="sunny" size={18} color={theme.colors.primary} />
        //     </TouchableOpacity>
        //     <TouchableOpacity
        //       style={[styles.themeToggle, { backgroundColor: mode==='auto'? theme.colors.primary : 'transparent', borderWidth:1, borderColor: theme.colors.primary }]}
        //       onPress={() => setMode('auto')}
        //     >
        //       <Ionicons name="sync" size={18} color={theme.colors.primary} />
        //     </TouchableOpacity>
        //   </View>
        // }
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
          {memoizedSections.map((section) => (
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
            Taatom v{appVersion}
          </Text>
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
  headerContainer: {
    margin: isTablet ? theme.spacing.xl : theme.spacing.lg,
    padding: isTablet ? theme.spacing.xl : 20,
    borderRadius: theme.borderRadius.md,
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: isTablet ? theme.typography.h3.fontSize : 20,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  userEmail: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  sectionsContainer: {
    marginHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    marginBottom: isTablet ? theme.spacing.xl : 20,
  },
  sectionItem: {
    marginBottom: isTablet ? theme.spacing.md : 12,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  sectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.lg : theme.spacing.lg,
  },
  iconContainer: {
    width: isTablet ? 56 : 48,
    height: isTablet ? 56 : 48,
    borderRadius: isTablet ? 28 : 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: isTablet ? theme.spacing.lg : 16,
  },
  sectionText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  sectionDescription: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    lineHeight: isTablet ? 22 : 20,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  resetContainer: {
    marginHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    marginBottom: isTablet ? theme.spacing.xl : 20,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isTablet ? theme.spacing.lg : theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  resetButtonText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginLeft: isTablet ? theme.spacing.sm : 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: isTablet ? theme.spacing.xl : 20,
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
