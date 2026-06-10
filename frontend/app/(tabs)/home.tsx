import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { FlashList, FlashListRef } from '@shopify/flash-list';
const AnyFlashList = FlashList as any;
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { Ionicons } from '@expo/vector-icons';
import { getPosts, getPostById, toggleLike } from '../../services/posts';
import { listChats } from '../../services/chat';
import { PostType } from '../../types/post';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import { getUserFromStorage } from '../../services/auth';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Audio } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import AnimatedHeader from '../../components/AnimatedHeader';
import EmptyState from '../../components/EmptyState';
import FeedEmptyState from '../../components/ui/EmptyState';
import { PostSkeleton } from '../../components/LoadingSkeleton';
import { PostCardSkeleton } from '../../components/ui/Skeleton';
import { trackScreenView, trackEngagement, trackFeatureUsage } from '../../services/analytics';
import api from '../../services/api';
import { socketService } from '../../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { isWeb, throttle } from '../../utils/webOptimizations';
import { triggerRefreshHaptic } from '../../utils/hapticFeedback';
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';
import { audioManager } from '../../utils/audioManager';
import { savedEvents } from '../../utils/savedEvents';
import { ErrorBoundary } from '../../utils/errorBoundary';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { CloudSkyBackground, CloudSegmentedControl } from '../../components/cloud';
import ScrollEdgeFades from '../../components/ScrollEdgeFades';
import { matchGradientLocations } from '../../utils/linearGradient';
import { NativeAdCard } from '../../components/ads/NativeAdCard';
import {
  useAdCap,
  recordGoogleAdImpression,
  logContentView,
  injectHomeFeedAds,
  HOME_AD_EVERY_N_POSTS,
} from '../../services/adCap';
import { flushPendingLikes } from '../../utils/likePersistence';
import { realtimePostsService } from '../../services/realtimePosts';
import type { FeedMode } from '../../services/posts';

/** Feed list item: either a post or a native ad placeholder (inserted every 5 posts). */
export type FeedItem = PostType | { type: 'ad'; adIndex: number };

function isAdItem(item: FeedItem): item is { type: 'ad'; adIndex: number } {
  return 'type' in item && item.type === 'ad';
}
const POST_VIEW_DWELL_MS = 2500;
const HOME_AD_START_DELAY_MS = __DEV__ ? 1000 : 30000;

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
// isWeb is already imported from '../../utils/webOptimizations'
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';
const logger = createLogger('HomeScreen');

const LIKED_POSTS_STORAGE_KEY = 'taatom_posts_liked_ids';
const PENDING_LIKES_STORAGE_KEY = 'taatom_pending_post_likes';

// Helper function to normalize IDs from various formats (string, ObjectId, Buffer)
// Buffer objects in React Native appear as objects with numeric keys (e.g., { '0': 104, '1': 235, ... })
const idCache = new Map<any, string | null>();
const normalizeId = (id: any): string | null => {
  if (!id) return null;
  
  // If it's already a string, validate and return it
  if (typeof id === 'string') {
    // Check if it's a valid ObjectId format (24 hex characters)
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      return id;
    }
    return id; // Return even if not valid format, let caller handle it
  }

  if (idCache.has(id)) {
    return idCache.get(id)!;
  }
  
  const result = (() => {
    // If it's an object with _id property, recurse
    if (id._id) {
      return normalizeId(id._id);
    }
    
    // If it has a buffer property (serialized Buffer from backend)
    // This handles: { buffer: { '0': 104, '1': 235, ... } }
    if (id.buffer && typeof id.buffer === 'object') {
      try {
        const bufferObj = id.buffer;
        const bytes: number[] = [];
        
        // Try to extract bytes from buffer object (can have numeric string keys)
        for (let i = 0; i < 12; i++) {
          const byte = bufferObj[i] ?? bufferObj[String(i)];
          if (byte !== undefined && typeof byte === 'number' && byte >= 0 && byte <= 255) {
            bytes.push(byte);
          }
        }
        
        if (bytes.length === 12) {
          // Convert bytes to hex string (24 characters)
          const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
          if (/^[0-9a-fA-F]{24}$/.test(hex)) {
            return hex;
          }
        }
      } catch (error) {
        if (__DEV__) {
          logger.debug('Error converting buffer to hex', { error, id });
        }
      }
    }
    
    // If the object itself looks like a buffer (has numeric keys directly)
    // This handles: { '0': 104, '1': 235, ... } (direct buffer serialization)
    if (typeof id === 'object' && !Array.isArray(id)) {
      const keys = Object.keys(id);
      // Check if it looks like a buffer (has numeric keys 0-11)
      if (keys.length >= 12 && keys.every(k => /^\d+$/.test(k) && parseInt(k) < 12)) {
        try {
          const bytes: number[] = [];
          for (let i = 0; i < 12; i++) {
            const byte = id[i] ?? id[String(i)];
            if (byte !== undefined && typeof byte === 'number' && byte >= 0 && byte <= 255) {
              bytes.push(byte);
            }
          }
          if (bytes.length === 12) {
            const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
            if (/^[0-9a-fA-F]{24}$/.test(hex)) {
              return hex;
            }
          }
        } catch (error) {
          if (__DEV__) {
            logger.debug('Error converting direct buffer to hex', { error, id });
          }
        }
      }
    }
    
    // If it has toString method
    if (id.toString && typeof id.toString === 'function') {
      try {
        const str = id.toString();
        if (typeof str === 'string' && /^[0-9a-fA-F]{24}$/.test(str)) {
          return str;
        }
      } catch (error) {
        if (__DEV__) {
          logger.debug('Error calling toString on ID:', error);
        }
      }
    }
    
    // Last resort: try to convert to string
    try {
      const str = String(id);
      if (/^[0-9a-fA-F]{24}$/.test(str)) {
        return str;
      }
    } catch (error) {
      if (__DEV__) {
        logger.debug('Error converting ID to string:', error);
      }
    }
    
    return null;
  })();

  idCache.set(id, result);
  return result;
};

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

interface FeedListItemProps {
  item: FeedItem;
  isCurrentlyVisible: boolean;
  onRefresh: () => void;
  onAdLoadFailed: (adIndex: number) => void;
}

