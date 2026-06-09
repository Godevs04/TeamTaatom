import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageStyle,
  RefreshControl,
  Pressable,
  Animated,
  useColorScheme,
  Platform,
  Dimensions,
  FlatList,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { matchGradientLocations } from '../../utils/linearGradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import NavBar from '../../components/NavBar';
import { getUserFromStorage, signOut } from '../../services/auth';
import { getProfile, getTravelMapData } from '../../services/profile';
import { getUserPosts, getShorts, getUserShorts, getPostById, deletePost, deleteShort } from '../../services/posts';
import { savedEvents } from '../../utils/savedEvents';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUnreadCount } from '../../services/notifications';
import { socketService } from '../../services/socket';
import { realtimePostsService } from '../../services/realtimePosts';
import { UserType } from '../../types/user';
import { PostType } from '../../types/post';
import EditProfile from '../../components/EditProfile';
import OriginalProfilePremiumView from '../../components/profile/ProfilePremiumView';
import KebabMenu from '../../components/common/KebabMenu';
import { triggerRefreshHaptic } from '../../utils/hapticFeedback';
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';
import { useSubscription } from '../../context/SubscriptionContext';
import { ErrorBoundary } from '../../utils/errorBoundary';
import { trackScreenView, trackEngagement, trackFeatureUsage } from '../../services/analytics';
import { theme } from '../../constants/theme';
import { optimizeCloudinaryUrl } from '../../utils/imageCache';
import { FILTER_PREVIEW_OVERLAY, ImageFilterType } from '../../components/ImageEditModal';
import { formatViewCount } from '../../utils/numberFormat';
import { CloudSkyBackground } from '../../components/cloud';
import ScrollEdgeFades from '../../components/ScrollEdgeFades';
import { cloudDesign } from '../../constants/cloudDesign';
import CloudGlassSurface from '../../components/cloud/CloudGlassSurface';
import ShortsCard from '../../components/shorts/ShortsCard';


const logger = createLogger('ProfileScreen');

function ProfilePremiumView(props: React.ComponentProps<typeof OriginalProfilePremiumView>) {
  const element = OriginalProfilePremiumView(props);
  if (!element || !element.props || !element.props.children) {
    return element;
  }
  
  const children = React.Children.toArray(element.props.children);
  const updatedChildren = children.map((child: any) => {
    if (React.isValidElement(child)) {
      const originalStyle = (child.props as any).style || {};
      const flattenedStyle = StyleSheet.flatten(originalStyle);
      const hasBorderRadius28 = (child.props as any).borderRadius === 28 || flattenedStyle?.borderRadius === 28;
      
      if (child.type === CloudGlassSurface || hasBorderRadius28) {
        const overriddenStyle = {
          ...flattenedStyle,
          backgroundColor: props.isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.85)', // Semi-transparent glass background to prevent Android bleed and avoid solid white square
          overflow: 'hidden' as const,
          borderRadius: 28,
        };
        return React.cloneElement(child, {
          style: overriddenStyle,
        } as any);
      }
    }
    return child;
  });
  
  return React.cloneElement(element, {}, ...updatedChildren);
}

const TRIP_GAP_DAYS = 7;

const sortByCreatedDesc = <T extends { createdAt?: string; created_at?: string; _id?: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
    const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return String(b._id || '').localeCompare(String(a._id || ''));
  });

const readSavedIds = async (key: 'savedShorts' | 'savedPosts', context: string): Promise<string[]> => {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
  } catch (error) {
    logger.warn(`Failed to parse ${key} ${context}, resetting`, error);
    try {
      await AsyncStorage.setItem(key, JSON.stringify([]));
    } catch {}
    return [];
  }
};

const readAllSavedIds = async (context: string): Promise<string[]> => {
  const [postsArr, shortsArr] = await Promise.all([
    readSavedIds('savedPosts', context),
    readSavedIds('savedShorts', context),
  ]);

  return Array.from(new Set([...postsArr, ...shortsArr]));
};

const isSavedItemUnavailable = (reason: any): boolean => {
  const status = reason?.response?.status;
  const errorCode = reason?.response?.data?.error?.code || reason?.response?.data?.code;
  const message = reason?.response?.data?.error?.message || reason?.response?.data?.message || reason?.message || '';

  // Only delete saved items if we get an explicit application error indicating the item is gone/private
  if (status === 403 && errorCode === 'AUTH_1006') return true;
  if (status === 404 && errorCode === 'RES_3001') return true;
  if (status === 410) return true;

  return (
    (status === 401 && typeof message === 'string' && message.toLowerCase().includes('not available'))
  );
};

const isVideoUrl = (url: any, videoUrl?: string) => {
  if (typeof url !== 'string') return false;
  const cleanUrl = url.split('?')[0].toLowerCase();
  return (
    cleanUrl.endsWith('.mp4') ||
    cleanUrl.endsWith('.mov') ||
    cleanUrl.endsWith('.m4v') ||
    cleanUrl.endsWith('.webm') ||
    cleanUrl.includes('/videos/') ||
    cleanUrl.includes('/shorts/') ||
    (videoUrl !== undefined && url === videoUrl)
  );
};

function countTripsFromLocations(locations: Array<{ date?: string }>): number {
  if (!locations?.length) return 0;
  const sorted = [...locations].filter((l) => l.date).sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  if (sorted.length === 0) return 0;
  let trips = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date!).getTime();
    const curr = new Date(sorted[i].date!).getTime();
    if ((curr - prev) / (24 * 60 * 60 * 1000) > TRIP_GAP_DAYS) trips += 1;
  }
  return trips;
}

// Journey interface for type safety
interface Journey {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  startCoords: { lat: number; lng: number };
  endCoords: { lat: number; lng: number };
  startedAt: string;
  completedAt: string;
  distanceTraveled: number;
  countries: string[];
  waypoints: any[];
  tripScoreAwarded: number;
}

// Responsive dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
// 3-column grid constants
// Card has marginHorizontal 0 each side = 0px consumed (occupies fully)
// postsTabsSection has paddingHorizontal 0 on the grid part
// 2 gaps between 3 columns
const GRID_GAP = 2;
const horizontalPadding = 0;
const profileColumnWidth = (screenWidth - (horizontalPadding * 2) - (GRID_GAP * 2)) / 3;
const profileShortHeight = profileColumnWidth; // cropped square for grid consistency
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Elegant font families for each platform
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) {
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    return 'System';
  }
  return 'Roboto';
};

interface ProfileData extends UserType {
  postsCount: number;
  followersCount: number;
  followingCount: number;
  locations: Array<{
    latitude: number;
    longitude: number;
    address: string;
    date: string;
  }>;
  tripScore: {
    totalScore: number;
    continents: { [key: string]: number };
    countries: { [key: string]: number };
    areas: Array<{
      address: string;
      continent: string;
      likes: number;
      date: string;
    }>;
  } | null;
  isFollowing: boolean;
  isOwnProfile: boolean;
}

