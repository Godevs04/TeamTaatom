import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  Modal,
  FlatList,
  Linking,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
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
  getPayoutPreview,
  getCurrencySymbol,
  formatConnectMoney,
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
import { NativeModules } from 'react-native';
import {
  CFErrorResponse,
  CFPaymentGatewayService,
  CFEnvironment,
  CFSubscriptionSession,
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

const getFontFamily = (weight: '400' | '500' | '600' | '700' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

// Section padding: md on each side + section padding
const sectionContentWidth = screenWidth - (isTablet ? themeConstants.spacing.lg * 2 + themeConstants.spacing.lg * 2 : themeConstants.spacing.md * 2 + themeConstants.spacing.md * 2);

// Auto-sizing content image (matches preview.tsx). Uses aspectRatio so the
// image scales correctly when its parent shrinks — e.g., inside a Half-width
// flex cell. A fixed pixel height computed from full-section width would
// leave the image with wrong proportions in narrow cells.
// Aspect ratio overrides from editor: 'square' → 1, 'landscape' → 16/9, 'portrait' → 3/4
const AR_MAP: Record<string, number> = { square: 1, landscape: 16 / 9, portrait: 3 / 4 };

function ContentImage({ uri, inRow, inStack, arOverride }: { uri: string; inRow?: boolean; inStack?: boolean; arOverride?: string }) {
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
      />
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[styles.contentImage, { aspectRatio: resolvedAR }]}
      resizeMode="cover"
    />
  );
}