const FeedListItem = React.memo(
  ({ item, isCurrentlyVisible, onRefresh, onAdLoadFailed }: FeedListItemProps) => {
    if (isAdItem(item)) {
      return (
        <NativeAdCard
          adIndex={item.adIndex}
          onImpression={recordGoogleAdImpression}
          onLoadFailed={() => onAdLoadFailed(item.adIndex)}
        />
      );
    }
    return (
      <OptimizedPhotoCard
        post={item}
        onRefresh={onRefresh}
        isCurrentlyVisible={isCurrentlyVisible}
        hideShareCount={true}
      />
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.isCurrentlyVisible !== nextProps.isCurrentlyVisible) {
      return false;
    }
    if (prevProps.onRefresh !== nextProps.onRefresh) {
      return false;
    }
    if (prevProps.onAdLoadFailed !== nextProps.onAdLoadFailed) {
      return false;
    }
    
    const prevItem = prevProps.item;
    const nextItem = nextProps.item;
    
    const prevIsAd = isAdItem(prevItem);
    const nextIsAd = isAdItem(nextItem);
    
    if (prevIsAd !== nextIsAd) {
      return false;
    }
    
    if (prevIsAd && nextIsAd) {
      return (prevItem as { adIndex: number }).adIndex === (nextItem as { adIndex: number }).adIndex;
    }
    
    const pPost = prevItem as PostType;
    const nPost = nextItem as PostType;
    
    return (
      pPost._id === nPost._id &&
      pPost.isLiked === nPost.isLiked &&
      pPost.likesCount === nPost.likesCount &&
      pPost.commentsCount === nPost.commentsCount &&
      pPost.viewsCount === nPost.viewsCount &&
      pPost.imageUrl === nPost.imageUrl &&
      pPost.caption === nPost.caption &&
      pPost.user?.fullName === nPost.user?.fullName &&
      pPost.user?.profilePic === nPost.user?.profilePic
    );
  }
);

