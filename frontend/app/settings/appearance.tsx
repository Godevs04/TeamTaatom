import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Switch,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getSettings, updateSettingCategory, UserSettings } from '../../services/settings';
import { useAlert } from '../../context/AlertContext';
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

export default function AppearanceSettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();
  const { theme, setMode, mode } = useTheme();
  const { showError, showSuccess, showConfirm, showOptions } = useAlert();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settingsData = await getSettings();
      setSettings(settingsData.settings);
    } catch (error) {
      showError('Failed to load appearance settings');
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
      
      // If theme is being changed, also update the context
      if (key === 'theme') {
        setMode(value);
      }
    } catch (error) {
      showError('Failed to update setting');
    } finally {
      setUpdating(false);
    }
  };

  const handleThemeChange = () => {
    showOptions(
      'Select Theme',
      [
        { text: 'Light', icon: 'sunny-outline', onPress: () => {
          updateSetting('theme', 'light');
          showSuccess('Theme changed to Light');
        }},
        { text: 'Dark', icon: 'moon-outline', onPress: () => {
          updateSetting('theme', 'dark');
          showSuccess('Theme changed to Dark');
        }},
      ],
      'Choose your preferred theme mode',
      true,
      'Cancel'
    );
  };

  const handleFontSizeChange = () => {
    showOptions(
      'Font Size',
      [
        { text: 'Small', icon: 'text-outline', onPress: () => {
          updateSetting('fontSize', 'small');
          showSuccess('Font size set to Small');
        }},
        { text: 'Medium', icon: 'text-outline', onPress: () => {
          updateSetting('fontSize', 'medium');
          showSuccess('Font size set to Medium');
        }},
        { text: 'Large', icon: 'text-outline', onPress: () => {
          updateSetting('fontSize', 'large');
          showSuccess('Font size set to Large');
        }},
      ],
      'Select your preferred font size',
      true,
      'Cancel'
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title="Appearance" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar 
        title="Appearance" 
        showBack={true}
        onBack={() => router.back()}
      />
      
      <ScrollView style={styles.scrollView}>
        {/* Quick Theme Toggle */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Quick Actions
          </Text>

          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="moon-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Quick Theme Toggle
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Instantly switch between light and dark theme
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              style={[styles.toggleButton, { borderWidth:1, borderColor: theme.colors.primary }]}
              accessibilityLabel="Quick theme toggle"
            >
              <Ionicons 
                name={mode === 'dark' ? 'moon' : 'sunny'} 
                size={16} 
                color={theme.colors.primary} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Theme Settings */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Theme Settings
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleThemeChange}
            disabled={updating}
          >
            <View style={styles.settingContent}>
              <Ionicons name="color-palette-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Theme Preference
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Choose your preferred theme mode
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                {settings?.account?.theme === 'light' ? 'Light' : 
                 settings?.account?.theme === 'dark' ? 'Dark' : 'Light'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Display Settings */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Display
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleFontSizeChange}
          >
            <View style={styles.settingContent}>
              <Ionicons name="text-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Font Size
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Adjust the size of text
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                Medium
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              showSuccess('Display density settings will be available soon');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="grid-outline" size={20} color={theme.colors.primary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                  Display Density
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Adjust the density of UI elements
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Visual Effects */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Visual Effects
          </Text>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              showSuccess('Animation settings will be available soon');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="flash-outline" size={20} color={theme.colors.primary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                  Animations
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Control app animations and transitions
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              showSuccess('Haptic feedback settings will be available soon');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="phone-portrait-outline" size={20} color={theme.colors.primary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                  Haptic Feedback
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Control vibration feedback
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Preview */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Preview
          </Text>

          <View style={[styles.previewContainer, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.previewCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.previewHeader}>
                <View style={[styles.previewAvatar, { backgroundColor: theme.colors.primary }]} />
                <View style={styles.previewText}>
                  <View style={[styles.previewLine, { backgroundColor: theme.colors.text, width: '60%' }]} />
                  <View style={[styles.previewLine, { backgroundColor: theme.colors.textSecondary, width: '40%' }]} />
                </View>
              </View>
              <View style={styles.previewContent}>
                <View style={[styles.previewLine, { backgroundColor: theme.colors.textSecondary, width: '100%' }]} />
                <View style={[styles.previewLine, { backgroundColor: theme.colors.textSecondary, width: '80%' }]} />
                <View style={[styles.previewLine, { backgroundColor: theme.colors.textSecondary, width: '90%' }]} />
              </View>
            </View>
          </View>
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
  toggleButton: {
    width: isTablet ? 40 : 32,
    height: isTablet ? 40 : 32,
    borderRadius: isTablet ? 20 : 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    padding: isTablet ? theme.spacing.lg : theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
  },
  previewCard: {
    padding: isTablet ? theme.spacing.lg : theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: isTablet ? theme.spacing.md : 12,
  },
  previewAvatar: {
    width: isTablet ? 50 : 40,
    height: isTablet ? 50 : 40,
    borderRadius: isTablet ? 25 : 20,
    marginRight: isTablet ? theme.spacing.md : 12,
  },
  previewText: {
    flex: 1,
  },
  previewContent: {
    marginTop: isTablet ? theme.spacing.sm : 8,
  },
  previewLine: {
    height: isTablet ? 10 : 8,
    borderRadius: isTablet ? 5 : 4,
    marginBottom: isTablet ? 8 : 6,
  },
});