export default function ConnectPageDetailScreen() {
  const { theme } = useTheme();
  const { showSuccess } = useAlert();
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
  const [subscribing, setSubscribing] = useState(false);
  // Stores the pending subscription response so onVerify can optimistically
  // flip the UI before the webhook arrives and DB status updates to 'active'.
  const pendingSubscriptionRef = useRef<{ subscriptionId: string; amount: number } | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [showPayoutInfo, setShowPayoutInfo] = useState(false);
  const [payoutPreview, setPayoutPreview] = useState<PayoutPreview | null>(null);
  const [showBioEdit, setShowBioEdit] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [savingBio, setSavingBio] = useState(false);

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

  // Set up Cashfree subscription payment callback. Skipped in Expo Go / web,
  // where the native module is absent and any SDK call would throw.
  useEffect(() => {
    if (!isCashfreeNativeAvailable) return;
    CFPaymentGatewayService.setCallback({
      onVerify(orderID: string): void {
        logger.info('Cashfree subscription verified, orderID:', orderID);
        // Optimistic update: flip UI to "Subscribed" immediately.
        // The webhook may not have reached the server yet, so getSubscriptionStatus
        // can still return isSubscribed:false if called right now.
        if (pendingSubscriptionRef.current) {
          setSubscriptionStatus({
            isSubscribed: true,
            subscription: {
              _id: pendingSubscriptionRef.current.subscriptionId,
              status: 'active',
              amount: pendingSubscriptionRef.current.amount,
              activatedAt: new Date().toISOString(),
              currentPeriodEnd: null,
            },
          });
          pendingSubscriptionRef.current = null;
        }
        // Refresh from server in background to get accurate period dates etc.
        loadSubscriptionStatus();
        loadPageDetail();
        showSuccess(
          isCommunity ? 'Your purchase was completed.' : 'Your subscription is now active.',
          'Payment received',
        );
      },
      onError(error: CFErrorResponse, orderID: string): void {
        logger.error('Cashfree subscription error:', JSON.stringify(error), 'orderID:', orderID);
        Alert.alert('Payment Failed', 'Could not complete payment. Please try again.');
      },
    });
    return () => {
      CFPaymentGatewayService.removeCallback();
    };
  }, [loadSubscriptionStatus, loadPageDetail, isCommunity, showSuccess]);

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
    setPendingChatRoomId(page.chatRoomId);
    router.push('/chat');
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
      setFollowers((response.followers || []).filter(Boolean));
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

  const renderContentBlock = (block: ContentBlock, index: number, pageTextColor?: string, inRow = false, inStack = false) => {
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

    switch (block.type) {
      case 'heading':
        return wrap(
          <Text style={[styles.contentHeading, { color: effectiveTextColor, textAlign, fontSize: headingFontSize }, block.bold ? { fontWeight: '800' } : undefined]}>
            {block.content}
          </Text>
        );
      case 'text':
        return wrap(
          <Text style={[styles.contentText, { color: effectiveTextColor, textAlign, fontSize: textFontSize }, block.bold ? { fontWeight: '700', fontFamily: getFontFamily('700') } : undefined]}>
            {block.content}
          </Text>
        );
      case 'image':
        return block.content ? (
          <View key={block._id || index} style={blockRadius !== undefined ? { borderRadius: blockRadius, overflow: 'hidden' } : undefined}>
            <ContentImage uri={block.content} inRow={inRow} inStack={inStack} arOverride={block.aspectRatio} />
          </View>
        ) : null;
      case 'video':
        return (
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
      case 'button': {
        // Defensive scheme prefix: backend normalizes button URLs on save,
        // but rows saved before that fix may still have bare domains like
        // "taatom.com" — without https:// Linking.openURL silently fails.
        const rawUrl = block.url?.trim();
        const buttonUrl = rawUrl && /^[a-z][a-z0-9+.-]*:/i.test(rawUrl)
          ? rawUrl
          : (rawUrl ? `https://${rawUrl}` : '');
        return (
          <TouchableOpacity
            key={block._id || index}
            style={[styles.contentButton, { backgroundColor: effectiveBg || theme.colors.primary }]}
            onPress={() => {
              if (buttonUrl) Linking.openURL(buttonUrl).catch(() => {});
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.contentButtonText, block.color ? { color: block.color } : undefined]}>
              {block.content || 'Button'}
            </Text>
          </TouchableOpacity>
        );
      }
      case 'divider':
        return (
          <View
            key={block._id || index}
            style={[styles.contentDivider, { backgroundColor: theme.colors.border }]}
          />
        );
      case 'embed':
        return (
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
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!page) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Connect Page</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>
            Page not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const ownerName = typeof page.userId === 'object' && page.userId ? page.userId.fullName : '';
  const currSym = getCurrencySymbol(page.subscriptionCurrency || 'INR');

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
          <Ionicons name="arrow-back" size={isTablet ? 28 : 24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
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
            <Ionicons name="ellipsis-horizontal" size={isTablet ? 26 : 22} color={theme.colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        {page.bannerImage ? (
          <Image
            source={{ uri: optimizeCloudinaryUrl(page.bannerImage, { width: 800, height: 300, quality: 'auto' }) }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.bannerPlaceholder, { backgroundColor: theme.colors.primary + '12' }]}>
            <Ionicons name="image-outline" size={32} color={theme.colors.primary + '30'} />
          </View>
        )}

        {/* Profile Section */}
        <View style={[styles.profileSection, { backgroundColor: theme.colors.surface }]}>
          {/* Profile image overlapping banner */}
          <View style={styles.profileImageWrapper}>
            {page.profileImage ? (
              <Image
                source={{ uri: optimizeCloudinaryUrl(page.profileImage, { width: 160, height: 160 }) }}
                style={[styles.pageProfileImage, { borderColor: theme.colors.surface }]}
              />
            ) : (
              <View style={[styles.pageProfileImagePlaceholder, { backgroundColor: theme.colors.background, borderColor: theme.colors.surface }]}>
                <Ionicons name="people" size={36} color={theme.colors.primary + '60'} />
              </View>
            )}
          </View>

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
              style={[styles.statsButton, { borderColor: theme.colors.border }]}
              onPress={handleShowFollowers}
              activeOpacity={0.7}
            >
              <Ionicons name="people-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.statsButtonText, { color: theme.colors.text }]}>
                {(page.followerCount || 0) + 1}
              </Text>
              <Text style={[styles.statsButtonLabel, { color: theme.colors.textSecondary }]}>
                Members
              </Text>
            </TouchableOpacity>

            {isOwner && (
              <TouchableOpacity
                style={[styles.statsButton, { borderColor: theme.colors.border }]}
                onPress={() => router.push(`/connect/dashboard?pageId=${id}&category=${page.category || 'connect'}`)}
                activeOpacity={0.7}
              >
                <Ionicons name="analytics-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.statsButtonLabel, { color: theme.colors.textSecondary }]}>
                  Dashboard
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Follow Button (non-owner) */}
          {!isOwner && (
            <TouchableOpacity
              style={[
                styles.followMainButton,
                isFollowing
                  ? { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }
                  : { backgroundColor: theme.colors.primary },
              ]}
              onPress={handleFollowToggle}
              disabled={followLoading}
              activeOpacity={0.7}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? theme.colors.text : '#FFFFFF'} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={isFollowing ? 'checkmark-circle' : 'add-circle-outline'}
                    size={18}
                    color={isFollowing ? theme.colors.text : '#FFFFFF'}
                  />
                  <Text
                    style={[
                      styles.followMainButtonText,
                      { color: isFollowing ? theme.colors.text : '#FFFFFF' },
                    ]}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Website Section — stacked content blocks (builder) */}
        {page.features?.website && (
          <View style={[styles.section, { backgroundColor: page.websiteBackground || theme.colors.surface, marginTop: isTablet ? 14 : 12 }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.primary + '12' }]}>
                  <Ionicons name="globe-outline" size={18} color={theme.colors.primary} />
                </View>
                <Text style={[styles.sectionTitle, { color: page.websiteTextColor || theme.colors.text }]}>Website</Text>
              </View>
            </View>
            <View style={styles.sectionContent}>
              {page.websiteContent && page.websiteContent.length > 0 ? (
                packBlocksIntoRows(
                  page.websiteContent
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .slice(0, isOwner ? undefined : 2)
                ).map((row, ri) => (
                  (() => {
                    const isSingle = row.length === 1 && row[0].blocks.length === 1;
                    return isSingle ? (
                      <React.Fragment key={`wrow-${ri}`}>{renderContentBlock(row[0].blocks[0], ri, page.websiteTextColor, false, false)}</React.Fragment>
                    ) : (
                      <View key={`wrow-${ri}`} style={{ flexDirection: 'row', gap: 3, marginVertical: 1, alignItems: 'flex-start' }}>
                        {row.map((cell, ci) => {
                          const isStackedCell = cell.blocks.length > 1;
                          const va = cell.blocks[0]?.verticalAlign;
                          const alignSelf = va === 'center' ? 'center' as const : va === 'bottom' ? 'flex-end' as const : undefined;
                          return (
                            <View key={`wc-${ri}-${ci}`} style={isStackedCell ? { flex: cell.col, flexDirection: 'column', gap: 6 } : { flex: cell.col, alignSelf }}>
                              {cell.blocks.map((block, bi) =>
                                isStackedCell ? (
                                  <View key={block._id || `ws-${ri}-${ci}-${bi}`} style={{ flex: 1 }}>
                                    {renderContentBlock(block, bi, page.websiteTextColor, true, true)}
                                  </View>
                                ) : (
                                  <React.Fragment key={block._id || `ws-${ri}-${ci}-${bi}`}>
                                    {renderContentBlock(block, bi, page.websiteTextColor, row.length > 1, false)}
                                  </React.Fragment>
                                )
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })()
                ))
              ) : (
                <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
                  {isOwner ? 'Add content to your website.' : 'No content yet.'}
                </Text>
              )}
              {!isOwner && page.websiteContent && page.websiteContent.length > 0 && (
                <TouchableOpacity
                  onPress={() => router.push(`/connect/preview?pageId=${id}&section=website&pageName=${encodeURIComponent(page.name)}`)}
                  activeOpacity={0.7}
                  style={[styles.viewButton, { borderColor: theme.colors.primary }]}
                >
                  <Ionicons name="eye-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.viewButtonText, { color: theme.colors.primary }]}>
                    View Website
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {isOwner && (
              <View style={styles.sectionBottomActions}>
                <TouchableOpacity
                  onPress={() => {
                    if (page.websiteContent && page.websiteContent.length > 0) {
                      router.push(`/connect/preview?pageId=${id}&section=website&pageName=${encodeURIComponent(page.name)}`);
                    }
                  }}
                  activeOpacity={page.websiteContent && page.websiteContent.length > 0 ? 0.7 : 1}
                  style={[
                    styles.sectionBottomButton,
                    { backgroundColor: theme.colors.primary },
                    !(page.websiteContent && page.websiteContent.length > 0) && { opacity: 0.4 },
                  ]}
                >
                  <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.sectionBottomButtonText}>Preview</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push(`/connect/editContent?pageId=${id}&section=website`)}
                  activeOpacity={0.7}
                  style={[styles.sectionBottomButton, { backgroundColor: theme.colors.primary }]}
                >
                  <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.sectionBottomButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Group Chat Section */}
        {page.features?.groupChat && (
          <TouchableOpacity
            style={[styles.section, { backgroundColor: theme.colors.surface, paddingBottom: isTablet ? themeConstants.spacing.md : 12 }, !page.features?.website && { marginTop: isTablet ? 14 : 12 }]}
            onPress={handleOpenChat}
            activeOpacity={0.7}
          >
            <View style={[styles.sectionHeader, { marginBottom: 0 }]}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.primary + '12' }]}>
                  <Ionicons name="chatbubbles-outline" size={18} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Group Chat</Text>
                  <Text style={[styles.chatDescription, { color: theme.colors.textSecondary }]}>
                    {(page.followerCount || 0) + 1} members active
                  </Text>
                </View>
              </View>
              <View style={[styles.chatArrowWrap, { backgroundColor: theme.colors.primary + '12' }]}>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Subscription Section */}
        {page.features?.subscription && (
          <View style={[styles.section, { backgroundColor: theme.colors.surface }, !page.features?.website && !page.features?.groupChat && { marginTop: isTablet ? 14 : 12 }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.primary + '12' }]}>
                  <Ionicons name="star-outline" size={18} color={theme.colors.primary} />
                </View>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{subLabel}</Text>
              </View>
            </View>

            {/* Approval status banner (owner only) */}
            {isOwner && page.subscriptionApproval?.status === 'pending' && (
              <View style={[styles.approvalBanner, { backgroundColor: '#FFF3CD' }]}>
                <Ionicons name="time-outline" size={16} color="#856404" />
                <Text style={[styles.approvalBannerText, { color: '#856404' }]}>
                  Price {currSym}{page.subscriptionApproval.requestedPrice}/mo — Pending admin approval
                </Text>
              </View>
            )}
            {isOwner && page.subscriptionApproval?.status === 'rejected' && (
              <View style={[styles.approvalBanner, { backgroundColor: theme.colors.error + '15' }]}>
                <Ionicons name="close-circle-outline" size={16} color={theme.colors.error} />
                <Text style={[styles.approvalBannerText, { color: theme.colors.error }]}>
                  Price rejected{page.subscriptionApproval.rejectionReason ? `: ${page.subscriptionApproval.rejectionReason}` : ''}
                </Text>
              </View>
            )}

            <View style={styles.sectionContent}>
              {isOwner || subscriptionStatus?.isSubscribed ? (
                page.subscriptionContent && page.subscriptionContent.length > 0 ? (
                  <>
                    {packBlocksIntoRows(
                      page.subscriptionContent.slice().sort((a, b) => a.order - b.order)
                    ).map((row, ri) => (
                      (() => {
                        const isSingle = row.length === 1 && row[0].blocks.length === 1;
                        return isSingle ? (
                          <React.Fragment key={`srow-${ri}`}>{renderContentBlock(row[0].blocks[0], ri, page.subscriptionTextColor, false, false)}</React.Fragment>
                        ) : (
                          <View key={`srow-${ri}`} style={{ flexDirection: 'row', gap: 3, marginVertical: 1, alignItems: 'flex-start' }}>
                            {row.map((cell, ci) => {
                              const isStackedCell = cell.blocks.length > 1;
                              const va = cell.blocks[0]?.verticalAlign;
                              const alignSelf = va === 'center' ? 'center' as const : va === 'bottom' ? 'flex-end' as const : undefined;
                              return (
                                <View key={`sc-${ri}-${ci}`} style={isStackedCell ? { flex: cell.col, flexDirection: 'column', gap: 6 } : { flex: cell.col, alignSelf }}>
                                  {cell.blocks.map((block, bi) =>
                                    isStackedCell ? (
                                      <View key={block._id || `ss-${ri}-${ci}-${bi}`} style={{ flex: 1 }}>
                                        {renderContentBlock(block, bi, page.subscriptionTextColor, true, true)}
                                      </View>
                                    ) : (
                                      <React.Fragment key={block._id || `ss-${ri}-${ci}-${bi}`}>
                                        {renderContentBlock(block, bi, page.subscriptionTextColor, row.length > 1, false)}
                                      </React.Fragment>
                                    )
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        );
                      })()
                    ))}
                    {!isOwner && (
                      <TouchableOpacity
                        onPress={() => router.push(`/connect/preview?pageId=${id}&section=subscription&pageName=${encodeURIComponent(page.name)}`)}
                        activeOpacity={0.7}
                        style={[styles.viewButton, { borderColor: theme.colors.primary }]}
                      >
                        <Ionicons name="eye-outline" size={16} color={theme.colors.primary} />
                        <Text style={[styles.viewButtonText, { color: theme.colors.primary }]}>
                          View {subLabel}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
                    {isOwner ? 'Tap the edit icon to list your services.' : 'No services listed yet.'}
                  </Text>
                )
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Ionicons name="lock-closed-outline" size={28} color={theme.colors.textSecondary} style={{ marginBottom: 8 }} />
                  <Text style={[styles.placeholderText, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
                    {isCommunity
                      ? 'Buy to unlock exclusive content from this community.'
                      : 'Subscribe to unlock exclusive content from this creator.'}
                  </Text>
                </View>
              )}
            </View>

            {/* Subscription pricing section */}
            {(() => {
              const approvalStatus = page.subscriptionApproval?.status || 'none';
              const approvedPrice = page.subscriptionPrice;
              const requestedPrice = page.subscriptionApproval?.requestedPrice;
              const displayPrice = approvalStatus === 'approved' ? approvedPrice : requestedPrice;

              // Owner view
              if (isOwner) {
                return (
                  <View style={[styles.subscriptionPriceSection, { borderTopColor: theme.colors.border }]}>
                    <View style={styles.priceRow}>
                      <Text style={[styles.priceAmount, { color: theme.colors.text }]}>
                        {currSym}{displayPrice || 0}
                      </Text>
                      <Text style={[styles.pricePeriod, { color: theme.colors.textSecondary }]}>/month</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setPriceInput(String(displayPrice || ''));
                          setShowPriceModal(true);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ marginLeft: 10 }}
                      >
                        <Ionicons name="pencil-outline" size={16} color={theme.colors.primary} />
                      </TouchableOpacity>
                    </View>

                    {approvalStatus === 'pending' && (
                      <View style={[styles.approvalStatusBadge, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="time-outline" size={14} color="#D97706" />
                        <Text style={{ color: '#D97706', fontSize: 12, fontWeight: '500', marginLeft: 4 }}>
                          Pending admin approval
                        </Text>
                      </View>
                    )}

                    {approvalStatus === 'approved' && (
                      <Text style={[styles.ownerPriceNote, { color: theme.colors.textSecondary }]}>
                        {subscribersLabel} pay {currSym}{approvedPrice}/month
                      </Text>
                    )}

                    {approvalStatus === 'rejected' && (
                      <View>
                        <View style={[styles.approvalStatusBadge, { backgroundColor: '#FEE2E2' }]}>
                          <Ionicons name="close-circle-outline" size={14} color="#DC2626" />
                          <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '500', marginLeft: 4 }}>
                            Price rejected
                          </Text>
                        </View>
                        {page.subscriptionApproval?.rejectionReason ? (
                          <Text style={[styles.ownerPriceNote, { color: theme.colors.textSecondary }]}>
                            Reason: {page.subscriptionApproval.rejectionReason}
                          </Text>
                        ) : null}
                      </View>
                    )}

                    {approvalStatus === 'none' && !displayPrice && (
                      <Text style={[styles.ownerPriceNote, { color: theme.colors.textSecondary }]}>
                        Tap the edit icon to set your price
                      </Text>
                    )}
                  </View>
                );
              }

              // Visitor view — show subscribed status or prompt to view subscription page
              if (approvalStatus === 'approved' && approvedPrice) {
                if (subscriptionStatus?.isSubscribed) {
                  return (
                    <View style={[styles.subscriptionPriceSection, { borderTopColor: theme.colors.border }]}>
                      <View style={[styles.subscribedBadge, { backgroundColor: theme.colors.success + '15' }]}>
                        <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                        <Text style={[styles.subscribedText, { color: theme.colors.success }]}>{isCommunity ? 'Purchased' : 'Subscribed'}</Text>
                      </View>
                      {subscriptionStatus.subscription?.currentPeriodEnd && (
                        <Text style={[styles.renewsText, { color: theme.colors.textSecondary }]}>
                          Renews {new Date(subscriptionStatus.subscription.currentPeriodEnd).toLocaleDateString()}
                        </Text>
                      )}
                      <TouchableOpacity
                        onPress={handleCancelSubscription}
                        activeOpacity={0.7}
                        style={styles.cancelLink}
                      >
                        <Text style={[styles.cancelLinkText, { color: theme.colors.error }]}>
                          Cancel {isCommunity ? 'purchase' : 'subscription'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                // Show subscribe button for non-subscribed visitors
                return (
                  <View style={[styles.subscriptionPriceSection, { borderTopColor: theme.colors.border }]}>
                    <TouchableOpacity
                      style={[styles.subscribeButton, { backgroundColor: theme.colors.primary }]}
                      onPress={handleSubscribe}
                      activeOpacity={0.7}
                      disabled={subscribing}
                    >
                      {subscribing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={isCommunity ? 'cart-outline' : 'star'} size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.subscribeButtonText}>
                            {subButtonText} · {currSym}{approvedPrice}/month
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }

              return null;
            })()}

            {/* Bottom action buttons (owner only) */}
            {isOwner && (
              <View style={styles.sectionBottomActions}>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const result = await getPayoutPreview(page._id);
                      setPayoutPreview(result.preview);
                    } catch { /* ignore */ }
                    setShowPayoutInfo(true);
                  }}
                  activeOpacity={0.7}
                  style={[styles.sectionBottomButton, { backgroundColor: theme.colors.primary }]}
                >
                  <Ionicons name="information-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.sectionBottomButtonText}>Details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (page.subscriptionContent && page.subscriptionContent.length > 0) {
                      router.push(`/connect/preview?pageId=${id}&section=subscription&pageName=${encodeURIComponent(page.name)}`);
                    }
                  }}
                  activeOpacity={page.subscriptionContent && page.subscriptionContent.length > 0 ? 0.7 : 1}
                  style={[
                    styles.sectionBottomButton,
                    { backgroundColor: theme.colors.primary },
                    !(page.subscriptionContent && page.subscriptionContent.length > 0) && { opacity: 0.4 },
                  ]}
                >
                  <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.sectionBottomButtonText}>Preview</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push(`/connect/editContent?pageId=${id}&section=subscription&category=${page.category || 'connect'}`)}
                  activeOpacity={0.7}
                  style={[styles.sectionBottomButton, { backgroundColor: theme.colors.primary }]}
                >
                  <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.sectionBottomButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Buy Items Section (Admin pages only) */}
        {page.isAdminPage && page.buyItems && page.buyItems.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="cart-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Buy</Text>
              </View>
            </View>
            {page.buyItems
              .filter(item => item.active)
              .map((item, idx) => (
                <View
                  key={item._id || idx}
                  style={[styles.buyItem, { borderBottomColor: theme.colors.border }]}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.buyItemImage} />
                  ) : null}
                  <View style={styles.buyItemInfo}>
                    <Text style={[styles.buyItemName, { color: theme.colors.text }]}>{item.name}</Text>
                    <Text style={[styles.buyItemDesc, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                      {item.description}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.buyButton, { backgroundColor: theme.colors.border }]}
                    onPress={() => Alert.alert('Coming Soon', 'Payments will be available in a future update.')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.buyButtonText, { color: theme.colors.textSecondary }]}>
                      Buy
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
          </View>
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
                style={[styles.bioModalSaveButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleSaveBio}
                activeOpacity={0.7}
                disabled={savingBio}
              >
                {savingBio ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
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
                <ActivityIndicator size="large" color={theme.colors.primary} />
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
                  style={[styles.priceModalBtn, { backgroundColor: theme.colors.primary }]}
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
                >
                  <Text style={[styles.priceModalBtnText, { color: '#FFFFFF' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerImage: {
    width: '100%',
    height: isTablet ? 200 : 150,
  },
  bannerPlaceholder: {
    width: '100%',
    height: isTablet ? 200 : 150,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: -(isTablet ? 44 : 38),
    paddingTop: isTablet ? 52 : 46,
    paddingHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.lg,
    paddingBottom: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.lg,
    borderRadius: isTablet ? 16 : 14,
  },
  profileImageWrapper: {
    position: 'absolute',
    top: -(isTablet ? 44 : 38),
    left: 0,
    right: 0,
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
});

