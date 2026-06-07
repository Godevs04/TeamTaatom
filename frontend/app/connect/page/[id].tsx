import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  Dimensions,
  Modal,
  FlatList,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import LoadingGlobe from '../../../components/LoadingGlobe';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../context/ThemeContext';
import GradientText from '../../../components/ui/GradientText';
import { useAlert } from '../../../context/AlertContext';
import { theme as themeConstants } from '../../../constants/theme';
import {
  getPageDetail,
  followConnectPage,
  unfollowConnectPage,
  deleteConnectPage,
  updateConnectPage,
  getPageFollowers,
  recordPageView,
  createSubscription,
  getSubscriptionStatus,
  cancelSubscription as cancelSubApi,
  createBuyOrder,
  verifyBuyOrder,
  getPayoutPreview,
  getCurrencySymbol,
  formatConnectMoney,
  fetchCurrencyConfig,
  ConnectPageType,
  ContentBlock,
  PayoutPreview,
  ConnectFollowerUser,
  SubscriptionStatus,
} from '../../../services/connect';
import { crashReportingService } from '../../../services/crashReporting';
import { setPendingChatRoomId } from '../../../utils/connectChatBridge';
import { optimizeCloudinaryUrl } from '../../../utils/imageCache';
import logger from '../../../utils/logger';
import { useSubscription } from '../../../context/SubscriptionContext';
import { NativeModules } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  CFErrorResponse,
  CFPaymentGatewayService,
  CFEnvironment,
  CFSubscriptionSession,
  CFSession,
} from '../../../utils/cashfreeShim';
import { resolveCashfreeEnvironment } from '../../../utils/cashfreeCheckout';

// The Cashfree SDK ships a Proxy that throws "package not linked" the moment
// any method is called when the native module is absent (Expo Go, web). Gate
// every SDK call on the real native module so the screen doesn't crash; the
// dev-client build links the module and this becomes true.
const isCashfreeNativeAvailable = !!NativeModules.CashfreePgApi;

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

const getFontFamily = (weight: '400' | '500' | '600' | '700' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

const getContrastColor = (bgColor: string, defaultDark = '#000000', defaultLight = '#FFFFFF') => {
  if (!bgColor) return defaultLight;
  let color = bgColor.trim().toLowerCase();

  // Parse rgb / rgba
  if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0], 10);
      const g = parseInt(matches[1], 10);
      const b = parseInt(matches[2], 10);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 125 ? defaultDark : defaultLight;
    }
  }

  // Parse Hex
  if (color.startsWith('#')) {
    color = color.slice(1);
  }

  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }

  if (color.length === 6) {
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 125 ? defaultDark : defaultLight;
  }

  return defaultLight;
};

// Section padding: md on each side + section padding
const sectionContentWidth = screenWidth - (isTablet ? themeConstants.spacing.lg * 2 + themeConstants.spacing.lg * 2 : themeConstants.spacing.md * 2 + themeConstants.spacing.md * 2);

// Auto-sizing content image (matches preview.tsx). Uses aspectRatio so the
// image scales correctly when its parent shrinks — e.g., inside a Half-width
// flex cell. A fixed pixel height computed from full-section width would
// leave the image with wrong proportions in narrow cells.
// Aspect ratio overrides from editor: 'square' → 1, 'landscape' → 16/9, 'portrait' → 3/4
const AR_MAP: Record<string, number> = { square: 1, landscape: 16 / 9, portrait: 3 / 4 };

function ContentImage({ uri, inRow, inStack, arOverride, blurRadius }: { uri: string; inRow?: boolean; inStack?: boolean; arOverride?: string; blurRadius?: number }) {
  const [aspectRatio, setAspectRatio] = useState<number>(4 / 3);

  useEffect(() => {
    if (!uri || inStack || (arOverride && arOverride !== 'original')) return;
    Image.getSize(uri, (w, h) => { if (w > 0 && h > 0) setAspectRatio(w / h); }, () => {});
  }, [uri, inStack, arOverride]);

  const resolvedAR = arOverride && AR_MAP[arOverride] ? AR_MAP[arOverride] : aspectRatio;

  if (inStack) {
    return (
      <Image
        source={{ uri }}
        style={{ flex: 1, width: '100%', borderRadius: 8 }}
        resizeMode="cover"
        blurRadius={blurRadius}
      />
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[styles.contentImage, { aspectRatio: resolvedAR }]}
      resizeMode="cover"
      blurRadius={blurRadius}
    />
  );
}

