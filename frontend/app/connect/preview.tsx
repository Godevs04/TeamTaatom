import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  fetchCurrencyConfig,
  ContentBlock,
  ConnectPageType,
  SubscriptionStatus,
} from '../../services/connect';
import { crashReportingService } from '../../services/crashReporting';
import logger from '../../utils/logger';
import { useSubscription } from '../../context/SubscriptionContext';
import { NativeModules } from 'react-native';
import {
  CFErrorResponse,
  CFPaymentGatewayService,
  CFEnvironment,
  CFSubscriptionSession,
} from '../../utils/cashfreeShim';
import { resolveCashfreeEnvironment } from '../../utils/cashfreeCheckout';
import { logContentView } from '../../services/adCap';

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

// Aspect ratio overrides from editor
const AR_MAP: Record<string, number> = { square: 1, landscape: 16 / 9, portrait: 3 / 4 };

// inRow: paired side-by-side with another block (fixed 4:3 + cover)
// inStack: stacked vertically in a mosaic column (fills flex:1 with cover)
function PreviewImage({ uri, inRow, inStack, arOverride }: { uri: string; inRow?: boolean; inStack?: boolean; arOverride?: string }) {
  const [aspectRatio, setAspectRatio] = useState<number>(4 / 3);

  useEffect(() => {
    if (inStack || (arOverride && arOverride !== 'original')) return;
    Image.getSize(uri, (w, h) => { if (w > 0 && h > 0) setAspectRatio(w / h); }, () => {});
  }, [uri, inStack, arOverride]);

  const resolvedAR = arOverride && AR_MAP[arOverride] ? AR_MAP[arOverride] : aspectRatio;

  if (inStack) {
    return (
      <Image
        source={{ uri }}
        style={{ flex: 1, width: '100%', borderRadius: 8 }}
        resizeMode="cover"
      />
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[styles.imageBlock, { aspectRatio: resolvedAR }]}
      resizeMode="cover"
    />
  );
}

