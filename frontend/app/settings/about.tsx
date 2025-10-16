import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getUserFromStorage } from '../../services/auth';
import CustomAlert, { CustomAlertButton } from '../../components/CustomAlert';

export default function AboutSettingsScreen() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await getUserFromStorage();
      setUser(userData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load user data');
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
        Alert.alert('Error', 'Cannot open this link');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open link');
    }
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'How would you like to contact us?',
      [
        { text: 'Email', onPress: () => handleOpenLink('mailto:support@taatom.com') },
        { text: 'Website', onPress: () => handleOpenLink('https://taatom.com/support') },
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

  const handleShareApp = () => {
    Alert.alert(
      'Share Taatom',
      'Share Taatom with your friends!',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share', onPress: () => {
          Alert.alert('Share', 'Sharing feature will be available soon');
        }}
      ]
    );
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
              Version 1.0.0
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
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {user?._id ? user._id.substring(0, 8) + '...' : 'Unknown'}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              Member Since
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
              Last Login
            </Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Unknown'}
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
            onPress={handleContactSupport}
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
            onPress={() => handleOpenLink('https://taatom.com/help')}
          >
            <View style={styles.settingContent}>
              <Ionicons name="book-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                Help Center
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => handleOpenLink('https://taatom.com/privacy')}
          >
            <View style={styles.settingContent}>
              <Ionicons name="shield-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                Privacy Policy
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => handleOpenLink('https://taatom.com/terms')}
          >
            <View style={styles.settingContent}>
              <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                Terms of Service
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
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
            onPress={() => {
              Alert.alert('Check for Updates', 'You are using the latest version of Taatom!');
            }}
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
              1.0.0 (100)
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
  appInfoContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 16,
    marginBottom: 8,
  },
  appDescription: {
    fontSize: 14,
    textAlign: 'center',
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
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
