import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { theme as themeConstants } from '../../constants/theme';
import ContentBlockBuilder from '../../components/ContentBlockBuilder';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getWebsiteContent,
  updateWebsiteContent,
  getSubscriptionContent,
  updateSubscriptionContent,
  ContentBlock,
} from '../../services/connect';
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

export default function EditContentScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { pageId, section, category } = useLocalSearchParams<{ pageId: string; section: 'website' | 'subscription'; category?: string }>();
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [pageBackground, setPageBackground] = useState<string>('');
  const [pageTextColor, setPageTextColor] = useState<string>('');
  const [colorPickerOpen, setColorPickerOpen] = useState<'bg' | 'text' | null>(null);

  const isCommunity = category === 'community';
  const sectionTitle = section === 'website' ? 'Website' : (isCommunity ? 'Buy' : 'Subscription');

  useEffect(() => {
    loadContent();
  }, [pageId, section]);

  const loadContent = async () => {
    if (!pageId || !section) return;
    try {
      setLoading(true);
      let response;
      if (section === 'website') {
        response = await getWebsiteContent(pageId);
        setBlocks(response.websiteContent || []);
        setPageBackground(response.websiteBackground || '');
        setPageTextColor(response.websiteTextColor || '');
      } else {
        response = await getSubscriptionContent(pageId);
        setBlocks(response.subscriptionContent || []);
        setPageBackground(response.subscriptionBackground || '');
        setPageTextColor(response.subscriptionTextColor || '');
      }
    } catch (error) {
      logger.error('Error loading content:', error);
      Alert.alert('Error', 'Failed to load content.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!pageId || !section) return;
    try {
      setSaving(true);

      // Prepare blocks for saving:
      // - Use _storageKey for newly uploaded images (uploaded on pick)
      // - Skip broken file:// URIs (old corrupted data)
      // - Signed R2 URLs are handled by backend (extracts storage key)
      const processedBlocks = blocks
        .filter((block) => {
          // Remove image blocks with broken local file URIs
          if (block.type === 'image' && block.content && block.content.startsWith('file://')) {
            return false;
          }
          return true;
        })
        .map((block) => {
          // Use storage key if available (set during immediate upload)
          if (block.type === 'image' && (block as any)._storageKey) {
            return { ...block, content: (block as any)._storageKey };
          }
          return block;
        });

      const colorOptions = { background: pageBackground, textColor: pageTextColor };
      if (section === 'website') {
        await updateWebsiteContent(pageId, processedBlocks, colorOptions);
      } else {
        await updateSubscriptionContent(pageId, processedBlocks, colorOptions);
      }
      setHasChanges(false);
      Alert.alert('Saved', `${sectionTitle} content has been updated.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      logger.error('Error saving content:', error);
      Alert.alert('Error', error.message || 'Failed to save content.');
    } finally {
      setSaving(false);
    }
  };

  const handleBlocksChange = (updatedBlocks: ContentBlock[]) => {
    setBlocks(updatedBlocks);
    setHasChanges(true);
  };

  const handleBack = () => {
    if (hasChanges) {
      Alert.alert('Unsaved Changes', 'You have unsaved changes. Discard them?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Edit {sectionTitle}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={isTablet ? 28 : 24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Edit {sectionTitle}</Text>
        <TouchableOpacity
          style={[
            styles.saveButton,
            { overflow: 'hidden' },
            (!hasChanges || saving) && { opacity: 0.5 },
          ]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#50C878', '#1C73B4']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          {saving ? (
            <LoadingGlobe size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={isIOS ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary }]}>
            {section === 'website'
              ? 'Build your page with headings, text, images, buttons, and more. Content is visible to all visitors.'
              : 'List the services you offer with text, images, and buttons. Visitors can see what you provide.'}
          </Text>

          {/* Page-level color settings */}
          <View style={[styles.pageColorRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.pageColorLabel, { color: theme.colors.text }]}>Page background</Text>
            <TouchableOpacity
              style={[
                styles.pageColorSwatch,
                {
                  backgroundColor: pageBackground || 'transparent',
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => setColorPickerOpen((o) => (o === 'bg' ? null : 'bg'))}
              activeOpacity={0.7}
            >
              {!pageBackground && (
                <Text style={[styles.pageColorPlaceholder, { color: theme.colors.textSecondary }]}>None</Text>
              )}
            </TouchableOpacity>
          </View>
          {colorPickerOpen === 'bg' && (
            <PageColorPalette
              theme={theme}
              current={pageBackground}
              onPick={(c) => {
                setPageBackground(c);
                setHasChanges(true);
                setColorPickerOpen(null);
              }}
            />
          )}
          <View style={[styles.pageColorRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.pageColorLabel, { color: theme.colors.text }]}>Default text color</Text>
            <TouchableOpacity
              style={[
                styles.pageColorSwatch,
                {
                  backgroundColor: pageTextColor || 'transparent',
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => setColorPickerOpen((o) => (o === 'text' ? null : 'text'))}
              activeOpacity={0.7}
            >
              {!pageTextColor && (
                <Text style={[styles.pageColorPlaceholder, { color: theme.colors.textSecondary }]}>Auto</Text>
              )}
            </TouchableOpacity>
          </View>
          {colorPickerOpen === 'text' && (
            <PageColorPalette
              theme={theme}
              current={pageTextColor}
              onPick={(c) => {
                setPageTextColor(c);
                setHasChanges(true);
                setColorPickerOpen(null);
              }}
            />
          )}

          <ContentBlockBuilder
            blocks={blocks}
            onChange={handleBlocksChange}
            pageId={pageId}
          />
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
  headerRight: {
    width: isTablet ? 48 : 40,
  },
  saveButton: {
    paddingHorizontal: isTablet ? 20 : 16,
    paddingVertical: isTablet ? 10 : 8,
    borderRadius: themeConstants.borderRadius.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: isTablet ? 16 : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    padding: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    paddingBottom: 40,
  },
  sectionDescription: {
    fontSize: isTablet ? 15 : 14,
    lineHeight: isTablet ? 22 : 20,
    marginBottom: 20,
  },
  pageColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  pageColorLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  pageColorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageColorPlaceholder: {
    fontSize: 10,
    fontWeight: '500',
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
  },
  paletteSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
  paletteClear: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

const PAGE_PRESET_COLORS = [
  '#FFFFFF', '#FAF7F2', '#F5F5F5', '#1E1E1E', '#000000',
  '#4A90E2', '#5856D6', '#9A1750', '#FF3B30',
  '#FF6B35', '#FFD700', '#E8C547', '#34C759',
  '#2C5530', '#0F4C5C', '#6B4F8A', '#D4A373',
];

function PageColorPalette({
  theme,
  current,
  onPick,
}: {
  theme: any;
  current: string;
  onPick: (color: string) => void;
}) {
  return (
    <View style={[styles.palette, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      {PAGE_PRESET_COLORS.map((c) => (
        <TouchableOpacity
          key={c}
          style={[
            styles.paletteSwatch,
            {
              backgroundColor: c,
              borderColor: current.toLowerCase() === c.toLowerCase() ? theme.colors.primary : theme.colors.border,
            },
          ]}
          onPress={() => onPick(c)}
          activeOpacity={0.7}
        />
      ))}
      <TouchableOpacity
        style={[styles.paletteClear, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
        onPress={() => onPick('')}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={16} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}