export default function ContentPreviewScreen() {
  const { theme } = useTheme();
  const { showSuccess } = useAlert();
  const { updateSubscriptionStatus } = useSubscription();
  const router = useRouter();
  const { pageId, section, pageName } = useLocalSearchParams<{
    pageId: string;
    section: string;
    pageName: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<ContentBlock[]>([]);
  const [pageBackground, setPageBackground] = useState<string>('');
  const [pageTextColor, setPageTextColor] = useState<string>('');
  const [pageData, setPageData] = useState<ConnectPageType | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const pendingSubscriptionRef = useRef<{ subscriptionId: string; amount: number } | null>(null);

  // Multi-currency live conversion support
  const [countryToCurrency, setCountryToCurrency] = useState<Record<string, string>>({ IN: 'INR' });
  const [displayPrices, setDisplayPrices] = useState<any>(null);

  useEffect(() => {
    fetchCurrencyConfig().then((config) => {
      setCountryToCurrency(config.countryToCurrency);
    }).catch(() => {});
  }, []);

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
        setPageBackground(
          isWebsite
            ? ((contentResponse as any).websiteBackground || '')
            : ((contentResponse as any).subscriptionBackground || '')
        );
        setPageTextColor(
          isWebsite
            ? ((contentResponse as any).websiteTextColor || '')
            : ((contentResponse as any).subscriptionTextColor || '')
        );
        if (pageResponse) {
          setPageData(pageResponse.page);
          setIsOwner(pageResponse.isOwner);
          setDisplayPrices((pageResponse as any).subscriptionDisplayPrices);
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
        if (isWebsite) {
          logContentView(pageId, 'website', { type: 'website', pageId });
        }
      } catch (error) {
        logger.error('Error loading preview content:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pageId, section, isWebsite]);

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
        try {
          if (!pageId) {
            throw new Error('Connect Page ID is missing during Cashfree preview callback sync');
          }

          if (pendingSubscriptionRef.current) {
            const newStatus = {
              isSubscribed: true,
              subscription: {
                _id: pendingSubscriptionRef.current.subscriptionId,
                status: 'active' as const,
                amount: pendingSubscriptionRef.current.amount,
                activatedAt: new Date().toISOString(),
                currentPeriodEnd: null,
              },
            };
            updateSubscriptionStatus(pageId, newStatus);
          }

          refreshSubscriptionStatus();
          showSuccess(
            isCommunity ? 'Your purchase was completed.' : 'Your subscription is now active.',
            'Payment received',
          );
          // Redirect to page detail, passing pending subscription data as params
          // so page/[id].tsx can flip to "Subscribed" immediately without waiting
          // for the webhook to update the DB.
          if (pageId) {
            const pending = pendingSubscriptionRef.current;
            pendingSubscriptionRef.current = null;
            router.replace({
              pathname: `/connect/page/${pageId}` as any,
              params: pending
                ? {
                    optimistic_subscribed: '1',
                    optimistic_subscription_id: pending.subscriptionId,
                    optimistic_amount: String(pending.amount),
                  }
                : {},
            });
          }
        } catch (err) {
          logger.error('Error handling Cashfree preview onVerify callback sync:', err);
          Alert.alert('Payment Verification Error', 'An error occurred while updating your subscription status.');
        }
      },
      onError(error: CFErrorResponse, orderID: string): void {
        try {
          logger.error('Cashfree subscription error:', JSON.stringify(error), 'orderID:', orderID);
          Alert.alert('Payment Failed', 'Could not complete payment. Please try again.');
        } catch (err) {
          logger.error('Error handling Cashfree preview onError callback:', err);
        }
      },
    });
    return () => {
      CFPaymentGatewayService.removeCallback();
    };
  }, [refreshSubscriptionStatus, isCommunity, pageId, router, showSuccess, updateSubscriptionStatus]);

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
      const subsSessionId = result.subscriptionSessionId || result.paymentSessionId;
      if (subsSessionId && result.cashfreeSubscriptionId) {
        pendingSubscriptionRef.current = {
          subscriptionId: result.subscriptionId,
          amount: result.amount,
        };
        const env = resolveCashfreeEnvironment(result.cashfreeEnvironment);
        const session = new CFSubscriptionSession(
          subsSessionId,
          result.cashfreeSubscriptionId,
          env,
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

  // A cell in a grid row — may contain multiple stacked blocks.
  type RowCell = { col: number; blocks: ContentBlock[] };

  // Pack sorted blocks into rows of RowCell[].
  // A block with stacked=true joins the last cell of the last closed row
  // (enabling the "tall-left + two-stacked-right" mosaic layout).
  const packBlocksIntoRows = (blocks: ContentBlock[]): RowCell[][] => {
    const rows: RowCell[][] = [];
    let current: RowCell[] = [];
    let used = 0;
    for (const block of blocks) {
      if ((block as any).stacked && rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        lastRow[lastRow.length - 1].blocks.push(block);
        continue;
      }
      const w = Math.max(1, Math.min(12, Number((block as any).col) || 12));
      if (used + w > 12 && current.length > 0) {
        rows.push(current);
        current = [];
        used = 0;
      }
      current.push({ col: w, blocks: [block] });
      used += w;
      if (used >= 12) {
        rows.push(current);
        current = [];
        used = 0;
      }
    }
    if (current.length > 0) rows.push(current);
    return rows;
  };

  const renderBlock = (block: ContentBlock, index: number, inRow = false, inStack = false) => {
    const effectiveTextColor = block.color || pageTextColor || theme.colors.text;
    const effectiveBg = block.backgroundColor || '';
    const textAlign: 'left' | 'center' | 'right' =
      (block.align as any) || (block.type === 'heading' ? 'center' : 'left');
    const headingFontSize = block.fontSize === 'small' ? 16 : block.fontSize === 'large' ? 26 : 20;
    const textFontSize = block.fontSize === 'small' ? 12 : block.fontSize === 'large' ? 18 : 15;
    // Padding & border-radius tiers
    const paddingMap: Record<string, number> = { none: 0, small: 6, medium: 12, large: 20 };
    const radiusMap: Record<string, number> = { none: 0, small: 6, medium: 12, large: 20 };
    const blockPadding = block.padding ? paddingMap[block.padding] ?? 0 : undefined;
    const blockRadius = block.borderRadius ? radiusMap[block.borderRadius] ?? 0 : undefined;
    const hasWrapStyles = effectiveBg || blockPadding !== undefined || blockRadius !== undefined;
    const wrapBg = (node: React.ReactNode) =>
      hasWrapStyles ? (
        <View
          key={block._id || index}
          style={{
            backgroundColor: effectiveBg || undefined,
            borderRadius: blockRadius ?? 12,
            padding: blockPadding ?? (effectiveBg ? 10 : 0),
            marginBottom: 8,
            overflow: 'hidden',
          }}
        >
          {node}
        </View>
      ) : (
        <React.Fragment key={block._id || index}>{node}</React.Fragment>
      );

    switch (block.type) {
      case 'heading':
        return wrapBg(
          <Text style={[styles.headingBlock, { color: effectiveTextColor, textAlign, fontSize: headingFontSize }, block.bold ? { fontWeight: '800' } : undefined]}>
            {block.content}
          </Text>
        );
      case 'text':
        return wrapBg(
          <Text style={[styles.textBlock, { color: effectiveTextColor, textAlign, fontSize: textFontSize }, block.bold ? { fontWeight: '700', fontFamily: getFontFamily('700') } : undefined]}>
            {block.content}
          </Text>
        );
      case 'image':
        return block.content ? (
          <View key={block._id || index} style={blockRadius !== undefined ? { borderRadius: blockRadius, overflow: 'hidden' } : undefined}>
            <PreviewImage uri={block.content} inRow={inRow} inStack={inStack} arOverride={block.aspectRatio} />
          </View>
        ) : null;
      case 'video':
        return (
          <View key={block._id || index} style={styles.videoContainer}>
            <Video
              source={{
                uri: block.content,
                overrideFileExtensionAndroid: (block.content.toLowerCase().includes('m3u8') || block.content.toLowerCase().includes('hls')) ? 'm3u8' : 'mp4'
              }}
              style={styles.videoBlock}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay={false}
            />
          </View>
        );
      case 'button': {
        const rawUrl = block.url?.trim();
        const buttonUrl = rawUrl && /^[a-z][a-z0-9+.-]*:/i.test(rawUrl)
          ? rawUrl
          : (rawUrl ? `https://${rawUrl}` : '');
        return (
          <TouchableOpacity
            key={block._id || index}
            style={[styles.buttonBlock, { backgroundColor: effectiveBg || theme.colors.primary }]}
            onPress={() => {
              if (buttonUrl) Linking.openURL(buttonUrl).catch(() => {});
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.buttonBlockText, block.color ? { color: block.color } : undefined]}>
              {block.content || 'Button'}
            </Text>
          </TouchableOpacity>
        );
      }
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
            style={[styles.embedBlock, { backgroundColor: effectiveBg || theme.colors.border }]}
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
          style={[styles.scrollContent, pageBackground ? { backgroundColor: pageBackground } : null]}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {packBlocksIntoRows(sorted).map((row, ri) => {
            const isSingle = row.length === 1 && row[0].blocks.length === 1;
            return isSingle ? (
              <React.Fragment key={`prow-${ri}`}>{renderBlock(row[0].blocks[0], ri, false, false)}</React.Fragment>
            ) : (
              <View key={`prow-${ri}`} style={{ flexDirection: 'row', gap: 3, marginVertical: 1, alignItems: 'flex-start' }}>
                {row.map((cell, ci) => {
                  const isStackedCell = cell.blocks.length > 1;
                  const va = cell.blocks[0]?.verticalAlign;
                  const alignSelf = va === 'center' ? 'center' as const : va === 'bottom' ? 'flex-end' as const : undefined;
                  return (
                    <View
                      key={`pc-${ri}-${ci}`}
                      style={isStackedCell
                        ? { flex: cell.col, flexDirection: 'column', gap: 6 }
                        : { flex: cell.col, alignSelf }}
                    >
                      {cell.blocks.map((block, bi) =>
                        isStackedCell ? (
                          <View key={block._id || `ps-${ri}-${ci}-${bi}`} style={{ flex: 1 }}>
                            {renderBlock(block, bi, true, true)}
                          </View>
                        ) : (
                          <React.Fragment key={block._id || `ps-${ri}-${ci}-${bi}`}>
                            {renderBlock(block, bi, row.length > 1, false)}
                          </React.Fragment>
                        )
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}

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
                          {(() => {
                            const locale = Intl.NumberFormat().resolvedOptions().locale || '';
                            const userCountry = locale.split('-')[1]?.toUpperCase() || 'IN';
                            const userCurrency = countryToCurrency[userCountry] || 'INR';
                            const userPriceInfo = displayPrices?.prices?.[userCurrency];
                            const altPrice = (userCurrency !== 'INR' && userPriceInfo) ? ` (${userPriceInfo.formatted})` : '';
                            return `${subButtonText} · ${currSym}${approvedPrice}${altPrice}/month`;
                          })()}
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
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
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
    borderRadius: themeConstants.borderRadius.sm,
    marginBottom: 1,
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
