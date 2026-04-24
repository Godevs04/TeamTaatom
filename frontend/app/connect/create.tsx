import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { theme as themeConstants } from '../../constants/theme';
import { createConnectPage } from '../../services/connect';
import logger from '../../utils/logger';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

export default function CreateConnectPageScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [websiteEnabled, setWebsiteEnabled] = useState(true);
  const [groupChatEnabled, setGroupChatEnabled] = useState(true);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [creating, setCreating] = useState(false);
  const [profileImage, setProfileImage] = useState<{ uri: string; type?: string; name?: string } | null>(null);
  const [bannerImage, setBannerImage] = useState<{ uri: string; type?: string; name?: string } | null>(null);

  const pickImage = async (type: 'profile' | 'banner') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need gallery access to pick an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'profile' ? [1, 1] : [16, 9],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const imageData = {
          uri: asset.uri,
          type: asset.mimeType || 'image/jpeg',
          name: asset.fileName || `${type}_${Date.now()}.jpg`,
        };
        if (type === 'profile') setProfileImage(imageData);
        else setBannerImage(imageData);
      }
    } catch (error) {
      logger.error('Error picking image:', error);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a page name.');
      return;
    }
    if (name.trim().length < 3) {
      Alert.alert('Too Short', 'Page name must be at least 3 characters.');
      return;
    }

    try {
      setCreating(true);
      const response = await createConnectPage({
        name: name.trim(),
        type,
        bio: bio.trim() || undefined,
        features: {
          website: websiteEnabled,
          groupChat: groupChatEnabled,
          subscription: subscriptionEnabled,
        },
        profileImage,
        bannerImage,
      });
      router.replace(`/connect/page/${response.page._id}`);
    } catch (error: any) {
      logger.error('Error creating connect page:', error);
      Alert.alert('Error', error.message || 'Failed to create page.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={isTablet ? 28 : 24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Create Connect Page</Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: theme.colors.primary, opacity: creating || !name.trim() ? 0.5 : 1 }]}
          onPress={handleCreate}
          disabled={creating || !name.trim()}
          activeOpacity={0.7}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.createButtonText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={isIOS ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Banner Image */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Banner</Text>
            <TouchableOpacity
              style={[styles.bannerPicker, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => pickImage('banner')}
              activeOpacity={0.7}
            >
              {bannerImage ? (
                <Image source={{ uri: bannerImage.uri }} style={styles.bannerPreview} />
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <Ionicons name="image-outline" size={isTablet ? 32 : 26} color={theme.colors.textSecondary} />
                  <Text style={[styles.imagePickerText, { color: theme.colors.textSecondary }]}>
                    Add Banner
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {bannerImage && (
              <TouchableOpacity onPress={() => setBannerImage(null)} activeOpacity={0.7} style={{ alignSelf: 'flex-end' }}>
                <Text style={[styles.removeImageText, { color: theme.colors.error }]}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Profile Image */}
          <View style={[styles.field, { alignItems: 'center' }]}>
            <TouchableOpacity
              style={[styles.imagePicker, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => pickImage('profile')}
              activeOpacity={0.7}
            >
              {profileImage ? (
                <Image source={{ uri: profileImage.uri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera-outline" size={isTablet ? 36 : 30} color={theme.colors.textSecondary} />
                  <Text style={[styles.imagePickerText, { color: theme.colors.textSecondary }]}>
                    Add Photo
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {profileImage && (
              <TouchableOpacity onPress={() => setProfileImage(null)} activeOpacity={0.7}>
                <Text style={[styles.removeImageText, { color: theme.colors.error }]}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Page Name */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Connect Page Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Enter your page name"
              placeholderTextColor={theme.colors.textSecondary}
              value={name}
              onChangeText={setName}
              maxLength={50}
              autoFocus
            />
            <Text style={[styles.charCount, { color: theme.colors.textSecondary }]}>
              {name.length}/50
            </Text>
          </View>

          {/* Bio */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Bio / Description</Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border },
              ]}
              placeholder="Tell others about your page..."
              placeholderTextColor={theme.colors.textSecondary}
              value={bio}
              onChangeText={setBio}
              maxLength={300}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: theme.colors.textSecondary }]}>
              {bio.length}/300
            </Text>
          </View>

          {/* Page Type */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Page Type</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  { borderColor: type === 'public' ? theme.colors.primary : theme.colors.border },
                  type === 'public' && { backgroundColor: theme.colors.primary + '15' },
                ]}
                onPress={() => setType('public')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="globe-outline"
                  size={20}
                  color={type === 'public' ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    { color: type === 'public' ? theme.colors.primary : theme.colors.textSecondary },
                  ]}
                >
                  Public
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  { borderColor: type === 'private' ? theme.colors.primary : theme.colors.border },
                  type === 'private' && { backgroundColor: theme.colors.primary + '15' },
                ]}
                onPress={() => setType('private')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={type === 'private' ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    { color: type === 'private' ? theme.colors.primary : theme.colors.textSecondary },
                  ]}
                >
                  Private
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Features */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Features</Text>
            <View style={[styles.featureCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <Ionicons name="globe-outline" size={20} color={theme.colors.primary} />
                  <View style={styles.featureText}>
                    <Text style={[styles.featureName, { color: theme.colors.text }]}>Website</Text>
                    <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>
                      Create a mini portfolio page
                    </Text>
                  </View>
                </View>
                <Switch
                  value={websiteEnabled}
                  onValueChange={setWebsiteEnabled}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
                  thumbColor={websiteEnabled ? theme.colors.primary : theme.colors.textSecondary}
                />
              </View>

              <View style={[styles.featureDivider, { borderBottomColor: theme.colors.border }]} />

              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <Ionicons name="chatbubbles-outline" size={20} color={theme.colors.primary} />
                  <View style={styles.featureText}>
                    <Text style={[styles.featureName, { color: theme.colors.text }]}>Group Chat</Text>
                    <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>
                      Shared chat room for followers
                    </Text>
                  </View>
                </View>
                <Switch
                  value={groupChatEnabled}
                  onValueChange={setGroupChatEnabled}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
                  thumbColor={groupChatEnabled ? theme.colors.primary : theme.colors.textSecondary}
                />
              </View>

              <View style={[styles.featureDivider, { borderBottomColor: theme.colors.border }]} />

              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <Ionicons name="star-outline" size={20} color={theme.colors.primary} />
                  <View style={styles.featureText}>
                    <Text style={[styles.featureName, { color: theme.colors.text }]}>Subscription</Text>
                    <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>
                      List services you offer
                    </Text>
                  </View>
                </View>
                <Switch
                  value={subscriptionEnabled}
                  onValueChange={setSubscriptionEnabled}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
                  thumbColor={subscriptionEnabled ? theme.colors.primary : theme.colors.textSecondary}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    paddingVertical: isTablet ? themeConstants.spacing.md : 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: isTablet ? themeConstants.spacing.sm : 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: isTablet ? 22 : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: isIOS ? 0.3 : 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  createButton: {
    paddingHorizontal: isTablet ? 20 : 16,
    paddingVertical: isTablet ? 10 : 8,
    borderRadius: themeConstants.borderRadius.sm,
    minWidth: 70,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: isTablet ? 16 : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    paddingBottom: 40,
  },
  field: {
    marginBottom: isTablet ? 28 : 24,
  },
  label: {
    fontSize: isTablet ? 16 : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  input: {
    borderWidth: 1,
    borderRadius: themeConstants.borderRadius.sm,
    paddingHorizontal: 14,
    paddingVertical: isIOS ? 14 : 10,
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      outlineStyle: 'none',
    } as any),
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: themeConstants.borderRadius.sm,
    borderWidth: 1.5,
  },
  typeLabel: {
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  featureCard: {
    borderWidth: 1,
    borderRadius: themeConstants.borderRadius.md,
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isTablet ? 20 : 16,
    paddingVertical: isTablet ? 16 : 14,
  },
  featureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  featureText: {
    flex: 1,
  },
  featureName: {
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  featureDesc: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('400'),
    marginTop: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  featureDivider: {
    borderBottomWidth: 1,
    marginHorizontal: 16,
  },
  bannerPicker: {
    width: '100%',
    height: isTablet ? 180 : 140,
    borderRadius: themeConstants.borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bannerPreview: {
    width: '100%',
    height: '100%',
    borderRadius: themeConstants.borderRadius.md,
  },
  bannerPlaceholder: {
    alignItems: 'center',
    gap: 6,
  },
  imagePicker: {
    width: isTablet ? 120 : 100,
    height: isTablet ? 120 : 100,
    borderRadius: isTablet ? 60 : 50,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: isTablet ? 60 : 50,
  },
  imagePlaceholder: {
    alignItems: 'center',
    gap: 4,
  },
  imagePickerText: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  removeImageText: {
    fontSize: 13,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    marginTop: 8,
  },
});
