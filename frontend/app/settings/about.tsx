import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Linking,
  Share,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getUserFromStorage } from '../../services/auth';
import api from '../../services/api';
import CustomAlert from '../../components/CustomAlert';
import Constants from 'expo-constants';
import logger from '../../utils/logger';
import { theme } from '../../constants/theme';
import AboutPolicies from '../../components/AboutPolicies';

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

export default function AboutSettingsScreen() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
    showCancel: false,
    confirmText: 'OK',
    onConfirm: undefined as (() => void) | undefined,
  });
  const router = useRouter();
  const { theme } = useTheme();

  const showAlert = (message: string, title?: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', showCancel: boolean = false, onConfirm?: () => void) => {
    setAlertConfig({ 
      title: title || '', 
      message, 
      type, 
      showCancel,
      confirmText: 'OK',
      onConfirm
    });
    setAlertVisible(true);
  };

  const showError = (message: string, title?: string) => {
    showAlert(message, title || 'Error', 'error');
  };

  const showSuccess = (message: string, title?: string) => {
    showAlert(message, title || 'Success', 'success');
  };

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // First load from storage for immediate display
      const cachedUser = await getUserFromStorage();
      setUser(cachedUser);
      
      // Then fetch fresh data from API to get lastLogin
      try {
        const response = await api.get('/api/v1/auth/me');
        if (response.data?.user) {
          setUser(response.data.user);
          // Update storage with fresh data
          await getUserFromStorage(); // This will be updated by auth service
        }
      } catch (apiError: any) {
        // If API fails, use cached data
        logger.debug('Failed to fetch user from API, using cached data:', apiError);
      }
    } catch (error) {
      logger.error('Failed to load user data:', error);
      showError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showError('Cannot open this link. Please check your internet connection.');
      }
    } catch (error: any) {
      logger.error('Error opening link:', error);
      showError('Failed to open link. Please try again.');
    }
  };

  const handleContactSupport = async () => {
    const supportEmail = 'support@taatom.com';
    const supportSubject = encodeURIComponent('Taatom Support Request');
    const supportBody = encodeURIComponent(
      `Hello Taatom Support Team,\n\n` +
      `User ID: ${user?.username ? `@${user.username}` : user?._id || 'Unknown'}\n` +
      `Email: ${user?.email || 'Unknown'}\n` +
      `Platform: ${Platform.OS}\n\n` +
      `Please describe your issue or question below:\n\n`
    );
    
    const mailtoUrl = `mailto:${supportEmail}?subject=${supportSubject}&body=${supportBody}`;
    
    Alert.alert(
      'Contact Support',
      'How would you like to contact us?',
      [
        { 
          text: 'Email', 
          onPress: async () => {
            try {
              const canOpen = await Linking.canOpenURL(mailtoUrl);
              if (canOpen) {
                await Linking.openURL(mailtoUrl);
              } else {
                // Fallback: Copy email to clipboard
                try {
                  if (Platform.OS === 'web') {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      await navigator.clipboard.writeText(supportEmail);
                      showSuccess('Support email copied to clipboard!');
                    } else {
                      showAlert(`Please send an email to: ${supportEmail}`, 'Contact Support');
                    }
                  } else {
                    // Mobile: Show email in alert
                    showAlert(`Please send an email to: ${supportEmail}`, 'Contact Support');
                  }
                } catch (error) {
                  showAlert(`Please send an email to: ${supportEmail}`, 'Contact Support');
                }
              }
            } catch (error) {
              logger.error('Error opening email:', error);
              showError('Failed to open email client');
            }
          }
        },
        { 
          text: 'Website', 
          onPress: () => handleOpenLink('https://taatom.com/support')
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleRateApp = () => {
    Alert.alert(
      'Rate Taatom',
      'Would you like to rate our app?',
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Rate', onPress: () => {
          Alert.alert('Thank You', 'Thank you for your feedback!');
        }}
      ]
    );
  };

  const handleCheckForUpdates = async () => {
    try {
      setLoading(true);
      // In a real app, you would check with your update service
      // For now, we'll check the app version
      const currentVersion = Constants.expoConfig?.version || '1.0.0';
      const buildNumber = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '100';
      
      // Simulate checking for updates (replace with actual API call)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      showSuccess(
        `You are using the latest version!\n\nVersion: ${currentVersion}\nBuild: ${buildNumber}`,
        'Check for Updates'
      );
    } catch (error) {
      logger.error('Error checking for updates:', error);
      showError('Failed to check for updates');
    } finally {
      setLoading(false);
    }
  };

  const handleShareApp = async () => {
    try {
      const shareMessage = `Check out Taatom - Share your moments with the world!\n\n` +
        `Download now: https://taatom.com/download`;
      
      const result = await Share.share({
        message: shareMessage,
        title: 'Share Taatom',
        ...(Platform.OS === 'ios' && {
          url: 'https://taatom.com/download'
        })
      });

      if (result.action === Share.sharedAction) {
        showSuccess('Thank you for sharing Taatom!');
      }
    } catch (error: any) {
      logger.error('Error sharing app:', error);
      if (error.message !== 'User did not share') {
        showError('Failed to share app');
      }
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title="About" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar 
        title="About" 
        showBack={true}
        onBack={() => router.back()}
      />
      
      <ScrollView style={styles.scrollView}>
        {/* App Info */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.appInfoContainer}>
            <View style={[styles.appIcon, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="camera" size={32} color="white" />
            </View>
            <Text style={[styles.appName, { color: theme.colors.text }]}>
              Taatom
            </Text>
            <Text style={[styles.appVersion, { color: theme.colors.textSecondary }]}>
              Version {Constants.expoConfig?.version || '1.0.0'}
            </Text>
            <Text style={[styles.appDescription, { color: theme.colors.textSecondary }]}>
              Share your moments with the world
            </Text>
          </View>
        </View>

        {/* User Info */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Account Information
          </Text>

          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              User ID
            </Text>
            <TouchableOpacity
              onPress={async () => {
                const userIdToCopy = user?.username || user?._id;
                if (userIdToCopy) {
                  try {
                    if (Platform.OS === 'web') {
                      // Web: Use navigator.clipboard
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        await navigator.clipboard.writeText(userIdToCopy);
                        showSuccess('User ID copied to clipboard!');
                      } else {
                        // Fallback for older browsers
                        showAlert(`User ID: ${userIdToCopy}`, 'User ID');
                      }
                    } else {
                      // Mobile: Show alert with User ID (can be manually copied)
                      showAlert(`User ID: ${userIdToCopy}\n\nTap and hold to copy.`, 'User ID');
                    }
                  } catch (error) {
                    logger.error('Error copying User ID:', error);
                    showAlert(`User ID: ${userIdToCopy}`, 'User ID');
                  }
                }
              }}
            >
              <Text style={[styles.infoValue, { color: theme.colors.primary }]}>
                {user?.username ? `@${user.username}` : user?._id ? user._id.substring(0, 8) + '...' : 'Unknown'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              Member Since
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {user?.createdAt 
                ? new Date(user.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit' 
                  })
                : 'Unknown'}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              Last Login
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {user?.lastLogin 
                ? (() => {
                    const lastLoginDate = new Date(user.lastLogin);
                    const now = new Date();
                    const diffMs = now.getTime() - lastLoginDate.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);
                    
                    // Show relative time for recent logins
                    if (diffMins < 1) return 'Just now';
                    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
                    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                    
                    // For older logins, show formatted date
                    return lastLoginDate.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                  })()
                : 'Never'}
            </Text>
          </View>
        </View>

        {/* Support */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Support
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/support/contact')}
          >
            <View style={styles.settingContent}>
              <Ionicons name="help-circle-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                Contact Support
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/support/help')}
          >
            <View style={styles.settingContent}>
              <Ionicons name="book-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                Help Center
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Legal & Policies */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Legal & Policies
          </Text>
          <AboutPolicies />
        </View>

        {/* App Actions */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            App Actions
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleRateApp}
          >
            <View style={styles.settingContent}>
              <Ionicons name="star-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                Rate Taatom
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleShareApp}
          >
            <View style={styles.settingContent}>
              <Ionicons name="share-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                Share Taatom
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleCheckForUpdates}
          >
            <View style={styles.settingContent}>
              <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                Check for Updates
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Legal */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Legal
          </Text>

          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              Copyright
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              © 2024 Taatom Inc.
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              Build Version
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {Constants.expoConfig?.version || '1.0.0'} ({Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '100'})
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              Platform
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              React Native / Expo
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            Made with ❤️ by the Taatom Team
          </Text>
        </View>
      </ScrollView>
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        showCancel={alertConfig.showCancel}
        confirmText={alertConfig.confirmText}
        onConfirm={alertConfig.onConfirm}
        onClose={() => setAlertVisible(false)}
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
  appInfoContainer: {
    alignItems: 'center',
    paddingVertical: isTablet ? theme.spacing.xl : 20,
  },
  appIcon: {
    width: isTablet ? 100 : 80,
    height: isTablet ? 100 : 80,
    borderRadius: isTablet ? 25 : 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isTablet ? theme.spacing.lg : 16,
  },
  appName: {
    fontSize: isTablet ? theme.typography.h2.fontSize : 24,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  appVersion: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('400'),
    marginBottom: isTablet ? theme.spacing.sm : 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  appDescription: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    textAlign: 'center',
    maxWidth: isTablet ? 500 : 300,
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
  settingLabel: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    marginLeft: isTablet ? theme.spacing.md : 12,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: isTablet ? theme.spacing.md : 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  infoLabel: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  infoValue: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: isTablet ? theme.spacing.xl : 20,
  },
  footerText: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    textAlign: 'center',
    maxWidth: isTablet ? 500 : 300,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});
