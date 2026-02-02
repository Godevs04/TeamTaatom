import React, { useEffect, useState, useCallback } from 'react';
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
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { useSettings } from '../../context/SettingsContext';
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
  const [updating, setUpdating] = useState(false);
  const router = useRouter();
  const { theme, setMode, mode } = useTheme();
  const { settings, loading, updateSetting: updateSettingContext, refreshSettings } = useSettings();
  const { showError, showSuccess, showConfirm, showOptions } = useAlert();

  // Refresh settings when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshSettings();
    }, [refreshSettings])
  );

  const updateSetting = async (key: string, value: any) => {
    if (!settings) return;
    
    setUpdating(true);
    try {
      // Use SettingsContext's updateSetting method for proper syncing
      await updateSettingContext('account', key, value);
      
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
            onPress={() => {
              showSuccess('Display density settings will be available soon');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="grid-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Display Density
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Adjust the density of UI elements
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
              <Ionicons name="flash-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Animations
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Control app animations and transitions
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

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => {
              showSuccess('Haptic feedback settings will be available soon');
            }}
          >
            <View style={styles.settingContent}>
              <Ionicons name="phone-portrait-outline" size={20} color={theme.colors.text} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Haptic Feedback
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  Control vibration feedback
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

        {/* Preview */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Preview
          </Text>

          <View style={[styles.previewContainer, { backgroundColor: theme.colors.background }]}>
            {/* Post Card Preview */}
            <View style={[styles.previewCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
              {/* Post Header */}
              <View style={styles.previewPostHeader}>
                <View style={styles.previewPostUserInfo}>
                  <View style={[styles.previewAvatar, { backgroundColor: theme.colors.primary }]} />
                  <View style={styles.previewUserDetails}>
                    <Text style={[styles.previewUserName, { color: theme.colors.text }]}>
                      John Doe
                    </Text>
                    {/* Location - Like home page */}
                    <View style={styles.previewLocation}>
                      <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} />
                      <Text style={[styles.previewLocationText, { color: theme.colors.textSecondary }]}>
                        New York, USA
                      </Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.textSecondary} />
              </View>

              {/* Post Image Placeholder */}
              <View style={[styles.previewImage, { backgroundColor: theme.colors.border + '40' }]}>
                <Ionicons name="image-outline" size={32} color={theme.colors.textSecondary} />
              </View>

              {/* Post Actions */}
              <View style={styles.previewActions}>
                <View style={styles.previewActionGroup}>
                  <Ionicons name="heart-outline" size={22} color={theme.colors.text} />
                  <Ionicons name="chatbubble-outline" size={22} color={theme.colors.text} />
                  <Ionicons name="paper-plane-outline" size={22} color={theme.colors.text} />
                </View>
                <Ionicons name="bookmark-outline" size={22} color={theme.colors.text} />
              </View>

              {/* Post Content */}
              <View style={styles.previewPostContent}>
                <Text style={[styles.previewLikes, { color: theme.colors.text }]}>
                  <Text style={{ fontWeight: '600' }}>1,234</Text> likes
                </Text>
                <Text style={[styles.previewCaption, { color: theme.colors.text }]}>
                  <Text style={{ fontWeight: '600' }}>johndoe</Text>{' '}
                  <Text style={{ color: theme.colors.textSecondary }}>
                    Beautiful sunset at the beach! 🌅 #travel #sunset
                  </Text>
                </Text>
                <Text style={[styles.previewComments, { color: theme.colors.textSecondary }]}>
                  View all 42 comments
                </Text>
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
  previewContainer: {
    padding: isTablet ? theme.spacing.md : theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  previewCard: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isTablet ? theme.spacing.md : 12,
  },
  previewPostUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  previewAvatar: {
    width: isTablet ? 40 : 32,
    height: isTablet ? 40 : 32,
    borderRadius: isTablet ? 20 : 16,
    marginRight: isTablet ? theme.spacing.sm : 10,
  },
  previewUserDetails: {
    flex: 1,
  },
  previewUserName: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  previewTime: {
    fontSize: isTablet ? 12 : 11,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  previewLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  previewLocationText: {
    fontSize: isTablet ? 12 : 11,
    fontFamily: getFontFamily('400'),
    marginLeft: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  previewImage: {
    width: '100%',
    height: isTablet ? 200 : 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isTablet ? theme.spacing.md : 12,
    paddingVertical: isTablet ? theme.spacing.sm : 10,
  },
  previewActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTablet ? theme.spacing.md : 16,
  },
  previewPostContent: {
    paddingHorizontal: isTablet ? theme.spacing.md : 12,
    paddingBottom: isTablet ? theme.spacing.md : 12,
  },
  previewLikes: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('500'),
    marginBottom: 6,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  previewCaption: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('400'),
    marginBottom: 4,
    lineHeight: isTablet ? 18 : 16,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  previewComments: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('400'),
    marginTop: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});
