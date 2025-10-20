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
import { getSettings, updateSettingCategory, UserSettings } from '../../services/settings';
import { useAlert } from '../../context/AlertContext';

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
        { text: 'Auto', icon: 'contrast-outline', onPress: () => {
          updateSetting('theme', 'auto');
          showSuccess('Theme set to Auto');
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
              onPress={() => setMode(mode === 'dark' ? 'light' : mode === 'light' ? 'auto' : 'dark')}
              style={[styles.toggleButton, { borderWidth:1, borderColor: theme.colors.primary }]}
              accessibilityLabel="Quick theme toggle"
            >
              <Ionicons 
                name={mode === 'dark' ? 'moon' : mode === 'light' ? 'sunny' : 'sync'} 
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
                 settings?.account?.theme === 'dark' ? 'Dark' : 'Auto'}
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
  settingValue: {
    fontSize: 14,
    marginRight: 8,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    padding: 16,
    borderRadius: 8,
  },
  previewCard: {
    padding: 16,
    borderRadius: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  previewText: {
    flex: 1,
  },
  previewContent: {
    marginTop: 8,
  },
  previewLine: {
    height: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
});
