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
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { theme as themeConstants } from '../../constants/theme';
import {
  getWebsiteContent,
  getSubscriptionContent,
  getPageDetail,
  getSubscriptionStatus,
  createSubscription,
  cancelSubscription as cancelSubApi,
  getCurrencySymbol,
  ContentBlock,
  ConnectPageType,
  SubscriptionStatus,
} from '../../services/connect';
import { crashReportingService } from '../../services/crashReporting';
import logger from '../../utils/logger';
import { NativeModules } from 'react-native';
import {
  CFErrorResponse,
  CFPaymentGatewayService,
  CFEnvironment,
  CFSubscriptionSession,
} from '../../utils/cashfreeShim';

// In Expo Go / web the Cashfree native module is absent and the SDK throws
// "package not linked" the moment any method is called. Gate every SDK call
// on the real native module so this screen renders without crashing.
const isCashfreeNativeAvailable = !!NativeModules.CashfreePgApi;

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
  const { showSuccess } = useAlert();
  const router = useRouter();
  const { pageId, section, pageName } = useLocalSearchParams<{
    pageId: string;
    section: string;
    pageName: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<ContentBlock[]>([]);
  const [pageData, setPageData] = useState<ConnectPageType | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  const isWebsite = section === 'website';
  const isSubscription = section === 'subscription';
  const isCommunity = pageData?.category === 'community';
  const subLabel = isCommunity ? 'Buy' : 'Subscription';
  const subButtonText = isCommunity ? 'Buy' : 'Subscribe';
  const title = pageName
    ? decodeURIComponent(pageName)
    : isWebsite
    ? 'Website'
    : subLabel;

  useEffect(() => {
    const load = async () => {
      if (!pageId) return;
      try {
        setLoading(true);
        const [contentResponse, pageResponse] = await Promise.all([
          isWebsite
            ? getWebsiteContent(pageId)
            : getSubscriptionContent(pageId),
          isSubscription ? getPageDetail(pageId).catch(() => null) : Promise.resolve(null),
        ]);
        const data = isWebsite
          ? (contentResponse as any).websiteContent
          : (contentResponse as any).subscriptionContent;
        setContent(data || []);
        if (pageResponse) {
          setPageData(pageResponse.page);
          setIsOwner(pageResponse.isOwner);
          // Load subscription status for non-owners
          if (!pageResponse.isOwner && pageResponse.page.features?.subscription && pageResponse.page.subscriptionPrice) {
            try {
              const status = await getSubscriptionStatus(pageId);
              setSubscriptionStatus(status);
            } catch (err) {
              logger.warn('Error loading subscription status:', err);
            }
          }
        }
      } catch (error) {
        logger.error('Error loading preview content:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pageId, section]);

  // Cashfree subscription payment callback
  const refreshSubscriptionStatus = useCallback(async () => {
    if (!pageId) return;
    try {
      const status = await getSubscriptionStatus(pageId);
      setSubscriptionStatus(status);
    } catch (err) {
      logger.warn('Error refreshing subscription status:', err);
    }
  }, [pageId]);

  useEffect(() => {
    if (!isCashfreeNativeAvailable) return;
    CFPaymentGatewayService.setCallback({
      onVerify(orderID: string): void {
        logger.info('Cashfree subscription verified, orderID:', orderID);
        refreshSubscriptionStatus();
        showSuccess(
          isCommunity ? 'Your purchase was completed.' : 'Your subscription is now active.',
          'Payment received',
        );
        // Redirect back to the Connect page the user subscribed from so they
        // land on the page detail (not stuck inside the preview), and so any
        // gated subscriber UI on that page reflects the new status.
        if (pageId) {
          router.replace(`/connect/page/${pageId}`);
        }
      },
      onError(error: CFErrorResponse, orderID: string): void {
        logger.error('Cashfree subscription error:', JSON.stringify(error), 'orderID:', orderID);
        Alert.alert('Payment Failed', 'Could not complete payment. Please try again.');
      },
    });
    return () => {
      CFPaymentGatewayService.removeCallback();
    };
  }, [refreshSubscriptionStatus, isCommunity, pageId, router, showSuccess]);

  const handleSubscribe = async () => {
    if (!pageData || subscribing) return;
    if (!isCashfreeNativeAvailable) {
      Alert.alert(
        'Dev build required',
        'Subscriptions need the Cashfree native module, which is not available in Expo Go. Install the development build to subscribe.',
      );
      return;
    }
    try {
      setSubscribing(true);
      const result = await createSubscription(pageData._id);
      if (result.paymentSessionId && result.cashfreeSubscriptionId) {
        const env = __DEV__ ? CFEnvironment.SANDBOX : CFEnvironment.PRODUCTION;
        const session = new CFSubscriptionSession(
          result.paymentSessionId,
          result.cashfreeSubscriptionId,
          env
        );
        CFPaymentGatewayService.doSubscriptionPayment(session);
      } else {
        Alert.alert('Error', 'Unable to initiate payment session. Please try again.');
      }
    } catch (error: any) {
      crashReportingService.captureException(error, { context: 'subscribe_from_preview' });
      Alert.alert('Error', error.message || 'Failed to subscribe. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscriptionStatus?.subscription?._id) return;
    Alert.alert(
      isCommunity ? 'Cancel Purchase' : 'Cancel Subscription',
      isCommunity ? 'Are you sure you want to cancel?' : 'Are you sure you want to cancel your subscription?',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: isCommunity ? 'Cancel Purchase' : 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelSubApi(subscriptionStatus.subscription!._id);
              const status = await getSubscriptionStatus(pageData!._id);
              setSubscriptionStatus(status);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel subscription.');
            }
          },
        },
      ]
    );
  };

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
        return block.content ? (
          <PreviewImage key={block._id || index} uri={block.content} />
        ) : null;
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
      case 'button':
        return (
          <TouchableOpacity
            key={block._id || index}
            style={[styles.buttonBlock, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              if (block.url) Linking.openURL(block.url).catch(() => {});
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonBlockText}>{block.content || 'Button'}</Text>
          </TouchableOpacity>
        );
      case 'divider':
        return (
          <View
            key={block._id || index}
            style={[styles.dividerBlock, { backgroundColor: theme.colors.border }]}
          />
        );
      case 'embed':
        return (
          <TouchableOpacity
            key={block._id || index}
            style={[styles.embedBlock, { backgroundColor: theme.colors.border }]}
            onPress={() => {
              if (block.content) Linking.openURL(block.content).catch(() => {});
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="open-outline" size={28} color={theme.colors.textSecondary} />
            <Text style={[styles.embedBlockLabel, { color: theme.colors.textSecondary }]}>
              {block.embedType === 'youtube' ? 'YouTube Video' : block.embedType === 'map' ? 'Google Map' : 'External Content'}
            </Text>
            <Text style={[styles.embedBlockLink, { color: theme.colors.primary }]}>
              Tap to open
            </Text>
          </TouchableOpacity>
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

          {/* Subscribe section */}
          {isSubscription && pageData && (pageData.subscriptionPrice || pageData.subscriptionApproval?.requestedPrice) && (() => {
            const approvalStatus = pageData.subscriptionApproval?.status || 'none';
            const approvedPrice = pageData.subscriptionPrice;
            const requestedPrice = pageData.subscriptionApproval?.requestedPrice;
            const displayPrice = approvalStatus === 'approved' ? approvedPrice : requestedPrice || approvedPrice;
            const currSym = getCurrencySymbol(pageData.subscriptionCurrency || 'INR');

            // Owner view — static preview
            if (isOwner) {
              return (
                <View style={[styles.subscribeSection, { borderTopColor: theme.colors.border }]}>
                  <View style={[styles.subscribeButton, { backgroundColor: theme.colors.primary }]}>
                    <Ionicons name={isCommunity ? 'cart-outline' : 'star'} size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.subscribeButtonText}>
                      {subButtonText} · {currSym}{displayPrice}/month
                    </Text>
                  </View>
                  <Text style={[styles.subscribeNote, { color: theme.colors.textSecondary }]}>
                    This is a preview — subscribers will see this button on your page
                  </Text>
                </View>
              );
            }

            // Visitor — already subscribed
            if (subscriptionStatus?.isSubscribed) {
              return (
                <View style={[styles.subscribeSection, { borderTopColor: theme.colors.border }]}>
                  <View style={[styles.subscribedBadge, { backgroundColor: (theme.colors as any).success + '15' }]}>
                    <Ionicons name="checkmark-circle" size={18} color={(theme.colors as any).success} />
                    <Text style={[styles.subscribedText, { color: (theme.colors as any).success }]}>Subscribed</Text>
                  </View>
                  {subscriptionStatus.subscription?.currentPeriodEnd && (
                    <Text style={[styles.subscribeNote, { color: theme.colors.textSecondary, fontStyle: 'normal' }]}>
                      Renews {new Date(subscriptionStatus.subscription.currentPeriodEnd).toLocaleDateString()}
                    </Text>
                  )}
                  <TouchableOpacity
                    onPress={handleCancelSubscription}
                    activeOpacity={0.7}
                    style={{ marginTop: 8, paddingVertical: 4 }}
                  >
                    <Text style={{ color: theme.colors.error, fontSize: 13, fontFamily: getFontFamily('500'), fontWeight: '500' }}>
                      Cancel subscription
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }

            // Visitor — can subscribe (price approved)
            if (approvalStatus === 'approved' && approvedPrice) {
              return (
                <View style={[styles.subscribeSection, { borderTopColor: theme.colors.border }]}>
                  <TouchableOpacity
                    style={[styles.subscribeButton, { backgroundColor: theme.colors.primary }]}
                    onPress={handleSubscribe}
                    activeOpacity={0.7}
                    disabled={subscribing}
                  >
                    {subscribing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name={isCommunity ? 'cart-outline' : 'star'} size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.subscribeButtonText}>
                          {subButtonText} · {currSym}{approvedPrice}/month
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            }

            return null;
          })()}

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
    fontSize: 11,
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
    fontSize: 20,
    lineHeight: 26,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    ...(isWeb &&
      ({
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any)),
  },
  textBlock: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: getFontFamily('400'),
    marginBottom: 16,
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
  buttonBlock: {
    paddingVertical: 14,
    borderRadius: themeConstants.borderRadius.sm,
    alignItems: 'center',
    marginBottom: isTablet ? 20 : 16,
  },
  buttonBlockText: {
    color: '#FFFFFF',
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  dividerBlock: {
    height: 1,
    marginVertical: isTablet ? 16 : 12,
  },
  embedBlock: {
    width: '100%',
    height: isTablet ? 160 : 120,
    borderRadius: themeConstants.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: isTablet ? 20 : 16,
  },
  embedBlockLabel: {
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  embedBlockLink: {
    fontSize: 13,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  subscribeSection: {
    borderTopWidth: 1,
    marginTop: 20,
    paddingTop: 20,
    alignItems: 'center',
  },
  subscribePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  subscribePrice: {
    fontSize: isTablet ? 28 : 24,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  subscribePeriod: {
    fontSize: isTablet ? 16 : 14,
    fontFamily: getFontFamily('400'),
    marginLeft: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: themeConstants.borderRadius.sm,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  subscribeNote: {
    fontSize: 11,
    fontFamily: getFontFamily('400'),
    marginTop: 10,
    fontStyle: 'italic',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  subscribedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  subscribedText: {
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});
