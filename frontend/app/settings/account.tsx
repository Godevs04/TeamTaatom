import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getUserFromStorage } from '../../services/auth';
import { getSettings, updateSettingCategory, UserSettings } from '../../services/settings';
import { useAlert } from '../../context/AlertContext';

export default function AccountSettingsScreen() {
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();
  const { showError, showSuccess, showConfirm, showOptions } = useAlert();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await getUserFromStorage();
      const settingsData = await getSettings();
      setUser(userData);
      setSettings(settingsData.settings);
    } catch (err) {
      showError('Failed to load account settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    if (!settings) return;
    
    setUpdating(true);
    try {
      const updatedSettings = {
        ...settings.account,
        [key]: value
      };
      
      const response = await updateSettingCategory('account', updatedSettings);
      setSettings(response.settings);
    } catch (err) {
      showError('Failed to update setting');
    } finally {
      setUpdating(false);
    }
  };

  const handleLanguageChange = () => {
    showOptions(
      'Select Language',
      [
        { text: 'English', icon: 'flag-outline', onPress: () => {
          updateSetting('language', 'en');
          showSuccess('Language updated to English');
        }},
        { text: 'Spanish', icon: 'flag-outline', onPress: () => {
          updateSetting('language', 'es');
          showSuccess('Language updated to Spanish');
        }},
        { text: 'French', icon: 'flag-outline', onPress: () => {
          updateSetting('language', 'fr');
          showSuccess('Language updated to French');
        }},
        { text: 'German', icon: 'flag-outline', onPress: () => {
          updateSetting('language', 'de');
          showSuccess('Language updated to German');
        }},
        { text: 'Chinese', icon: 'flag-outline', onPress: () => {
          updateSetting('language', 'zh');
          showSuccess('Language updated to Chinese');
        }},
      ],
      'Choose your preferred language',
      true,
      'Cancel'
    );
  };


  const handleDataUsageChange = () => {
    showOptions(
      'Data Usage Preference',
      [
        { text: 'Low', icon: 'cellular-outline', onPress: () => {
          updateSetting('dataUsage', 'low');
          showSuccess('Data usage set to Low');
        }},
        { text: 'Medium', icon: 'cellular-outline', onPress: () => {
          updateSetting('dataUsage', 'medium');
          showSuccess('Data usage set to Medium');
        }},
        { text: 'High', icon: 'cellular-outline', onPress: () => {
          updateSetting('dataUsage', 'high');
          showSuccess('Data usage set to High');
        }},
      ],
      'Control how much data the app uses',
      true,
      'Cancel'
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title="Account Settings" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar 
        title="Account Settings" 
        showBack={true}
        onBack={() => router.back()}
      />
      
      <ScrollView style={styles.scrollView}>
        {/* Account Information */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Account Information
          </Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="person-outline" size={20} color={theme.colors.text} />
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                Full Name
              </Text>
            </View>
            <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
              {user?.fullName || 'Not set'}
            </Text>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="mail-outline" size={20} color={theme.colors.text} />
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                Email
              </Text>
            </View>
            <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
              {user?.email}
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              // Navigate back to profile and trigger edit profile modal
              router.back();
              // We'll need to pass a parameter to trigger edit profile
              setTimeout(() => {
                router.push({ pathname: '/profile', params: { editProfile: 'true' } });
              }, 100);
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                Edit Profile
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Preferences
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleLanguageChange}
            disabled={updating}
          >
            <View style={styles.settingContent}>
              <Ionicons name="language-outline" size={20} color={theme.colors.text} />
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                Language
              </Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                {settings?.account?.language === 'en' ? 'English' : 
                 settings?.account?.language === 'es' ? 'Spanish' : 
                 settings?.account?.language === 'fr' ? 'French' : 'English'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleDataUsageChange}
            disabled={updating}
          >
            <View style={styles.settingContent}>
              <Ionicons name="cellular-outline" size={20} color={theme.colors.text} />
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                Data Usage
              </Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                {settings?.account?.dataUsage === 'low' ? 'Low' : 
                 settings?.account?.dataUsage === 'medium' ? 'Medium' : 'High'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/settings/appearance')}
          >
            <View style={styles.settingContent}>
              <Ionicons name="color-palette-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                Appearance & Theme
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Account Actions */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Account Actions
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push('/(auth)/forgot')}
          >
            <View style={styles.settingContent}>
              <Ionicons name="key-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                Change Password
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.settingItem, styles.dangerItem]}
            onPress={() => {
              showConfirm(
                'Are you sure you want to delete your account? This action cannot be undone.',
                () => {
                  showSuccess('Account deletion feature will be available soon');
                },
                'Delete Account',
                'Delete',
                'Cancel'
              );
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              <Text style={[styles.settingLabel, { color: theme.colors.error }]}>
                Delete Account
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
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
  settingLabel: {
    fontSize: 16,
    marginLeft: 12,
  },
  settingValue: {
    fontSize: 14,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
});
