import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
import { getUserFromStorage } from '../../services/auth';
import { useSettings } from '../../context/SettingsContext';
import { useAlert } from '../../context/AlertContext';
import { createLogger } from '../../utils/logger';
import { TextInput } from 'react-native';
import { theme } from '../../constants/theme';
import { resendVerificationEmail, deleteAccount, exportUserData } from '../../services/userManagement';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

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

const logger = createLogger('AccountSettings');

export default function AccountSettingsScreen() {
  const [user, setUser] = useState<any>(null);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  
  // Settings State Single Source of Truth: Use SettingsContext
  const { settings, loading: settingsLoading, updateSetting, refreshSettings } = useSettings();
  
  // Navigation & Lifecycle Safety: Track mounted state
  const isMountedRef = useRef(true);
  
  // Toggle Interaction Safety: Per-toggle guards
  const updatingKeysRef = useRef<Set<string>>(new Set());
  
  const router = useRouter();
  const { theme } = useTheme();
  const { showError, showSuccess, showConfirm, showDestructiveConfirm, showOptions } = useAlert();

  // Navigation & Lifecycle Safety: Setup and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    loadUserData();
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

  const loadUserData = useCallback(async () => {
    try {
      const userData = await getUserFromStorage();
      if (isMountedRef.current) {
        setUser(userData);
      }
    } catch (err) {
      if (isMountedRef.current) {
        showError('Failed to load user data');
      }
    }
  }, [showError]);

  // Toggle Interaction Safety: Wrapper with per-toggle guard
  const handleUpdateSetting = useCallback(async (key: string, value: any) => {
    if (!settings) return;
    
    // Language feature is disabled - prevent any updates
    if (key === 'language') {
      showSuccess('🌐 Multiple languages coming soon\n\nCurrently available in English only.', 'Coming Soon');
      return;
    }
    
    // Validate input
    if (key === 'language' && !['en', 'es', 'fr', 'de', 'zh'].includes(value)) {
      showError('Invalid language selection');
      return;
    }
    
    if (key === 'dataUsage' && !['low', 'medium', 'high'].includes(value)) {
      showError('Invalid data usage selection');
      return;
    }
    
    // Prevent re-entry while API call is in-flight
    if (updatingKeysRef.current.has(key)) {
      logger.debug(`Update already in progress for ${key}, skipping`);
      return;
    }
    
    updatingKeysRef.current.add(key);
    
    try {
      await updateSetting('account', key, value);
      if (isMountedRef.current) {
        logger.debug(`Setting ${key} updated successfully`);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        logger.error(`Failed to update setting ${key}`, err);
        showError(err.message || 'Failed to update setting');
      }
    } finally {
      updatingKeysRef.current.delete(key);
    }
  }, [settings, updateSetting, showError]);

  const handleLanguageChange = () => {
    // Language feature disabled - show "Coming Soon" message
    showSuccess('🌐 Multiple languages coming soon\n\nCurrently available in English only.', 'Coming Soon');
  };


  const handleDataUsageChange = () => {
    showOptions(
      'Data Usage Preference',
      [
        { text: 'Low', icon: 'cellular-outline', onPress: () => {
          handleUpdateSetting('dataUsage', 'low');
          showSuccess('Data usage set to Low');
        }},
        { text: 'Medium', icon: 'cellular-outline', onPress: () => {
          handleUpdateSetting('dataUsage', 'medium');
          showSuccess('Data usage set to Medium');
        }},
        { text: 'High', icon: 'cellular-outline', onPress: () => {
          handleUpdateSetting('dataUsage', 'high');
          showSuccess('Data usage set to High');
        }},
      ],
      'Control how much data the app uses',
      true,
      'Cancel'
    );
  };

  // Screen Load Performance: Memoize loading state
  const isLoading = useMemo(() => settingsLoading || !settings, [settingsLoading, settings]);

  if (isLoading) {
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
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Email
                </Text>
                {user?.isVerified === false && (
                  <Text style={[styles.settingDescription, { color: theme.colors.error }]}>
                    Email not verified
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.settingRight}>
              {user?.isVerified === false ? (
                <View style={[styles.verificationBadge, { backgroundColor: theme.colors.error + '20' }]}>
                  <Ionicons name="close-circle" size={16} color={theme.colors.error} />
                  <Text style={[styles.verificationText, { color: theme.colors.error }]}>
                    Unverified
                  </Text>
                </View>
              ) : user?.isVerified === true ? (
                <View style={[styles.verificationBadge, { backgroundColor: theme.colors.success + '20' }]}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.success || '#4CAF50'} />
                  <Text style={[styles.verificationText, { color: theme.colors.success || '#4CAF50' }]}>
                    Verified
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary, marginLeft: 8 }]}>
                {user?.email}
              </Text>
            </View>
          </View>

          {user?.isVerified === false && (
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={async () => {
                if (resendingEmail) return;
                setResendingEmail(true);
                try {
                  await resendVerificationEmail();
                  showSuccess('Verification email sent! Please check your inbox.');
                } catch (err: any) {
                  showError(err.message || 'Failed to send verification email');
                } finally {
                  setResendingEmail(false);
                }
              }}
              disabled={resendingEmail}
            >
              <View style={styles.settingContent}>
                <Ionicons name="mail-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                  {resendingEmail ? 'Sending...' : 'Resend Verification Email'}
                </Text>
              </View>
              {resendingEmail ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              )}
            </TouchableOpacity>
          )}

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
            style={[styles.settingItem, styles.disabledSettingItem]}
            onPress={handleLanguageChange}
            disabled={true}
            activeOpacity={0.5}
          >
            <View style={styles.settingContent}>
              <Ionicons name="language-outline" size={20} color={theme.colors.textSecondary} />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingLabel, { color: theme.colors.textSecondary }]}>
                  Language
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
                  🌐 Multiple languages coming soon
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              <View style={styles.comingSoonBadge}>
                <Text style={[styles.comingSoonText, { color: theme.colors.primary }]}>
                  Coming Soon
                </Text>
              </View>
              <Text style={[styles.settingValue, { color: theme.colors.textSecondary, marginLeft: 8 }]}>
                {settings?.account?.language === 'en' ? 'English' : 
                 settings?.account?.language === 'es' ? 'Spanish' : 
                 settings?.account?.language === 'fr' ? 'French' : 
                 settings?.account?.language === 'de' ? 'German' : 
                 settings?.account?.language === 'zh' ? 'Chinese' : 'English'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleDataUsageChange}
            disabled={updatingKeysRef.current.has('dataUsage')}
          >
            <View style={styles.settingContent}>
              <Ionicons name="cellular-outline" size={20} color={theme.colors.text} />
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                Data Usage
              </Text>
            </View>
            <View style={styles.settingRight}>
              {updatingKeysRef.current.has('dataUsage') ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <Text style={[styles.settingValue, { color: theme.colors.textSecondary }]}>
                    {settings?.account?.dataUsage === 'low' ? 'Low' : 
                     settings?.account?.dataUsage === 'medium' ? 'Medium' : 'High'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                </>
              )}
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
            style={styles.settingItem}
            onPress={async () => {
              setExportingData(true);
              try {
                const data = await exportUserData();
                const jsonData = JSON.stringify(data, null, 2);
                const fileName = `taatom-data-export-${Date.now()}.json`;
                
                // Create download link for web
                if (Platform.OS === 'web') {
                  const blob = new Blob([jsonData], { type: 'application/json' });
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = fileName;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                  showSuccess('Your data has been downloaded successfully');
                } else {
                  // For mobile, save to device storage and share it
                  const documentDir = (FileSystem as any).documentDirectory || '';
                  const fileUri = `${documentDir}${fileName}`;
                  await FileSystem.writeAsStringAsync(fileUri, jsonData);
                  
                  // Use sharing API to make file accessible (works on both iOS and Android)
                  try {
                    if (await Sharing.isAvailableAsync()) {
                      await Sharing.shareAsync(fileUri, {
                        mimeType: 'application/json',
                        dialogTitle: 'Save your data export',
                        UTI: 'public.json' // iOS specific
                      });
                      showSuccess('Your data export is ready! Use the share menu to save it to Files, Downloads, or any app.');
                    } else {
                      // Fallback: Try to save to Downloads on Android
                      if (Platform.OS === 'android') {
                        try {
                          const { status } = await MediaLibrary.requestPermissionsAsync();
                          if (status === 'granted') {
                            // Create asset from file
                            const asset = await MediaLibrary.createAssetAsync(fileUri);
                            // Add to Downloads album
                            const albums = await MediaLibrary.getAlbumsAsync();
                            let downloadAlbum = albums.find(album => album.title === 'Download' || album.title === 'Downloads');
                            
                            if (downloadAlbum) {
                              await MediaLibrary.addAssetsToAlbumAsync([asset], downloadAlbum, false);
                            } else {
                              // Create Download album if it doesn't exist
                              await MediaLibrary.createAlbumAsync('Download', asset, false);
                            }
                            showSuccess('Your data has been saved to Downloads folder. You can find it in your file manager.');
                          } else {
                            showSuccess(`Your data has been saved. File location: ${fileUri}\n\nTo access it, grant storage permissions in app settings.`);
                          }
                        } catch (mediaError) {
                          logger.error('Error saving to Downloads', mediaError);
                          showSuccess(`Your data has been saved. File location: ${fileUri}`);
                        }
                      } else {
                        showSuccess(`Your data has been saved. File location: ${fileUri}`);
                      }
                    }
                  } catch (shareError) {
                    logger.error('Error sharing file', shareError);
                    showSuccess(`Your data has been saved. File location: ${fileUri}`);
                  }
                }
              } catch (error: any) {
                logger.error('Error exporting data', error);
                const errorMessage = error?.message || 'Failed to export data';
                showError(errorMessage);
              } finally {
                setExportingData(false);
              }
            }}
            disabled={exportingData}
          >
            <View style={styles.settingContent}>
              <Ionicons name="download-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.settingLabel, { color: theme.colors.primary }]}>
                Download Your Data
              </Text>
            </View>
            {exportingData ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.settingItem, styles.dangerItem]}
            onPress={() => {
              setShowDeleteModal(true);
            }}
            disabled={deletingAccount}
          >
            <View style={styles.settingContent}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              <Text style={[styles.settingLabel, { color: theme.colors.error }]}>
                Delete Account
              </Text>
            </View>
            {deletingAccount ? (
              <ActivityIndicator size="small" color={theme.colors.error} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Delete Account
            </Text>
            <Text style={[styles.modalMessage, { color: theme.colors.textSecondary }]}>
              This action cannot be undone. All your data, posts, and account information will be permanently deleted.
            </Text>
            <Text style={[styles.modalWarning, { color: theme.colors.error }]}>
              ⚠️ Warning: This action is permanent and irreversible.
            </Text>
            <TextInput
              style={[styles.passwordInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="Enter your password to confirm"
              placeholderTextColor={theme.colors.textSecondary}
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { 
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border
                }]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                }}
                disabled={deletingAccount}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDelete, { 
                  backgroundColor: theme.colors.error 
                }]}
                onPress={async () => {
                  if (!deletePassword.trim()) {
                    showError('Please enter your password');
                    return;
                  }

                  // Final confirmation
                  showDestructiveConfirm(
                    'Are you absolutely sure? This will permanently delete your account and all data. This cannot be undone.',
                    async () => {
                      setDeletingAccount(true);
                      try {
                        await deleteAccount(deletePassword);
                        showSuccess('Your account has been deleted. You will be logged out.');
                        // Clear local storage and redirect to sign in
                        setTimeout(() => {
                          router.replace('/(auth)/signin');
                        }, 2000);
                      } catch (error: any) {
                        logger.error('Error deleting account', error);
                        showError(error.message || 'Failed to delete account');
                        setDeletingAccount(false);
                      }
                    },
                    'Final Confirmation',
                    'Yes, Delete Forever',
                    'Cancel'
                  );
                }}
                disabled={deletingAccount || !deletePassword.trim()}
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalButtonTextDelete}>
                    Delete Account
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
  settingLabel: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('500'),
    marginLeft: isTablet ? theme.spacing.md : 12,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  settingValue: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  disabledSettingItem: {
    opacity: 0.7,
  },
  settingTextContainer: {
    marginLeft: isTablet ? theme.spacing.md : 12,
    flex: 1,
  },
  settingDescription: {
    fontSize: isTablet ? theme.typography.body.fontSize - 1 : 12,
    fontFamily: getFontFamily('400'),
    marginTop: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  comingSoonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: theme.colors.primary + '15',
    marginRight: 4,
  },
  comingSoonText: {
    fontSize: 10,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    gap: 4,
  },
  verificationText: {
    fontSize: 10,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: isTablet ? 500 : '90%',
    maxWidth: 500,
    borderRadius: theme.borderRadius.lg,
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
    ...(isWeb && {
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
    } as any),
  },
  modalTitle: {
    fontSize: isTablet ? theme.typography.h2.fontSize : 24,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginBottom: isTablet ? theme.spacing.md : 12,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  modalMessage: {
    fontSize: isTablet ? theme.typography.body.fontSize : 16,
    fontFamily: getFontFamily('400'),
    marginBottom: isTablet ? theme.spacing.md : 12,
    lineHeight: 22,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  modalWarning: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: isTablet ? theme.spacing.lg : 16,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: isTablet ? theme.spacing.md : 12,
    fontSize: isTablet ? theme.typography.body.fontSize : 16,
    marginBottom: isTablet ? theme.spacing.lg : 16,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  modalButtons: {
    flexDirection: 'row',
    gap: isTablet ? theme.spacing.md : 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
  },
  modalButtonDelete: {
    // Error color applied inline
  },
  modalButtonText: {
    fontSize: isTablet ? theme.typography.body.fontSize : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  modalButtonTextDelete: {
    fontSize: isTablet ? theme.typography.body.fontSize : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    color: 'white',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});
