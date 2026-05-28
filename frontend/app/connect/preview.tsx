import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  Dimensions,
  StatusBar,
  Linking,
  Alert,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { theme as themeConstants } from '../../constants/theme';
import {
  getWebsiteContent,
  getSubscriptionContent,
  getPageDetail,
  getSubscriptionStatus,
  createSubscription,
  cancelSubscription as cancelSubApi,
  buyCommunityItem,
  getCurrencySymbol,
  fetchCurrencyConfig,
  formatConnectMoney,
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
  const { theme, isDark } = useTheme();
  const { showSuccess } = useAlert();
  const insets = useSafeAreaInsets();
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

  // Buy Items Checkout states
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [payPhone, setPayPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    fetchCurrencyConfig().then((config) => {
      setCountryToCurrency(config.countryToCurrency);
    }).catch(() => {});
  }, []);

  const isWebsite = section === 'website';
  const isSubscription = section === 'subscription';
  const isLocked = isSubscription && !isOwner && !subscriptionStatus?.isSubscribed;
  const isCommunity = pageData?.category === 'community' || pageData?.isAdminPage === true;
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

  const handleBuyPress = (item: any) => {
    setSelectedItem(item);
    setCheckoutModalVisible(true);
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          Alert.alert('Copied', 'UPI ID copied to clipboard!');
        }
      } else {
        const Clipboard = require('expo-clipboard').default;
        await Clipboard.setStringAsync(text);
        Alert.alert('Copied', 'UPI ID copied to clipboard!');
      }
    } catch (err) {
      logger.error('Failed to copy UPI:', err);
    }
  };

  const handleBuyItem = async () => {
    if (!selectedItem || !pageId) return;
    if (!buyerName.trim()) {
      Alert.alert('Error', 'Please enter your name.');
      return;
    }
    if (!buyerPhone.trim()) {
      Alert.alert('Error', 'Please enter your phone number.');
      return;
    }
    if (!payPhone.trim()) {
      Alert.alert('Error', 'Please enter your payment phone number.');
      return;
    }
    if (!deliveryAddress.trim()) {
      Alert.alert('Error', 'Please enter your delivery address.');
      return;
    }
    try {
      setCheckingOut(true);
      await buyCommunityItem(pageId, {
        itemId: selectedItem._id,
        buyerName: buyerName.trim(),
        buyerPhone: buyerPhone.trim(),
        payPhone: payPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
      });
      setCheckoutModalVisible(false);
      setBuyerName('');
      setBuyerPhone('');
      setPayPhone('');
      setDeliveryAddress('');
      Alert.alert('Success', 'Order placed successfully! The creator will contact you soon.');
    } catch (error: any) {
      logger.error('Failed to buy item:', error);
      Alert.alert('Error', error.message || 'Failed to place order.');
    } finally {
      setCheckingOut(false);
    }
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

    const getRawElement = () => {
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

    const element = getRawElement();
    if (!element) return null;

    if (isLocked) {
      return (
        <View key={block._id || index} pointerEvents="none" style={{ position: 'relative', overflow: 'hidden', borderRadius: blockRadius ?? 12, marginBottom: 8 }}>
          {element}
          <BlurView
            intensity={40}
            tint="dark"
            style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)' }]}
          >
            <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 }}>
              <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
            </View>
          </BlurView>
        </View>
      );
    }

    return element;
  };

  const buyItemsList = pageData?.buyItems?.filter(item => item.active) || [];
  const hasBuyItems = isCommunity && isSubscription && buyItemsList.length > 0;
  const isEmpty = !loading && sorted.length === 0 && !hasBuyItems;
  const screenBg = isEmpty ? '#FFFFFF' : theme.colors.background;
  const headerBg = isEmpty ? '#FFFFFF' : theme.colors.surface;
  const headerBorderColor = isEmpty ? '#FFFFFF' : theme.colors.border;
  const textColor = isEmpty ? '#000000' : theme.colors.text;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: screenBg }]}
      edges={['top']}
    >
      <StatusBar barStyle={isEmpty ? 'dark-content' : (isDark ? 'light-content' : 'dark-content')} />
      {/* Floating Glass Header */}
      <View
        style={[
          styles.headerContainer,
          {
            backgroundColor: isDark ? 'rgba(20, 23, 24, 0.7)' : 'rgba(250, 251, 251, 0.7)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            height: 60 + insets.top,
            paddingTop: insets.top,
          }
        ]}
      >
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={isDark ? ['rgba(255, 255, 255, 0.1)', 'transparent'] : ['rgba(255, 255, 255, 0.5)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.headerInner}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={isTablet ? 28 : 24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerRight}>
            {isOwner ? (
              <TouchableOpacity
                onPress={() => router.push(`/connect/editContent?pageId=${pageId}&section=${section}${section === 'subscription' ? `&category=${pageData?.category || 'connect'}` : ''}`)}
                activeOpacity={0.7}
                style={styles.editBtnWrap}
              >
                <LinearGradient
                  colors={['#34D399', '#14B8A6', '#38BDF8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.editBtnGradient}
                >
                  <Text style={styles.editBtnText}>
                    Edit
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View
                style={[styles.liveBadge, { backgroundColor: theme.colors.primary + '15' }]}
              >
                <View style={[styles.liveDot, { backgroundColor: theme.colors.primary }]} />
                <Text style={[styles.liveText, { color: theme.colors.primary }]}>Preview</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={theme.colors.primary} />
        </View>
      ) : isEmpty ? (
        <View style={[styles.emptyContainer, { backgroundColor: '#FFFFFF' }]}>
          <Text style={[styles.emptyText, { color: '#000000', fontFamily: getFontFamily('600'), fontWeight: '600', fontSize: 16 }]}>
            No content yet
          </Text>
        </View>
      ) : (
        <ScrollView
          style={[styles.scrollContent, pageBackground ? { backgroundColor: pageBackground } : null]}
          contentContainerStyle={[styles.contentContainer, { paddingTop: 60 + insets.top + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Buy Items Listing for Community Category */}
          {hasBuyItems && (
            <View style={styles.buyItemsSection}>
              <Text style={[styles.buySectionTitle, { color: textColor, fontFamily: getFontFamily('600') }]}>
                Items Available for Purchase
              </Text>
              {buyItemsList.map((item, index) => (
                <View
                  key={item._id || index}
                  style={[
                    styles.buyItemCard,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                    }
                  ]}
                >
                  <BlurView
                    intensity={15}
                    tint={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={styles.buyItemInner}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.buyItemImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.buyItemImagePlaceholder, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}>
                        <Ionicons name="cube-outline" size={24} color={textColor + '60'} />
                      </View>
                    )}
                    <View style={styles.buyItemInfo}>
                      <Text style={[styles.buyItemName, { color: textColor, fontFamily: getFontFamily('600') }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.buyItemDesc, { color: isDark ? '#A1A1AA' : '#71717A', fontFamily: getFontFamily('400') }]} numberOfLines={2}>
                        {item.description}
                      </Text>
                      <Text style={[styles.buyItemPrice, { color: theme.colors.primary, fontFamily: getFontFamily('600') }]}>
                        {formatConnectMoney(item.price, pageData?.subscriptionCurrency)}
                      </Text>
                    </View>
                    {!isOwner && (
                      <TouchableOpacity
                        onPress={() => handleBuyPress(item)}
                        activeOpacity={0.8}
                        style={styles.buyItemButton}
                      >
                        <LinearGradient
                          colors={['#34D399', '#14B8A6', '#38BDF8']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.buyItemButtonGradient}
                        >
                          <Text style={styles.buyItemButtonText}>Buy</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

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
                      <LoadingGlobe size="small" color="#FFFFFF" />
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

      {/* Checkout Modal */}
      <Modal
        visible={checkoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCheckoutModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setCheckoutModalVisible(false)} />
          <View
            style={[
              styles.checkoutModalBox,
              {
                backgroundColor: isDark ? 'rgba(20, 25, 35, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
              }
            ]}
          >
            <BlurView
              intensity={90}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.modalHeader}>
              <Text style={[styles.checkoutModalTitle, { color: textColor, fontFamily: getFontFamily('600') }]}>Checkout</Text>
              <TouchableOpacity onPress={() => setCheckoutModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <View style={styles.checkoutItemSummary}>
                <Text style={[styles.checkoutItemName, { color: textColor, fontFamily: getFontFamily('600') }]} numberOfLines={1}>{selectedItem.name}</Text>
                <Text style={[styles.checkoutItemPrice, { color: theme.colors.primary, fontFamily: getFontFamily('600') }]}>
                  {formatConnectMoney(selectedItem.price, pageData?.subscriptionCurrency)}
                </Text>
              </View>
            )}

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {pageData?.creatorPayoutInfo?.upiId ? (
                <View style={[styles.upiInfoCard, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]}>
                  <View style={styles.upiInfoRow}>
                    <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
                    <Text style={[styles.upiInfoTitle, { color: textColor, fontFamily: getFontFamily('600') }]}>Payment Instructions</Text>
                  </View>
                  <Text style={[styles.upiInfoText, { color: isDark ? '#A1A1AA' : '#71717A', fontFamily: getFontFamily('400') }]}>
                    To place this order, please pay ₹{selectedItem?.price} to the creator's UPI ID below.
                  </Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(pageData.creatorPayoutInfo.upiId || '')}
                    style={[styles.upiIdRow, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.8)', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.upiIdText, { color: theme.colors.primary, fontFamily: getFontFamily('600') }]}>
                      {pageData.creatorPayoutInfo.upiId}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 12, color: theme.colors.primary, fontFamily: getFontFamily('500') }}>Copy</Text>
                      <Ionicons name="copy-outline" size={16} color={theme.colors.primary} />
                    </View>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.upiInfoCard, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]}>
                  <View style={styles.upiInfoRow}>
                    <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
                    <Text style={[styles.upiInfoTitle, { color: textColor, fontFamily: getFontFamily('600') }]}>Payment Details</Text>
                  </View>
                  <Text style={[styles.upiInfoText, { color: isDark ? '#A1A1AA' : '#71717A', fontFamily: getFontFamily('400') }]}>
                    Payment must be done to place this order. Please enter your payment phone number below so the creator can verify your payment.
                  </Text>
                </View>
              )}

              <Text style={[styles.inputLabel, { color: textColor, fontFamily: getFontFamily('500') }]}>Your Name</Text>
              <TextInput
                style={[
                  styles.checkoutInput,
                  {
                    color: textColor,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    fontFamily: getFontFamily('400')
                  }
                ]}
                value={buyerName}
                onChangeText={setBuyerName}
                placeholder="Enter your full name"
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
              />

              <Text style={[styles.inputLabel, { color: textColor, fontFamily: getFontFamily('500') }]}>Phone Number</Text>
              <TextInput
                style={[
                  styles.checkoutInput,
                  {
                    color: textColor,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    fontFamily: getFontFamily('400')
                  }
                ]}
                value={buyerPhone}
                onChangeText={setBuyerPhone}
                placeholder="Enter your phone number"
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                keyboardType="phone-pad"
              />

              <Text style={[styles.inputLabel, { color: textColor, fontFamily: getFontFamily('500') }]}>UPI / Payment Phone Number</Text>
              <TextInput
                style={[
                  styles.checkoutInput,
                  {
                    color: textColor,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    fontFamily: getFontFamily('400')
                  }
                ]}
                value={payPhone}
                onChangeText={setPayPhone}
                placeholder="Enter UPI-linked phone number"
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                keyboardType="phone-pad"
              />

              <Text style={[styles.inputLabel, { color: textColor, fontFamily: getFontFamily('500') }]}>Delivery Address</Text>
              <TextInput
                style={[
                  styles.checkoutInput,
                  styles.checkoutAddressInput,
                  {
                    color: textColor,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    fontFamily: getFontFamily('400')
                  }
                ]}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder="Enter complete delivery address"
                placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={styles.checkoutBtn}
                onPress={handleBuyItem}
                disabled={checkingOut}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#34D399', '#14B8A6', '#38BDF8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.checkoutBtnGradient}
                >
                  {checkingOut ? (
                    <LoadingGlobe size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.checkoutBtnText, { fontFamily: getFontFamily('600') }]}>Place Order</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 10,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderTopWidth: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  editBtnWrap: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  editBtnGradient: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  buyItemsSection: {
    marginBottom: 20,
  },
  buySectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  buyItemCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  buyItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  buyItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  buyItemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyItemInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  buyItemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  buyItemDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  buyItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  buyItemButton: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  buyItemButtonGradient: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyItemButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  checkoutModalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
    overflow: 'hidden',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  checkoutModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  checkoutItemSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  checkoutItemName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  checkoutItemPrice: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 12,
  },
  checkoutInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  checkoutAddressInput: {
    height: 80,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  checkoutBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 24,
    marginBottom: 8,
  },
  checkoutBtnGradient: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  upiInfoCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  upiInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upiInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  upiInfoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  upiIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
  },
  upiIdText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