export default function ConnectPageDetailScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { showSuccess } = useAlert();
  const { updateSubscriptionStatus } = useSubscription();
  const router = useRouter();
  const {
    id,
    optimistic_subscribed,
    optimistic_subscription_id,
    optimistic_amount,
    subscription_return,
  } = useLocalSearchParams<{
    id: string;
    optimistic_subscribed?: string;
    optimistic_subscription_id?: string;
    optimistic_amount?: string;
    subscription_return?: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<ConnectPageType | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [followers, setFollowers] = useState<ConnectFollowerUser[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [showSubscriptionManagementModal, setShowSubscriptionManagementModal] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  // Stores the pending subscription response so onVerify can optimistically
  // flip the UI before the webhook arrives and DB status updates to 'active'.
  const pendingSubscriptionRef = useRef<{ subscriptionId: string; amount: number } | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
   const [priceInput, setPriceInput] = useState('');
  const [showPayoutInfo, setShowPayoutInfo] = useState(false);
  const [payoutPreview, setPayoutPreview] = useState<PayoutPreview | null>(null);
  const [showBioEdit, setShowBioEdit] = useState(false);
  const [bioInput, setBioInput] = useState('');

  // Checkout Modal State
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  // Stores the pending buy order so onVerify can mark it paid
  const pendingBuyOrderRef = useRef<{ orderId: string; cashfreeOrderId: string; pageId: string } | null>(null);

  const [savingBio, setSavingBio] = useState(false);

  // Multi-currency live conversion support
  const [countryToCurrency, setCountryToCurrency] = useState<Record<string, string>>({ IN: 'INR' });
  const [displayPrices, setDisplayPrices] = useState<any>(null);

  useEffect(() => {
    fetchCurrencyConfig().then((config) => {
      setCountryToCurrency(config.countryToCurrency);
    }).catch(() => {});
  }, []);

  // Category-based labels
  const isCommunity = page?.category === 'community' || page?.isAdminPage === true;
  const subLabel = isCommunity ? 'Premium content' : 'Subscription';
  const subPriceLabel = isCommunity ? 'Buy' : 'Subscription';
  const subButtonText = isCommunity ? 'Buy' : 'Subscribe';
  const subscriberLabel = isCommunity ? 'Buyer' : 'Subscriber';
  const subscribersLabel = isCommunity ? 'Buyers' : 'Subscribers';

  const loadPageDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await getPageDetail(id);
      setPage(response.page);
      setIsOwner(response.isOwner);
      setIsFollowing(response.isFollowing);
      setDisplayPrices((response as any).subscriptionDisplayPrices);
      // Record view (non-critical, fire and forget)
      recordPageView(id);
    } catch (error) {
      logger.error('Error loading page detail:', error);
      Alert.alert('Error', 'Failed to load page details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadSubscriptionStatus = useCallback(async () => {
    if (!id || isOwner) return;
    try {
      const status = await getSubscriptionStatus(id);
      setSubscriptionStatus(status);
    } catch (error) {
      logger.warn('Error loading subscription status:', error);
    }
  }, [id, isOwner]);

  useFocusEffect(
    useCallback(() => {
      loadPageDetail();
    }, [loadPageDetail])
  );

  // Set up Cashfree payment callback for both subscription and one-time buy payments.
  useEffect(() => {
    if (!isCashfreeNativeAvailable) return;
    CFPaymentGatewayService.setCallback({
      onVerify(orderID: string): void {
        logger.info('Cashfree payment verified, orderID:', orderID);
        try {
          if (!id) throw new Error('Connect Page ID is missing during Cashfree callback');

          // ── One-time buy order verification ──
          if (pendingBuyOrderRef.current) {
            const { orderId, cashfreeOrderId, pageId } = pendingBuyOrderRef.current;
            pendingBuyOrderRef.current = null;
            verifyBuyOrder(pageId, { orderId, cashfreeOrderId, cashfreePaymentId: orderID })
              .catch((err) => logger.warn('Buy order server verify failed (non-blocking):', err));
            setCheckoutModalVisible(false);
            setBuyerName('');
            setBuyerPhone('');
            setDeliveryAddress('');
            showSuccess('Your payment is complete. Order placed!', 'Order confirmed');
            return;
          }

          // ── Subscription verification ──
          let newStatus: SubscriptionStatus = { isSubscribed: true, subscription: null };
          if (pendingSubscriptionRef.current) {
            newStatus = {
              isSubscribed: true,
              subscription: {
                _id: pendingSubscriptionRef.current.subscriptionId,
                status: 'active' as const,
                amount: pendingSubscriptionRef.current.amount,
                activatedAt: new Date().toISOString(),
                currentPeriodEnd: null,
              },
            };
            setSubscriptionStatus(newStatus);
            updateSubscriptionStatus(id, newStatus);
            pendingSubscriptionRef.current = null;
          } else {
            newStatus = {
              isSubscribed: true,
              subscription: {
                _id: orderID || 'unknown',
                status: 'active' as const,
                amount: page?.subscriptionPrice || 0,
                activatedAt: new Date().toISOString(),
                currentPeriodEnd: null,
              }
            };
            setSubscriptionStatus(newStatus);
            updateSubscriptionStatus(id, newStatus);
          }
          loadSubscriptionStatus();
          loadPageDetail();
          showSuccess(
            isCommunity ? 'Your purchase was completed.' : 'Your subscription is now active.',
            'Payment received',
          );
        } catch (err) {
          logger.error('Error handling Cashfree onVerify callback:', err);
          Alert.alert('Payment Verification Error', 'An error occurred while processing your payment.');
        }
      },
      onError(error: CFErrorResponse, orderID: string): void {
        try {
          logger.error('Cashfree payment error:', JSON.stringify(error), 'orderID:', orderID);
          // If this was a buy order, clear it
          if (pendingBuyOrderRef.current) {
            pendingBuyOrderRef.current = null;
          }
          Alert.alert('Payment Failed', 'Could not complete payment. Please try again.');
        } catch (err) {
          logger.error('Error handling Cashfree onError callback:', err);
        }
      },
    });
    return () => { CFPaymentGatewayService.removeCallback(); };
  }, [loadSubscriptionStatus, loadPageDetail, isCommunity, showSuccess, id, page, updateSubscriptionStatus]);

  // Load subscription status after page loads (non-owner only)
  useEffect(() => {
    if (page && !isOwner && page.features?.subscription && page.subscriptionPrice) {
      loadSubscriptionStatus();
    }
  }, [page, isOwner, loadSubscriptionStatus]);

  // If navigated from preview after payment, apply optimistic subscribed state
  // immediately so the UI flips without waiting for the webhook to update the DB.
  useEffect(() => {
    if (optimistic_subscribed === '1' && optimistic_subscription_id) {
      setSubscriptionStatus({
        isSubscribed: true,
        subscription: {
          _id: optimistic_subscription_id,
          status: 'active',
          amount: Number(optimistic_amount) || 0,
          activatedAt: new Date().toISOString(),
          currentPeriodEnd: null,
        },
      });
    }
  }, [optimistic_subscribed, optimistic_subscription_id, optimistic_amount]);

  // After Cashfree HTTPS return redirect opens the app again
  useEffect(() => {
    if (subscription_return === '1' && page && !isOwner) {
      loadSubscriptionStatus();
      loadPageDetail();
    }
  }, [subscription_return, page, isOwner, loadSubscriptionStatus, loadPageDetail]);

  const getNextBillingDate = () => {
    if (subscriptionStatus?.subscription?.currentPeriodEnd) {
      return new Date(subscriptionStatus.subscription.currentPeriodEnd).toLocaleDateString();
    }
    if (subscriptionStatus?.subscription?.activatedAt) {
      const activated = new Date(subscriptionStatus.subscription.activatedAt);
      activated.setMonth(activated.getMonth() + 1);
      return activated.toLocaleDateString();
    }
    return '4/7/2026';
  };

  const handleSubscribe = async () => {
    if (!page || subscribing) return;
    if (!isCashfreeNativeAvailable) {
      Alert.alert(
        'Dev build required',
        'Subscriptions need the Cashfree native module, which is not available in Expo Go. Install the development build to subscribe.',
      );
      return;
    }
    try {
      setSubscribing(true);
      const result = await createSubscription(page._id);
      const subsSessionId = result.subscriptionSessionId || result.paymentSessionId;
      if (subsSessionId && result.cashfreeSubscriptionId) {
        // Store pending data so onVerify can optimistically flip the UI
        // before the webhook arrives and syncs DB status to 'active'.
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
      logger.error('Error creating subscription:', error);
      Alert.alert('Error', error.message || 'Failed to initiate subscription.');
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancelSubscription = () => {
    if (!subscriptionStatus?.subscription?._id) return;
    Alert.alert(
      isCommunity ? 'Cancel Purchase' : 'Cancel Subscription',
      isCommunity
        ? 'Are you sure you want to cancel? You will retain access until the end of the current billing period.'
        : 'Are you sure you want to cancel your subscription? You will retain access until the end of the current billing period.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: isCommunity ? 'Cancel Purchase' : 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelSubApi(subscriptionStatus.subscription!._id);
              setSubscriptionStatus({
                isSubscribed: false,
                subscription: {
                  ...subscriptionStatus.subscription!,
                  status: 'cancelled',
                },
              });
              Alert.alert('Cancelled', isCommunity ? 'Your purchase has been cancelled.' : 'Your subscription has been cancelled.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel subscription.');
            }
          },
        },
      ]
    );
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          Alert.alert('Copied', 'UPI ID copied to clipboard!');
        }
      } else {
        await Clipboard.setStringAsync(text);
        Alert.alert('Copied', 'UPI ID copied to clipboard!');
      }
    } catch (err) {
      logger.error('Failed to copy UPI:', err);
    }
  };

  const handleBuyItem = async () => {
    if (!selectedItem) return;
    if (!buyerName.trim()) {
      Alert.alert('Validation Error', 'Please enter your name.');
      return;
    }
    if (!buyerPhone.trim()) {
      Alert.alert('Validation Error', 'Please enter your phone number.');
      return;
    }
    if (!deliveryAddress.trim()) {
      Alert.alert('Validation Error', 'Please enter your delivery address.');
      return;
    }

    if (!isCashfreeNativeAvailable) {
      Alert.alert(
        'Dev build required',
        'Payments need the Cashfree native module, which is not available in Expo Go. Use a development build to complete purchases.',
      );
      return;
    }

    try {
      setCheckingOut(true);
      const result = await createBuyOrder(id, {
        itemId: selectedItem._id,
        buyerName: buyerName.trim(),
        buyerPhone: buyerPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
      });

      // Store pending order ref so onVerify knows to call verifyBuyOrder
      pendingBuyOrderRef.current = {
        orderId: result.orderId,
        cashfreeOrderId: result.cashfreeOrderId,
        pageId: id,
      };

      const env = resolveCashfreeEnvironment(result.cashfreeEnvironment);
      const session = new CFSession(
        result.paymentSessionId,
        result.cashfreeOrderId,
        env,
      );
      CFPaymentGatewayService.doPayment(session);
    } catch (error: any) {
      logger.error('Failed to initiate buy payment:', error);
      Alert.alert('Error', error.message || 'Failed to initiate payment. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };


  const handleFollowToggle = async () => {
    if (!page || followLoading) return;
    try {
      setFollowLoading(true);
      // Optimistic update
      const wasFollowing = isFollowing;
      setIsFollowing(!wasFollowing);
      setPage(prev =>
        prev
          ? { ...prev, followerCount: prev.followerCount + (wasFollowing ? -1 : 1) }
          : prev
      );

      if (wasFollowing) {
        await unfollowConnectPage(page._id);
      } else {
        await followConnectPage(page._id);
      }
    } catch (error) {
      // Revert optimistic update
      setIsFollowing(isFollowing);
      setPage(prev =>
        prev
          ? { ...prev, followerCount: prev.followerCount + (isFollowing ? 0 : -1) }
          : prev
      );
      logger.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleOpenChat = () => {
    if (!page?.chatRoomId) return;
    crashReportingService.addBreadcrumb('Opening connect page group chat', 'navigation', {
      pageId: page._id,
      pageName: page.name,
      chatRoomId: page.chatRoomId,
    });
    router.push({
      pathname: '/chat/thread',
      params: { chatId: page.chatRoomId }
    });
  };

  const handleSaveBio = async () => {
    if (!page) return;
    try {
      setSavingBio(true);
      const result = await updateConnectPage(page._id, { bio: bioInput.trim() } as any);
      setPage(result.page);
      setShowBioEdit(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update description.');
    } finally {
      setSavingBio(false);
    }
  };

  const handleDeletePage = () => {
    if (!page) return;
    Alert.alert(
      'Delete Page',
      `Are you sure you want to delete "${page.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConnectPage(page._id);
              Alert.alert('Deleted', 'Your connect page has been deleted.');
              router.back();
            } catch (error: any) {
              logger.error('Error deleting page:', error);
              Alert.alert('Error', error.message || 'Failed to delete page.');
            }
          },
        },
      ]
    );
  };

  const handleShowFollowers = async () => {
    if (!id) return;
    setShowFollowers(true);
    setFollowersLoading(true);
    try {
      const response = await getPageFollowers(id);
      let list = (response.followers || []).filter(Boolean);
      const isCommunityPage = (page?.type as string) === 'community' || page?.category === 'community';
      if (isCommunityPage) {
        const creatorId = page && typeof page.userId === 'object' && page.userId ? page.userId._id : page?.userId;
        if (creatorId) {
          list = list.filter((m: any) => m._id.toString() !== creatorId.toString());
        }
      }
      setFollowers(list);
    } catch (error) {
      logger.error('Error loading followers:', error);
    } finally {
      setFollowersLoading(false);
    }
  };

  type RowCell = { col: number; blocks: ContentBlock[] };

  // Pack blocks into rows of cells. stacked=true blocks join the last cell of
  // the last closed row (mosaic: tall-left + two-stacked-right layout).
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

  const renderContentBlock = (block: ContentBlock, index: number, pageTextColor?: string, inRow = false, inStack = false, obfuscate = false) => {
    // Per-block override > page-level override > theme default.
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
    const wrap = (node: React.ReactNode) =>
      hasWrapStyles ? (
        <View
          key={block._id || index}
          style={{
            backgroundColor: effectiveBg || undefined,
            borderRadius: blockRadius ?? 12,
            padding: blockPadding ?? (effectiveBg ? 10 : 0),
            overflow: 'hidden',
          }}
        >
          {node}
        </View>
      ) : (
        <React.Fragment key={block._id || index}>{node}</React.Fragment>
      );

    let node = null;
    switch (block.type) {
      case 'heading':
        node = wrap(
          <Text style={[styles.contentHeading, { color: effectiveTextColor, textAlign, fontSize: headingFontSize }, block.bold ? { fontWeight: '800' } : undefined]}>
            {block.content}
          </Text>
        );
        break;
      case 'text':
        node = wrap(
          <Text style={[styles.contentText, { color: effectiveTextColor, textAlign, fontSize: textFontSize }, block.bold ? { fontWeight: '700', fontFamily: getFontFamily('700') } : undefined]}>
            {block.content}
          </Text>
        );
        break;
      case 'image':
        node = block.content ? (
          <View key={block._id || index} style={blockRadius !== undefined ? { borderRadius: blockRadius, overflow: 'hidden' } : undefined}>
            <ContentImage uri={block.content} inRow={inRow} inStack={inStack} arOverride={block.aspectRatio} blurRadius={obfuscate ? 25 : undefined} />
          </View>
        ) : null;
        break;
      case 'video':
        node = (
          <TouchableOpacity
            key={block._id || index}
            style={[styles.videoPlaceholder, { backgroundColor: effectiveBg || theme.colors.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="play-circle" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.videoLabel, { color: theme.colors.textSecondary }]}>
              Video
            </Text>
          </TouchableOpacity>
        );
        break;
      case 'button': {
        // Defensive scheme prefix: backend normalizes button URLs on save,
        // but rows saved before that fix may still have bare domains like
        // "taatom.com" — without https:// Linking.openURL silently fails.
        const rawUrl = block.url?.trim();
        const buttonUrl = rawUrl && /^[a-z][a-z0-9+.-]*:/i.test(rawUrl)
          ? rawUrl
          : (rawUrl ? `https://${rawUrl}` : '');
        const hasCustomBg = !!effectiveBg;
        const buttonBg = effectiveBg || theme.colors.primary;
        const contrastTextColor = hasCustomBg ? getContrastColor(buttonBg, '#000000', '#FFFFFF') : '#FFFFFF';
        const buttonTextColor = block.color
          ? (block.color.toLowerCase() === '#ffffff' && contrastTextColor === '#000000' ? '#000000' : block.color)
          : contrastTextColor;
        node = (
          <TouchableOpacity
            key={block._id || index}
            style={[styles.contentButton, { backgroundColor: hasCustomBg ? buttonBg : 'transparent', overflow: 'hidden' }]}
            onPress={() => {
              if (buttonUrl) Linking.openURL(buttonUrl).catch(() => {});
            }}
            activeOpacity={0.7}
          >
            {!hasCustomBg && (
              <LinearGradient
                colors={['#50C878', '#1C73B4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            <Text style={[styles.contentButtonText, { color: buttonTextColor }]}>
              {block.content || 'Button'}
            </Text>
          </TouchableOpacity>
        );
        break;
      }
      case 'divider':
        node = (
          <View
            key={block._id || index}
            style={[styles.contentDivider, { backgroundColor: theme.colors.border }]}
          />
        );
        break;
      case 'embed':
        node = (
          <TouchableOpacity
            key={block._id || index}
            style={[styles.embedPlaceholder, { backgroundColor: effectiveBg || theme.colors.border }]}
            onPress={() => {
              if (block.content) Linking.openURL(block.content).catch(() => {});
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="open-outline" size={24} color={theme.colors.textSecondary} />
            <Text style={[styles.embedLabel, { color: theme.colors.textSecondary }]}>
              {block.embedType === 'youtube' ? 'YouTube Video' : block.embedType === 'map' ? 'Google Map' : 'External Content'}
            </Text>
            <Text style={[styles.embedLink, { color: theme.colors.primary }]} numberOfLines={1}>
              Tap to open
            </Text>
          </TouchableOpacity>
        );
        break;
      default:
        node = null;
    }

    if (obfuscate && block.type !== 'image' && node) {
      return (
        <View key={block._id || index} style={{ position: 'relative', overflow: 'hidden', borderRadius: blockRadius ?? 12 }}>
          {node}
          <BlurView
            intensity={35}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
            {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
          />
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: isDark ? 'rgba(30, 30, 30, 0.4)' : 'rgba(240, 240, 240, 0.4)',
              zIndex: 10,
            }}
          />
        </View>
      );
    }

    return node;
  };

  if (loading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!page) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View
          style={[
            styles.headerContainer,
            {
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(28, 115, 180, 0.15)',
              top: 0,
              paddingTop: insets.top,
              height: 52 + insets.top,
              marginTop: 0,
              marginHorizontal: 0,
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              borderWidth: 0,
              borderBottomWidth: 1,
              shadowOpacity: isDark ? 0.3 : 0.1,
            }
          ]}
        >
          <BlurView
            intensity={80}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.headerInner}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <GradientText text="Connect Page" style={styles.headerTitle} />
            <View style={styles.headerRight} />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>
            Page not found
          </Text>
        </View>
      </View>
    );
  }

  const ownerName = typeof page.userId === 'object' && page.userId ? page.userId.fullName : '';
  const currSym = getCurrencySymbol(page.subscriptionCurrency || 'INR');
  const normalCount = Math.max(0, Math.floor((page.followerCount || 0) + 1));
  const isCommunityPage = (page.type as string) === 'community' || page.category === 'community';
  const displayMemberCount = isCommunityPage ? Math.max(0, normalCount - 1) : normalCount;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Background Depth Layer */}
      {page.bannerImage ? (
        <Image
          source={{ uri: optimizeCloudinaryUrl(page.bannerImage, { width: 200, height: 200 }) }}
          style={[StyleSheet.absoluteFillObject, { opacity: isDark ? 0.12 : 0.22 }]}
          resizeMode="cover"
          blurRadius={Platform.OS === 'android' ? 25 : 50}
        />
      ) : page.profileImage ? (
        <Image
          source={{ uri: optimizeCloudinaryUrl(page.profileImage, { width: 200, height: 200 }) }}
          style={[StyleSheet.absoluteFillObject, { opacity: isDark ? 0.12 : 0.22 }]}
          resizeMode="cover"
          blurRadius={Platform.OS === 'android' ? 25 : 50}
        />
      ) : null}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(13, 17, 23, 0.92)', 'rgba(6, 8, 12, 0.98)']
            : ['rgba(248, 250, 252, 0.85)', 'rgba(241, 245, 249, 0.95)']
        }
        style={StyleSheet.absoluteFillObject}
      />

      {/* Floating Glass Header */}
      <View
        style={[
          styles.headerContainer,
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            zIndex: 100,
            paddingTop: insets.top,
            height: 52 + insets.top,
            borderWidth: 0,
            borderBottomWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            backgroundColor: 'transparent',
          }
        ]}
      >
        <BlurView
          intensity={75}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
          {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
        />
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: isDark ? 'rgba(15, 15, 15, 0.35)' : 'rgba(255, 255, 255, 0.1)' }
          ]}
        />
        <View style={styles.headerInner}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={isTablet ? 28 : 24} color={isDark ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#000000' }]} numberOfLines={1}>
            {page.name}
          </Text>
          {isOwner ? (
            <TouchableOpacity
              style={styles.headerRight}
              onPress={() => {
                Alert.alert(
                  'Page Options',
                  undefined,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete Page',
                      style: 'destructive',
                      onPress: handleDeletePage,
                    },
                  ]
                );
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-horizontal" size={isTablet ? 26 : 22} color={isDark ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerRight} />
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{ paddingTop: 0 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        {page.bannerImage ? (
          <Image
            source={{ uri: optimizeCloudinaryUrl(page.bannerImage, { width: 800, height: 400, quality: 'auto' }) }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.bannerPlaceholder, { backgroundColor: isDark ? '#000000' : '#FFFFFF', overflow: 'hidden', position: 'relative' }]}>
            {/* Aurora Mesh Glows */}
            <View
              style={{
                position: 'absolute',
                top: -20,
                left: -20,
                width: 150,
                height: 150,
                borderRadius: 75,
                backgroundColor: 'rgba(28, 115, 180, 0.15)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: -20,
                right: -20,
                width: 150,
                height: 150,
                borderRadius: 75,
                backgroundColor: 'rgba(80, 200, 120, 0.15)',
              }}
            />
            <BlurView
              intensity={50}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFillObject}
              {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
            />
            <Ionicons name="people-outline" size={32} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
          </View>
        )}

        {/* Profile Image Wrapper (rendered as sibling, positioned above/overlapping the profile section card) */}
        <View style={[styles.profileImageWrapper, { position: 'relative', zIndex: 20, top: 0, marginBottom: -(isTablet ? 44 : 38) }]}>
          {page.profileImage ? (
            <Image
              source={{ uri: optimizeCloudinaryUrl(page.profileImage, { width: 160, height: 160 }) }}
              style={[styles.pageProfileImage, { borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.8)' }]}
            />
          ) : (
            <View style={[styles.pageProfileImagePlaceholder, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)', borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.8)' }]}>
              <Ionicons name="people" size={36} color={theme.colors.primary + '60'} />
            </View>
          )}
        </View>

        {/* Profile Section */}
        <View
          style={[
            styles.profileSection,
            {
              overflow: 'hidden',
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderTopColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.75)',
              borderLeftColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.75)',
              borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.2)',
              borderRightColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.2)',
              marginTop: 0,
              paddingTop: isTablet ? 52 : 46,
              ...Platform.select({
                ios: {
                  shadowColor: isDark ? '#000000' : '#1f2687',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: isDark ? 0.12 : 0.07,
                  shadowRadius: 32,
                },
                android: {
                  elevation: 1,
                },
              }),
            }
          ]}
        >
          <BlurView
            intensity={50}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
            {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
          />
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: isDark ? 'rgba(15, 20, 30, 0.45)' : 'rgba(255, 255, 255, 0.45)',
              }
            ]}
          />

          {/* Name & bio centered */}
          <View style={styles.profileInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              {page.type === 'private' && (
                <Ionicons name="lock-closed" size={14} color={theme.colors.textSecondary} style={{ marginRight: 5 }} />
              )}
              <Text style={[styles.pageName, { color: theme.colors.text }]}>{page.name}</Text>
            </View>
            {ownerName ? (
              <Text style={[styles.ownerLabel, { color: theme.colors.textSecondary }]}>
                by {ownerName}
              </Text>
            ) : null}
          </View>

          {/* Bio / Description */}
          {isOwner ? (
            <TouchableOpacity
              onPress={() => {
                setBioInput(page.bio || '');
                setShowBioEdit(true);
              }}
              activeOpacity={0.7}
              style={styles.bioEditTouchable}
            >
              <Text style={[styles.pageBio, { color: page.bio ? theme.colors.textSecondary : theme.colors.primary }]}>
                {page.bio || 'Add a description...'}
              </Text>
              <Ionicons name="pencil-outline" size={14} color={theme.colors.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ) : page.bio ? (
            <Text style={[styles.pageBio, { color: theme.colors.textSecondary }]}>
              {page.bio}
            </Text>
          ) : null}

          {/* Stats & Actions Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.statsButton,
                {
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.06)' : 'rgba(28, 115, 180, 0.05)',
                  borderColor: isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(28, 115, 180, 0.25)',
                  borderWidth: 1,
                }
              ]}
              onPress={handleShowFollowers}
              activeOpacity={0.7}
            >
              <Ionicons name="people-outline" size={16} color={isDark ? '#38BDF8' : '#1C73B4'} />
              <Text style={[styles.statsButtonText, { color: isDark ? '#FFFFFF' : '#1C73B4' }]}>
                {displayMemberCount}
              </Text>
              <Text style={[styles.statsButtonLabel, { color: isDark ? '#8E9AA8' : '#64748B' }]}>
                Members
              </Text>
            </TouchableOpacity>

            {isOwner && (
              <TouchableOpacity
                style={[
                  styles.statsButton,
                  {
                    backgroundColor: isDark ? 'rgba(80, 200, 120, 0.06)' : 'rgba(80, 200, 120, 0.05)',
                    borderColor: isDark ? 'rgba(80, 200, 120, 0.2)' : 'rgba(80, 200, 120, 0.25)',
                    borderWidth: 1,
                  }
                ]}
                onPress={() => router.push(`/connect/dashboard?pageId=${id}&category=${page.category || 'connect'}`)}
                activeOpacity={0.7}
              >
                <Ionicons name="analytics-outline" size={16} color={isDark ? '#50C878' : '#107C41'} />
                <Text style={[styles.statsButtonLabel, { color: isDark ? '#8E9AA8' : '#107C41', fontWeight: '600' }]}>
                  Dashboard
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Follow Button (non-owner) */}
          {!isOwner && (
            <TouchableOpacity
              style={styles.followMainButtonContainer}
              onPress={handleFollowToggle}
              disabled={followLoading}
              activeOpacity={0.7}
            >
              {isFollowing ? (
                <View
                  style={[
                    styles.followButtonInner,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(28, 115, 180, 0.06)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(28, 115, 180, 0.3)',
                    }
                  ]}
                >
                  {followLoading ? (
                    <LoadingGlobe size="small" color={isDark ? '#38BDF8' : '#1C73B4'} />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={isDark ? '#38BDF8' : '#1C73B4'}
                      />
                      <Text style={[styles.followMainButtonText, { color: isDark ? '#38BDF8' : '#1C73B4' }]}>
                        Following
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <LinearGradient
                  colors={isDark ? ['#14B8A6', '#38BDF8'] : ['#50C878', '#1C73B4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.followButtonGradient}
                >
                  {followLoading ? (
                    <LoadingGlobe size="small" color="#FFFFFF" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons
                        name="add-circle-outline"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={[styles.followMainButtonText, { color: '#FFFFFF' }]}>
                        Follow
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Website Section */}
        {page.features?.website && (
          <TouchableOpacity
            style={[
              styles.section,
              {
                overflow: 'hidden',
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderTopColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.7)',
                borderLeftColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.7)',
                borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.2)',
                borderRightColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.2)',
                paddingBottom: isTablet ? themeConstants.spacing.md : 12,
                marginTop: isTablet ? 14 : 12,
                ...Platform.select({
                  ios: {
                    shadowColor: isDark ? '#000000' : '#1f2687',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: isDark ? 0.12 : 0.07,
                    shadowRadius: 32,
                  },
                  android: {
                    elevation: 1,
                  },
                }),
              }
            ]}
            onPress={() => router.push(`/connect/preview?pageId=${id}&section=website&pageName=${encodeURIComponent(page.name)}`)}
            activeOpacity={0.7}
          >
            <BlurView
              intensity={45}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFillObject}
              {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
            />
            <View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: isDark ? 'rgba(15, 20, 30, 0.45)' : 'rgba(255, 255, 255, 0.45)',
                }
              ]}
            />
            <View style={[styles.sectionHeader, { marginBottom: 0 }]}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(28, 115, 180, 0.08)' }]}>
                  <Ionicons name="globe-outline" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Website</Text>
                  <Text style={[styles.chatDescription, { color: theme.colors.textSecondary }]}>
                    {isOwner ? 'Manage your site and content' : 'Explore website and pages'}
                  </Text>
                </View>
              </View>
              <View style={[styles.chatArrowWrap, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(28, 115, 180, 0.08)' }]}>
                <Ionicons name="chevron-forward" size={16} color={isDark ? '#38BDF8' : '#1C73B4'} />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Group Chat Section */}
        {page.features?.groupChat && (
          <TouchableOpacity
            style={[
              styles.section,
              {
                overflow: 'hidden',
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderTopColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.7)',
                borderLeftColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.7)',
                borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.2)',
                borderRightColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.2)',
                paddingBottom: isTablet ? themeConstants.spacing.md : 12,
                marginTop: !page.features?.website ? (isTablet ? 14 : 12) : 10,
                ...Platform.select({
                  ios: {
                    shadowColor: isDark ? '#000000' : '#1f2687',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: isDark ? 0.12 : 0.07,
                    shadowRadius: 32,
                  },
                  android: {
                    elevation: 1,
                  },
                }),
              }
            ]}
            onPress={handleOpenChat}
            activeOpacity={0.7}
          >
            <BlurView
              intensity={45}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFillObject}
              {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
            />
            <View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: isDark ? 'rgba(15, 20, 30, 0.45)' : 'rgba(255, 255, 255, 0.45)',
                }
              ]}
            />
            <View style={[styles.sectionHeader, { marginBottom: 0 }]}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: isDark ? 'rgba(80, 200, 120, 0.15)' : 'rgba(80, 200, 120, 0.08)' }]}>
                  <Ionicons name="chatbubbles-outline" size={18} color={isDark ? '#50C878' : '#107C41'} />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Group Chat</Text>
                  <GradientText
                    text={`${displayMemberCount} members active`}
                    style={styles.chatDescription}
                  />
                </View>
              </View>
              <View style={[styles.chatArrowWrap, { backgroundColor: isDark ? 'rgba(80, 200, 120, 0.12)' : 'rgba(80, 200, 120, 0.08)' }]}>
                <Ionicons name="chevron-forward" size={16} color={isDark ? '#50C878' : '#107C41'} />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Subscription / Buy Items Section */}
        {page.features?.subscription && (
          <TouchableOpacity
            style={[
              styles.section,
              {
                overflow: 'hidden',
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderTopColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.7)',
                borderLeftColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.7)',
                borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.2)',
                borderRightColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.2)',
                paddingBottom: isTablet ? themeConstants.spacing.md : 12,
                marginTop: (!page.features?.website && !page.features?.groupChat) ? (isTablet ? 14 : 12) : 10,
                ...Platform.select({
                  ios: {
                    shadowColor: isDark ? '#000000' : '#1f2687',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: isDark ? 0.12 : 0.07,
                    shadowRadius: 32,
                  },
                  android: {
                    elevation: 1,
                  },
                }),
              }
            ]}
            onPress={() => {
              if (subscriptionStatus?.isSubscribed) {
                setShowSubscriptionManagementModal(true);
              } else {
                router.push(`/connect/preview?pageId=${id}&section=subscription&pageName=${encodeURIComponent(page.name)}`);
              }
            }}
            activeOpacity={0.7}
          >
            <BlurView
              intensity={45}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFillObject}
              {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
            />
            <View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: isDark ? 'rgba(15, 20, 30, 0.45)' : 'rgba(255, 255, 255, 0.45)',
                }
              ]}
            />
            <View style={[styles.sectionHeader, { marginBottom: 0 }]}>
              <View style={styles.sectionTitleRow}>
                <View
                  style={[
                    styles.sectionIconWrap,
                    {
                      backgroundColor: isCommunity
                        ? (isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(217, 119, 6, 0.08)')
                        : (isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(28, 115, 180, 0.08)')
                    }
                  ]}
                >
                  <Ionicons
                    name={isCommunity ? 'cart-outline' : 'star-outline'}
                    size={18}
                    color={
                      isCommunity
                        ? (isDark ? '#F59E0B' : '#D97706')
                        : (isDark ? '#38BDF8' : '#1C73B4')
                    }
                  />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    {isCommunity ? 'Buy Items' : subLabel}
                  </Text>
                  <Text style={[styles.chatDescription, { color: theme.colors.textSecondary }]}>
                    {isOwner
                      ? (isCommunity ? 'Manage items listed for sale' : 'Manage subscription content')
                      : (isCommunity ? 'Browse items for sale' : 'Access premium content')
                    }
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.chatArrowWrap,
                  {
                    backgroundColor: isCommunity
                      ? (isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(217, 119, 6, 0.08)')
                      : (isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(28, 115, 180, 0.08)')
                  }
                ]}
              >
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={
                    isCommunity
                      ? (isDark ? '#F59E0B' : '#D97706')
                      : (isDark ? '#38BDF8' : '#1C73B4')
                  }
                />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Delete Page — Owner only */}
        {isOwner && (
          <TouchableOpacity
            style={[styles.deleteButton, { borderColor: theme.colors.border }]}
            onPress={handleDeletePage}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.deleteButtonText, { color: theme.colors.textSecondary }]}>Delete Page</Text>
          </TouchableOpacity>
        )}

        {/* Bottom Spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bio Edit Modal */}
      <Modal
        visible={showBioEdit}
        animationType="fade"
        transparent
        onRequestClose={() => setShowBioEdit(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={styles.priceModalOverlay}
            activeOpacity={1}
            onPress={() => setShowBioEdit(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.bioModalBox, { backgroundColor: theme.colors.surface }]}
            >
              <View style={styles.bioModalHeader}>
                <Text style={[styles.bioModalTitle, { color: theme.colors.text }]}>Edit Description</Text>
                <TouchableOpacity
                  onPress={() => setShowBioEdit(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.bioModalInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                value={bioInput}
                onChangeText={setBioInput}
                placeholder="Describe your page..."
                placeholderTextColor={theme.colors.textSecondary + '80'}
                multiline
                maxLength={300}
                autoFocus
              />
              <Text style={[styles.bioModalCharCount, { color: theme.colors.textSecondary }]}>
                {bioInput.length}/300
              </Text>
              <TouchableOpacity
                style={[styles.bioModalSaveButton, { overflow: 'hidden' }]}
                onPress={handleSaveBio}
                activeOpacity={0.7}
                disabled={savingBio}
              >
                <LinearGradient
                  colors={['#50C878', '#1C73B4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                {savingBio ? (
                  <LoadingGlobe size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.bioModalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Followers Modal */}
      <Modal
        visible={showFollowers}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFollowers(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Members
              </Text>
              <TouchableOpacity
                onPress={() => setShowFollowers(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {followersLoading ? (
              <View style={styles.modalLoading}>
                <LoadingGlobe size="large" color={theme.colors.primary} />
              </View>
            ) : followers.length === 0 ? (
              <View style={styles.modalLoading}>
                <Text style={{ color: theme.colors.textSecondary }}>No members yet</Text>
              </View>
            ) : (
              <FlatList
                data={followers}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.followerItem}
                    onPress={() => {
                      setShowFollowers(false);
                      router.push(`/profile/${item._id}`);
                    }}
                    activeOpacity={0.7}
                  >
                    {item.profilePic ? (
                      <Image source={{ uri: item.profilePic }} style={styles.followerAvatar} />
                    ) : (
                      <View style={[styles.followerAvatarPlaceholder, { backgroundColor: theme.colors.border }]}>
                        <Ionicons name="person" size={20} color={theme.colors.textSecondary} />
                      </View>
                    )}
                    <View style={styles.followerInfo}>
                      <View style={styles.followerNameRow}>
                        <Text style={[styles.followerName, { color: theme.colors.text }]} numberOfLines={1}>
                          {item.fullName}
                        </Text>
                        {item.role === 'admin' && (
                          <View style={[styles.adminBadge, { backgroundColor: theme.colors.primary + '18' }]}>
                            <Text style={[styles.adminBadgeText, { color: theme.colors.primary }]}>Admin</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.followerUsername, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        @{item.username}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Payout Info Modal (owner only) */}
      <Modal
        visible={showPayoutInfo}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPayoutInfo(false)}
      >
        <TouchableOpacity
          style={styles.priceModalOverlay}
          activeOpacity={1}
          onPress={() => setShowPayoutInfo(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.payoutModalBox, { backgroundColor: theme.colors.surface }]}
          >
            <View style={styles.payoutModalHeader}>
              <Text style={[styles.payoutModalTitle, { color: theme.colors.text }]}>
                Payout Breakdown
              </Text>
              <TouchableOpacity
                onPress={() => setShowPayoutInfo(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {payoutPreview ? (
              <View style={styles.payoutDetails}>
                <View style={styles.payoutRow}>
                  <Text style={[styles.payoutLabel, { color: theme.colors.textSecondary }]}>{subscriberLabel} pays</Text>
                  <Text style={[styles.payoutValue, { color: theme.colors.text }]}>
                    {formatConnectMoney(payoutPreview.grossAmount, payoutPreview.currency)}
                  </Text>
                </View>
                <View style={[styles.payoutDivider, { backgroundColor: theme.colors.border }]} />

                <View style={styles.payoutRow}>
                  <Text style={[styles.payoutLabel, { color: theme.colors.textSecondary }]}>
                    Payment gateway ({payoutPreview.gatewayFeePercent}%)
                  </Text>
                  <Text style={[styles.payoutDeduction, { color: theme.colors.error }]}>
                    −{formatConnectMoney(payoutPreview.gatewayFee, payoutPreview.currency)}
                  </Text>
                </View>

                {payoutPreview.fxCharge > 0 && (
                  <View style={styles.payoutRow}>
                    <Text style={[styles.payoutLabel, { color: theme.colors.textSecondary }]}>
                      FX charge ({payoutPreview.isInternational ? '1.5%' : '0%'})
                    </Text>
                    <Text style={[styles.payoutDeduction, { color: theme.colors.error }]}>
                      −{formatConnectMoney(payoutPreview.fxCharge, payoutPreview.currency)}
                    </Text>
                  </View>
                )}

                <View style={styles.payoutRow}>
                  <Text style={[styles.payoutLabel, { color: theme.colors.textSecondary }]}>
                    Net after gateway
                  </Text>
                  <Text style={[styles.payoutValue, { color: theme.colors.text }]}>
                    {formatConnectMoney(payoutPreview.netAfterGateway, payoutPreview.currency)}
                  </Text>
                </View>
                <View style={[styles.payoutDivider, { backgroundColor: theme.colors.border }]} />

                <View style={styles.payoutRow}>
                  <Text style={[styles.payoutLabel, { color: theme.colors.textSecondary }]}>
                    Taatom commission ({payoutPreview.commissionPercent}%)
                  </Text>
                  <Text style={[styles.payoutDeduction, { color: theme.colors.error }]}>
                    −{formatConnectMoney(payoutPreview.commissionAmount, payoutPreview.currency)}
                  </Text>
                </View>

                <View style={styles.payoutRow}>
                  <Text style={[styles.payoutLabel, { color: theme.colors.textSecondary }]}>
                    GST on commission ({payoutPreview.gstPercent}%)
                  </Text>
                  <Text style={[styles.payoutDeduction, { color: theme.colors.error }]}>
                    −{formatConnectMoney(payoutPreview.gstAmount, payoutPreview.currency)}
                  </Text>
                </View>

                {payoutPreview.wiseFee > 0 && (
                  <View style={styles.payoutRow}>
                    <Text style={[styles.payoutLabel, { color: theme.colors.textSecondary }]}>
                      Wise transfer fee ({payoutPreview.wiseFeePercent}%)
                    </Text>
                    <Text style={[styles.payoutDeduction, { color: theme.colors.error }]}>
                      −{formatConnectMoney(payoutPreview.wiseFee, payoutPreview.currency)}
                    </Text>
                  </View>
                )}

                <View style={[styles.payoutDivider, { backgroundColor: theme.colors.border }]} />

                <View style={styles.payoutRow}>
                  <Text style={[styles.payoutLabelBold, { color: theme.colors.text }]}>You receive</Text>
                  <Text style={[styles.payoutTotal, { color: theme.colors.success }]}>
                    {formatConnectMoney(payoutPreview.creatorPayout, payoutPreview.currency)}
                  </Text>
                </View>

                <Text style={[styles.payoutNote, { color: theme.colors.textSecondary }]}>
                  {payoutPreview.isInternational
                    ? 'International payouts are sent monthly via Wise. An additional ~1% Wise transfer fee applies.'
                    : 'Payouts are sent monthly to your bank account or UPI.'}
                </Text>
              </View>
            ) : (
              <View style={styles.payoutEmpty}>
                <Ionicons name="information-circle-outline" size={32} color={theme.colors.textSecondary} />
                <Text style={[styles.payoutEmptyText, { color: theme.colors.textSecondary }]}>
                  Set a price to see your payout breakdown.
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Set Price Modal (owner only) */}
      <Modal
        visible={showPriceModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPriceModal(false)}
      >
        <KeyboardAvoidingView
          behavior={isIOS ? 'padding' : 'height'}
          style={styles.priceModalOverlay}
        >
          <TouchableOpacity
            style={styles.priceModalOverlay}
            activeOpacity={1}
            onPress={() => setShowPriceModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.priceModalBox, { backgroundColor: theme.colors.surface }]}
            >
              <Text style={[styles.priceModalTitle, { color: theme.colors.text }]}>
                Set {subPriceLabel} Price
              </Text>
              <Text style={[styles.priceModalSubtitle, { color: theme.colors.textSecondary }]}>
                Monthly price in {currSym}
              </Text>
              <View style={[styles.priceModalInputRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <Text style={[styles.priceModalCurrency, { color: theme.colors.textSecondary }]}>{currSym}</Text>
                <TextInput
                  style={[styles.priceModalInput, { color: theme.colors.text }]}
                  value={priceInput}
                  onChangeText={(text) => setPriceInput(text.replace(/[^0-9.]/g, ''))}
                  placeholder="e.g. 299"
                  placeholderTextColor={theme.colors.textSecondary + '80'}
                  keyboardType="number-pad"
                  maxLength={5}
                  autoFocus
                />
              </View>
              <View style={styles.priceModalButtons}>
                <TouchableOpacity
                  style={[styles.priceModalBtn, { borderColor: theme.colors.border, borderWidth: 1 }]}
                  onPress={() => setShowPriceModal(false)}
                >
                  <Text style={[styles.priceModalBtnText, { color: theme.colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.priceModalBtn, { overflow: 'hidden' }]}
                  onPress={async () => {
                    const price = parseFloat(priceInput);
                    if (isNaN(price) || price <= 0) {
                      Alert.alert('Invalid', `Invalid price for ${page?.subscriptionCurrency || 'INR'}.`);
                      return;
                    }
                    try {
                      await updateConnectPage(page!._id, { subscriptionPrice: price } as any);
                      setPage(prev => prev ? { ...prev, subscriptionPrice: price } : prev);
                      setShowPriceModal(false);
                    } catch (err: any) {
                      Alert.alert('Error', err.message || 'Failed to update price.');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#50C878', '#1C73B4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text style={[styles.priceModalBtnText, { color: '#FFFFFF' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Checkout Modal */}
      <Modal
        visible={checkoutModalVisible}
        transparent
        animationType="slide"
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
                backgroundColor: isDark ? 'rgba(20, 25, 35, 0.98)' : 'rgba(255, 255, 255, 0.98)',
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
              <Text style={[styles.checkoutModalTitle, { color: theme.colors.text, fontFamily: getFontFamily('600') }]}>Checkout</Text>
              <TouchableOpacity onPress={() => setCheckoutModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <View style={styles.checkoutItemSummary}>
                <Text style={[styles.checkoutItemName, { color: theme.colors.text, fontFamily: getFontFamily('600') }]} numberOfLines={1}>{selectedItem.name}</Text>
                <Text style={[styles.checkoutItemPrice, { color: theme.colors.primary, fontFamily: getFontFamily('700') }]}>
                  {formatConnectMoney(selectedItem.price, page?.subscriptionCurrency)}
                </Text>
              </View>
            )}

            {/* Cashfree payment info banner */}
            <View style={[styles.upiInfoCard, { backgroundColor: isDark ? 'rgba(56,189,248,0.08)' : 'rgba(56,189,248,0.06)', borderColor: isDark ? 'rgba(56,189,248,0.25)' : 'rgba(56,189,248,0.2)' }]}>
              <View style={styles.upiInfoRow}>
                <Ionicons name="shield-checkmark" size={20} color="#38BDF8" />
                <Text style={[styles.upiInfoTitle, { color: theme.colors.text, fontFamily: getFontFamily('600') }]}>Secure Payment via Cashfree</Text>
              </View>
              <Text style={[styles.upiInfoText, { color: isDark ? '#A1A1AA' : '#71717A', fontFamily: getFontFamily('400') }]}>
                Fill in your details and tap the Pay button. You will be taken to the secure Cashfree payment screen.
              </Text>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: getFontFamily('500') }]}>Your Name</Text>
              <TextInput
                style={[
                  styles.checkoutInput,
                  {
                    color: theme.colors.text,
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

              <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: getFontFamily('500') }]}>Phone Number</Text>
              <TextInput
                style={[
                  styles.checkoutInput,
                  {
                    color: theme.colors.text,
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

              <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: getFontFamily('500') }]}>Delivery Address</Text>
              <TextInput
                style={[
                  styles.checkoutInput,
                  styles.checkoutAddressInput,
                  {
                    color: theme.colors.text,
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
                  colors={['#1C73B4', '#0EA5E9', '#38BDF8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.checkoutBtnGradient}
                >
                  {checkingOut ? (
                    <LoadingGlobe size="small" color="#FFFFFF" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
                      <Text style={[styles.checkoutBtnText, { fontFamily: getFontFamily('700') }]}>
                        Pay {formatConnectMoney(selectedItem?.price, page?.subscriptionCurrency)}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Subscription Management Bottom Sheet Modal */}
      <Modal
        visible={showSubscriptionManagementModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubscriptionManagementModal(false)}
      >
        <View style={styles.bottomSheetOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowSubscriptionManagementModal(false)} />
          <View style={[styles.bottomSheetContent, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.bottomSheetDragHandle} />
            
            <View style={styles.bottomSheetHeader}>
              <Text style={[styles.bottomSheetTitle, { color: theme.colors.text }]}>
                {isCommunity ? 'Purchase Details' : 'Subscription Status'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowSubscriptionManagementModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.bottomSheetStatusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: (theme.colors as any).success + '15' }]}>
                <Ionicons name="checkmark-circle" size={20} color={(theme.colors as any).success} />
                <Text style={[styles.statusBadgeText, { color: (theme.colors as any).success }]}>
                  {subscriptionStatus?.subscription?.status === 'cancelled'
                    ? 'Ending Soon'
                    : (isCommunity ? 'Purchased' : 'Active')}
                </Text>
              </View>
            </View>

            <View style={styles.bottomSheetInfoContainer}>
              <Text style={[styles.billingDateText, { color: theme.colors.textSecondary }]}>
                {subscriptionStatus?.subscription?.status === 'cancelled'
                  ? 'Access expires: ' + getNextBillingDate()
                  : (isCommunity ? 'Next payment date: ' : 'Next billing date: ') + getNextBillingDate()}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.viewContentButton, { overflow: 'hidden' }]}
              onPress={() => {
                setShowSubscriptionManagementModal(false);
                router.push(`/connect/preview?pageId=${id}&section=subscription&pageName=${encodeURIComponent(page.name)}`);
              }}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#50C878', '#1C73B4']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={styles.viewContentButtonText}>View Premium Content</Text>
            </TouchableOpacity>

            {subscriptionStatus?.subscription?.status !== 'cancelled' && (
              <TouchableOpacity
                style={styles.cancelSubscriptionButton}
                onPress={() => {
                  setShowSubscriptionManagementModal(false);
                  handleCancelSubscription();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelSubscriptionButtonText}>
                  {isCommunity ? 'Cancel Purchase' : 'Cancel Subscription'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerImage: {
    width: '100%',
    height: isTablet ? 320 : 250,
  },
  bannerPlaceholder: {
    width: '100%',
    height: isTablet ? 320 : 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 56,
    zIndex: 10,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
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
    alignItems: 'flex-end',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  // Profile Section
  profileSection: {
    marginHorizontal: isTablet ? themeConstants.spacing.lg : themeConstants.spacing.md,
    marginTop: 0,
    paddingTop: isTablet ? 52 : 46,
    paddingHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.lg,
    paddingBottom: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.lg,
    borderRadius: isTablet ? 16 : 14,
  },
  profileImageWrapper: {
    alignItems: 'center',
    zIndex: 10,
  },
  pageProfileImage: {
    width: isTablet ? 84 : 76,
    height: isTablet ? 84 : 76,
    borderRadius: isTablet ? 42 : 38,
    borderWidth: 3,
  },
  pageProfileImagePlaceholder: {
    width: isTablet ? 84 : 76,
    height: isTablet ? 84 : 76,
    borderRadius: isTablet ? 42 : 38,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 10,
  },
  pageName: {
    fontSize: isTablet ? 22 : 20,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginBottom: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  ownerLabel: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    marginTop: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  pageBio: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    lineHeight: isTablet ? 21 : 19,
    marginBottom: 16,
    textAlign: 'center',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
  },
  statsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  statsButtonText: {
    fontSize: 14,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  statsButtonLabel: {
    fontSize: 13,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  followMainButton: {
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followMainButtonText: {
    fontSize: 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  followMainButtonContainer: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  followButtonInner: {
    width: '100%',
    height: '100%',
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  followButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  // Sections
  section: {
    marginHorizontal: isTablet ? themeConstants.spacing.lg : themeConstants.spacing.md,
    marginBottom: isTablet ? 12 : 10,
    padding: isTablet ? themeConstants.spacing.lg : themeConstants.spacing.md,
    borderRadius: isTablet ? 14 : 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: isTablet ? 17 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionActionButton: {
    padding: 4,
  },
  sectionLabelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: themeConstants.borderRadius.sm,
  },
  sectionLabelButtonText: {
    fontSize: 12,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    color: '#FFFFFF',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  sectionBottomActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  sectionBottomButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  sectionBottomButtonText: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    color: '#FFFFFF',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  sectionContent: {
    gap: 12,
  },
  viewMoreText: {
    fontSize: 13,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    textAlign: 'center',
    paddingTop: 8,
  },
  placeholderText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  // Content blocks
  contentHeading: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  contentText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  contentImage: {
    width: '100%',
    borderRadius: themeConstants.borderRadius.sm,
    marginBottom: 1,
  },
  videoPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: themeConstants.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  contentButton: {
    paddingVertical: 12,
    borderRadius: themeConstants.borderRadius.sm,
    alignItems: 'center',
  },
  contentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  contentDivider: {
    height: 1,
    marginVertical: 8,
  },
  embedPlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: themeConstants.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  embedLabel: {
    fontSize: 13,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  embedLink: {
    fontSize: 12,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  viewButtonText: {
    fontSize: 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  // Chat
  chatDescription: {
    fontSize: 12,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    marginTop: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  bioEditTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  bioModalBox: {
    width: isTablet ? 440 : screenWidth - 40,
    borderRadius: 14,
    padding: isTablet ? 24 : 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
    }),
  },
  bioModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  bioModalTitle: {
    fontSize: isTablet ? 20 : 18,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  bioModalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('400'),
    minHeight: 100,
    textAlignVertical: 'top',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      outlineStyle: 'none',
    } as any),
  },
  bioModalCharCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
    fontFamily: getFontFamily('400'),
  },
  bioModalSaveButton: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioModalSaveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  chatArrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Subscribe
  subscriptionPriceSection: {
    borderTopWidth: 1,
    paddingTop: 14,
    paddingHorizontal: isTablet ? 20 : 16,
    paddingBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  priceAmount: {
    fontSize: isTablet ? 28 : 24,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
  },
  pricePeriod: {
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('400'),
    marginLeft: 4,
  },
  subscribeButton: {
    paddingVertical: 13,
    borderRadius: themeConstants.borderRadius.sm,
    alignItems: 'center',
    marginTop: 4,
  },
  subscribeButtonText: {
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  subscribeButtonDisabledText: {
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  subscribedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: themeConstants.borderRadius.full,
  },
  subscribedText: {
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  renewsText: {
    fontSize: 12,
    fontFamily: getFontFamily('400'),
    marginTop: 6,
  },
  cancelLink: {
    marginTop: 8,
    paddingVertical: 4,
  },
  cancelLinkText: {
    fontSize: 13,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  ownerPriceNote: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('400'),
    fontStyle: 'italic',
  },
  approvalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 8,
  },
  // Approval Banner
  approvalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: themeConstants.borderRadius.sm,
    marginBottom: 10,
  },
  approvalBannerText: {
    flex: 1,
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  // Payout Modal
  payoutModalBox: {
    width: isTablet ? 440 : screenWidth - 40,
    borderRadius: themeConstants.borderRadius.lg,
    padding: isTablet ? 24 : 20,
    maxHeight: '80%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
    }),
  },
  payoutModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  payoutModalTitle: {
    fontSize: isTablet ? 20 : 18,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
  },
  payoutDetails: {
    gap: 10,
  },
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payoutLabel: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('400'),
    flex: 1,
  },
  payoutLabelBold: {
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    flex: 1,
  },
  payoutValue: {
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  payoutDeduction: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  payoutTotal: {
    fontSize: isTablet ? 18 : 16,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
  },
  payoutDivider: {
    height: 1,
    marginVertical: 4,
  },
  payoutNote: {
    fontSize: isTablet ? 12 : 11,
    fontFamily: getFontFamily('400'),
    lineHeight: 16,
    marginTop: 8,
  },
  payoutEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  payoutEmptyText: {
    fontSize: 14,
    fontFamily: getFontFamily('400'),
    textAlign: 'center',
  },
  // Buy Items
  buyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  buyItemImage: {
    width: isTablet ? 56 : 48,
    height: isTablet ? 56 : 48,
    borderRadius: themeConstants.borderRadius.sm,
    marginRight: 12,
  },
  buyItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  buyItemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  buyItemDesc: {
    fontSize: isTablet ? 13 : 12,
    lineHeight: 18,
  },
  buyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: themeConstants.borderRadius.sm,
  },
  buyButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    marginTop: isTablet ? 20 : 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 13,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  // Followers Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  modalLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  followerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  followerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followerInfo: {
    flex: 1,
    gap: 2,
  },
  followerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followerName: {
    fontSize: 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    flexShrink: 1,
  },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  adminBadgeText: {
    fontSize: 11,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  followerUsername: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('400'),
  },
  // Price Modal
  priceModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  priceModalBox: {
    width: isTablet ? 400 : screenWidth - 48,
    borderRadius: themeConstants.borderRadius.lg,
    padding: isTablet ? 28 : 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
    }),
  },
  priceModalTitle: {
    fontSize: isTablet ? 20 : 18,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginBottom: 4,
  },
  priceModalSubtitle: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('400'),
    marginBottom: 16,
  },
  priceModalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: themeConstants.borderRadius.sm,
    paddingHorizontal: 14,
    height: isTablet ? 52 : 48,
    marginBottom: 20,
  },
  priceModalCurrency: {
    fontSize: isTablet ? 20 : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginRight: 8,
  },
  priceModalInput: {
    flex: 1,
    fontSize: isTablet ? 20 : 18,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    paddingVertical: 0,
  },
  priceModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  priceModalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: themeConstants.borderRadius.sm,
    alignItems: 'center',
  },
  priceModalBtnText: {
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
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
  checkoutModalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
    overflow: 'hidden',
    paddingBottom: 24,
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
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    alignItems: 'center',
    width: '100%',
  },
  bottomSheetDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  bottomSheetStatusContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  bottomSheetInfoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  billingDateText: {
    fontSize: 15,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  viewContentButton: {
    width: '100%',
    height: 52,
    borderRadius: themeConstants.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  viewContentButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  cancelSubscriptionButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelSubscriptionButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
});

