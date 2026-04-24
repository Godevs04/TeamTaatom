import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '../../context/ThemeContext';
import { theme as themeConstants } from '../../constants/theme';
import {
  getWebsiteContent,
  getSubscriptionContent,
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

// Auto-sizing image that shows full image at screen width
const contentWidth = screenWidth - (isTablet ? themeConstants.spacing.xl * 2 : themeConstants.spacing.md * 2);

function PreviewImage({ uri }: { uri: string }) {
  const [height, setHeight] = useState(contentWidth * 0.75); // default 4:3 fallback

  useEffect(() => {
    Image.getSize(
      uri,
      (w, h) => {
        if (w > 0) {
          setHeight((h / w) * contentWidth);
        }
      },
      () => {} // ignore errors, keep fallback
    );
  }, [uri]);

  return (
    <Image
      source={{ uri }}
      style={[styles.imageBlock, { height }]}
      resizeMode="contain"
    />
  );
}

export default function ContentPreviewScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { pageId, section, pageName } = useLocalSearchParams<{
    pageId: string;
    section: string;
    pageName: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<ContentBlock[]>([]);

  const isWebsite = section === 'website';
  const title = pageName
    ? decodeURIComponent(pageName)
    : isWebsite
    ? 'Website'
    : 'Subscription';

  useEffect(() => {
    const load = async () => {
      if (!pageId) return;
      try {
        setLoading(true);
        const response = isWebsite
          ? await getWebsiteContent(pageId)
          : await getSubscriptionContent(pageId);
        const data = isWebsite
          ? (response as any).websiteContent
          : (response as any).subscriptionContent;
        setContent(data || []);
      } catch (error) {
        logger.error('Error loading preview content:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pageId, section]);

  const sorted = [...content].sort((a, b) => a.order - b.order);

  const renderBlock = (block: ContentBlock, index: number) => {
    switch (block.type) {
      case 'heading':
        return (
          <Text
            key={block._id || index}
            style={[styles.headingBlock, { color: theme.colors.text }]}
          >
            {block.content}
          </Text>
        );
      case 'text':
        return (
          <Text
            key={block._id || index}
            style={[styles.textBlock, { color: theme.colors.text }]}
          >
            {block.content}
          </Text>
        );
      case 'image':
        return (
          <PreviewImage key={block._id || index} uri={block.content} />
        );
      case 'video':
        return (
          <View key={block._id || index} style={styles.videoContainer}>
            <Video
              source={{ uri: block.content }}
              style={styles.videoBlock}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay={false}
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={isTablet ? 28 : 24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerRight}>
          <View
            style={[styles.liveBadge, { backgroundColor: theme.colors.primary + '15' }]}
          >
            <View style={[styles.liveDot, { backgroundColor: theme.colors.primary }]} />
            <Text style={[styles.liveText, { color: theme.colors.primary }]}>Preview</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="document-text-outline"
            size={48}
            color={theme.colors.textSecondary + '50'}
          />
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            No content to preview yet.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {sorted.map((block, idx) => renderBlock(block, idx))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(isWeb &&
      ({
        maxWidth: isTablet ? 1000 : 800,
        alignSelf: 'center',
        width: '100%',
      } as any)),
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
    ...(isWeb &&
      ({
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any)),
  },
  headerRight: {
    minWidth: isTablet ? 80 : 70,
    alignItems: 'flex-end',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 12,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  contentContainer: {
    padding: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
  },
  headingBlock: {
    fontSize: isTablet ? 24 : 22,
    lineHeight: isTablet ? 32 : 28,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: isTablet ? 20 : 16,
    ...(isWeb &&
      ({
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any)),
  },
  textBlock: {
    fontSize: isTablet ? 17 : 15,
    lineHeight: isTablet ? 26 : 22,
    fontFamily: getFontFamily('400'),
    marginBottom: isTablet ? 20 : 16,
    ...(isWeb &&
      ({
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any)),
  },
  imageBlock: {
    width: '100%',
    borderRadius: themeConstants.borderRadius.md,
    marginBottom: isTablet ? 20 : 16,
  },
  videoContainer: {
    width: '100%',
    height: isTablet ? 350 : 220,
    borderRadius: themeConstants.borderRadius.md,
    overflow: 'hidden',
    marginBottom: isTablet ? 20 : 16,
  },
  videoBlock: {
    width: '100%',
    height: '100%',
  },
});