export default function ProfileScreen() {
  const { handleScroll } = useScrollToHideNav();
  const insets = useSafeAreaInsets();
  const { subscriptionStatuses, refreshSubscriptionStatus, updateSubscriptionStatus } = useSubscription();
  const [user, setUser] = useState<UserType | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [userShorts, setUserShorts] = useState<PostType[]>([]);

  const [savedPosts, setSavedPosts] = useState<PostType[]>([]);
  const [savedShorts, setSavedShorts] = useState<PostType[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'shorts' | 'saved'>('posts');
  const [activeSavedSubTab, setActiveSavedSubTab] = useState<'posts' | 'shorts'>('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [verifiedLocationsCount, setVerifiedLocationsCount] = useState<number | null>(null);
  const [verifiedLocations, setVerifiedLocations] = useState<Array<{ latitude: number; longitude: number; address: string; date?: string }>>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeysLoading, setJourneysLoading] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme, mode } = useTheme();
  const { showError, showSuccess, showConfirm } = useAlert();
  
  const [enlargedPhotoSource, setEnlargedPhotoSource] = useState<any>(null);
  
  // Lifecycle & Navigation Safety: Track mounted state and cancel requests on unmount
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Analytics De-duplication: Prevent duplicate profile view events
  const lastProfileViewTimeRef = useRef<number>(0);
  const PROFILE_VIEW_DEBOUNCE_MS = 2000; // 2 seconds
  
  // Request Guards: Prevent duplicate API calls on rapid tab switching
  const isFetchingRef = useRef(false);
  
  // Scroll position persistence: Store scroll position when navigating away
  const scrollViewRef = useRef<FlatList>(null);
  const scrollPositionRef = useRef<number>(0);
  // True when we're returning to the screen and owe the ScrollView a scrollTo.
  // Set in useFocusEffect; cleared by the loading-aware effect below once the
  // ScrollView is actually mounted (loadUserData briefly flips checkingUser
  // which swaps the ScrollView for a spinner — restoring scroll before then
  // is a no-op).
  const pendingScrollRestoreRef = useRef<boolean>(false);
  // Remember where the posts/shorts/saved tabs sit, so tab switches don't feel like a jump
  const tabsOffsetRef = useRef<number>(0);
  
  // Theme-aware colors for profile - MUST be called before any conditional returns
  const colorScheme = useColorScheme();
  // Improved dark mode detection - use theme mode if available, otherwise check background color
  const isDark =
    mode === 'dark' ||
    (mode === 'auto' && colorScheme === 'dark') ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#000000' ||
    theme.colors.background === '#111114' ||
    theme.colors.background === '#121212';

  const profileTheme = useMemo(() => {
    if (isDark) {
      return {
        headerGradient: ['#000000', 'rgba(28, 115, 180, 0.10)'] as const,
        cardBg: theme.colors.card,
        glassCardBg: theme.colors.glassSurface,
        cardBorder: theme.colors.glassBorder,
        textPrimary: theme.colors.text,
        textSecondary: theme.colors.textSecondary,
        accent: theme.colors.primary,
        statCardBg: 'rgba(28, 115, 180, 0.05)',
        statCardBorder: 'rgba(28, 115, 180, 0.15)',
        pillTabsBg: 'rgba(0, 0, 0, 0.4)',
        explorerBadgeBg: 'rgba(28, 115, 180, 0.15)',
        explorerBadgeText: theme.colors.primary,
        gapBorderColor: '#000000',
      };
    }
    return {
      headerGradient: ['#FFFFFF', 'rgba(28, 115, 180, 0.10)'] as const,
      cardBg: '#FFFFFF',
      glassCardBg: 'rgba(255, 255, 255, 0.85)',
      cardBorder: 'rgba(28, 115, 180, 0.15)',
      textPrimary: '#000000',
      textSecondary: 'rgba(0, 0, 0, 0.55)',
      accent: '#1C73B4',
      statCardBg: 'rgba(28, 115, 180, 0.05)',
      statCardBorder: 'rgba(28, 115, 180, 0.15)',
      pillTabsBg: 'rgba(255, 255, 255, 0.85)',
      explorerBadgeBg: '#FFFFFF',
      explorerBadgeText: '#000000',
      gapBorderColor: '#FFFFFF',
    };
  }, [isDark, theme.colors]);

  const tripsCount = useMemo(() => countTripsFromLocations(verifiedLocations), [verifiedLocations]);
  const countriesCount = useMemo(() => (profileData?.tripScore?.countries ? Object.keys(profileData.tripScore.countries).length : 0), [profileData?.tripScore?.countries]);
  const globeLocations = useMemo(() => {
    return verifiedLocations.map((l) => ({ latitude: l.latitude, longitude: l.longitude, address: l.address }));
  }, [verifiedLocations]);

  const screenGradientLocations = useMemo(() => {
    const colors = theme.colors.screenGradient;
    const preferred: readonly [number, number, ...number[]] = isDark ? [0, 0.45, 1] : [0, 0.22, 0.55, 1];
    return matchGradientLocations(colors.length, preferred);
  }, [isDark, theme.colors.screenGradient]);

  const activeListData = useMemo(() => {
    if (activeTab === 'posts') return posts;
    if (activeTab === 'shorts') return userShorts;
    if (activeTab === 'saved') {
      return activeSavedSubTab === 'posts' ? savedPosts : savedShorts;
    }
    return [];
  }, [activeTab, activeSavedSubTab, posts, userShorts, savedPosts, savedShorts]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await getUnreadCount();
      setUnreadCount(response.unreadCount);
    } catch (error) {
      logger.error('Failed to load unread count', error);
    }
  }, []);

  // Profile Data Consistency: Single source of truth - refresh all profile data from API
  const loadUserData = useCallback(async (isBackground = false) => {
    // Request Guard: Prevent duplicate calls
    if (isFetchingRef.current) {
      logger.debug('loadUserData already in progress, skipping');
      return;
    }
    
    isFetchingRef.current = true;
    if (!isBackground) {
      setCheckingUser(true);
      setVerifiedLocations([]);
      setVerifiedLocationsCount(null);
    }
    
    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      const startTime = Date.now();
      const userData = await getUserFromStorage();
      logger.debug('getUserFromStorage:', userData);
      
      if (!isMountedRef.current) return;
      
      if (!userData) {
        setCheckingUser(false);
        setLoading(false);
        return;
      }
      
      // OPTIMIZATION: Set user immediately for optimistic rendering
      setUser(userData);
      setCheckingUser(false);
      
      // OPTIMIZATION: Try to load cached data first for instant display (optimistic)
      try {
        const [cachedProfile, cachedPosts] = await Promise.all([
          AsyncStorage.getItem(`cachedProfile_${userData._id}`).catch(() => null),
          AsyncStorage.getItem(`cachedUserPosts_${userData._id}`).catch(() => null)
        ]);
        
        if (cachedProfile && !isMountedRef.current) return;
        if (cachedProfile) {
          const parsed = JSON.parse(cachedProfile);
          const cacheAge = Date.now() - (parsed.timestamp || 0);
          if (cacheAge < 5 * 60 * 1000) { // 5 min cache for profile
            setProfileData(parsed.data);
            setLoading(false); // Show cached data immediately
          }
        }
        
        if (cachedPosts && !isMountedRef.current) return;
        if (cachedPosts) {
          const parsed = JSON.parse(cachedPosts);
          const cacheAge = Date.now() - (parsed.timestamp || 0);
          // 50 min — must stay under the 1h R2/S3 signed URL expiry so cached
          // posts never contain stale URLs that would render blank.
          if (cacheAge < 50 * 60 * 1000) {
            setPosts(sortByCreatedDesc(parsed.data || []));
          }
        }
      } catch (cacheError) {
        logger.debug('Cache load error (non-critical):', cacheError);
      }
      
      // OPTIMIZATION: Fetch profile, posts, shorts, and verified locations in parallel for 2-3x faster loading
      const [profileResult, userPosts, shortsResp, travelMapResult] = await Promise.allSettled([
        getProfile(userData._id),
        getUserPosts(userData._id),
        getUserShorts(userData._id, 1, 100),
        getTravelMapData(userData._id).catch(() => null) // Don't fail if this fails
      ]);
      
      if (!isMountedRef.current) return;
      
      // Handle profile result
      if (profileResult.status === 'fulfilled') {
        const freshProfile = profileResult.value.profile;
        setProfileData(freshProfile);
        
        // Update local user state and AsyncStorage cache to keep them consistent
        if (userData && freshProfile && userData._id === freshProfile._id) {
          const updatedUser = {
            ...userData,
            fullName: freshProfile.fullName,
            bio: freshProfile.bio,
            profilePic: freshProfile.profilePic,
          };
          setUser(updatedUser);
          AsyncStorage.setItem('userData', JSON.stringify(updatedUser)).catch(() => {});
        }

        // Cache profile for next time
        AsyncStorage.setItem(`cachedProfile_${userData._id}`, JSON.stringify({
          data: freshProfile,
          timestamp: Date.now()
        })).catch(() => {});
      }
      
      if (!isMountedRef.current) return;

      // Handle verified locations (count + list for globe and trips) - backend returns { locations, statistics } at top level
      if (travelMapResult.status === 'fulfilled' && travelMapResult.value) {
        const raw = travelMapResult.value as { locations?: unknown[]; statistics?: { totalLocations?: number } };
        const locs = Array.isArray(raw.locations) ? raw.locations : [];
        const total = raw.statistics?.totalLocations ?? locs.length;
        setVerifiedLocationsCount(total);
        setVerifiedLocations(locs.map((l: unknown) => {
          const item = l as { latitude: number; longitude: number; address?: string; date?: string };
          return { latitude: item.latitude, longitude: item.longitude, address: item.address ?? '', date: item.date };
        }));
      } else {
        setVerifiedLocationsCount(0);
        setVerifiedLocations([]);
      }
      
      if (userPosts.status === 'fulfilled') {
        const fetchedPosts = sortByCreatedDesc(userPosts.value.posts || []);
        if (__DEV__) {
          console.log('📸 [Profile] Fetched posts:', fetchedPosts.length);
          if (fetchedPosts.length > 0) {
            console.log('📸 [Profile] First post:', {
              _id: fetchedPosts[0]._id,
              imageUrl: fetchedPosts[0].imageUrl,
              image_url: (fetchedPosts[0] as any).image_url,
              mediaUrl: (fetchedPosts[0] as any).mediaUrl,
              images: (fetchedPosts[0] as any).images,
              allKeys: Object.keys(fetchedPosts[0] || {})
            });
          }
        }
        setPosts(fetchedPosts);
        // Cache posts for offline support
        try {
          await AsyncStorage.setItem(`cachedUserPosts_${userData._id}`, JSON.stringify({
            data: fetchedPosts,
            timestamp: Date.now()
          }));
        } catch (cacheError) {
          logger.debug('Failed to cache user posts', cacheError);
        }
      } else if (userPosts.status === 'rejected') {
        if (__DEV__) {
          console.error('❌ [Profile] Failed to fetch posts:', userPosts.reason);
        }
        logger.error('Failed to fetch user posts:', userPosts.reason);
        
        // Try to load cached posts on network error
        const isNetworkError = userPosts.reason?.message?.includes('Network') || 
                              userPosts.reason?.code === 'ERR_NETWORK' ||
                              !userPosts.reason?.response;
        if (isNetworkError) {
          try {
            const cachedData = await AsyncStorage.getItem(`cachedUserPosts_${userData._id}`);
            if (cachedData) {
              const parsed = JSON.parse(cachedData);
              if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
                const cacheAge = Date.now() - (parsed.timestamp || 0);
                if (cacheAge < 50 * 60 * 1000) {
                  logger.debug('Loading cached user posts due to network error');
                  setPosts(sortByCreatedDesc(parsed.data));
                }
              }
            }
          } catch (cacheError) {
            logger.debug('Failed to load cached user posts', cacheError);
          }
        }
      }
      
      if (shortsResp.status === 'fulfilled') {
        setUserShorts(sortByCreatedDesc(shortsResp.value.shorts || []));
      }
      
      // OPTIMIZATION: Load saved IDs and unread count in parallel (non-blocking)
      Promise.allSettled([
        // Load saved IDs (defensive parsing)
        (async () => {
          const uniqueIds = await readAllSavedIds('from AsyncStorage');
          if (isMountedRef.current) {
            setSavedIds(uniqueIds);
          }
        })(),
        loadUnreadCount()
      ]).catch(() => {}); // Non-critical, continue even if these fail
      
      const loadTime = Date.now() - startTime;
      logger.debug(`[PERF] Profile loaded in ${loadTime}ms (optimized parallel fetch with cache)`);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.debug('loadUserData aborted');
        return;
      }
      if (!isMountedRef.current) return;
      logger.error('Failed to load profile', error);
      const isNetwork =
        error?.message?.includes('Network') ||
        error?.code === 'ERR_NETWORK' ||
        error?.message === 'Network Error';
      showError(isNetwork ? 'Network Error — check your connection and try again.' : 'Failed to load profile data');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setCheckingUser(false);
      }
      isFetchingRef.current = false;
    }
  }, [showError, loadUnreadCount]);

  // Lifecycle: Setup and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    loadUserData();

    return () => {
      isMountedRef.current = false;
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadUserData]);

  useEffect(() => {
    const unsubscribe = realtimePostsService.subscribeToViews(({ postId, viewsCount }) => {
      setPosts(prev => prev.map(post => (
        post._id === postId
          ? { ...post, viewsCount, views: viewsCount } as any
          : post
      )));
      setUserShorts(prev => prev.map(short => (
        short._id === postId
          ? { ...short, viewsCount, views: viewsCount } as any
          : short
      )));
      setSavedPosts(prev => prev.map(item => (
        item._id === postId
          ? { ...item, viewsCount, views: viewsCount } as any
          : item
      )));
      setSavedShorts(prev => prev.map(item => (
        item._id === postId
          ? { ...item, viewsCount, views: viewsCount } as any
          : item
      )));
    });
    return unsubscribe;
  }, []);

  // Sync subscriptions on mount to keep SubscriptionContext in sync
  const [subSyncLoading, setSubSyncLoading] = useState(false);
  useEffect(() => {
    let active = true;
    async function syncSubscriptions() {
      if (subSyncLoading) return;
      setSubSyncLoading(true);
      try {
        const { getMySubscriptions } = require('../../services/connect');
        const res = await getMySubscriptions();
        if (active && res?.subscriptions) {
          for (const sub of res.subscriptions) {
            if (sub.connectPageId?._id) {
              const status = {
                isSubscribed: sub.status === 'active',
                subscription: {
                  _id: sub._id,
                  status: sub.status,
                  amount: sub.amount,
                  activatedAt: sub.activatedAt,
                  currentPeriodEnd: sub.currentPeriodEnd,
                }
              };
              updateSubscriptionStatus(sub.connectPageId._id, status);
            }
          }
        }
      } catch (err) {
        logger.warn('Failed to sync subscriptions on profile mount:', err);
      } finally {
        if (active) {
          setSubSyncLoading(false);
        }
      }
    }
    syncSubscriptions();
    return () => {
      active = false;
    };
  }, [updateSubscriptionStatus]);

  // Real-time notification badge: increment count when a new notification arrives via socket
  useEffect(() => {
    const onNotification = () => {
      setUnreadCount(prev => prev + 1);
    };
    socketService.subscribe('notification', onNotification);
    return () => {
      socketService.unsubscribe('notification', onNotification);
    };
  }, []);

  // Real-time profile invalidation and short transcode updates via socket
  useEffect(() => {
    if (!user?._id) return;
    
    const handleInvalidateProfile = () => {
      logger.debug('Invalidate profile event received, refreshing profile data');
      if (isMountedRef.current && user?._id && !isFetchingRef.current) {
        loadUserData(true);
      }
    };
    
    const handleShortTranscoded = (payload: any) => {
      logger.debug('Short transcoded event received on profile, refreshing profile data', payload);
      // If the transcoded short belongs to the user, refresh
      if (isMountedRef.current && user?._id && !isFetchingRef.current) {
        loadUserData(true);
      }
    };
    
    socketService.subscribe(`invalidate:profile:${user._id}`, handleInvalidateProfile);
    socketService.subscribe('short:transcoded', handleShortTranscoded);
    
    return () => {
      socketService.unsubscribe(`invalidate:profile:${user._id}`, handleInvalidateProfile);
      socketService.unsubscribe('short:transcoded', handleShortTranscoded);
    };
  }, [user?._id, loadUserData]);
  
  // Navigation Lifecycle Safety: Clear state on screen blur
  // Privacy & Settings Propagation: Refresh profile when screen is focused (e.g., after settings changes)
  useFocusEffect(
    useCallback(() => {
      // Screen focused - ensure mounted
      isMountedRef.current = true;
      
      // Restore scroll position when returning to profile page.
      // We can't scroll here directly because loadUserData (below) flips
      // checkingUser=true which swaps the ScrollView for a spinner — any
      // scrollTo we issue right now hits a stale (or unmounted) ScrollView.
      // Mark the intent; the loading-aware effect below performs the scroll
      // once the ScrollView is actually back in the tree.
      if (scrollPositionRef.current > 0) {
        pendingScrollRestoreRef.current = true;
      }
      
      // Reload saved items when screen is focused and saved tab is active
      // This ensures saved items persist when navigating back from a post
      if (activeTab === 'saved' && isMountedRef.current) {
        const reloadSaved = async () => {
          try {
            const uniqueIds = await readAllSavedIds('on focus');
            if (isMountedRef.current) {
              setSavedIds(uniqueIds);
            }
          } catch (error) {
            logger.error('Error reloading saved items on focus', error);
          }
        };
        
        // Reload saved items immediately when focused
        reloadSaved();
      }
      
      // Refresh profile data when screen is focused to ensure privacy settings are reflected
      // This ensures profile header, visibility, and dependent UI reflect latest settings
      // BUT: Don't refresh if we're on saved tab to avoid clearing saved items
      const refreshTimer = setTimeout(async () => {
        let needsRefresh = false;
        try {
          const flag = await AsyncStorage.getItem('profile_shorts_needs_refresh');
          if (flag === 'true') {
            needsRefresh = true;
            await AsyncStorage.removeItem('profile_shorts_needs_refresh');
          }
        } catch (err) {
          logger.error('Failed to read profile_shorts_needs_refresh from AsyncStorage', err);
        }

        if (user?._id && (!isFetchingRef.current || needsRefresh) && activeTab !== 'saved') {
          if (isMountedRef.current && user?._id) {
            loadUserData(true);
          }
        }
      }, 100);
      
      return () => {
        clearTimeout(refreshTimer);
        // Screen blurred - cancel pending requests
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, [user?._id, loadUserData])
  );

  // Loading-aware scroll restoration. Runs whenever the spinner finishes
  // (loading + checkingUser both false) — that's when the ScrollView is
  // actually in the tree. Without this, scroll-restore in useFocusEffect
  // fires while the spinner is still mounted and gets dropped on the floor.
  useEffect(() => {
    if (loading || checkingUser) return;
    if (!pendingScrollRestoreRef.current) return;
    pendingScrollRestoreRef.current = false;
    // requestAnimationFrame ensures the ScrollView has painted its content
    // before we ask it to seek. Two RAFs cover Android, where layout can
    // straggle a frame behind the JS state update.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!isMountedRef.current) return;
        if (!scrollViewRef.current) return;
        if (scrollPositionRef.current <= 0) return;
        scrollViewRef.current.scrollToOffset({
          offset: scrollPositionRef.current,
          animated: false,
        });
      });
    });
  }, [loading, checkingUser]);

  // Log posts when they change for debugging (development only)
  useEffect(() => {
    if (__DEV__) {
      if (posts.length > 0) {
        console.log('📊 [Profile] Posts state updated:', posts.length, 'posts');
        console.log('📊 [Profile] First post imageUrl:', posts[0]?.imageUrl || 'NONE');
      } else {
        console.log('📊 [Profile] No posts in state');
      }
    }
  }, [posts]);
  
  // Analytics De-duplication: Prevent duplicate profile view events
  useEffect(() => {
    if (!user || !profileData) return;
    
    const now = Date.now();
    const timeSinceLastView = now - lastProfileViewTimeRef.current;
    
    // Only track if enough time has passed since last view
    if (timeSinceLastView >= PROFILE_VIEW_DEBOUNCE_MS) {
      lastProfileViewTimeRef.current = now;
      trackScreenView('profile', {
        userId: user._id,
        hasPosts: posts.length > 0,
        hasShorts: userShorts.length > 0,
        postsCount: profileData.postsCount || 0
      });
    }
  }, [user?._id, profileData?.postsCount, posts.length, userShorts.length]);

  // Saved Content Stability: Listen for save/unsave events with defensive parsing
  useEffect(() => {
    const unsubscribe = savedEvents.addListener(async () => {
      if (!isMountedRef.current) return;
      
      try {
        const uniqueIds = await readAllSavedIds('after saved event');
        if (isMountedRef.current) {
          setSavedIds(uniqueIds);
        }
      } catch (error) {
        logger.error('Error loading saved items in listener', error);
      }
    });
    return () => { 
      unsubscribe(); 
    };
  }, []);

  // Listen for archive, unarchive, and delete actions on posts to synchronize local lists/grid and counters
  useEffect(() => {
    const unsubscribe = savedEvents.addPostActionListener((postId, action) => {
      if (!isMountedRef.current) return;
      
      if (action === 'delete' || action === 'archive') {
        // Remove from posts and savedPosts arrays
        setPosts(prev => {
          const filtered = prev.filter(p => p._id !== postId);
          if (filtered.length !== prev.length) {
            // Decrement count aggregate to stay synchronized
            setProfileData(cur => cur ? {
              ...cur,
              postsCount: Math.max(0, (cur.postsCount || 0) - (prev.length - filtered.length))
            } : null);
          }
          return filtered;
        });
        setSavedPosts(prev => prev.filter(p => p._id !== postId));
        setUserShorts(prev => prev.filter(s => s._id !== postId));
        setSavedShorts(prev => prev.filter(s => s._id !== postId));
      } else if (action === 'unarchive') {
        // Since it's restored, let's trigger a full background refresh of user data/posts to pull it back in
        void loadUserData(true);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [loadUserData]);

  // Saved Content Stability: Load saved IDs when switching to saved tab (defensive parsing)
  useEffect(() => {
    const loadSaved = async () => {
      if (activeTab !== 'saved' || !isMountedRef.current) return;
      
      try {
        const uniqueIds = await readAllSavedIds('on tab switch');
        if (isMountedRef.current) {
          setSavedIds(uniqueIds);
        }
      } catch (error) {
        logger.error('Error loading saved items on tab switch', error);
      }
    };
    loadSaved();
  }, [activeTab]);

  // Saved Content Stability: Resolve saved IDs to full post objects with deduplication and cleanup
  useEffect(() => {
    const resolveSaved = async () => {
      if (activeTab !== 'saved' || !isMountedRef.current) return;
      if (!savedIds || savedIds.length === 0) {
        if (isMountedRef.current) {
          setSavedPosts([]);
          setSavedShorts([]);
        }
        return;
      }
      
      try {
        // Deduplicate IDs (defensive)
        const uniqueIds = Array.from(new Set(savedIds.filter(id => id && typeof id === 'string')));
        
        if (uniqueIds.length === 0) {
          if (isMountedRef.current) {
            setSavedPosts([]);
            setSavedShorts([]);
          }
          return;
        }
        
        const batchSize = 10; // Batch size for performance
        const batches: string[][] = [];
        for (let i = 0; i < uniqueIds.length; i += batchSize) {
          batches.push(uniqueIds.slice(i, i + batchSize));
        }
        
        // Load all batches in parallel
        const allResults = await Promise.all(
          batches.map(batch => 
            Promise.allSettled(batch.map(id => getPostById(id)))
          )
        );
        
        if (!isMountedRef.current) return;
        
        const items: PostType[] = [];
        const itemMap = new Map<string, PostType>(); // Deduplicate by _id
        const failedIds: string[] = [];
        
        allResults.forEach((batchResults, batchIndex) => {
          batchResults.forEach((r, itemIndex) => {
            if (r.status === 'fulfilled') {
              const val: any = (r as any).value;
              const item = val?.data?.post || val?.post || val;
              if (item && item._id) {
                // Deduplicate: only add if not already in map
                if (!itemMap.has(item._id)) {
                  itemMap.set(item._id, item);
                  items.push(item);
                }
              } else {
                // Post not found in response payload
                const id = batches[batchIndex][itemIndex];
                logger.warn(`Resolved saved item ${id} but could not find post in response`, val);
              }
            } else {
              // Post fetch failed (deleted, auth issue, or network error)
              const id = batches[batchIndex][itemIndex];
              const reason = (r as any).reason;
              
              // Remove saved IDs that the API says are deleted or no longer visible.
              // A real expired-token 401 is handled by the API interceptor before this point.
              if (isSavedItemUnavailable(reason)) {
                failedIds.push(id);
              } else {
                logger.warn(`Saved item ${id} fetch failed transiently (will retry next time):`, reason?.message || reason);
              }
            }
          });
        });
        
        // Clean up AsyncStorage by removing unavailable post IDs (atomic read-modify-write)
        if (failedIds.length > 0 && isMountedRef.current) {
          try {
            const savedShorts = await AsyncStorage.getItem('savedShorts');
            const savedPosts = await AsyncStorage.getItem('savedPosts');
            
            // Defensive parsing
            let shortsArr: string[] = [];
            let postsArr: string[] = [];
            
            try {
              if (savedShorts) {
                const parsed = JSON.parse(savedShorts);
                shortsArr = Array.isArray(parsed) ? parsed : [];
              }
            } catch (error) {
              logger.warn('Failed to parse savedShorts during cleanup, resetting', error);
              shortsArr = [];
            }
            
            try {
              if (savedPosts) {
                const parsed = JSON.parse(savedPosts);
                postsArr = Array.isArray(parsed) ? parsed : [];
              }
            } catch (error) {
              logger.warn('Failed to parse savedPosts during cleanup, resetting', error);
              postsArr = [];
            }
            
            // Remove failed IDs from both arrays
            const cleanedShorts = shortsArr.filter(id => !failedIds.includes(id));
            const cleanedPosts = postsArr.filter(id => !failedIds.includes(id));
            
            // Atomic write: update both storage keys
            await Promise.all([
              AsyncStorage.setItem('savedShorts', JSON.stringify(cleanedShorts)),
              AsyncStorage.setItem('savedPosts', JSON.stringify(cleanedPosts))
            ]);
            
            // Update savedIds state to reflect cleaned list
            if (isMountedRef.current) {
              const allCleanedIds = [...cleanedPosts, ...cleanedShorts];
              const uniqueCleanedIds = Array.from(new Set(allCleanedIds));
              setSavedIds(uniqueCleanedIds);
            }
            
            logger.debug(`Cleaned up ${failedIds.length} unavailable posts from saved items`);
          } catch (cleanupError) {
            logger.error('Error cleaning up deleted posts from AsyncStorage', cleanupError);
          }
        }
        
        if (isMountedRef.current) {
          const orderedItems = uniqueIds
            .map(id => itemMap.get(id))
            .filter((item): item is PostType => !!item);
          const postsItems = orderedItems.filter(item => item.type !== 'short' && !item.videoUrl);
          const shortsItems = orderedItems.filter(item => item.type === 'short' || !!item.videoUrl);
          setSavedPosts(postsItems);
          setSavedShorts(shortsItems);
        }
      } catch (e) {
        if (!isMountedRef.current) return;
        logger.error('Failed to load saved items', e);
        setSavedPosts([]);
        setSavedShorts([]);
      }
    };
    resolveSaved();
  }, [activeTab, savedIds]);

  useEffect(() => {
    if (params.editProfile === 'true') {
      setShowEditProfile(true);
    }
  }, [params.editProfile]);

  useEffect(() => {
    if (!checkingUser && !user) {
      router.replace('/(auth)/signin');
    }
  }, [checkingUser, user, router]);

  const handleRefresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    triggerRefreshHaptic();
    setRefreshing(true);
    
    try {
      await loadUserData();
      if (isMountedRef.current) {
        await loadUnreadCount();
      }
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [loadUserData, loadUnreadCount]);

  const handleSignOut = async () => {
    showConfirm(
      'Are you sure you want to sign out?',
      async () => {
        try {
          // Sign out and clear all auth data (includes socket disconnect and storage clearing)
          await signOut();
          
          // Force navigation to signin immediately - use replace to prevent back navigation
          // Use a small delay to ensure storage is cleared before navigation
          setTimeout(() => {
            try {
              // Navigate to signin screen
              router.replace('/(auth)/signin');
              
              // On web, also force a hard reload to clear all state
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                // Use a slightly longer delay to ensure navigation completes first
                setTimeout(() => {
                  window.location.href = '/';
                }, 200);
              }
            } catch (navError) {
              logger.error('Navigation error after signout:', navError);
              // Fallback: try direct navigation
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.location.href = '/';
              }
            }
          }, 50);
        } catch (error: any) {
          logger.error('Sign out error:', error);
          // Even if signOut fails, try to navigate to signin
          try {
            router.replace('/(auth)/signin');
            // On web, force reload
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              setTimeout(() => {
                window.location.href = '/';
              }, 100);
            }
          } catch (navError) {
            logger.error('Navigation error after signout:', navError);
            // Last resort: force page reload
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }
          showError(error?.message || 'Failed to sign out. Please try again.');
        }
      },
      'Sign Out',
      'Sign Out',
      'Cancel'
    );
  };

  // Profile Data Consistency: Refresh profile data after edit to ensure single source of truth
  const handleProfileUpdate = useCallback(async (updatedUser: UserType) => {
    if (!isMountedRef.current) return;
    
    // Optimistic update
    setUser(updatedUser);
    setProfileData(prev => prev ? { ...prev, ...updatedUser } : null);
    
    // Refresh from API to ensure consistency (single source of truth)
    // This ensures profile header, post count, follower/following count, and tabs are all in sync
    try {
      if (updatedUser._id) {
        const profile = await getProfile(updatedUser._id);
        if (isMountedRef.current) {
          setProfileData(profile.profile);
          // Also refresh posts count if needed
          const userPosts = await getUserPosts(updatedUser._id);
          if (isMountedRef.current) {
            setPosts(userPosts.posts);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to refresh profile after update', error);
      // Don't show error - optimistic update is already applied
    }
  }, []);

  const handleDeletePost = async (postId: string, isShort: boolean = false) => {
    showConfirm(
      `Are you sure you want to delete this ${isShort ? 'short' : 'post'}?`,
      async () => {
        // Optimistic update - update UI immediately
        const previousPosts = [...posts];
        const previousShorts = [...userShorts];
        const previousSavedPosts = [...savedPosts];
        const previousSavedShorts = [...savedShorts];
        const previousProfileData = profileData;
        
        try {
          // Update UI optimistically
          if (isShort) {
            setUserShorts(prev => prev.filter(short => short._id !== postId));
          } else {
            setPosts(prev => prev.filter(post => post._id !== postId));
          }
          
          setSavedPosts(prev => prev.filter(item => item._id !== postId));
          setSavedShorts(prev => prev.filter(item => item._id !== postId));
          
          if (profileData) {
            setProfileData(prev => prev ? { 
              ...prev, 
              postsCount: Math.max(0, (prev.postsCount || 0) - 1) 
            } : null);
          }
          
          // Track deletion
          trackEngagement('delete', isShort ? 'short' : 'post', postId);
          
          // Perform actual deletion
          if (isShort) {
            await deleteShort(postId);
          } else {
            await deletePost(postId);
            await AsyncStorage.removeItem('postDraft');
          }
          const { audioManager } = await import('../../utils/audioManager');
          await audioManager.stopAll();
          
          showSuccess(`${isShort ? 'Short' : 'Post'} deleted successfully!`);
          
          // Invalidate/refresh profile count in the background
          void loadUserData(true);
        } catch (error: any) {
          // Revert optimistic update on error
          setPosts(previousPosts);
          setUserShorts(previousShorts);
          setSavedPosts(previousSavedPosts);
          setSavedShorts(previousSavedShorts);
          setProfileData(previousProfileData);
          
          logger.error('Failed to delete post', error);
          showError(error.message || `Failed to delete ${isShort ? 'short' : 'post'}`);
        }
      },
      'Delete',
      'Delete',
      'Cancel'
    );
  };

  const handleBulkDelete = () => {
    if (selectedItemIds.length === 0) return;
    const typeLabel = activeTab === 'shorts' ? 'shorts' : 'posts';
    showConfirm(
      `Are you sure you want to delete the ${selectedItemIds.length} selected ${typeLabel}?`,
      async () => {
        const idsToDelete = [...selectedItemIds];
        // Optimistic update
        const previousPosts = [...posts];
        const previousShorts = [...userShorts];
        const previousProfileData = profileData;

        try {
          // Reset selection states immediately
          setIsSelectionMode(false);
          setSelectedItemIds([]);

          if (activeTab === 'shorts') {
            setUserShorts(prev => prev.filter(s => !idsToDelete.includes(s._id)));
            await Promise.all(idsToDelete.map(id => deleteShort(id)));
          } else {
            setPosts(prev => prev.filter(p => !idsToDelete.includes(p._id)));
            await Promise.all(idsToDelete.map(id => deletePost(id)));
          }

          if (profileData) {
            setProfileData(prev => prev ? {
              ...prev,
              postsCount: Math.max(0, (prev.postsCount || 0) - idsToDelete.length)
            } : null);
          }

          showSuccess(`${idsToDelete.length} ${typeLabel} deleted successfully!`);
          
          // Invalidate/refresh profile count in the background
          void loadUserData(true);
        } catch (error: any) {
          // Revert optimistic updates
          setPosts(previousPosts);
          setUserShorts(previousShorts);
          setProfileData(previousProfileData);

          logger.error('Failed to perform bulk deletion', error);
          showError(error.message || 'Failed to delete selected items.');
        }
      },
      'Delete All',
      'Delete',
      'Cancel'
    );
  };

  if (loading || checkingUser) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
        <NavBar title="Profile" />
        <View style={styles.loadingContainer}>
          <LoadingGlobe size={36} />
        </View>
      </View>
    );
  }

  if (!user || !profileData) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title="Profile" />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            Failed to load profile
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { overflow: 'hidden' }]}
            onPress={() => loadUserData()}
          >
            <LinearGradient
              colors={['#50C878', '#1C73B4']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={[styles.retryButtonText, { color: '#FFFFFF' }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderProfileItem = ({ item, index }: { item: PostType; index: number }) => {
    if (activeTab === 'posts') {
      const post = item;
      const imageUrl = post.imageUrl 
        || (post as any).image_url 
        || (post as any).mediaUrl 
        || (post as any).images?.[0]
        || (post as any).thumbnailUrl;
      
      const rawUrl = imageUrl && String(imageUrl).trim() && String(imageUrl).trim().length > 0
        ? String(imageUrl).trim()
        : null;
      const validImageUrl = rawUrl ? optimizeCloudinaryUrl(rawUrl, { width: 300, height: 300 }) : null;
      
      const isSelected = selectedItemIds.includes(post._id);
      const handlePress = () => {
        if (isSelectionMode) {
          setSelectedItemIds(prev => 
            prev.includes(post._id) ? prev.filter(id => id !== post._id) : [...prev, post._id]
          );
        } else {
          if (user?._id) {
            router.push({
              pathname: `/user-posts/${user._id}`,
              params: {
                postId: post._id,
                postData: JSON.stringify(post),
                index: String(index),
              },
            });
          }
        }
      };
      const handleLongPress = () => {
        if (!isSelectionMode) {
          setIsSelectionMode(true);
          setSelectedItemIds([post._id]);
        }
      };

      return (
        <Pressable 
          style={[styles.postThumbnail, { backgroundColor: profileTheme.cardBg, borderColor: isSelected ? theme.colors.primary : profileTheme.gapBorderColor }]}
          onLongPress={handleLongPress}
          onPress={handlePress}
        >
          {validImageUrl ? (
            <>
              <Image 
                source={{ uri: validImageUrl }} 
                style={styles.thumbnailImage as ImageStyle}
                resizeMode="cover"
                onError={(error) => {
                  const errorMessage = error?.nativeEvent?.error?.message || '';
                  const is403 = errorMessage.includes('403') || errorMessage.includes('Forbidden');
                  if (__DEV__ && !is403) {
                    console.warn('⚠️ [Profile] Image failed:', { postId: post._id, url: validImageUrl.substring(0, 80), error: errorMessage || 'Unknown' });
                  }
                  if (!is403) {
                    logger.warn('Image failed to load', { postId: post._id, imageUrl: validImageUrl.substring(0, 100), error: errorMessage || 'Unknown error' });
                  }
                }}
              />
              {post.filter && FILTER_PREVIEW_OVERLAY[post.filter as ImageFilterType] && (
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      backgroundColor: FILTER_PREVIEW_OVERLAY[post.filter as ImageFilterType]!,
                    }
                  ]}
                />
              )}
            </>
          ) : (
            <View style={[styles.placeholderThumbnail, { backgroundColor: profileTheme.cardBg + '80' }]}>
              <Ionicons name="image-outline" size={28} color={profileTheme.textSecondary} />
            </View>
          )}
          {isSelected && (
            <View style={[styles.selectionOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.4)' }]}>
              <View style={styles.checkmarkCircle}>
                <LinearGradient
                  colors={['#1C73B4', '#50C878']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </View>
            </View>
          )}
          {(post as any).images?.length > 1 && (
            <View style={styles.multiImageBadge}>
              <Ionicons name="copy-outline" size={12} color="#FFFFFF" />
            </View>
          )}
          <View style={styles.viewCountOverlay}>
            <Ionicons name="eye-outline" size={11} color="#FFFFFF" />
            <Text style={styles.viewCountText}>
              {formatViewCount((post as any).viewsCount)}
            </Text>
          </View>
        </Pressable>
      );
    } else if (activeTab === 'shorts') {
      const s = item;
      const isSelected = selectedItemIds.includes(s._id);
      const handlePress = () => {
        if (isSelectionMode) {
          setSelectedItemIds(prev => 
            prev.includes(s._id) ? prev.filter(id => id !== s._id) : [...prev, s._id]
          );
        } else {
          router.push(`/user-shorts/${user?._id || ''}?shortId=${s._id}&index=${index}`);
        }
      };
      const handleLongPress = () => {
        if (!isSelectionMode) {
          setIsSelectionMode(true);
          setSelectedItemIds([s._id]);
        }
      };

      return (
        <ShortsCard
          item={s}
          isThumbnail={true}
          isSelected={isSelected}
          onPress={handlePress}
          onLongPress={handleLongPress}
          profileTheme={profileTheme}
        />
      );
    } else if (activeTab === 'saved') {
      if (activeSavedSubTab === 'posts') {
        const imageUrl = (item as any).imageUrl && !isVideoUrl((item as any).imageUrl, (item as any).videoUrl) ? (item as any).imageUrl : 
                         (item as any).image_url && !isVideoUrl((item as any).image_url, (item as any).videoUrl) ? (item as any).image_url : 
                         (item as any).thumbnailUrl && !isVideoUrl((item as any).thumbnailUrl, (item as any).videoUrl) ? (item as any).thumbnailUrl : 
                         (item as any).images?.[0] && !isVideoUrl((item as any).images?.[0], (item as any).videoUrl) ? (item as any).images?.[0] : '';
        
        const rawUrl = imageUrl && String(imageUrl).trim() && String(imageUrl).trim().length > 0
          ? String(imageUrl).trim()
          : null;
        const validImageUrl = rawUrl ? optimizeCloudinaryUrl(rawUrl, { width: 300, height: 300 }) : null;
        
        return (
          <Pressable 
            style={[styles.postThumbnail, { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.gapBorderColor }]}
            onPress={() => {
              router.push({
                pathname: '/saved-posts',
                params: {
                  postId: item._id,
                  postData: JSON.stringify(item),
                },
              });
            }}
          >
            {validImageUrl ? (
              <Image 
                source={{ uri: validImageUrl }} 
                style={styles.thumbnailImage as ImageStyle}
                resizeMode="cover"
                onError={(error) => {
                  const errorMessage = error?.nativeEvent?.error?.message || '';
                  const is403 = errorMessage.includes('403') || errorMessage.includes('Forbidden');
                  if (!is403) {
                    logger.warn('Saved item image failed to load', {
                      postId: item._id,
                      imageUrl: validImageUrl.substring(0, 100),
                      error: errorMessage || 'Unknown error'
                    });
                  }
                }}
              />
            ) : (
              <View style={[styles.placeholderThumbnail, { backgroundColor: profileTheme.cardBg + '80' }]}>
                <Ionicons name="image-outline" size={32} color={profileTheme.textSecondary} />
              </View>
            )}
            <View style={[styles.bookmarkOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
              <Ionicons name="bookmark" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
        );
      } else {
        return (
          <ShortsCard
            item={item}
            isThumbnail={true}
            showBookmark={true}
            onPress={() => {
              router.push(`/saved-shorts?shortId=${item._id}`);
            }}
            profileTheme={profileTheme}
          />
        );
      }
    }
    return null;
  };

  return (
    <ErrorBoundary level="route">
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {!isDark && <CloudSkyBackground heightRatio={0.38} />}
      <LinearGradient
        colors={theme.colors.screenGradient as [string, string, ...string[]]}
        style={StyleSheet.absoluteFillObject}
        locations={screenGradientLocations}
      />

      {/* Top Bar Container matching Home feed's top bar */}
      <View style={[
        styles.topBarContainer,
        {
          paddingTop: insets.top,
          height: 56 + insets.top,
          backgroundColor: 'transparent',
          borderBottomWidth: 1,
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.35)',
          borderTopWidth: 1,
          borderTopColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.45)',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          
          // Soft ambient blue glow
          shadowColor: isDark ? '#38BDF8' : '#1C73B4',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.04 : 0.06,
          shadowRadius: 20,
          elevation: 2,
        }
      ]}>
        <BlurView
          intensity={95}
          tint={isDark ? 'dark' : 'light'}
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: isDark ? 'rgba(15, 22, 35, 0.82)' : 'rgba(250, 252, 255, 0.85)',
            }
          ]}
        />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleRefresh}
            activeOpacity={0.7}
            style={styles.logoContainer}
            accessibilityLabel="Taatom, tap to refresh profile"
            accessibilityRole="button"
          >
            <View style={styles.logoImageContainer}>
              <Image 
                source={{ uri: 'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1766525159/aefbv7kr261jzp4sptel.png' }}
                style={[styles.logoImage, { resizeMode: 'contain' }] as ImageStyle[]}
              />
            </View>
            <Text style={[styles.logoText, { color: theme.colors.text }]} allowFontScaling={false}>
              Taatom
            </Text>
          </TouchableOpacity>

          <View style={styles.headerIconsRight}>
            <Pressable
              style={styles.iconButton}
              onPress={() => router.push('/notifications')}
              accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              accessibilityRole="button"
            >
              {unreadCount > 0 ? (
                <MaskedView
                  style={{ width: 22, height: 22 }}
                  maskElement={
                    <Ionicons
                      name="notifications"
                      size={22}
                      color="#000000"
                      style={{ backgroundColor: 'transparent' }}
                    />
                  }
                >
                  <LinearGradient
                    colors={['#1C73B4', '#50C878']}
                    style={{ flex: 1 }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                </MaskedView>
              ) : (
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color={isDark ? '#38BDF8' : '#1C73B4'}
                />
              )}
              {unreadCount > 0 && (
                <View style={[styles.headerNotificationBadge, { backgroundColor: theme.colors.error, borderColor: isDark ? '#0A1624' : '#C4E5FF' }]}>
                  <Text style={[styles.headerBadgeText, { color: '#FFFFFF' }]}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
            <KebabMenu
              iconColor={isDark ? '#38BDF8' : '#1C73B4'}
              iconSize={22}
              items={[
                {
                  label: 'Settings',
                  icon: 'settings-outline',
                  onPress: () => router.push('/settings'),
                },
                {
                  label: 'Sign Out',
                  icon: 'log-out-outline',
                  onPress: handleSignOut,
                  destructive: true,
                },
              ]}
            />
          </View>
        </View>
      </View>
      <View style={styles.scrollClip}>
      <FlatList
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        data={activeListData}
        numColumns={3}
        key={`${activeTab}_${activeSavedSubTab}`}
        keyExtractor={(item) => item._id}
        renderItem={renderProfileItem}
        ListHeaderComponent={
          <>
            {/* Spacer to reserve space for the absolute header */}
            <View style={{ height: 56 + insets.top }} />

            {profileData && (
              <ProfilePremiumView
                profilePic={profileData.profilePic}
                fullName={profileData.fullName}
                username={profileData.username}
                bio={profileData.bio}
                createdAt={profileData.createdAt}
                tripScore={profileData.tripScore?.totalScore ?? 0}
                postCount={profileData.postsCount || 0}
                followersCount={profileData.followersCount || 0}
                verifiedCount={verifiedLocationsCount}
                tripsCount={tripsCount}
                countriesCount={countriesCount}
                verifiedLocations={verifiedLocations}
                userId={user?._id ?? profileData._id}
                isDark={isDark}
                accent={profileTheme.accent}
                textPrimary={profileTheme.textPrimary}
                textSecondary={profileTheme.textSecondary}
                onEditProfile={() => setShowEditProfile(true)}
                onAvatarLongPress={(source) => setEnlargedPhotoSource(source)}
                onAvatarPressOut={() => setEnlargedPhotoSource(null)}
                onOpenMap={() => {
                  const id = user?._id ?? profileData?._id;
                  const userId = id != null ? String(id) : undefined;
                  if (userId) router.push(`/map/all-locations?userId=${encodeURIComponent(userId)}`);
                }}
                onOpenTripScore={() => router.push(`/tripscore/continents?userId=${user?._id}`)}
                onOpenJourneys={() => {
                  const name = user?.fullName || profileData?.fullName || user?.username || '';
                  router.push(`/journeys?userId=${user?._id}&userName=${encodeURIComponent(name)}`);
                }}
                onOpenConnect={() => router.push('/connect')}
                followingCount={profileData.followingCount || 0}
                onOpenFollowers={() => {
                  if (profileData?._id) {
                    router.push(`/followers?userId=${profileData._id}&type=followers`);
                  }
                }}
                onOpenFollowing={() => {
                  if (profileData?._id) {
                    router.push(`/followers?userId=${profileData._id}&type=following`);
                  }
                }}
              />
            )}

            <View style={[styles.unifiedCardHeader, { backgroundColor: profileTheme.glassCardBg }]}>
              {/* Posts/Shorts/Saved Tabs - Pill Style (padded row) */}
              <View
                style={styles.postsTabsSection}
                onLayout={(event) => {
                  tabsOffsetRef.current = event.nativeEvent.layout.y;
                }}
              >
                <View style={[styles.pillTabsContainer, { backgroundColor: profileTheme.pillTabsBg, borderColor: isDark ? 'rgba(255,255,255,0.08)' : profileTheme.cardBorder, borderWidth: StyleSheet.hairlineWidth }]}>
                  {(['posts','shorts','saved'] as const).map(tab => (
                    <Pressable 
                      key={tab} 
                      style={[
                        styles.pillTab, 
                        activeTab===tab && styles.activePillTab
                      ]} 
                      onPress={() => {
                        // Profile Tabs Lifecycle Safety: Prevent rapid tab switching from causing duplicate API calls
                        if (isFetchingRef.current && activeTab !== tab) {
                          logger.debug('Tab switch blocked - fetch in progress');
                          return;
                        }
                        setIsSelectionMode(false);
                        setSelectedItemIds([]);
                        setActiveTab(tab);
                      }}
                    >
                      {activeTab === tab && (
                        <LinearGradient
                          colors={['#1C73B4', '#50C878']}
                          style={StyleSheet.absoluteFillObject}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        />
                      )}
                      <Ionicons 
                        name={tab==='posts' ? 'images-outline' : tab==='shorts' ? 'videocam-outline' : 'bookmark-outline'} 
                        size={18} 
                        color={activeTab===tab ? '#FFFFFF' : profileTheme.textSecondary} 
                        style={{ zIndex: 1 }}
                      />
                      <Text style={[
                        styles.pillTabText, 
                        { color: activeTab===tab ? '#FFFFFF' : profileTheme.textSecondary, zIndex: 1 }
                      ]}>
                        {tab === 'posts' ? 'Posts' : tab === 'shorts' ? 'Shorts' : 'Saved'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {activeTab === 'saved' && (
                <View style={[styles.savedSubTabsContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: profileTheme.cardBorder, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 }]}>
                  {(['posts', 'shorts'] as const).map(subTab => (
                    <Pressable
                      key={subTab}
                      style={[
                        styles.savedSubTab,
                        activeSavedSubTab === subTab && { overflow: 'hidden' }
                      ]}
                      onPress={() => setActiveSavedSubTab(subTab)}
                    >
                      {activeSavedSubTab === subTab && (
                        <LinearGradient
                          colors={['#1C73B4', '#50C878']}
                          style={StyleSheet.absoluteFillObject}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        />
                      )}
                      <Text
                        style={[
                          styles.savedSubTabText,
                          {
                            color: activeSavedSubTab === subTab ? '#FFFFFF' : profileTheme.textSecondary,
                            fontWeight: activeSavedSubTab === subTab ? '700' : '500',
                            zIndex: 1,
                          }
                        ]}
                      >
                        {subTab === 'posts' ? 'Posts' : 'Shorts'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </>
        }
        columnWrapperStyle={[styles.postsGridWrapper, { backgroundColor: profileTheme.glassCardBg }]}
        ListFooterComponent={
          <>
            <View style={[styles.unifiedCardFooter, { backgroundColor: profileTheme.glassCardBg }]} />
            
            {/* Edit Profile Modal */}
            {showEditProfile && user && (
              <EditProfile
                visible={showEditProfile}
                user={{
                  ...user,
                  fullName: profileData?.fullName ?? user.fullName,
                  bio: profileData?.bio ?? user.bio,
                  profilePic: profileData?.profilePic ?? user.profilePic,
                }}
                onClose={() => setShowEditProfile(false)}
                onSuccess={handleProfileUpdate}
              />
            )}
          </>
        }
        ListEmptyComponent={
          <View style={{ backgroundColor: profileTheme.glassCardBg, paddingVertical: 40, alignItems: 'center' }}>
            <Ionicons name="images-outline" size={48} color={profileTheme.textSecondary} style={{ marginBottom: 12, opacity: 0.5 }} />
            <Text style={{ color: profileTheme.textSecondary, fontSize: 15, fontFamily: getFontFamily('500') }}>
              {activeTab === 'posts' ? 'No posts yet' : activeTab === 'shorts' ? 'No shorts yet' : 'No saved items'}
            </Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          if (event.target !== event.currentTarget) return;
          handleScroll(event);
          // Store scroll position for restoration
          scrollPositionRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.secondary]}
            tintColor={theme.colors.secondary}
            progressBackgroundColor={theme.colors.surface}
            progressViewOffset={56 + insets.top}
          />
        }
      />
      </View>
      <ScrollEdgeFades isDark={isDark} variant="vertical" hideTop={true} />

      {isSelectionMode && selectedItemIds.length > 0 && (
        <View style={[styles.floatingActionBar, { backgroundColor: isDark ? 'rgba(16, 34, 54, 0.95)' : 'rgba(255, 255, 255, 0.95)', borderColor: profileTheme.cardBorder }]}>
          <Text style={[styles.actionBarText, { color: profileTheme.textPrimary }]}>
            {selectedItemIds.length} selected
          </Text>
          <View style={styles.actionBarButtons}>
            <TouchableOpacity
              style={[styles.actionBarCancelBtn, { borderColor: profileTheme.textSecondary }]}
              onPress={() => {
                setIsSelectionMode(false);
                setSelectedItemIds([]);
              }}
            >
              <Text style={[styles.actionBarCancelText, { color: profileTheme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBarDeleteBtn, { backgroundColor: theme.colors.error }]}
              onPress={handleBulkDelete}
            >
              <Ionicons name="trash-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.actionBarDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {enlargedPhotoSource && (
        <View 
          style={[StyleSheet.absoluteFillObject, { 
            backgroundColor: 'rgba(0, 0, 0, 0.85)', 
            justifyContent: 'center', 
            alignItems: 'center', 
            zIndex: 999999 
          }]} 
          pointerEvents="none"
        >
          <View style={{
            width: 280,
            height: 280,
            borderRadius: 24,
            borderWidth: 2,
            borderColor: 'rgba(255, 255, 255, 0.2)',
            overflow: 'hidden',
            backgroundColor: '#000000',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.5,
            shadowRadius: 24,
            elevation: 12,
          }}>
            <Image
              source={enlargedPhotoSource}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </View>
        </View>
      )}

      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  savedSubTabsContainer: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 20,
    padding: 3,
    marginVertical: 12,
    width: '60%',
    maxWidth: 300,
    gap: 4,
  },
  savedSubTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedSubTabActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  savedSubTabText: {
    fontSize: 12,
    letterSpacing: 0.1,
  },
  container: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isTablet ? 1200 : 1000,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  topBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    ...(isWeb && {
      maxWidth: isTablet ? 1200 : 1000,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 2,
    paddingTop: 0,
    minHeight: 56,
    borderBottomWidth: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImageContainer: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  logoImage: {
    width: 56,
    height: 56,
  },
  logoText: {
    fontSize: 30,
    fontWeight: '600',
    fontFamily: Platform.select({
      ios: 'Snell Roundhand',
      android: 'cursive',
      web: '"Dancing Script", "Satisfy", "Brush Script MT", "Lucida Handwriting", cursive',
      default: 'cursive',
    }),
    letterSpacing: 0.3,
    fontStyle: 'normal',
    ...(Platform.OS === 'web' && {
      fontFamily: '"Dancing Script", "Satisfy", "Brush Script MT", "Lucida Handwriting", cursive',
      fontWeight: '600',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    } as any),
  },
  headerIconsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  iconButton: {
    padding: 4,
    borderRadius: 16,
    backgroundColor: 'transparent',
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerNotificationBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    borderRadius: 7.5,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    zIndex: 10,
  },
  headerBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollClip: {
    flex: 1,
    position: 'relative',
  },
  scrollContent: {
    // Add padding for tab bar (88px mobile, 70px web) + extra spacing
    paddingBottom: isWeb ? 90 : (isTablet ? 110 : 100),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : 20,
  },
  errorText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('500'),
    marginBottom: isTablet ? theme.spacing.xl : 20,
    textAlign: 'center',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  retryButton: {
    paddingHorizontal: isTablet ? theme.spacing.xl : 24,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      background: 'linear-gradient(135deg, #50C878 0%, #1C73B4 100%)',
    } as any),
  },
  retryButtonText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  
  // Top Actions Container
  topActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    marginTop: isTablet ? 80 : 60,
    marginBottom: 4,
  },
  topActionsLeft: {
    flex: 1,
  },
  travelBannerWrapper: {
    marginHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    marginBottom: 0,
    borderRadius: 28,
    overflow: 'hidden',
    height: isTablet ? 140 : 120,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#4AA3DF',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 10,
  },
  travelBannerImage: {
    width: '100%',
    height: '100%',
  },
  topActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTablet ? theme.spacing.md : 12,
  },
  headerActionButton: {
    width: isTablet ? 48 : 40,
    height: isTablet ? 48 : 40,
    borderRadius: isTablet ? 24 : 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    shadowColor: '#65BDF7',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 5,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Profile Header Section (inside unified card)
  profileHeaderSection: {
    alignItems: 'center',
    paddingBottom: isTablet ? theme.spacing.lg : 16,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    marginBottom: isTablet ? theme.spacing.lg : 16,
  },
  avatarRing: {
    width: isTablet ? 160 : 132,
    height: isTablet ? 160 : 132,
    borderRadius: isTablet ? 80 : 66,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  avatarRingCloud: {
    borderWidth: 4,
    shadowColor: 'rgba(91, 188, 248, 0.35)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  avatar: {
    width: isTablet ? 148 : 120,
    height: isTablet ? 148 : 120,
    borderRadius: isTablet ? 74 : 60,
    borderWidth: 4,
  },
  username: {
    fontSize: isTablet ? theme.typography.h1.fontSize : 22,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: isIOS ? 0.3 : 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  profileName: {
    fontSize: isTablet ? theme.typography.body.fontSize : 16,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: isIOS ? 0.1 : 0.05,
    opacity: 0.7,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  memberSince: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('500'),
    marginBottom: isTablet ? theme.spacing.md : 12,
    textAlign: 'center',
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  
  // Stats Container - Uniform pill-like cards (legacy, kept for compatibility)
  statCard: {
    flex: 1,
    width: '100%',
    height: isTablet ? 130 : 110,
    borderRadius: isTablet ? theme.borderRadius.lg : 20,
    paddingVertical: isTablet ? theme.spacing.lg : 16,
    paddingHorizontal: isTablet ? theme.spacing.md : 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statIconContainer: {
    width: isTablet ? 44 : 36,
    height: isTablet ? 44 : 36,
    borderRadius: isTablet ? 22 : 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isTablet ? theme.spacing.sm : 8,
  },
  statValue: {
    fontSize: isTablet ? 28 : 22,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.3,
    textAlign: 'center',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  statLabel: {
    fontSize: isTablet ? theme.typography.small.fontSize + 1 : 10,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  
  // Unified Profile Content Card - elegant, soft shadow
  unifiedCard: {
    marginHorizontal: 0,
    marginTop: -16,
    marginBottom: isTablet ? theme.spacing.md : 12,
    borderRadius: 28,
    overflow: 'hidden',
  },
  unifiedCardInner: {
    paddingTop: isTablet ? theme.spacing.xl : 20,
    paddingBottom: isTablet ? theme.spacing.lg : 16,
    paddingHorizontal: 0,
  },
  unifiedCardHeader: {
    marginHorizontal: 0,
    marginTop: -16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingTop: isTablet ? theme.spacing.xl : 20,
  },
  unifiedCardFooter: {
    marginHorizontal: 0,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    height: isTablet ? theme.spacing.lg : 28,
    marginBottom: isTablet ? theme.spacing.md : 12,
  },
  travelAccentStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  unifiedSection: {
    width: '100%',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: isTablet ? theme.spacing.md : 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsIconContainer: {
    width: isTablet ? 44 : 36,
    height: isTablet ? 44 : 36,
    borderRadius: isTablet ? 22 : 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isTablet ? theme.spacing.sm : 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  statsLabel: {
    fontSize: isTablet ? theme.typography.small.fontSize + 1 : 10,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  statsValue: {
    fontSize: isTablet ? 24 : 20,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  
  // Section Cards (legacy, kept for compatibility)
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    letterSpacing: 0.2,
  },
  sectionTextContainer: {
    flex: 1,
  },
  sectionDescription: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  tripScoreBadgeContainer: {
    alignItems: 'center',
    paddingVertical: isTablet ? theme.spacing.lg : 20,
  },
  tripScoreBadgeBox: {
    alignItems: 'center',
    paddingVertical: isTablet ? theme.spacing.lg : 16,
    paddingHorizontal: isTablet ? theme.spacing.xl : 20,
    borderRadius: 24,
    borderWidth: 1,
    minWidth: isTablet ? 160 : 140,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  tripScoreBadgeNumber: {
    fontSize: isTablet ? 48 : 40,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.5,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  tripScoreBadgeLabel: {
    fontSize: isTablet ? theme.typography.body.fontSize : 12,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 0.8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  verifiedTravelCard: {
    marginTop: isTablet ? theme.spacing.md : 12,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    paddingHorizontal: isTablet ? theme.spacing.lg : 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#65BDF7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  verifiedTravelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTablet ? theme.spacing.md : 10,
  },
  verifiedTravelIcon: {
    width: isTablet ? 44 : 36,
    height: isTablet ? 44 : 36,
    borderRadius: isTablet ? 22 : 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedTravelText: {
    flex: 1,
  },
  verifiedTravelTitle: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  verifiedTravelCount: {
    fontSize: isTablet ? theme.typography.small.fontSize : 12,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  tripScoreNumberInline: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: '600',
    letterSpacing: -0.5,
    marginLeft: 'auto',
    marginRight: 8,
  },
  tripScoreContent: {
    alignItems: 'center',
    marginTop: 4,
  },
  tripScoreCard: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 120,
  },
  tripScoreNumber: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  tripScoreLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  tripScoreHint: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  
  // Edit Profile Button (inside unified card)
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isTablet ? theme.spacing.md : 12,
    paddingHorizontal: isTablet ? theme.spacing.lg : 20,
    borderRadius: theme.borderRadius.md,
    gap: 8,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  editProfileButtonText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 0.3,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  primaryJourneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 14,
    borderRadius: 999,
    ...cloudDesign.shadowFloat,
  },
  primaryJourneyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  ghostEditButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  ghostEditText: {
    fontSize: 13,
    fontWeight: '700',
  },
  
  // Location Card (legacy, kept for compatibility)
  locationCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  locationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  locationCardBody: {
    marginBottom: 4,
  },
  locationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationTextContainer: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  locationSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  locationGlobeContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyGlobeContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  journeysInlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    marginTop: 4,
    shadowColor: '#65BDF7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
  journeysInlineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  journeysInlineText: {
    flex: 1,
  },
  journeysInlineTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  journeysInlineSubtitle: {
    fontSize: 12,
    fontWeight: '400',
  },
  
  // Settings Tiles
  settingsTile: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    minHeight: 64,
  },
  tileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileTextContainer: {
    flex: 1,
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  tileSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  
  // Posts Container
  postsTabsSection: {
    width: '100%',
    paddingHorizontal: 16,
  },
  // Grid area has NO horizontal padding — width fills the card's content area
  postsGridSection: {
    width: '100%',
  },
  postsContainer: {
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillTabsContainer: {
    flexDirection: 'row',
    borderRadius: 26,
    padding: 4,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  pillTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 19,
    overflow: 'hidden',
  },
  activePillTab: {
  },
  pillTabText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  
  // Content Area
  contentArea: {
    marginTop: 12,
    minHeight: 400,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
  },
  postsGridWrapper: {
    justifyContent: 'flex-start',
    gap: GRID_GAP,
  },
  postsGridContainer: {
    gap: GRID_GAP,
  },
  postThumbnail: {
    width: profileColumnWidth,
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  multiImageBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    padding: 3,
    zIndex: 10,
  },
  viewCountOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 20,
  },
  viewCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -24 }, { translateY: -24 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookmarkOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    minHeight: 400,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    fontWeight: '400',
  },
  createPostButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
  },
  createPostButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 0,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(28, 115, 180, 0.15)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  checkmarkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingActionBar: {
    position: 'absolute',
    bottom: isTablet ? 90 : 80,
    left: 20,
    right: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
  },
  actionBarText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: getFontFamily('700'),
  },
  actionBarButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBarCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBarCancelText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: getFontFamily('600'),
  },
  actionBarDeleteBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBarDeleteText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: getFontFamily('700'),
  },
});