export default function HomeScreen() {
  const { handleScroll } = useScrollToHideNav();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(56 + 63 + insets.top);
  const bottomBarHeight = isWeb ? 70 : (Platform.OS === 'ios' ? (insets.bottom > 0 ? 56 + insets.bottom : 64) : 68);
  const [posts, setRawPosts] = useState<PostType[]>([]);
  const setPosts = useCallback((value: React.SetStateAction<PostType[]>) => {
    setRawPosts((prev) => {
      const resolved = typeof value === 'function' ? (value as any)(prev) : value;
      const seen = new Set<string>();
      return resolved.filter((p: PostType) => {
        if (!p || !p._id) return false;
        if (seen.has(p._id)) return false;
        seen.add(p._id);
        return true;
      });
    });
  }, []);

  const postsRef = useRef(posts);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    const unsubscribeViews = realtimePostsService.subscribeToViews(({ postId, viewsCount }) => {
      setPosts(prev => prev.map(post => (
        post._id === postId
          ? { ...post, viewsCount, views: viewsCount } as any
          : post
      )));
    });

    const unsubscribeLikes = realtimePostsService.subscribeToLikes(({ postId, isLiked, likesCount }) => {
      // 1. Sync local likedPostIdsRef Set
      const set = likedPostIdsRef.current;
      if (isLiked) set.add(postId);
      else set.delete(postId);
      AsyncStorage.setItem(LIKED_POSTS_STORAGE_KEY, JSON.stringify([...set])).catch(() => {});

      // 2. Update posts state
      setPosts(prev => prev.map(post => {
        if (post._id === postId) {
          if (post.isLiked === isLiked && post.likesCount === likesCount) {
            return post;
          }
          return { ...post, isLiked, likesCount } as any;
        }
        return post;
      }));

      // 3. Update tab caches (feedCacheRef.current)
      const modes: FeedMode[] = ['recents', 'friends', 'popular'];
      modes.forEach(mode => {
        const cache = feedCacheRef.current[mode];
        if (cache && cache.posts) {
          cache.posts = cache.posts.map(post => {
            if (post._id === postId) {
              return { ...post, isLiked, likesCount } as any;
            }
            return post;
          });
        }
      });
    });

    const unsubscribeLocalActions = savedEvents.addPostActionListener((postId, action, data) => {
      if (action === 'like' || action === 'unlike') {
        const isLiked = action === 'like';
        const likesCount = data?.likesCount ?? 0;

        // Sync local likedPostIdsRef Set
        const set = likedPostIdsRef.current;
        if (isLiked) set.add(postId);
        else set.delete(postId);
        AsyncStorage.setItem(LIKED_POSTS_STORAGE_KEY, JSON.stringify([...set])).catch(() => {});

        // Update posts state
        setPosts(prev => prev.map(post => {
          if (post._id === postId) {
            if (post.isLiked === isLiked && post.likesCount === likesCount) {
              return post;
            }
            return { ...post, isLiked, likesCount } as any;
          }
          return post;
        }));

        // Update tab caches
        const modes: FeedMode[] = ['recents', 'friends', 'popular'];
        modes.forEach(mode => {
          const cache = feedCacheRef.current[mode];
          if (cache && cache.posts) {
            cache.posts = cache.posts.map(post => {
              if (post._id === postId) {
                return { ...post, isLiked, likesCount } as any;
              }
              return post;
            });
          }
        });
      } else if (action === 'save' || action === 'unsave') {
        const isSaved = action === 'save';

        // Update posts state
        setPosts(prev => prev.map(post => {
          if (post._id === postId) {
            if (post.isSaved === isSaved) {
              return post;
            }
            return { ...post, isSaved } as any;
          }
          return post;
        }));

        // Update tab caches
        const modes: FeedMode[] = ['recents', 'friends', 'popular'];
        modes.forEach(mode => {
          const cache = feedCacheRef.current[mode];
          if (cache && cache.posts) {
            cache.posts = cache.posts.map(post => {
              if (post._id === postId) {
                return { ...post, isSaved } as any;
              }
              return post;
            });
          }
        });
      }
    });

    return () => {
      unsubscribeViews();
      unsubscribeLikes();
      unsubscribeLocalActions();
    };
  }, [setPosts]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unseenMessageCount, setUnseenMessageCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [feedMode, setFeedMode] = useState<FeedMode>('recents');
  const { theme, mode, isDark } = useTheme();
  const { showError } = useAlert();
  const router = useRouter();
  const params = useLocalSearchParams();
  const flatListRef = useRef<FlashListRef<FeedItem>>(null);
  const homeScrollOffsetRef = useRef(0);
  const shouldRestoreHomeScrollRef = useRef(false);
  const savedVisibleIndexRef = useRef<number | null>(null);
  const savedVisiblePostIdRef = useRef<string | null>(null);
  const visibleIndexRef = useRef<number | null>(null);
  const visiblePostIdRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [failedAdIndices, setFailedAdIndices] = useState<number[]>([]);
  const handleAdLoadFailed = useCallback((adIndex: number) => {
    setFailedAdIndices(prev => {
      if (prev.includes(adIndex)) return prev;
      return [...prev, adIndex];
    });
  }, []);
  const isFetchingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const lastErrorTimeRef = useRef(0);
  const errorCountRef = useRef(0);
  const isFetchingMessagesRef = useRef(false);
  const lastMessageFetchRef = useRef(0);
  
  // Request guards for pull-to-refresh and pagination race safety.
  // fetchingTabsRef tracks which feed tabs currently have a first-page fetch
  // in flight — we allow concurrent fetches across DIFFERENT tabs (so a tab
  // switch never gets blocked by a previous tab's still-running request) but
  // de-duplicate concurrent first-page fetches WITHIN the same tab.
  const fetchingTabsRef = useRef<Set<FeedMode>>(new Set());
  const isPaginatingRef = useRef(false);
  
  // View tracking de-duplication: track last viewed post ID and timestamp
  const lastViewedPostIdRef = useRef<string | null>(null);
  const lastViewTimeRef = useRef<number>(0);
  const VIEW_DEBOUNCE_MS = POST_VIEW_DWELL_MS; // Prevent duplicate view events within 1 second
  const viewTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track visible index for conditional image rendering
  const [visibleIndex, setVisibleIndex] = useState<number | null>(null);
  // Only apply lazy-load distance restriction after user has scrolled (not on initial render)
  const hasScrolledRef = useRef(false);
  // Track currently visible post ID for music playback control
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);

  // Strike 20: Force Initial Viewability on mount and load completion
  useEffect(() => {
    if (posts && posts.length > 0) {
      const hasCurrent = posts.some(p => p._id === visiblePostId);
      if (!visiblePostId || !hasCurrent) {
        setVisiblePostId(posts[0]._id);
      }
    } else {
      setVisiblePostId(null);
    }
  }, [posts, visiblePostId]);

  // Frequency control: only show native ads after user has scrolled past 5 posts and session > 30s (1s in dev).
  const [hasScrolledPastFifthPost, setHasScrolledPastFifthPost] = useState(false);
  const [adsAllowedAfter30s, setAdsAllowedAfter30s] = useState(false);
  // Persistent 5-per-8h Google AdMob cap, shared with the shorts feed. Once
  // capped, no ad slots are inserted into the feed (per spec: posts/reels show
  // no ads after the cap is reached).
  const adCap = useAdCap();
  const hasSetScrollThresholdRef = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => setAdsAllowedAfter30s(true), HOME_AD_START_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Persisted liked post IDs so likes survive app restart (same as Shorts)
  const likedPostIdsRef = useRef<Set<string>>(new Set());

  // In-memory cache of posts per feed tab — switching tabs restores instantly without image reload
  const feedCacheRef = useRef<Record<FeedMode, { posts: PostType[]; page: number; hasMore: boolean }>>({
    recents: { posts: [], page: 1, hasMore: true },
    friends: { posts: [], page: 1, hasMore: true },
    popular: { posts: [], page: 1, hasMore: true },
  });

  const feedModeRef = useRef<FeedMode>(feedMode);
  useEffect(() => {
    feedModeRef.current = feedMode;
  }, [feedMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [feedMode]);

  const feedTabs: Array<{ id: FeedMode; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> = useMemo(
    () => [
      { id: 'recents', label: 'Recent', icon: 'time-outline', activeIcon: 'time' },
      { id: 'friends', label: 'Friends', icon: 'people-outline', activeIcon: 'people' },
      { id: 'popular', label: 'Popular', icon: 'flame-outline', activeIcon: 'flame' },
    ],
    []
  );

  const mergeLikedIntoPosts = useCallback((list: PostType[]): PostType[] => {
    if (list.length === 0) return list;
    const set = likedPostIdsRef.current;
    return list.map(p => {
      const fromStorage = set.has(p._id);
      const isLiked = p.isLiked || fromStorage;
      const likesCount = isLiked && fromStorage && !p.isLiked
        ? Math.max(p.likesCount ?? 0, 1)
        : (p.likesCount ?? 0);
      return { ...p, isLiked, likesCount };
    });
  }, []);

  const fetchPosts = useCallback(async (pageNum: number = 1, shouldAppend: boolean = false) => {
    // Capture feedMode at request time so the response can only be applied to
    // the tab that asked for it. Tab switches mid-flight produce stale responses
    // that must be discarded (otherwise friends data lands in popular cache, etc).
    const requestFeedMode = feedMode;

    // Request guards. Tab switches must be allowed to fetch even while a
    // previous tab's request is still in flight — fetchingTabsRef is keyed
    // per-tab so we only de-duplicate WITHIN the same tab. Pagination is
    // blocked if any first-page fetch is in flight for the current tab.
    if (shouldAppend) {
      if (isPaginatingRef.current || fetchingTabsRef.current.has(requestFeedMode)) {
        logger.debug('Pagination blocked: refresh or pagination already in progress');
        return;
      }
      isPaginatingRef.current = true;
    } else {
      if (fetchingTabsRef.current.has(requestFeedMode)) {
        logger.debug('Refresh blocked: same-tab refresh already in progress', requestFeedMode);
        return;
      }
      fetchingTabsRef.current.add(requestFeedMode);
    }

    const showSkeleton = pageNum === 1 && postsRef.current.length === 0;
    if (showSkeleton) {
      setLoading(true);
    }

    isFetchingRef.current = true;
    try {
      logger.debug(`Fetching posts page=${pageNum} feed=${requestFeedMode}`);

      // Web: Fetch more posts per page for better UX
      const postsPerPage = isWeb ? 15 : 10;
      const response = await getPosts(pageNum, postsPerPage, requestFeedMode);

      // Stale-response guard: if user switched tabs while this request was in
      // flight, drop the result. Otherwise we would overwrite the new tab's
      // posts and corrupt feedCacheRef for the wrong tab.
      if (feedModeRef.current !== requestFeedMode) {
        logger.debug(`Discarding stale ${requestFeedMode} response (current tab is ${feedModeRef.current})`);
        return;
      }

      setLoadError(null);
      setIsError(false);
      
      // Handle empty posts array gracefully (don't show error if API succeeded)
      if (!response.posts || response.posts.length === 0) {
        if (pageNum === 1 && !shouldAppend) {
          // First page with no posts - set empty array, don't show error
          setPosts([]);
          setHasMore(false);
          setPage(1);
          // Persist the empty/finished state into the per-tab cache so revisiting
          // this tab restores instantly with the empty state instead of refetching.
          feedCacheRef.current[requestFeedMode] = { posts: [], page: 1, hasMore: false };
          logger.debug('No posts returned (may be filtered or empty database)');
        } else {
          // Pagination with no more posts
          setHasMore(false);
          if (feedCacheRef.current[requestFeedMode]) {
            feedCacheRef.current[requestFeedMode].hasMore = false;
          }
        }
        return;
      }

      if (shouldAppend) {
        // Feed de-duplication: merge items by unique _id, never append duplicates
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p._id));
          const newPosts = response.posts.filter(p => !existingIds.has(p._id));
          const merged = mergeLikedIntoPosts([...prev, ...newPosts]);
          // Update in-memory cache for this tab (using captured request mode)
          feedCacheRef.current[requestFeedMode] = { posts: merged, page: pageNum, hasMore: true };
          return merged;
        });
      } else {
        const merged = mergeLikedIntoPosts(response.posts);
        setPosts(merged);
        feedCacheRef.current[requestFeedMode] = { posts: merged, page: pageNum, hasMore: true };
      }

      // If fewer posts returned than requested, we've reached the end regardless
      // of what the backend pagination says (e.g. friends feed with few posts).
      const receivedLessThanRequested = response.posts.length < postsPerPage;
      const newHasMore = receivedLessThanRequested ? false : (response.pagination?.hasNextPage ?? false);
      setHasMore(newHasMore);
      setPage(pageNum);
      // Sync hasMore into cache (using captured request mode)
      feedCacheRef.current[requestFeedMode].hasMore = newHasMore;
      feedCacheRef.current[requestFeedMode].page = pageNum;
      
      // Scroll to specific post if postId is provided in params
      if (params.postId && typeof params.postId === 'string' && response.posts.length > 0) {
        const targetIndex = response.posts.findIndex(p => p._id === params.postId);
        if (targetIndex !== -1) {
          // Use multiple attempts with increasing delays to ensure scroll works
          // This handles cases where FlatList isn't ready immediately
          const attemptScroll = (attempt: number = 0) => {
            if (attempt > 5) {
              logger.warn(`Failed to scroll to post ${params.postId} after 5 attempts`);
              return;
            }
            
            setTimeout(() => {
              if (flatListRef.current) {
                try {
                  flatListRef.current.scrollToIndex({ 
                    index: targetIndex, 
                    animated: true 
                  });
                  logger.debug(`Successfully scrolled to post at index ${targetIndex}`);
                } catch (error) {
                  // If scroll fails, retry with longer delay
                  logger.debug(`Scroll attempt ${attempt + 1} failed, retrying...`, error);
                  attemptScroll(attempt + 1);
                }
              } else {
                // FlatList not ready yet, retry
                attemptScroll(attempt + 1);
              }
            }, 100 * (attempt + 1)); // Increasing delay: 100ms, 200ms, 300ms, etc.
          };
          
          // Start scroll attempts
          attemptScroll();
        } else {
          logger.warn(`Post ${params.postId} not found in loaded posts`);
        }
      }
      
      // Cache posts for offline support (per-tab key)
      if (pageNum === 1 && !shouldAppend) {
        try {
          await AsyncStorage.setItem(`cachedPosts_${requestFeedMode}`, JSON.stringify({
            data: response.posts,
            timestamp: Date.now()
          }));
        } catch (error) {
          logger.error('Error caching posts', error);
        }
      }
      
      // Light background caching — don't interfere with Image component's network loads.
      // Visible posts are cached after display via cacheAfterDisplay() in PostImage.
      // FlashList drawDistance pre-mounts roughly the first 3 posts, so only pre-cache
      // posts BEYOND that window — duplicating fetches for posts already mounting was
      // saturating connections and breaking the first batch on cold start.
      if (response.posts.length > 6) {
        const preloadStart = 6;
        const preloadEnd = isWeb ? 10 : 9;
        const upcomingPosts = response.posts.slice(preloadStart, preloadEnd);
        setTimeout(() => {
          const urls = upcomingPosts
            .map((post) => post.imageUrl)
            .filter((u): u is string => !!u);
          if (urls.length > 0) {
            ExpoImage.prefetch(urls, { cachePolicy: 'memory-disk' });
          }
        }, 1500);
      }
    } catch (error: any) {
      const now = Date.now();
      const timeSinceLastError = now - lastErrorTimeRef.current;
      
      // Only log error if it's been more than 2 seconds since last error (prevent spam)
      if (timeSinceLastError > 2000) {
        errorCountRef.current = 0;
        logger.error('Failed to fetch posts', error);
      } else {
        errorCountRef.current++;
        // Only log every 10th error to prevent log spam
        if (errorCountRef.current % 10 === 0) {
          logger.error(`Failed to fetch posts (${errorCountRef.current} attempts)`, error);
        }
      }
      lastErrorTimeRef.current = now;
      
      // Only show error once per failure, not repeatedly
      const isNetworkError = !isOnline || 
        error?.message?.includes('Network') || 
        error?.code === 'ERR_NETWORK' ||
        error?.message === 'Network Error';
      
      // Load cached posts on network error (only for first page, not pagination).
      // Must use the per-tab key — falling back to a global 'cachedPosts' key would
      // mix recents data into friends/popular tabs after offline recovery.
      if (isNetworkError && pageNum === 1 && !shouldAppend) {
        try {
          const cachedData = await AsyncStorage.getItem(`cachedPosts_${requestFeedMode}`);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
              // Check if cache is not too old (24 hours)
              const cacheAge = Date.now() - (parsed.timestamp || 0);
              // 50 min — must stay under the 1h R2/S3 signed URL expiry so cached
              // posts never contain stale URLs that would render blank.
              if (cacheAge < 50 * 60 * 1000) {
                logger.debug('Loading cached posts due to network error');
                setPosts(mergeLikedIntoPosts(parsed.data));
                setHasMore(false); // Can't paginate with cached data
                setPage(1);
                setLoadError(null);
                return;
              }
            }
          }
        } catch (cacheError) {
          logger.warn('Failed to load cached posts', cacheError);
        }
        if (pageNum === 1 && !shouldAppend) {
          setLoadError('Network Error');
        }
      }
      
      if (pageNum === 1 && !shouldAppend) {
        setIsError(true);
      }
      // For pagination errors, silently fail - user can retry by scrolling
    } finally {
      isFetchingRef.current = false;
      // Clear request guards (release the per-tab lock with the same key we acquired)
      if (shouldAppend) {
        isPaginatingRef.current = false;
      } else {
        fetchingTabsRef.current.delete(requestFeedMode);
      }
      if (showSkeleton && feedModeRef.current === requestFeedMode) {
        setLoading(false);
      }
    }
  }, [isOnline, feedMode, mergeLikedIntoPosts, params.postId]);

  const fetchUnseenMessageCount = useCallback(async () => {
    // Prevent duplicate calls within 2 seconds
    const now = Date.now();
    if (isFetchingMessagesRef.current || (now - lastMessageFetchRef.current < 2000)) {
      return;
    }
    
    isFetchingMessagesRef.current = true;
    lastMessageFetchRef.current = now;
    
    try {
      const user = await getUserFromStorage();
      const myUserId = user?._id || '';
      
      if (!myUserId) {
        isFetchingMessagesRef.current = false;
        return;
      }
      
      const data = await listChats();
      const chats = data.chats || [];
      
      // Normalize myUserId for comparison
      const normalizedMyUserId = normalizeId(myUserId);
      if (!normalizedMyUserId) {
        logger.warn('Could not normalize myUserId for unread count calculation', { myUserId });
        isFetchingMessagesRef.current = false;
        return;
      }
      
      // Calculate total unseen messages
      let totalUnseen = 0;
      try {
        chats.forEach((chat: any, chatIndex: number) => {
          try {
            if (chat.messages && Array.isArray(chat.messages)) {
              // Handle participants - can be array of user objects or array of IDs
              // Also handle case where participants might be serialized as array-indexed objects
              let participants = chat.participants;

              // If participants looks like an array-indexed object (e.g., { '0': {...}, '1': {...} })
              if (participants && typeof participants === 'object' && !Array.isArray(participants)) {
                const keys = Object.keys(participants);
                if (keys.every(k => /^\d+$/.test(k))) {
                  // Convert to array
                  participants = keys.map(k => participants[k]);
                }
              }

              if (!Array.isArray(participants) || participants.length === 0) {
                return;
              }

              const isGroupChat = chat.type === 'connect_page';

              if (isGroupChat) {
                // Group chats: msg.seen only flips true once ALL participants
                // have read it, so it's not a per-viewer flag. Count messages
                // where I'm not the sender and I'm not in seenBy.
                const unseen = chat.messages.filter((msg: any) => {
                  try {
                    const senderId = normalizeId(msg.sender?._id || msg.sender);
                    if (!senderId || senderId === normalizedMyUserId) return false;
                    if (Array.isArray(msg.seenBy) && msg.seenBy.some((id: any) => normalizeId(id) === normalizedMyUserId)) {
                      return false;
                    }
                    return true;
                  } catch (e) {
                    return false;
                  }
                }).length;
                totalUnseen += unseen;
                return;
              }

              // 1:1 chat — find the other user and use msg.seen
              const otherUser = participants.find((p: any) => {
                try {
                  // Handle both populated participants (with _id) and direct IDs
                  const pId = normalizeId(p?._id || p);
                  return pId && pId !== normalizedMyUserId;
                } catch (e) {
                  // Skip this participant if normalization fails
                  return false;
                }
              });

              if (otherUser) {
                try {
                  const otherUserId = normalizeId(otherUser._id || otherUser);

                  if (otherUserId) {
                    const unseen = chat.messages.filter((msg: any) => {
                      try {
                        // Normalize sender ID - handle Buffer objects from backend
                        // Sender can be: string, ObjectId, or { _id: ObjectId }
                        const senderId = normalizeId(msg.sender?._id || msg.sender);

                        // Message is unseen if:
                        // 1. It's from the other user (not me)
                        // 2. It hasn't been seen
                        return senderId === otherUserId && !msg.seen;
                      } catch (e) {
                        // Skip this message if normalization fails
                        return false;
                      }
                    }).length;

                    totalUnseen += unseen;
                  }
                } catch (e) {
                  // Skip this chat if otherUserId normalization fails
                }
              }
            }
          } catch (e) {
            // Skip this chat if processing fails
          }
        });
      } catch (e) {
        // If entire loop fails, log but continue
        logger.warn('Error processing chats for unread count', { error: e });
      }
      
      setUnseenMessageCount(totalUnseen);
    } catch (error: any) {
      // Only log if it's not a network error or expected error
      if (error?.message && !error.message.includes('Failed to fetch') && !error.message.includes('Network')) {
        logger.error('fetchUnseenMessageCount', error);
      }
      // Silently fail - don't show error to user for message count
    } finally {
      isFetchingMessagesRef.current = false;
    }
  }, []);

  // Monitor network status using NetInfo
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false;
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Prevent multiple initializations
    if (hasInitializedRef.current) {
      return;
    }
    
    const loadInitialData = async () => {
      if (hasInitializedRef.current) return;
      hasInitializedRef.current = true;

      // Capture feed mode at load start. If the user switches tabs while we're
      // loading, this run is "stale" and must not setLoading(false) (the new run
      // owns that state) and must not write the wrong tab's AsyncStorage cache.
      const requestFeedMode = feedMode;

      try {
        // Load persisted liked post IDs first so mergeLikedIntoPosts is correct
        try {
          const raw = await AsyncStorage.getItem(LIKED_POSTS_STORAGE_KEY);
          const ids: string[] = raw ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : [];
          likedPostIdsRef.current = new Set(Array.isArray(ids) ? ids : []);
        } catch {
          // ignore
        }

        // Best-effort flush of pending like intents (handles app kill before request completes)
        flushPendingLikes({
          pendingStorageKey: PENDING_LIKES_STORAGE_KEY,
          likedIdsStorageKey: LIKED_POSTS_STORAGE_KEY,
          getPostById,
          toggleLike,
        }).catch(() => {
          // ignore
        });

        // Load current user first
        const user = await getUserFromStorage();
        setCurrentUser(user);

        // Try to load AsyncStorage-cached posts first for instant display.
        // Only honor if user is still on the tab we started loading for.
        try {
          const cachedData = await AsyncStorage.getItem(`cachedPosts_${requestFeedMode}`);
          if (cachedData && feedModeRef.current === requestFeedMode) {
            const parsed = JSON.parse(cachedData);
            if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
              const cacheAge = Date.now() - (parsed.timestamp || 0);
              // 50 min — must stay under the 1h R2/S3 signed URL expiry so cached
              // posts never contain stale URLs that would render blank.
              if (cacheAge < 50 * 60 * 1000) {
                logger.debug('Loading cached posts for instant display');
                setPosts(mergeLikedIntoPosts(parsed.data));
                setHasMore(false);
                setPage(1);
                setLoading(false);
              }
            }
          }
        } catch (cacheError) {
          logger.debug('No cached posts available or cache error', cacheError);
        }

        // Fetch unseen message count (non-blocking)
        fetchUnseenMessageCount().catch(err => {
          logger.debug('Failed to fetch message count (non-critical)', err);
        });

        // Try to load fresh posts (will update cache if successful)
        logger.debug('Loading fresh posts for', requestFeedMode);
        await fetchPosts(1, false);
      } catch (error) {
        logger.error('Error loading initial data', error);
        setIsError(true);
        hasInitializedRef.current = false; // Allow retry
      } finally {
        // Only clear the loader if this run is still the current tab's run.
        // Otherwise the next loadInitialData (started by handleFeedTabPress)
        // owns the loading state and will clear it when its own fetch lands.
        if (feedModeRef.current === requestFeedMode) {
          setLoading(false);
        }
      }
    };

    loadInitialData();
    
    // Track screen view
    trackScreenView('home');
  }, [feedMode]); // Re-run when feed mode changes

  // Sync state values to refs for access in focus effect cleanup without stale closures
  useEffect(() => {
    visibleIndexRef.current = visibleIndex;
  }, [visibleIndex]);

  useEffect(() => {
    visiblePostIdRef.current = visiblePostId;
  }, [visiblePostId]);

  // Navigation lifecycle safety: clear/restore visible index tracking, resume playback, background refresh
  useFocusEffect(
    useCallback(() => {
      // 1. Restore scroll position
      if (shouldRestoreHomeScrollRef.current && homeScrollOffsetRef.current > 0) {
        const offset = homeScrollOffsetRef.current;
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset, animated: false });
        });
        shouldRestoreHomeScrollRef.current = false;
      }

      // 2. Restore playback states
      if (savedVisibleIndexRef.current !== null) {
        setVisibleIndex(savedVisibleIndexRef.current);
      }
      if (savedVisiblePostIdRef.current !== null) {
        setVisiblePostId(savedVisiblePostIdRef.current);
      }

      // Lift any audio freeze
      audioManager.unfreeze();

      // CRITICAL: Re-assert global audio session mode on focus to prevent OS swallowing it.
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 0, // MIX_WITH_OTHERS
        interruptionModeAndroid: 1, // DO_NOT_MIX
      }).catch(err => {
        logger.error('Error setting audio mode for home:', err);
      });

      // 3. Background refresh data on focus
      if (hasInitializedRef.current && !isFetchingRef.current) {
        logger.debug('[Home] Screen focused: triggering background refresh of page 1');
        fetchPosts(1, false).catch((err) => {
          logger.error('[Home] Background refresh failed:', err);
        });
      }

      // 4. Refresh unseen count and setup periodic refresh
      fetchUnseenMessageCount();
      const interval = setInterval(() => {
        fetchUnseenMessageCount();
      }, 10000);

      return () => {
        clearInterval(interval);
        // Clear active view timer when leaving home page
        if (viewTimerRef.current) {
          clearTimeout(viewTimerRef.current);
          viewTimerRef.current = null;
        }
        // Save current visible index and post ID to restore on return
        savedVisibleIndexRef.current = visibleIndexRef.current;
        savedVisiblePostIdRef.current = visiblePostIdRef.current;
        shouldRestoreHomeScrollRef.current = true;
        setVisibleIndex(null);
        setVisiblePostId(null);
        hasScrolledRef.current = false;
        lastViewedPostIdRef.current = null;
        lastViewTimeRef.current = 0;
        logger.debug('[Home] Stopping all audio - leaving home page');
        audioManager.freeze(3000);
        audioManager.stopAll().catch((error) => {
          logger.error('[Home] Error stopping audio:', error);
        });
      };
    }, [fetchPosts, fetchUnseenMessageCount])
  );

  // Refresh feed when admin approves content or backend signals invalidation
  useEffect(() => {
    const unsub = savedEvents.addFeedInvalidateListener(() => {
      if (!isFetchingRef.current) {
        fetchPosts(1, false).catch(() => {});
      }
    });
    return unsub;
  }, [fetchPosts]);

  // Scroll to specific post when postId parameter is provided — only once when post first appears.
  // Prevents scroll jump when loading more (effect would re-run on append and scroll back to post).
  const hasScrolledToPostIdRef = useRef<string | null>(null);
  // dataIndex accounts for ad slots only when feed is showing ads (frequency control).
  useEffect(() => {
    if (!params.postId || typeof params.postId !== 'string' || posts.length === 0 || !flatListRef.current) {
      return;
    }
    if (hasScrolledToPostIdRef.current === params.postId) {
      return; // Already scrolled to this post (e.g. on initial load); do not scroll again on append.
    }
    const postIndex = posts.findIndex(p => p._id === params.postId);
    if (postIndex === -1) {
      logger.debug(`Post ${params.postId} not found in current posts`);
      return;
    }
    hasScrolledToPostIdRef.current = params.postId;
    const showAds = !isWeb && hasScrolledPastFifthPost && adsAllowedAfter30s;
    const dataIndex = showAds
      ? postIndex + Math.floor(postIndex / HOME_AD_EVERY_N_POSTS)
      : postIndex;
    const attemptScroll = (attempt: number = 0) => {
      if (attempt > 8) {
        logger.warn(`Failed to scroll to post ${params.postId} after 8 attempts`);
        return;
      }
      setTimeout(() => {
        if (flatListRef.current) {
          try {
            flatListRef.current.scrollToIndex({
              index: dataIndex,
              animated: attempt > 0,
              viewPosition: 0,
            });
            logger.debug(`Successfully scrolled to post at index ${dataIndex}`);
          } catch (error) {
            logger.debug(`Scroll attempt ${attempt + 1} failed, retrying...`, error);
            flatListRef.current?.scrollToOffset({
              offset: Math.max(0, dataIndex * 500),
              animated: false,
            });
            attemptScroll(attempt + 1);
          }
        } else {
          attemptScroll(attempt + 1);
        }
      }, 150 * (attempt + 1));
    };
    attemptScroll();
  }, [params.postId, posts, hasScrolledPastFifthPost, adsAllowedAfter30s]);

  // Subscribe to socket events for real-time unread count updates
  useEffect(() => {
    if (!isOnline) return;
    
    const onMessageNew = async (payload: any) => {
      logger.debug('Received message:new event on home page, updating unread count', payload);
      // Refresh count after a short delay to get accurate count
      setTimeout(() => {
        fetchUnseenMessageCount();
      }, 500);
    };
    
    const onMessageSeen = async (payload: any) => {
      logger.debug('Received message seen event, updating unread count', payload);
      // Refresh count after a short delay
      setTimeout(() => {
        fetchUnseenMessageCount();
      }, 500);
    };
    
    socketService.subscribe('message:new', onMessageNew);
    socketService.subscribe('seen', onMessageSeen);
    
    return () => {
      socketService.unsubscribe('message:new', onMessageNew);
      socketService.unsubscribe('seen', onMessageSeen);
    };
  }, [isOnline, fetchUnseenMessageCount]);

  const handleRefresh = useCallback(async () => {
    // Request guard: prevent refresh if a same-tab refresh or pagination is in flight.
    if (fetchingTabsRef.current.has(feedMode) || isPaginatingRef.current) {
      logger.debug('Refresh blocked: already in progress');
      setRefreshing(false);
      return;
    }
    
    // Allow scroll-to-post effect to run again after refresh if postId in URL
    hasScrolledToPostIdRef.current = null;
    
    // Trigger haptic feedback for better UX
    triggerRefreshHaptic();
    
    // Animated scroll to top for visual feedback (scrolls the old list).
    if (flatListRef.current && postsRef.current.length > 0) {
      try {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      } catch (error) {
        logger.debug('Error scrolling to top:', error);
      }
    }

    setRefreshing(true);
    try {
      await Promise.all([
        fetchPosts(1, false),
        fetchUnseenMessageCount()
      ]);

      // After the new posts have been applied to state, defer a final scroll-to-top
      // to the next frame so FlashList lands at offset 0 on the fresh data instead
      // of preserving its prior scroll offset.
      requestAnimationFrame(() => {
        try {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        } catch (error) {
          logger.debug('Error scrolling to top after refresh:', error);
        }
      });
    } finally {
      setRefreshing(false);
    }
  }, [fetchPosts, fetchUnseenMessageCount, feedMode, isOnline]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await handleRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [handleRefresh]);

  const handleFeedTabPress = useCallback((mode: FeedMode) => {
    if (mode === feedMode) return;

    // Save current tab's posts into cache before switching
    feedCacheRef.current[feedMode] = { posts, page, hasMore };

    // Restore cached posts for the new tab (instant, no image reload)
    const cached = feedCacheRef.current[mode];
    if (cached.posts.length > 0 || cached.hasMore === false) {
      // Have cache OR previously confirmed empty — restore instantly, no fetch.
      setPosts(cached.posts);
      setPage(cached.page);
      setHasMore(cached.hasMore);
      setLoading(false);
      hasInitializedRef.current = true;
    } else {
      // No cache yet for this tab — clear stale content from the previous tab
      // immediately so the user does NOT see e.g. recents posts under the
      // friends header, and show a loader until the fresh fetch lands.
      setPosts([]);
      setPage(1);
      setHasMore(true);
      setLoading(true);
      hasInitializedRef.current = false;
    }

    setFeedMode(mode);
    hasScrolledToPostIdRef.current = null;
    // Scroll-to-top is handled by the `key={feedMode}` prop on FlashList:
    // changing feedMode remounts the list, which guarantees offset 0 on the new tab.
    // FlashList v2's scrollToOffset is unreliable across data-swap re-renders.
  }, [feedMode, posts, page, hasMore]);

  // Throttle load more for web performance.
  // Pagination is blocked while a same-tab refresh is in flight (resetting to
  // page 1 mid-pagination would corrupt the list ordering).
  const handleLoadMore = useCallback(
    throttle(async () => {
      if (!loading && hasMore && !isPaginatingRef.current && !fetchingTabsRef.current.has(feedMode)) {
        await fetchPosts(page + 1, true);
      }
    }, 1000),
    [loading, hasMore, page, fetchPosts, feedMode]
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: mode === 'dark' ? '#000000' : '#FFFFFF',
      ...(isWeb && {
        maxWidth: isTablet ? 800 : 600,
        alignSelf: 'center',
        width: '100%',
      } as any),
    },
    safeArea: {
      flex: 1,
      ...(isWeb && {
        width: '100%',
      } as any),
    },
    topBarContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingTop: insets.top,
      zIndex: 1000,
      borderBottomWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(28, 115, 180, 0.15)',
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 10,
      elevation: 4,
      overflow: 'hidden',
      paddingBottom: 6,
      ...(isWeb && {
        maxWidth: isTablet ? 800 : 600,
        alignSelf: 'center',
        width: '100%',
      } as any),
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
      backgroundColor: theme.colors.background,
    },
    emptyImageContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.xl,
      padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      alignItems: 'center',
    },
    emptyImage: {
      width: isTablet ? 160 : 120,
      height: isTablet ? 160 : 120,
      borderRadius: theme.borderRadius.lg,
      opacity: 0.8,
    },
    emptyTitle: {
      fontSize: isTablet ? theme.typography.h1.fontSize : theme.typography.h2.fontSize,
      fontFamily: getFontFamily('600'),
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
      letterSpacing: isIOS ? -0.3 : 0,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    emptyDescription: {
      fontSize: isTablet ? theme.typography.body.fontSize + 2 : theme.typography.body.fontSize,
      fontFamily: getFontFamily('400'),
      color: theme.colors.textPassive,
      textAlign: 'center',
      lineHeight: isTablet ? 26 : 22,
      maxWidth: isTablet ? 400 : 280,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    postsContainer: {
      flex: 1,
    },
    feedClip: {
      flex: 1,
      position: 'relative',
    },
  feedTabsContainer: {
    marginHorizontal: isTablet ? theme.spacing.lg : theme.spacing.md,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
    postsList: {
      paddingHorizontal: 0,
      // Add padding for tab bar (88px mobile, 70px web) + extra spacing
      paddingBottom: isWeb ? 90 : (isTablet ? 110 : 100),
    },
    loadMoreContainer: {
      padding: isTablet ? theme.spacing.lg : theme.spacing.md,
      alignItems: 'center',
    },
    emptyLoadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 380,
    },
    offlineBanner: {
      backgroundColor: theme.colors.error + '20',
      padding: isTablet ? theme.spacing.md : theme.spacing.sm,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.error,
    },
    offlineText: {
      color: theme.colors.error,
      fontSize: isTablet ? theme.typography.body.fontSize : theme.typography.small.fontSize,
      fontFamily: getFontFamily('600'),
      fontWeight: '600',
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
  });

  // Interleave native ad slots through the shared ad/view engine.
  // This honors the 30s/1s startup window, ignored bootstrap views, and global 5-per-8h cap.
  const feedData = useMemo((): FeedItem[] => {
    if (isWeb || posts.length === 0) return posts as FeedItem[];
    const showAds = hasScrolledPastFifthPost && adsAllowedAfter30s && !adCap.isCapped;
    if (!showAds) return posts as FeedItem[];
    const rawFeed = injectHomeFeedAds(posts, {
      isCapped: adCap.isCapped,
      count: adCap.count,
      remainingSlots: adCap.remainingSlots,
    }) as FeedItem[];
    return rawFeed.filter(item => {
      if (isAdItem(item)) {
        return !failedAdIndices.includes(item.adIndex);
      }
      return true;
    });
  }, [posts, hasScrolledPastFifthPost, adsAllowedAfter30s, adCap, failedAdIndices]);

  const renderTopHeader = () => (
    <AnimatedHeader
      unseenMessageCount={unseenMessageCount}
      onRefresh={handleRefresh}
      disableSafeArea={true}
    />
  );

  const renderFeedTabs = () => (
    <CloudSegmentedControl
      style={styles.feedTabsContainer}
      segments={feedTabs.map((tab) => ({ key: tab.id, label: tab.label }))}
      value={feedMode}
      onChange={(id) => handleFeedTabPress(id as FeedMode)}
    />
  );

  // Memoize keyExtractor and renderItem at top level (before conditional returns)
  // MUST be defined before conditional returns to follow Rules of Hooks
  const keyExtractor = useCallback((item: FeedItem) => {
    if (isAdItem(item)) return `ad-${item.adIndex}`;
    return item._id?.toString() || '';
  }, []);
  
  // Track viewable items for conditional image rendering and analytics
  // Frequency control: allow ads only after user has scrolled past 5th item (set once).
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      // Find the most visible non-ad post
      let bestItemToken = null;
      let maxPercent = -1;

      for (const token of viewableItems) {
        const item = token.item;
        if (item && !isAdItem(item)) {
          const percent = token.percentVisible ?? 0;
          if (percent > maxPercent) {
            maxPercent = percent;
            bestItemToken = token;
          }
        }
      }

      // If we found a valid non-ad post, use it
      if (bestItemToken) {
        const item = bestItemToken.item as PostType;
        const newVisibleIndex = bestItemToken.index;

        if (newVisibleIndex !== null && newVisibleIndex !== undefined) {
          setVisibleIndex(newVisibleIndex);
          if (!hasScrolledRef.current && newVisibleIndex > 0) {
            hasScrolledRef.current = true;
          }
          const threshold = __DEV__ ? 1 : 5;
          if (!hasSetScrollThresholdRef.current && newVisibleIndex >= threshold) {
            hasSetScrollThresholdRef.current = true;
            setHasScrolledPastFifthPost(true);
          }
          
          const postId = item._id;
          setVisiblePostId(postId);
          
          // Clear any active timer for a previous post
          if (viewTimerRef.current) {
            clearTimeout(viewTimerRef.current);
            viewTimerRef.current = null;
          }

          // Start a 1-second timer. User must stay on this post for 1s to count as a view.
          viewTimerRef.current = setTimeout(async () => {
            if (currentUser?._id && item.user?._id === currentUser._id) {
              viewTimerRef.current = null;
              return;
            }
            const result = await logContentView(postId, 'post', { type: 'photo', source: 'home_feed' });
            if (result.incremented) {
              const existing = postsRef.current.find(post => post._id === postId);
              const emittedViewsCount = existing
                ? (((existing as any).viewsCount ?? (existing as any).views ?? 0) + 1)
                : null;
              setPosts(prev => prev.map(post => {
                if (post._id !== postId) return post;
                const nextViews = emittedViewsCount ?? (((post as any).viewsCount ?? (post as any).views ?? 0) + 1);
                return { ...post, viewsCount: nextViews, views: nextViews } as any;
              }));
              if (emittedViewsCount !== null) {
                realtimePostsService.emitLocalView(postId, emittedViewsCount, currentUser?._id);
              }
            }
            viewTimerRef.current = null;
          }, POST_VIEW_DWELL_MS);
        }
      } else {
        // No non-ad post is viewable/visible (e.g. only ads on screen)
        // Set visibleIndex to the first item's index if it exists, for tracking/ads threshold
        const firstToken = viewableItems[0];
        if (firstToken && firstToken.index !== null && firstToken.index !== undefined) {
          setVisibleIndex(firstToken.index);
          const threshold = __DEV__ ? 1 : 5;
          if (!hasSetScrollThresholdRef.current && firstToken.index >= threshold) {
            hasSetScrollThresholdRef.current = true;
            setHasScrolledPastFifthPost(true);
          }
        }
        
        // Clear any active timer if visible item is an ad or empty
        if (viewTimerRef.current) {
          clearTimeout(viewTimerRef.current);
          viewTimerRef.current = null;
        }
        setVisiblePostId(null);
      }
    } else {
      // Clear timer if no viewable items
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
      setVisiblePostId(null);
    }
  }, [currentUser?._id, setPosts]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50, // Item is considered visible when 50% is on screen
    minimumViewTime: 200, // Minimum time item must be visible (ms)
  }).current;

  visiblePostIdRef.current = visiblePostId;

  const renderItem = useCallback(({ item, index }: { item: FeedItem; index: number }) => {
    return (
      <FeedListItem
        item={item}
        isCurrentlyVisible={!isAdItem(item) && visiblePostIdRef.current === item._id}
        onRefresh={handleRefresh}
        onAdLoadFailed={handleAdLoadFailed}
      />
    );
  }, [handleRefresh, handleAdLoadFailed]);

  const screenGradientColors =
    mode === 'dark'
      ? (['#000000', '#000000', '#000000'] as const)
      : (theme.colors.screenGradient as [string, string, ...string[]]);
  const screenGradientLocs = matchGradientLocations(
    screenGradientColors.length,
    mode === 'dark' ? [0, 0.22, 1] : [0, 0.22, 0.55, 1],
  );

  const screenBg = (
    <>
      <CloudSkyBackground heightRatio={0.28} />
      <LinearGradient
        colors={screenGradientColors}
        style={StyleSheet.absoluteFillObject}
        locations={screenGradientLocs}
      />
    </>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {screenBg}
        <View style={styles.safeArea}>
          <StatusBar
            barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
            backgroundColor="transparent"
            translucent
          />
          <View style={[styles.topBarContainer, { position: 'relative' }]}>
            <BlurView
              intensity={95}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFillObject}
            />
            {renderTopHeader()}
            {renderFeedTabs()}
          </View>
          <ScrollView
            style={styles.postsContainer}
            contentContainerStyle={{
              paddingTop: 10,
              paddingBottom: bottomBarHeight + 20,
            }}
            showsVerticalScrollIndicator={false}
          >
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
          </ScrollView>
        </View>
      </View>
    );
  }


  return (
    <ErrorBoundary level="route">
    <View style={styles.container}>
      {screenBg}
      <StatusBar 
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent"
        translucent
      />
      <View style={styles.safeArea}>
        {/* Scrollable feed container (zIndex: 1) */}
        <View style={[styles.feedClip, { zIndex: 1 }]}>
          <View style={StyleSheet.absoluteFillObject}>
            <AnyFlashList
              ref={flatListRef}
              data={feedData}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              extraData={visiblePostId}
              estimatedItemSize={580}
              style={styles.postsContainer}
              contentContainerStyle={[
                styles.postsList,
                {
                  paddingTop: headerHeight,
                  paddingBottom: bottomBarHeight + 20,
                }
              ]}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => {
                if (e.target !== e.currentTarget) return;
                homeScrollOffsetRef.current = e.nativeEvent.contentOffset.y;
                handleScroll(e);
              }}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.secondary}
                  colors={[theme.colors.secondary]}
                  progressBackgroundColor={theme.colors.surface}
                  progressViewOffset={headerHeight}
                />
              }
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.1}
              ListHeaderComponent={
                <View>
                  {!isOnline && (
                    <View style={styles.offlineBanner}>
                      <Text style={styles.offlineText}>
                        You're offline. Some features may be limited.
                      </Text>
                    </View>
                  )}
                  {isError && isOnline && (
                    <View style={styles.offlineBanner}>
                      <Text style={styles.offlineText}>
                        Failed to update feed. Showing cached content.
                      </Text>
                    </View>
                  )}
                </View>
              }
              ListEmptyComponent={
                (loading || refreshing) ? (
                  <View style={styles.emptyLoadingContainer}>
                    <LoadingGlobe color={theme.colors.primary} size="large" />
                  </View>
                ) : null
              }
              ListFooterComponent={
                hasMore && posts.length > 0 ? (
                  <View style={[styles.loadMoreContainer, { minHeight: 56 }]}>
                    <LoadingGlobe color={theme.colors.primary} />
                  </View>
                ) : posts.length > 0 ? (
                  <View style={[styles.loadMoreContainer, { minHeight: 56 }]}>
                    <Text style={{
                      color: theme.colors.textPassive,
                      fontSize: theme.typography.small.fontSize,
                    }}>
                      You're all caught up!
                    </Text>
                  </View>
                ) : null
              }
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              drawDistance={screenHeight}
            />
          </View>
          <ScrollEdgeFades isDark={isDark} variant="vertical" hideTop={true} />
        </View>

        {/* Absolute Top Bar (zIndex: 1000) */}
        <View
          style={styles.topBarContainer}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          <BlurView
            intensity={95}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
          />
          {renderTopHeader()}
          {renderFeedTabs()}
        </View>
      </View>
    </View>
    </ErrorBoundary>
  );
}
