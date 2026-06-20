import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Image,
  ImageStyle,
  Alert,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
  Animated,
  AppState,
  AppStateStatus,
  BackHandler,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Easing,
  InteractionManager,
} from 'react-native';
import { FlashList, FlashListRef } from '@shopify/flash-list';

const AnyFlashList = FlashList as any;
import LoadingGlobe from '../../components/LoadingGlobe';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode, AVPlaybackStatus, Audio } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useTheme } from '../../context/ThemeContext';
import { getShorts, getUserShorts, toggleLike, addComment, getPostById, deleteShort } from '../../services/posts';
import { toggleFollow, getProfile } from '../../services/profile';
import { PostType } from '../../types/post';
import { getUserFromStorage } from '../../services/auth';
import { useRouter, useFocusEffect, useLocalSearchParams, useSegments } from 'expo-router';
import { useAlert } from '../../context/AlertContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PostComments from '../../components/post/PostComments';
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';
import { trackScreenView, trackEngagement } from '../../services/analytics';
import SongPlayer from '../../components/SongPlayer';
import { GlassModal } from '../../components/ui/GlassModal';
import { theme } from '../../constants/theme';
import { audioManager } from '../../utils/audioManager';
import PostLocation from '../../components/post/PostLocation';
import { geocodeAddress } from '../../utils/locationUtils';
import { socketService } from '../../services/socket';
import ShareModal from '../../components/ShareModal';
import { ErrorBoundary } from '../../utils/errorBoundary';
import { ShortsNativeAd } from '../../components/ads/ShortsNativeAd';
import { useAdCap, recordGoogleAdImpression, logContentView } from '../../services/adCap';
import { realtimePostsService } from '../../services/realtimePosts';
import Constants from 'expo-constants';
import { savedEvents, normalizeId } from '../../utils/savedEvents';
import { triggerHaptic } from '../../utils/hapticFeedback';
import { shortsEvents } from '../../utils/shortsEvents';
import { preloadVideoAsync, getLocalVideoUri, removeCachedVideo, getLocalVideoUriSync, addCacheListener } from '../../src/utils/videoCache';

/** Shorts list item: either a reel (PostType) or a full-screen native ad slot. */
export type ShortsItem = PostType | { type: 'ad'; adIndex: number };

function isAdItem(item: ShortsItem): item is { type: 'ad'; adIndex: number } {
  return 'type' in item && item.type === 'ad';
}

const SHORTS_ADS_AFTER_EVERY = 5;
const MAX_SHORTS_ADS = 3;
const SHORTS_ADS_SESSION_DELAY_MS = 20000;
const SHORT_VIEW_DWELL_MS = 2500;

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';
// Expo Go can't load the react-native-google-mobile-ads native module —
// ShortsNativeAd would mount, fail synchronously in its first effect, and
// the parent slot would render a SHORTS_ITEM_HEIGHT-tall black void at
// position 6 before onLoadFailed could propagate. Skip ad insertion entirely
// in this environment so dev builds in Expo Go don't show the blank slot.
const isExpoGo = (Constants as any)?.appOwnership === 'expo';
const logger = createLogger('ShortsScreen');

// Tab bar height from (tabs)/_layout - content must sit above it
const TAB_BAR_HEIGHT = isWeb ? 70 : 88;
const SHORTS_ITEM_HEIGHT = SCREEN_HEIGHT;

const getScaledVideoDimensions = (width: number, height: number) => {
  const targetRatio = 9 / 16;
  const currentRatio = width / height;
  
  if (currentRatio > targetRatio) {
    // The container is wider than 9:16 (e.g. tablet)
    // Fit to height, scale width
    const videoHeight = height;
    const videoWidth = height * targetRatio;
    return { width: videoWidth, height: videoHeight };
  } else {
    // The container is taller/narrower than 9:16 (e.g. standard phone)
    // Fit to width, scale height
    const videoWidth = width;
    const videoHeight = width / targetRatio;
    return { width: videoWidth, height: videoHeight };
  }
};

const LIKED_SHORTS_STORAGE_KEY = 'taatom_shorts_liked_ids';

// Type for particle animation values
type ParticleAnimations = {
  [particleId: string]: {
    scale: Animated.Value;
    opacity: Animated.Value;
    translateY: Animated.Value;
    translateX: Animated.Value;
  };
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

/**
 * ShortsScreen - Vertical video feed with auto-play and swipe navigation
 * 
 * Performance optimizations:
 * - Only one video plays at a time (prevents memory leaks)
 * - Videos pause on screen blur / app background
 * - FlatList virtualization for smooth scrolling
 * - Video cleanup for off-screen items
 * 
 * Known limitations:
 * - Privacy settings do NOT currently apply to Shorts (all shorts are public)
 * - Saved shorts are local-only (not synced to backend)
 * 
 * @component
 */

function normalizeSearchParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export type ShortsScreenProps = {
  /** When embedded from `/user-shorts/[userId]` — load this user's shorts (params may not reach hooks reliably). */
  scopedUserId?: string;
  initialShortId?: string;
  initialIndex?: number;
  isSavedShorts?: boolean;
  isMuted?: boolean;
  onMuteToggle?: () => void;
};

const videoSourceCache = new Map<string, { uri: string; overrideFileExtensionAndroid?: string }>();

// Global cache for shorts feed to persist across screen mounts/unmounts
let globalCachedShorts: PostType[] = [];
let globalCachedPage = 1;
let globalCachedCursor: string | null = null;
let globalCachedHasMore = true;
let globalCachedFollowStates: Record<string, boolean> = {};

const getVideoSource = (uri: string | null | undefined) => {
  if (!uri) return undefined;
  if (!videoSourceCache.has(uri)) {
    const lowercaseUrl = uri.toLowerCase();
    const ext = (lowercaseUrl.includes('m3u8') || lowercaseUrl.includes('hls')) ? 'm3u8' : 'mp4';
    videoSourceCache.set(uri, { uri, overrideFileExtensionAndroid: ext });
  }
  return videoSourceCache.get(uri);
};

import { MarqueeText } from './_shorts_split/MarqueeText';
import { CyclingMetadata } from './_shorts_split/CyclingMetadata';
import { ShortsCell, emitLikeRailState } from './_shorts_split/ShortsCellFeed';
// Module-level global mute state for shorts feed to persist across mounts/unmounts
let globalIsFeedMuted = false;

export default function ShortsScreen(props: ShortsScreenProps = {}) {
  const params = useLocalSearchParams();
  const initialIndex = props.initialIndex ?? (params.index ? parseInt(params.index as string, 10) : 0);

  const effectiveUserId =
    props.scopedUserId ?? normalizeSearchParam(params.userId as string | string[] | undefined);
  const effectiveShortId =
    props.initialShortId ?? normalizeSearchParam(params.shortId as string | string[] | undefined);
  const isGeneralFeed = !props.isSavedShorts && !effectiveUserId && !effectiveShortId;

  const [shorts, setRawShorts] = useState<PostType[]>(() => {
    return isGeneralFeed ? globalCachedShorts : [];
  });
  const setShorts = useCallback((value: React.SetStateAction<PostType[]>) => {
    setRawShorts((prev) => {
      const resolved = typeof value === 'function' ? (value as any)(prev) : value;
      return savedEvents.filterDeleted(resolved);
    });
  }, []);
  const [loading, setLoading] = useState(() => {
    return isGeneralFeed ? globalCachedShorts.length === 0 : true;
  });
  const [isTransitionFinished, setIsTransitionFinished] = useState(false);

  useEffect(() => {
    // Defer rendering of heavy components (FlatList, Video) until navigation transition completes
    const interactionPromise = InteractionManager.runAfterInteractions(() => {
      setIsTransitionFinished(true);
    });

    const fallbackTimer = setTimeout(() => {
      setIsTransitionFinished(true);
    }, 500);

    return () => {
      interactionPromise.cancel();
      clearTimeout(fallbackTimer);
    };
  }, []);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  // Track visible index precisely using onViewableItemsChanged
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(initialIndex);

  const targetInitialIndexRef = useRef<number>(initialIndex);
  const isInitialScrollDoneRef = useRef(initialIndex === 0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const isScreenFocusedRef = useRef(true);
  const [appState, setAppState] = useState(AppState.currentState);
  const [containerHeight, setContainerHeight] = useState(SCREEN_HEIGHT - TAB_BAR_HEIGHT);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [savedShorts, setSavedShorts] = useState<Set<string>>(new Set());
  const [isFeedMuted, setIsFeedMuted] = useState(() => {
    const currentSessionMuted = audioManager.getSessionMuted();
    if (currentSessionMuted !== globalIsFeedMuted) {
      globalIsFeedMuted = currentSessionMuted;
    }
    return globalIsFeedMuted;
  });

  useEffect(() => {
    const unsubscribeDelete = savedEvents.addPostActionListener((postId, action) => {
      if (action === 'delete') {
        const normDeletedId = normalizeId(postId);
        setShorts(prev => prev.filter(s => normalizeId(s._id) !== normDeletedId));
      }
    });
    return () => {
      unsubscribeDelete();
    };
  }, []);

  useEffect(() => {
    const unsub = audioManager.addSessionMuteListener((muted) => {
      setIsFeedMuted(muted);
      globalIsFeedMuted = muted;
    });
    return unsub;
  }, []);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedShortId, setSelectedShortId] = useState<string | null>(null);
  const [selectedShortComments, setSelectedShortComments] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedShortForShare, setSelectedShortForShare] = useState<PostType | null>(null);
  const [followStates, setFollowStates] = useState<{ [key: string]: boolean }>(() => {
    return isGeneralFeed ? globalCachedFollowStates : {};
  });
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const isSwipeActiveRef = useRef(false);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [videoQuality, setVideoQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [localVideoUris, setLocalVideoUris] = useState<Record<string, string>>({});
  const [checkedVideoCacheIds, setCheckedVideoCacheIds] = useState<Set<string>>(new Set());
  const [activeVideoPrepared, setActiveVideoPrepared] = useState(false);
  const activeStartedWithRemoteRef = useRef<Record<string, boolean>>({});
  const currentVisibleIndexRef = useRef<number>(initialIndex);
  const shortsDataRef = useRef<ShortsItem[]>([]);

  useEffect(() => {
    currentVisibleIndexRef.current = currentVisibleIndex;
  }, [currentVisibleIndex]);

  useEffect(() => {
    if (isGeneralFeed && globalCachedShorts.length > 0) {
      const firstShorts = globalCachedShorts.slice(0, 3);
      const initialUris: Record<string, string> = {};
      
      firstShorts.forEach((item: any) => {
        const localUri = getLocalVideoUriSync(item._id);
        if (localUri) {
          initialUris[item._id] = localUri;
        }
      });

      setLocalVideoUris((prev) => ({ ...prev, ...initialUris }));
      setCheckedVideoCacheIds((prev) => {
        const next = new Set(prev);
        firstShorts.forEach((s) => next.add(s._id));
        return next;
      });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = addCacheListener((videoId, localUri) => {
      setLocalVideoUris((prev) => {
        if (prev[videoId] === localUri) return prev;
        return { ...prev, [videoId]: localUri };
      });
      setCheckedVideoCacheIds((prev) => {
        if (prev.has(videoId)) return prev;
        const next = new Set(prev);
        next.add(videoId);
        return next;
      });
    });
    return unsubscribe;
  }, []);



  useEffect(() => {
    const unsubscribeViews = realtimePostsService.subscribeToViews(({ postId, viewsCount }) => {
      setShorts(prev => prev.map(short => (
        short._id === postId
          ? { ...short, viewsCount, views: viewsCount } as any
          : short
      )));
    });

    const unsubscribeLikes = realtimePostsService.subscribeToLikes(({ postId, isLiked, likesCount }) => {
      // Find if we have the short in the state array
      const currentShort = shortsRef.current.find(s => s && s._id === postId);
      if (currentShort) {
        // Prevent processing if it's already in the same state
        const currentIsLiked = likedShortIdsRef.current.has(postId);
        if (currentIsLiked === isLiked && currentShort.likesCount === likesCount) {
          return;
        }

        // Sync with local liked ids Set
        const finalSet = new Set(likedShortIdsRef.current);
        if (isLiked) {
          finalSet.add(postId);
        } else {
          finalSet.delete(postId);
        }
        likedShortIdsRef.current = finalSet;
        AsyncStorage.setItem(LIKED_SHORTS_STORAGE_KEY, JSON.stringify([...finalSet])).catch(() => {});

        // Emit changes to ActionRail
        emitLikeRailState(postId, isLiked);

        // Update state array
        setShorts(prev => prev.map(short => (
          short._id === postId
            ? { ...short, isLiked, likesCount } as any
            : short
        )));
      }
    });

    return () => {
      unsubscribeViews();
      unsubscribeLikes();
    };
  }, []);

  // Throttle for the defensive mute-enforcement inside onPlaybackStatusUpdate
  // (status callbacks fire ~5x/sec per video; firing setIsMutedAsync each time
  // is bridge churn that has been correlated with native crashes on Android).

  // Hard cap: track ads shown this session
  const adsShownThisSessionRef = useRef(0);
  const [adsShownThisSession, setAdsShownThisSession] = useState(0);
  // Persistent 5-per-8h Google AdMob cap, shared with the home feed. The
  // existing per-session counter above stays in place as defense-in-depth;
  // the persistent cap is the authoritative limit across app restarts.
  const adCap = useAdCap();
  // When an ad slot can't render (Expo Go, no AdMob fill, network error,
  // placeholder unit ID, …), ShortsNativeAd returns null but its parent
  // wrapper still occupies a SHORTS_ITEM_HEIGHT-tall cell with the black
  // shortItem background — the user sees a blank dark screen at that
  // position. ShortsNativeAd's onLoadFailed callback flips this flag, and
  // shortsData below excludes ad slots once it's true. Session-scoped: a
  // single failure stops further ad insertion until next app launch (per
  // CLAUDE.md "stability first" — better to lose ads than show black slots).
  const [shortsAdsBroken, setShortsAdsBroken] = useState(false);
  const [failedAdIndices, setFailedAdIndices] = useState<number[]>([]);
  const consecutiveAdFailuresRef = useRef(0);

  const flatListRef = useRef<FlashListRef<ShortsItem>>(null);
  const videoRefs = useRef<{ [key: string]: Video | null }>({});
  // Two timeout namespaces. Previously a single `pauseTimeoutRefs[id]` slot was
  // shared by the pause-button hide timer AND the like-animation hide timer,
  // so a tap-then-like (or vice versa) on the same cell within 1.5s overwrote
  // the slot and orphaned the first timer. Splitting them prevents stale
  // callbacks from setting state on stale data.
  const likeDebounceRefs = useRef<Record<string, { timer: NodeJS.Timeout; targetState: boolean; originalState: boolean; originalLikesCount: number }>>({});
  const swipeAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;
  // Track currently active video to ensure only one plays at a time
  const activeVideoIdRef = useRef<string | null>(null);
  const userPausedShortIdsRef = useRef<Set<string>>(new Set());
  // Track current audio player (Sound from SongPlayer) so we can pause when tab/focus/scroll/background
  const currentPlayerRef = useRef<Audio.Sound | null>(null);
  // Callbacks map to track position/duration of playing videos and update progress bars efficiently
  const progressCallbacks = useRef<Record<string, (position: number, duration: number) => void>>({});
  // Track each video's last known position to detect native loop restarts
  const lastVideoPositionRef = useRef<Record<string, number>>({});
  // Mirror of `shorts` state for stable callbacks (handleSongPlayingChange) that
  // need current item data without being re-memoed on every list change.
  const shortsRef = useRef<PostType[]>([]);
  shortsRef.current = shorts;
  // Track last viewed short ID for analytics de-duplication
  const lastViewedShortIdRef = useRef<string | null>(null);
  const viewTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Guard to prevent duplicate navigation on rapid swipes
  const isNavigatingRef = useRef<boolean>(false);
  const lastNavigationUserIdRef = useRef<string | null>(null);
  // When we blur with userId in params (e.g. tab switch), clear params on next focus so Shorts shows all users
  const shouldClearParamsOnNextFocusRef = useRef<boolean>(false);
  const lastViewTimeRef = useRef<number>(0);
  const VIEW_DEBOUNCE_MS = SHORT_VIEW_DWELL_MS; // Prevent duplicate view events within 1 second
  // Ref to store loadShorts function for socket handlers (prevents stale closure)
  const loadShortsRef = useRef<(() => Promise<void>) | null>(null);
  const currentPageRef = useRef(isGeneralFeed ? globalCachedPage : 1);
  const cursorRef = useRef<string | null>(isGeneralFeed ? globalCachedCursor : null);
  const hasMoreRef = useRef(isGeneralFeed ? globalCachedHasMore : true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Persisted liked short IDs so likes survive app restart (server is source of truth; this merges when API omits isLiked)
  const likedShortIdsRef = useRef<Set<string>>(new Set());
  // Refs for handlers to avoid recreating renderItem on every handler change
  const handlersRef = useRef({
    handleTouchStart: null as any,
    handleTouchMove: null as any,
    handleTouchEnd: null as any,
    handleTouchCancel: null as any,
    handleDeleteShort: null as any,
    handleProfilePress: null as any,
    handleLike: null as any,
    handleComment: null as any,
    handleShare: null as any,
    handleSave: null as any,
    getVideoUrl: null as any,
    refetchShortWithFreshUrl: null as any,
    removeLocalVideoUri: null as any,
    handleSongPlayingChange: null as any,
    onVideoReady: null as any,
  });
  
  const { theme, mode } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  const lastEffectiveUserIdRef = useRef<string | undefined>(effectiveUserId);

  const isOnTabShorts = segments.includes('(tabs)') && segments.includes('shorts');
  const isUserShortsStack = segments.includes('user-shorts');
  const isSavedShortsStack = segments.includes('saved-shorts');
  const shortsPlaybackSurfaceActive = isOnTabShorts || isUserShortsStack || isSavedShortsStack;
  const { showSuccess, showError, showInfo, showWarning, showConfirm } = useAlert();
  const { handleScroll } = useScrollToHideNav();

  // ============================================
  // CENTRALIZED VIDEO CONTROL HELPERS
  // ============================================
  // These helpers prevent race conditions and ensure consistent video lifecycle management
  // All lifecycle events (scroll, back, blur, app background) must use these helpers
  // Defined early so they can be used in useEffect/useFocusEffect hooks

  /**
   * Pause the currently active video
   * Used when screen loses focus, app backgrounds, or user navigates away
   */
  const pauseCurrentVideo = useCallback(async () => {
    if (activeVideoIdRef.current) {
      const video = videoRefs.current[activeVideoIdRef.current];
      if (video) {
        try {
          await video.pauseAsync();
          logger.debug(`Paused current video: ${activeVideoIdRef.current}`);
        } catch (error) {
          logger.warn(`Error pausing current video:`, error);
        }
      }
      activeVideoIdRef.current = null;
    }
  }, []);

  /**
   * Stable callback for SongPlayer's onPlayingChange.
   * MUST be memoized — if this is an inline function, SongPlayer's effect fires
   * on every render and interrupts sound loading mid-flight.
   *
   * When audio first becomes active (after its load latency), the video has
   * usually already been playing for 200-500 ms. Seek the audio to match the
   * current video position so they start aligned instead of audio permanently
   * trailing the visual.
   */
  const handleSongPlayingChange = useCallback((s: Audio.Sound | null) => {
    currentPlayerRef.current = s;
    if (!s) return;
    const activeId = activeVideoIdRef.current;
    if (!activeId) return;
    const video = videoRefs.current[activeId];
    if (!video) return;
    const activeItem = shortsRef.current?.find((it: any) => it && !isAdItem(it) && it._id === activeId) as PostType | undefined;
    if (!activeItem || !(activeItem.song?.songId?._id || activeItem.song?.songId)) return;
    const startSec = activeItem.song?.startTime || 0;
    const endSec = activeItem.song?.endTime;
    const segmentMs = endSec && endSec > startSec ? (endSec - startSec) * 1000 : 60000;
    video.getStatusAsync().then((status: any) => {
      if (!status?.isLoaded || typeof status.positionMillis !== 'number') return;
      const audioOffsetMs = status.positionMillis % segmentMs;
      s.setPositionAsync(startSec * 1000 + audioOffsetMs).catch(() => {});
    }).catch(() => {});
  }, []);

  /**
   * Pause current audio (Shorts song) when tab/focus/scroll/background.
   * Uses currentPlayerRef (set by SongPlayer via onPlayingChange) and audioManager.
   */
  const pauseCurrentAudio = useCallback(() => {
    const player = currentPlayerRef.current;
    currentPlayerRef.current = null;
    if (player) {
      player.getStatusAsync()
        .then((status) => {
          if (status.isLoaded && status.isPlaying) {
            return player.pauseAsync();
          }
        })
        .catch(() => {
          // Sound already unloaded or pausing failed — safe to ignore
        });
    }
    audioManager.stopAll().catch(() => {});
  }, []);

  /**
   * Stop and unload a specific video, fully releasing its resources
   * Used when video is far from viewport to prevent memory leaks
   */
  const stopAndUnloadVideo = useCallback(async (videoId: string) => {
    const video = videoRefs.current[videoId];
    if (!video) {
      return;
    }

    try {
      // Check if video is still valid before operations
      const status = await video.getStatusAsync();
      
      // Stop playback first if video is loaded
      if (status.isLoaded) {
        try {
          await video.pauseAsync();
        } catch (pauseError) {
          logger.debug(`Video ${videoId} already paused or pause failed:`, pauseError);
        }
      }

      // Then unload to release GPU/memory resources
      // Check if unloadAsync exists and video is still loaded
      if (status.isLoaded && typeof video.unloadAsync === 'function') {
        try {
          await video.unloadAsync();
        } catch (unloadError) {
          // Video might already be unloaded, this is okay
          logger.debug(`Video ${videoId} unload failed (may already be unloaded):`, unloadError);
        }
      }

      // Remove from refs
      delete videoRefs.current[videoId];

      logger.debug(`Stopped and unloaded video: ${videoId}`);
    } catch (error) {
      // Safely handle and log errors
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : 'Unknown video cleanup error';

      logger.warn(`Error stopping/unloading video ${videoId}:`, errorMessage);

      // Still remove from refs even if cleanup fails to prevent memory leaks
      delete videoRefs.current[videoId];
    }
  }, []);

  useEffect(() => {
    const userIdChanged = lastEffectiveUserIdRef.current !== effectiveUserId;
    lastEffectiveUserIdRef.current = effectiveUserId;

    if (shorts.length > 0 && !userIdChanged) {
      return;
    }

    if (userIdChanged) {
      setShorts([]);
    }

    loadShorts();
    loadCurrentUser();
    loadSavedShorts();
    
    // Track screen view
    trackScreenView('shorts');
    
    // Hide swipe hint after 3 seconds
    const timer = setTimeout(() => {
      setShowSwipeHint(false);
    }, 3000);
    
    // Cleanup video refs on unmount
    // Note: Socket subscriptions are handled in a separate useEffect after loadShorts is defined
    return () => {
      clearTimeout(timer);
      
      // Cleanup all video refs
      const cleanupPromises = Object.values(videoRefs.current).map(async (video) => {
        if (video) {
          try {
            // Check if video is still valid
            const status = await video.getStatusAsync();
            if (status.isLoaded && typeof video.unloadAsync === 'function') {
              await video.unloadAsync();
            }
          } catch (error) {
            // Silently fail cleanup - video may already be unloaded
            logger.debug('Video cleanup error (expected on unmount):', error instanceof Error ? error.message : String(error));
          }
        }
      });
      // Don't await - cleanup happens in background
      Promise.all(cleanupPromises).catch(() => {
        // Ignore cleanup errors
      });
      videoRefs.current = {};
      
      // Clear all debounced like timers.
      Object.values(likeDebounceRefs.current).forEach(item => clearTimeout(item.timer));
      likeDebounceRefs.current = {};
      
      // Clear video cache
      if (videoCacheRef.current) {
        videoCacheRef.current.clear();
      }
      
      // Reset active video tracking
      activeVideoIdRef.current = null;
      lastViewedShortIdRef.current = null;

      // Pause current audio on unmount
      if (currentPlayerRef.current) {
        currentPlayerRef.current.pauseAsync?.().catch(() => {});
        currentPlayerRef.current = null;
      }
      audioManager.stopAll().catch(() => {});
    };
  }, [effectiveUserId]);


  // Handle app backgrounding/foregrounding and screen focus/blur
  // Pause videos when screen loses focus or app goes to background
  // Uses centralized pauseCurrentVideo helper to prevent race conditions
  // Reset navigation guard when screen comes into focus (user navigated back)
  // CRITICAL: Refresh shorts feed when screen comes into focus (real-time updates after upload)
  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
      lastNavigationUserIdRef.current = null;
      swipeAnimation.setValue(0);
      fadeAnimation.setValue(1);

      // Only on Shorts *tab*: if we left with ?userId= in URL, clear on next focus so feed is global again
      if (shouldClearParamsOnNextFocusRef.current && isOnTabShorts) {
        shouldClearParamsOnNextFocusRef.current = false;
        router.replace('/(tabs)/shorts');
      }

      const refreshTimer = setTimeout(() => {
        const shouldFilterByUser = !!effectiveUserId;
        if (!shouldFilterByUser && shortsRef.current.length === 0) {
          logger.debug('Shorts screen focused - refreshing feed for real-time updates');
          const loadFn = loadShortsRef.current;
          if (loadFn) loadFn();
        }
      }, 300);

      return () => {
        clearTimeout(refreshTimer);
        if (isOnTabShorts && effectiveUserId) {
          shouldClearParamsOnNextFocusRef.current = true;
        }
      };
    }, [effectiveUserId, router, isOnTabShorts])
  );

  useFocusEffect(
    useCallback(() => {
      // Mark screen as focused so SongPlayer knows it can play
      isScreenFocusedRef.current = true;
      setIsScreenFocused(true);
      setIsVideoPlaying(true);

      // Lift any audio freeze left over from the previous tab-blur cleanup.
      audioManager.unfreeze();

      // CRITICAL: Set audio mode for shorts playback (main speaker, not earpiece)
      // MUST include interruptionModeIOS: 0 (MIX_WITH_OTHERS) so that
      // Audio.Sound (SongPlayer) can play alongside a muted Video component.
      // Without this, iOS gives the muted Video exclusive audio-session control
      // and silences (or blocks) all Audio.Sound instances — the user sees a
      // reel play but hears nothing.
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 0, // MIX_WITH_OTHERS — required for video + song coexistence
        interruptionModeAndroid: 1, // DO_NOT_MIX (default; Android handles mixing via audioFocus)
      }).catch(err => {
        logger.error('Error setting audio mode for shorts:', err);
      });

      return () => {
        // CRITICAL: Mark screen as unfocused FIRST
        isScreenFocusedRef.current = false;
        setIsScreenFocused(false);
        setIsVideoPlaying(false);

        // Clear active view timer when leaving shorts page
        if (viewTimerRef.current) {
          clearTimeout(viewTimerRef.current);
          viewTimerRef.current = null;
        }

        // Freeze audioManager to block in-flight SongPlayer loads from playing
        // on the next tab after we leave.
        audioManager.freeze(3000);

        // Pause video and audio
        pauseCurrentVideo();
        logger.debug('[Shorts] Stopping all audio - leaving shorts page');
        audioManager.stopAll().catch(() => {});
      };
    }, [pauseCurrentVideo])
  );

  // Pause when user navigates away from Shorts (tab or /user-shorts stack)
  useEffect(() => {
    if (!shortsPlaybackSurfaceActive) {
      isScreenFocusedRef.current = false;
      setIsScreenFocused(false);
      setIsVideoPlaying(false);
      pauseCurrentVideo();
      if (currentPlayerRef.current) {
        currentPlayerRef.current.pauseAsync?.().catch(() => {});
        currentPlayerRef.current = null;
      }
      audioManager.stopAll().catch(() => {});
    }
  }, [shortsPlaybackSurfaceActive, pauseCurrentVideo]);

  // Handle app state changes (background/foreground)
  // Updates reactive appState prop which flows down to ShortsCell
  useEffect(() => {
    if (Platform.OS === 'web') return; // AppState not needed on web
    
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      setAppState(nextAppState);
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App going to background - pause current video and audio
        pauseCurrentVideo();
        if (currentPlayerRef.current) {
          currentPlayerRef.current.pauseAsync?.().catch(() => {});
          currentPlayerRef.current = null;
        }
        audioManager.stopAll().catch(() => {});
        logger.debug('App backgrounded, paused current video and audio');
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [pauseCurrentVideo]);

  // Handle Android hardware back button
  // Pauses video before allowing normal navigation
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Pause current video before allowing back navigation
      // This ensures video stops immediately when user presses back
      pauseCurrentVideo();
      // Return false to allow normal back navigation
      return false;
    });

    return () => {
      backHandler.remove();
    };
  }, [pauseCurrentVideo]);

  // Handle back button press (UI or hardware)
  // When we came from a profile (userId in params): clear Shorts params then go back once.
  // This pops Shorts and returns to that profile; back from profile then goes to previous screen (no loop).
  // Clearing params ensures next time user opens Shorts tab they see all users' shorts.
  const handleBack = useCallback(async () => {
    pauseCurrentVideo();

    // When opened from a profile (`userId` present), prefer going back once if possible.
    if (effectiveUserId) {
      // If navigator has a previous screen, pop back to it (profile or previous route)
      if (router.canGoBack?.()) {
        router.back();
        return;
      }
      // Fallback: clear Shorts params and go to profile screen explicitly
      router.replace(`/profile/${effectiveUserId}`);
      return;
    }

    // Generic back: only call back if navigator can handle it, otherwise go home
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  }, [pauseCurrentVideo, router, effectiveUserId]);

  // Monitor network status for video quality adaptation
  // Wrapped with defensive error handling to prevent false quality downgrades
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        try {
          const response = await fetch('https://www.google.com/favicon.ico', {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          // Assume WiFi if request succeeds quickly
          setVideoQuality('high');
        } catch (fetchError) {
          clearTimeout(timeoutId);
          // Network probe failed - log as debug since this is expected and handled gracefully
          // The video URL itself may still be accessible even if favicon check fails
          // The app keeps the current quality setting, which is the correct behavior
          logger.debug('[ShortsScreen] Network quality probe failed, keeping current quality setting', fetchError);
          // Only downgrade if we're currently on high quality and probe consistently fails
          // This prevents unnecessary quality drops when CDN is accessible but probe fails
        }
      } catch (error) {
        // Outer catch for any unexpected errors
        // Log as debug since this is non-critical and handled gracefully
        logger.debug('[ShortsScreen] Network status check error (non-critical):', error);
        // Don't change quality on unexpected errors - let video loading determine quality
      }
    };
    
    checkNetworkStatus();
    const interval = setInterval(checkNetworkStatus, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  // Note: Cleanup, preloading, and remote URL tracking effects moved lower (after shortsData declaration)

  // Video cache for offline support
  const videoCacheRef = useRef<Map<string, { url: string; timestamp: number }>>(new Map());
  const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  // Get quality-adaptive video URL with caching
  // Priority: videoUrl > mediaUrl > imageUrl (for shorts, videoUrl should always be present)
  // CRITICAL: Signed URLs expire after 15 minutes, so cache is limited to 10 minutes
  const getVideoUrl = useCallback((item: PostType) => {
    const videoId = item._id;

    // Return local URI if available and we didn't start playing with a remote URL
    if (localVideoUris[videoId] && !activeStartedWithRemoteRef.current[videoId]) {
      return localVideoUris[videoId];
    }

    // Prioritize videoUrl for shorts, fallback to mediaUrl or imageUrl
    const baseUrl = item.videoUrl || item.mediaUrl || item.imageUrl;
    
    // DETAILED LOGGING: Track URL resolution for first 2 shorts
    const isFirstTwoShorts = shorts.length > 0 && shorts.indexOf(item) !== -1 && shorts.indexOf(item) < 2;
    if (isFirstTwoShorts) {
      logger.info(`[FIRST_2_SHORTS] getVideoUrl called for short at index ${shorts.indexOf(item)}:`, {
        videoId,
        hasVideoUrl: !!item.videoUrl,
        hasMediaUrl: !!item.mediaUrl,
        hasImageUrl: !!item.imageUrl,
        videoUrl: item.videoUrl ? item.videoUrl.substring(0, 80) : 'UNDEFINED',
        mediaUrl: item.mediaUrl ? item.mediaUrl.substring(0, 80) : 'UNDEFINED',
        imageUrl: item.imageUrl ? item.imageUrl.substring(0, 80) : 'UNDEFINED',
        baseUrl: baseUrl ? baseUrl.substring(0, 80) : 'UNDEFINED',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate base URL exists
    if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
      logger.error(`Invalid video URL for item ${videoId}:`, {
        videoUrl: item.videoUrl,
        mediaUrl: item.mediaUrl,
        imageUrl: item.imageUrl,
        isFirstTwoShorts
      });
      if (isFirstTwoShorts) {
        logger.error(`[FIRST_2_SHORTS] EMPTY URL DETECTED at index ${shorts.indexOf(item)}`);
      }
      return '';
    }
    
    // CRITICAL: Signed URLs expire after 15 minutes, so cache for max 10 minutes
    // This ensures we don't use expired URLs
    const CACHE_MAX_AGE = 10 * 60 * 1000; // 10 minutes (signed URLs expire after 15 minutes)
    
    // Check cache first (but don't use if too old - signed URLs expire)
    const cached = videoCacheRef.current.get(videoId);
    if (cached) {
      const cacheAge = Date.now() - cached.timestamp;
      if (cacheAge < CACHE_MAX_AGE) {
        // Verify cached URL is still the same as current base URL
        const cachedBaseUrl = cached.url.split('?')[0]; // Remove query params for comparison
        const currentBaseUrl = baseUrl.split('?')[0];
        if (cachedBaseUrl === currentBaseUrl) {
          // Check if cache is close to expiry (within 2 minutes)
          if (cacheAge < (CACHE_MAX_AGE - 2 * 60 * 1000)) {
            if (isFirstTwoShorts) {
              logger.info(`[FIRST_2_SHORTS] Cache HIT for short at index ${shorts.indexOf(item)}, age: ${Math.round(cacheAge / 1000)}s`);
            }
            return cached.url;
          } else {
            // Cache is getting old, but still valid - return it but don't update cache timestamp
            // This will force a refresh on next call
            logger.debug(`Video ${videoId} cache is close to expiry (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
            if (isFirstTwoShorts) {
              logger.info(`[FIRST_2_SHORTS] Cache NEAR_EXPIRY for short at index ${shorts.indexOf(item)}`);
            }
            return cached.url;
          }
        } else {
          // Base URL changed, clear cache for this item
          videoCacheRef.current.delete(videoId);
          if (isFirstTwoShorts) {
            logger.warn(`[FIRST_2_SHORTS] Cache INVALIDATED (URL changed) for short at index ${shorts.indexOf(item)}`);
          }
        }
      } else {
        // Cache expired, clear it
        logger.debug(`Video ${videoId} cache expired (${Math.round(cacheAge / 1000 / 60)} minutes old), clearing`);
        if (isFirstTwoShorts) {
          logger.warn(`[FIRST_2_SHORTS] Cache EXPIRED for short at index ${shorts.indexOf(item)}`);
        }
        videoCacheRef.current.delete(videoId);
      }
    } else {
      if (isFirstTwoShorts) {
        logger.info(`[FIRST_2_SHORTS] Cache MISS for short at index ${shorts.indexOf(item)}`);
      }
    }
    
    // Generate URL based on quality
    let url = baseUrl.trim();
    // Only add quality param if URL doesn't already have query params
    if (!url.includes('?') && videoQuality !== 'high') {
      url = `${baseUrl}?q=${videoQuality}`;
    } else if (videoQuality !== 'high' && url.includes('?')) {
      // URL already has params, append quality
      url = `${baseUrl}&q=${videoQuality}`;
    }
    
    // Cache the URL with current timestamp (fresh from backend)
    videoCacheRef.current.set(videoId, {
      url,
      timestamp: Date.now()
    });
    
    if (isFirstTwoShorts) {
      logger.info(`[FIRST_2_SHORTS] Generated URL for short at index ${shorts.indexOf(item)}: ${url.substring(0, 100)}...`);
    }
    logger.debug(`Video URL for ${videoId} (fresh):`, url.substring(0, 100) + '...');
    return url;
  }, [videoQuality, shorts, localVideoUris]);
  
  // Track previous visible index to detect actual scroll changes
  const previousVisibleIndexRef = useRef<number>(-1);
  
  const loadSavedShorts = async () => {
    try {
      const stored = await AsyncStorage.getItem('savedShorts');
      if (!stored) {
        setSavedShorts(new Set());
        return;
      }
      
      // Defensive JSON parsing with validation
      let arr: string[] = [];
      try {
        const parsed = JSON.parse(stored);
        arr = Array.isArray(parsed) ? parsed : [];
      } catch (parseError) {
        logger.warn('Failed to parse savedShorts, resetting to empty array', parseError);
        // Reset corrupted data
        await AsyncStorage.setItem('savedShorts', JSON.stringify([]));
        arr = [];
      }
      
      // Filter out any invalid entries (non-string IDs)
      const validIds = arr.filter((id): id is string => typeof id === 'string' && id.length > 0);
      setSavedShorts(new Set(validIds));
    } catch (error) {
      logger.error('Error loading saved shorts', error);
      setSavedShorts(new Set());
    }
  };

  const loadCurrentUser = async () => {
    try {
      const user = await getUserFromStorage();
      setCurrentUser(user);
    } catch (error) {
      logger.error('Error loading current user', error);
    }
  };

  // Helper function to refetch a single short with fresh signed URL
  const refetchShortWithFreshUrl = useCallback(async (shortId: string): Promise<PostType | null> => {
    try {
      logger.debug(`Refetching short ${shortId} to get fresh signed URL...`);
      const response = await getPostById(shortId);
      // getPostById returns { post: PostType } or PostType directly
      const short = response?.data?.post || response?.post || response;
      if (short && (short.mediaUrl || short.videoUrl || short.imageUrl)) {
        logger.debug(`Successfully refetched short ${shortId} with fresh URL`);
        return short as PostType;
      }
      logger.warn(`Refetched short ${shortId} but no valid URL found`);
      return null;
    } catch (error) {
      logger.error(`Failed to refetch short ${shortId}:`, error);
      return null;
    }
  }, []);

  const handleUrlRefetch = useCallback(async (shortId: string) => {
    const freshShort = await refetchShortWithFreshUrl(shortId);
    if (freshShort) {
      setShorts(prev => prev.map(s =>
        s._id === shortId
          ? { ...s, mediaUrl: freshShort.mediaUrl, videoUrl: freshShort.videoUrl || s.videoUrl, imageUrl: freshShort.imageUrl || s.imageUrl }
          : s
      ));
      return freshShort;
    }
    return null;
  }, [refetchShortWithFreshUrl]);

  const removeLocalVideoUri = useCallback((shortId: string) => {
    if (localVideoUris[shortId]) {
      const pathToRemove = localVideoUris[shortId];
      setLocalVideoUris(prev => {
        const updated = { ...prev };
        delete updated[shortId];
        return updated;
      });
      removeCachedVideo(pathToRemove).catch(() => {});
    }
  }, [localVideoUris]);

  const loadShorts = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) {
        setLoading(true);
      }
      currentPageRef.current = 1;
      cursorRef.current = null;
      hasMoreRef.current = true;
      setCheckedVideoCacheIds(new Set());

      logger.info(`[LOAD_SHORTS] Starting to load shorts`, {
        effectiveUserId,
        effectiveShortId,
        isSavedShorts: props.isSavedShorts,
        timestamp: new Date().toISOString()
      });

      if (props.isSavedShorts) {
        logger.debug(`[LOAD_SHORTS] Loading saved shorts`);
        const savedShortsJson = await AsyncStorage.getItem('savedShorts');
        let savedIds: string[] = [];
        if (savedShortsJson) {
          try {
            const parsed = JSON.parse(savedShortsJson);
            savedIds = Array.isArray(parsed) ? parsed.filter((id: any): id is string => typeof id === 'string' && id.length > 0) : [];
          } catch {
            savedIds = [];
          }
        }

        if (savedIds.length === 0) {
          setShorts([]);
          setLoading(false);
          return;
        }

        // Fetch each short by ID
        const resolvedPosts = await Promise.all(
          savedIds.map(async (id) => {
            try {
              const raw = await getPostById(id);
              return raw?.data?.post || raw?.post || raw || null;
            } catch {
              return null;
            }
          })
        );

        const validShorts = resolvedPosts.filter((s): s is PostType => s !== null && (s.type === 'short' || !!s.videoUrl));

        const enriched = validShorts.map((s) => {
          const fromStorage = likedShortIdsRef.current.has(s._id);
          const isLiked = s.isLiked || fromStorage;
          const likesCount = isLiked && fromStorage && !s.isLiked
            ? Math.max(s.likesCount ?? 0, 1)
            : (s.likesCount ?? 0);
          return { ...s, isLiked, likesCount };
        });

        // Resolve cache for the first 3 saved shorts
        const firstShorts = enriched.slice(0, 3);
        const initialUris: Record<string, string> = {};
        firstShorts.forEach((item: any) => {
          const localUri = getLocalVideoUriSync(item._id);
          if (localUri) {
            initialUris[item._id] = localUri;
          }
        });
        setLocalVideoUris((prev) => ({ ...prev, ...initialUris }));
        setCheckedVideoCacheIds((prev) => {
          const next = new Set(prev);
          firstShorts.forEach((s) => next.add(s._id));
          return next;
        });

        // Set follow states
        const followStatesMap: { [key: string]: boolean } = {};
        enriched.forEach((short: PostType) => {
          if (short.user && short.user._id) {
            followStatesMap[short.user._id] = (short.user as any).isFollowing || false;
          }
        });
        setFollowStates(followStatesMap);

        setShorts(enriched);

        setLoading(false);
        hasMoreRef.current = false; // No paginated loading for saved items
        return;
      }

      const shouldFilterByUser = !!effectiveUserId;

      // When a specific shortId is provided (opened from notification / feed tap)
      // without a userId filter, show that short immediately then load the full feed.
      if (effectiveShortId && !shouldFilterByUser) {
        try {
          const raw = await getPostById(effectiveShortId);
          const singleShort: PostType | null = raw?.data?.post || raw?.post || raw || null;
          if (singleShort) {
            logger.info(`[LOAD_SHORTS] Loaded specific short:`, {
              shortId: singleShort._id,
              hasVideoUrl: !!singleShort.videoUrl,
              hasMediaUrl: !!singleShort.mediaUrl,
              hasImageUrl: !!singleShort.imageUrl
            });

            // Resolve cache for this single short first!
            const localUri = getLocalVideoUriSync(singleShort._id);
            if (localUri) {
              setLocalVideoUris(prev => ({ ...prev, [singleShort._id]: localUri }));
            }
            setCheckedVideoCacheIds((prev) => {
              const next = new Set(prev);
              next.add(singleShort._id);
              return next;
            });

            const fromStorage = likedShortIdsRef.current.has(singleShort._id);
            const isLiked = singleShort.isLiked || fromStorage;
            const likesCount = isLiked && fromStorage && !singleShort.isLiked
              ? Math.max(singleShort.likesCount ?? 0, 1)
              : (singleShort.likesCount ?? 0);
            setShorts([{ ...singleShort, isLiked, likesCount }]);
            setLoading(false);
          }
        } catch (e) {
          logger.warn('Failed to load specific short, falling back to feed:', e);
        }
        // Load the full feed in background; merge so the specific short stays at position 0
        try {
          const response = await getShorts(1, 10);
          logger.info(`[LOAD_SHORTS] Loaded full feed (${response.shorts?.length || 0} shorts)`, {
            timestamp: new Date().toISOString()
          });
          // Log first 2 shorts details
          if (response.shorts && response.shorts.length > 0) {
            response.shorts.slice(0, 2).forEach((s, idx) => {
              logger.info(`[LOAD_SHORTS] First 2 shorts - Short ${idx}:`, {
                shortId: s._id,
                hasVideoUrl: !!s.videoUrl,
                hasMediaUrl: !!s.mediaUrl,
                hasImageUrl: !!s.imageUrl,
                videoUrl: s.videoUrl ? s.videoUrl.substring(0, 80) : 'UNDEFINED',
                mediaUrl: s.mediaUrl ? s.mediaUrl.substring(0, 80) : 'UNDEFINED',
                imageUrl: s.imageUrl ? s.imageUrl.substring(0, 80) : 'UNDEFINED'
              });
            });
          }
          videoCacheRef.current.clear();
          const merged = (response.shorts || []).map((s: PostType) => {
            const fromStorage = likedShortIdsRef.current.has(s._id);
            const isLiked = s.isLiked || fromStorage;
            const likesCount = isLiked && fromStorage && !s.isLiked
              ? Math.max(s.likesCount ?? 0, 1)
              : (s.likesCount ?? 0);
            return { ...s, isLiked, likesCount };
          });
          setShorts(prev => {
            const ids = new Set(merged.map((s: PostType) => s._id));
            const kept = prev.filter(s => !ids.has(s._id)); // specific short, deduped
            return [...kept, ...merged];
          });
          const followStatesMap: { [key: string]: boolean } = {};
          response.shorts.forEach((short: PostType) => {
            followStatesMap[short.user._id] = (short.user as any).isFollowing || false;
          });
          setFollowStates(followStatesMap);
          hasMoreRef.current = (response.shorts || []).length >= 10;
          cursorRef.current = response.pagination?.nextCursor || null;
        } catch (e) {
          logger.warn('Failed to load full feed in background:', e);
        }
        return;
      }

      let response;
      if (shouldFilterByUser) {
        logger.debug(`Loading shorts for specific user: ${effectiveUserId}`);
        response = await getUserShorts(effectiveUserId, 1, 100);
      } else {
        response = await getShorts(1, 10);
      }

      logger.info(`[LOAD_SHORTS] Loaded shorts (${response.shorts?.length || 0} shorts)`, {
        timestamp: new Date().toISOString()
      });
      
      // Log first 2 shorts details
      if (response.shorts && response.shorts.length > 0) {
        response.shorts.slice(0, 2).forEach((s, idx) => {
          logger.info(`[LOAD_SHORTS] First 2 shorts - Short ${idx}:`, {
            shortId: s._id,
            hasVideoUrl: !!s.videoUrl,
            hasMediaUrl: !!s.mediaUrl,
            hasImageUrl: !!s.imageUrl,
            videoUrl: s.videoUrl ? s.videoUrl.substring(0, 80) : 'UNDEFINED',
            mediaUrl: s.mediaUrl ? s.mediaUrl.substring(0, 80) : 'UNDEFINED',
            imageUrl: s.imageUrl ? s.imageUrl.substring(0, 80) : 'UNDEFINED'
          });
        });
      }

      videoCacheRef.current.clear();
      const merged = (response.shorts || []).map((s: PostType) => {
        const fromStorage = likedShortIdsRef.current.has(s._id);
        const isLiked = s.isLiked || fromStorage;
        const likesCount = isLiked && fromStorage && !s.isLiked
          ? Math.max(s.likesCount ?? 0, 1)
          : (s.likesCount ?? 0);
        return { ...s, isLiked, likesCount };
      });

      // Resolve cache for the first 3 shorts
      const firstShorts = merged.slice(0, 3);
      const initialUris: Record<string, string> = {};
      firstShorts.forEach((item: any) => {
        const localUri = getLocalVideoUriSync(item._id);
        if (localUri) {
          initialUris[item._id] = localUri;
        }
      });
      setLocalVideoUris((prev) => ({ ...prev, ...initialUris }));
      setCheckedVideoCacheIds((prev) => {
        const next = new Set(prev);
        firstShorts.forEach((s) => next.add(s._id));
        return next;
      });

      setShorts(merged);
      if (!shouldFilterByUser) {
        hasMoreRef.current = (response.shorts || []).length >= 10;
        cursorRef.current = response.pagination?.nextCursor || null;
      }

      const followStatesMap: { [key: string]: boolean } = {};
      response.shorts.forEach((short: PostType) => {
        followStatesMap[short.user._id] = (short.user as any).isFollowing || false;
      });
      setFollowStates(followStatesMap);

      if (isGeneralFeed) {
        globalCachedShorts = merged;
        globalCachedPage = 1;
        globalCachedCursor = cursorRef.current;
        globalCachedHasMore = hasMoreRef.current;
        globalCachedFollowStates = followStatesMap;
      }
    } catch (error) {
      logger.error('Error loading shorts', error);
      showError('Failed to load shorts');
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, effectiveShortId, showError]);

  // Update ref whenever loadShorts changes (for socket handlers)
  useEffect(() => {
    loadShortsRef.current = loadShorts;
  }, [loadShorts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadShorts(true);
    } finally {
      setRefreshing(false);
    }
  }, [loadShorts]);

  useEffect(() => {
    return shortsEvents.addTabRefreshListener(async () => {
      if (!isOnTabShorts || effectiveUserId || props.isSavedShorts) return;
      userPausedShortIdsRef.current.clear();
      setRefreshing(true);
      setCurrentIndex(0);
      setCurrentVisibleIndex(0);
      previousVisibleIndexRef.current = -1;
      activeVideoIdRef.current = null;
      setCheckedVideoCacheIds(new Set());
      pauseCurrentAudio();
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      try {
        await loadShorts(true);
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        });
      } finally {
        setRefreshing(false);
      }
    });
  }, [effectiveUserId, isOnTabShorts, loadShorts, pauseCurrentAudio, props.isSavedShorts]);

  const loadMoreShorts = useCallback(async () => {
    if (!hasMoreRef.current || isLoadingMore || !!effectiveUserId || !!effectiveShortId || props.isSavedShorts) return;
    try {
      setIsLoadingMore(true);
      const nextPage = currentPageRef.current + 1;
      const response = await getShorts(cursorRef.current || nextPage, 10);
      const newShorts: PostType[] = response.shorts || [];
      if (newShorts.length === 0) {
        hasMoreRef.current = false;
        return;
      }
      currentPageRef.current = nextPage;
      hasMoreRef.current = newShorts.length >= 10;
      cursorRef.current = response.pagination?.nextCursor || null;
      const mapped = newShorts.map((s) => {
        const fromStorage = likedShortIdsRef.current.has(s._id);
        const isLiked = s.isLiked || fromStorage;
        const likesCount = isLiked && fromStorage && !s.isLiked ? Math.max(s.likesCount ?? 0, 1) : (s.likesCount ?? 0);
        return { ...s, isLiked, likesCount };
      });
      setShorts(prev => {
        const existingIds = new Set(prev.map(s => s._id));
        const updated = [...prev, ...mapped.filter((s) => !existingIds.has(s._id))];
        if (isGeneralFeed) {
          globalCachedShorts = updated;
          globalCachedPage = nextPage;
          globalCachedCursor = cursorRef.current;
          globalCachedHasMore = hasMoreRef.current;
        }
        return updated;
      });
      const followStatesMap: { [key: string]: boolean } = {};
      newShorts.forEach((s) => { followStatesMap[s.user._id] = (s.user as any).isFollowing || false; });
      setFollowStates(prev => {
        const updatedFollows = { ...prev, ...followStatesMap };
        if (isGeneralFeed) {
          globalCachedFollowStates = updatedFollows;
        }
        return updatedFollows;
      });
    } catch (error) {
      logger.error('Error loading more shorts', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [effectiveUserId, effectiveShortId, isLoadingMore]);

  // Load persisted liked short IDs on mount so likes survive app restart; merge into current shorts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(LIKED_SHORTS_STORAGE_KEY);
        if (cancelled) return;
        const ids: string[] = raw ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : [];
        likedShortIdsRef.current = new Set(Array.isArray(ids) ? ids : []);
        setShorts(prev => {
          if (prev.length === 0) return prev;
          const set = likedShortIdsRef.current;
          return prev.map(s => {
            const fromStorage = set.has(s._id);
            const isLiked = s.isLiked || fromStorage;
            const likesCount = isLiked && fromStorage && !s.isLiked
              ? Math.max(s.likesCount ?? 0, 1)
              : (s.likesCount ?? 0);
            return { ...s, isLiked, likesCount };
          });
        });
      } catch (e) {
        logger.debug('Load liked shorts from storage', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // CRITICAL: Subscribe to Socket.IO events for real-time feed updates after loadShorts is defined
  // Listen for 'short:created' and 'invalidate:feed' events to refresh feed immediately
  useEffect(() => {
    const handleShortCreated = (payload: { shortId?: string }) => {
      logger.debug('Short created event received, refreshing feed:', payload);
      // Only refresh if we're not filtering by a specific user (general feed)
      const shouldFilterByUser = !!effectiveUserId;
      if (!shouldFilterByUser) {
        // Refresh feed to show new short immediately using ref to avoid stale closure
        const loadFn = loadShortsRef.current;
        if (loadFn) {
          loadFn();
        }
      }
    };
    
    const handleInvalidateFeed = () => {
      logger.debug('Feed invalidation event received, refreshing shorts feed');
      // Only refresh if we're not filtering by a specific user (general feed)
      const shouldFilterByUser = !!effectiveUserId;
      if (!shouldFilterByUser) {
        // Refresh feed to show updated content using ref to avoid stale closure
        const loadFn = loadShortsRef.current;
        if (loadFn) {
          loadFn();
        }
      }
    };
    
    // Subscribe to socket events for real-time updates
    socketService.subscribe('short:created', handleShortCreated).catch(err => {
      logger.warn('Error subscribing to short:created event:', err);
    });
    
    socketService.subscribe('invalidate:feed', handleInvalidateFeed).catch(err => {
      logger.warn('Error subscribing to invalidate:feed event:', err);
    });
    
    // Cleanup: Unsubscribe from socket events when component unmounts or params change
    return () => {
      socketService.unsubscribe('short:created', handleShortCreated);
      socketService.unsubscribe('invalidate:feed', handleInvalidateFeed);
    };
  }, [effectiveUserId]); // Only depend on scoped user, not loadShorts (use ref instead)



  const executeLikeApiCall = useCallback(async (shortId: string) => {
    const pending = likeDebounceRefs.current[shortId];
    if (!pending) return;

    delete likeDebounceRefs.current[shortId];

    try {
      const response = await toggleLike(shortId);
      
      const finalSet = new Set(likedShortIdsRef.current);
      if (response.isLiked) finalSet.add(shortId);
      else finalSet.delete(shortId);
      likedShortIdsRef.current = finalSet;
      AsyncStorage.setItem(LIKED_SHORTS_STORAGE_KEY, JSON.stringify([...finalSet])).catch(() => {});

      // Sync the parent state with final confirmed values from server
      setShorts(prevShorts => 
        prevShorts.map(s => 
          s._id === shortId 
            ? { ...s, isLiked: response.isLiked, likesCount: response.likesCount } 
            : s
        )
      );

      trackEngagement('like', 'short', shortId, {
        isLiked: response.isLiked
      });
    } catch (error) {
      logger.error('Error toggling like in backend:', error);
      
      const revertSet = new Set(likedShortIdsRef.current);
      if (pending.originalState) revertSet.add(shortId);
      else revertSet.delete(shortId);
      likedShortIdsRef.current = revertSet;
      AsyncStorage.setItem(LIKED_SHORTS_STORAGE_KEY, JSON.stringify([...revertSet])).catch(() => {});

      // Revert parent state
      setShorts(prevShorts => 
        prevShorts.map(s => 
          s._id === shortId 
            ? { ...s, isLiked: pending.originalState, likesCount: pending.originalLikesCount } 
            : s
        )
      );

      // Revert rail child state
      emitLikeRailState(shortId, pending.originalState);

      showError('Failed to update like status');
    }
  }, [showError, setShorts]);

  const handleLike = useCallback(async (shortId: string, forceLike: boolean = false) => {
    // Find current short
    const currentShort = shortsRef.current.find(s => s._id === shortId);
    if (!currentShort) return;

    const originalIsLiked = likedShortIdsRef.current.has(shortId) || currentShort.isLiked || false;
    const originalLikesCount = currentShort.likesCount || 0;

    // If forceLike is true and it's already liked, strictly return
    if (forceLike && originalIsLiked) {
      return;
    }

    const newIsLiked = forceLike ? true : !originalIsLiked;
    const newLikesCount = newIsLiked 
      ? originalLikesCount + 1 
      : Math.max(originalLikesCount - 1, 0);

    // Keep the video cell isolated from like state. The action rail performs
    // its own optimistic UI update; the parent only mirrors persisted liked IDs.
    if (newIsLiked && forceLike) {
      emitLikeRailState(shortId, true);
    }

    // Keep persisted liked IDs in sync
    const newPersistSet = new Set(likedShortIdsRef.current);
    if (newIsLiked) newPersistSet.add(shortId);
    else newPersistSet.delete(shortId);
    likedShortIdsRef.current = newPersistSet;
    AsyncStorage.setItem(LIKED_SHORTS_STORAGE_KEY, JSON.stringify([...newPersistSet])).catch(() => {});

    // Update parent state optimistically
    setShorts(prevShorts => 
      prevShorts.map(s => 
        s._id === shortId 
          ? { ...s, isLiked: newIsLiked, likesCount: newLikesCount } 
          : s
      )
    );

    // Debounce & coalesce API call
    const pending = likeDebounceRefs.current[shortId];
    if (pending) {
      clearTimeout(pending.timer);
      if (newIsLiked === pending.originalState) {
        delete likeDebounceRefs.current[shortId];
        return;
      }
      pending.targetState = newIsLiked;
      pending.timer = setTimeout(() => executeLikeApiCall(shortId), 500);
    } else {
      likeDebounceRefs.current[shortId] = {
        originalState: originalIsLiked,
        originalLikesCount: originalLikesCount,
        targetState: newIsLiked,
        timer: setTimeout(() => executeLikeApiCall(shortId), 500)
      };
    }
  }, [executeLikeApiCall, setShorts]);



  const handleFollow = async (userId: string) => {
    if (actionLoading === userId) return;
    
    try {
      setActionLoading(userId);
      const response = await toggleFollow(userId);
      
      setFollowStates(prev => ({
        ...prev,
        [userId]: response.isFollowing
      }));
      
      // No success alert - silent update for better UX
    } catch (error) {
      logger.error('Error toggling follow', error);
      showError('Failed to update follow status');
    } finally {
      setActionLoading(null);
    }
  };

  // Atomic read-modify-write for saved shorts to prevent race conditions
  const handleSave = async (shortId: string) => {
    try {
      // Atomic operation: read, modify, write
      const stored = await AsyncStorage.getItem('savedShorts');
      let currentIds: string[] = [];
      
      // Defensive parsing
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          currentIds = Array.isArray(parsed) ? parsed.filter((id: any): id is string => 
            typeof id === 'string' && id.length > 0
          ) : [];
        } catch (parseError) {
          logger.warn('Corrupted savedShorts data, resetting', parseError);
          currentIds = [];
        }
      }
      
      // Check if already saved (prevent duplicates)
      const isCurrentlySaved = currentIds.includes(shortId);
      let updatedIds: string[];
      
      if (isCurrentlySaved) {
        // Remove from saved
        updatedIds = currentIds.filter(id => id !== shortId);
        await AsyncStorage.setItem('savedShorts', JSON.stringify(updatedIds));
        setSavedShorts(new Set(updatedIds));
        showInfo('Removed from saved');
        savedEvents.emitChanged();
        savedEvents.emitPostAction(shortId, 'unsave', { isBookmarked: false });
      } else {
        // Add newest saves at the beginning so saved feeds stay reverse chronological by saved time.
        if (!currentIds.includes(shortId)) {
          updatedIds = [shortId, ...currentIds.filter(id => id !== shortId)];
          await AsyncStorage.setItem('savedShorts', JSON.stringify(updatedIds));
          setSavedShorts(new Set(updatedIds));
          showSuccess('Saved to favorites!');
          savedEvents.emitChanged();
          savedEvents.emitPostAction(shortId, 'save', { isBookmarked: true });
        } else {
          // Already saved (race condition handled)
          setSavedShorts(new Set(currentIds));
        }
      }
    } catch (error) {
      logger.error('Error saving short', error);
      showError('Failed to save short');
    }
  };

  const handleShare = async (short: PostType) => {
    try {
      // Open ShareModal instead of native share
      setSelectedShortForShare(short);
      setShowShareModal(true);
      
      // Track share engagement
      trackEngagement('share', 'short', short._id);
    } catch (error) {
      logger.error('Error opening share modal', error);
      showError('Failed to open share options');
    }
  };

  const upsertSelectedComment = useCallback((incomingComment: any) => {
    if (!incomingComment) return;
    setSelectedShortComments((prev) => {
      const next = [...prev];
      if (incomingComment._id) {
        const existingIndex = next.findIndex((c) => c._id === incomingComment._id);
        if (existingIndex !== -1) {
          next[existingIndex] = incomingComment;
          return next;
        }
      }
      return [incomingComment, ...next];
    });
  }, []);

  const handleComment = async (shortId: string) => {
    setShowCommentModal(true);
    setSelectedShortId(shortId);
    
    getPostById(shortId)
      .then(response => {
        const short = response?.data?.post || response?.post || response;
        setSelectedShortComments(short?.comments || []);
      })
      .catch(error => {
        logger.error('Error loading comments', error);
        showError('Failed to load comments');
        setShowCommentModal(false);
        setSelectedShortId(null);
      });
  };

  const handleCommentAdded = (comment: any) => {
    upsertSelectedComment(comment);
    setShorts(prev => prev.map(short => 
      short._id === selectedShortId 
        ? { ...short, commentsCount: short.commentsCount + 1 }
        : short
    ));
  };

  const handleProfilePress = (userId: string) => {
    // Prevent duplicate navigation
    if (isNavigatingRef.current && lastNavigationUserIdRef.current === userId) {
      logger.debug('Navigation already in progress, skipping duplicate navigation');
      return;
    }
    
    isNavigatingRef.current = true;
    lastNavigationUserIdRef.current = userId;
    
    router.push(`/profile/${userId}`);
    
    // Reset navigation guard after a delay
    setTimeout(() => {
      isNavigatingRef.current = false;
      lastNavigationUserIdRef.current = null;
    }, 1000);
  };

  const handleSwipeLeft = (userId: string) => {
    // Note: Navigation guard is already set in handleTouchEnd before calling this function
    // This prevents duplicate navigations on rapid swipes
    
    // Animate swipe gesture to slide screen completely out in parallel
    Animated.parallel([
      Animated.timing(swipeAnimation, {
        toValue: -SCREEN_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Navigate to profile
      router.push(`/profile/${userId}`);
      
      // Safety reset fallback: if navigation fails or is rejected, reset after 1.5 seconds
      setTimeout(() => {
        if (isNavigatingRef.current) {
          Animated.spring(swipeAnimation, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
          fadeAnimation.setValue(1);
          isNavigatingRef.current = false;
          lastNavigationUserIdRef.current = null;
        }
      }, 1500);
    });
  };

  const handleDeleteShort = async (shortId: string) => {
    showConfirm(
      'Are you sure you want to delete this short?',
      async () => {
        try {
          await deleteShort(shortId);
          savedEvents.emitPostAction(shortId, 'delete');
          
          // Remove from local state
          setShorts(prev => prev.filter(short => short._id !== shortId));
          
          // Remove from saved shorts if it exists there
          const savedShorts = await AsyncStorage.getItem('savedShorts');
          if (savedShorts) {
            const savedIds = JSON.parse(savedShorts);
            const updatedIds = savedIds.filter((id: string) => id !== shortId);
            await AsyncStorage.setItem('savedShorts', JSON.stringify(updatedIds));
          }
          
          showSuccess('Short deleted successfully!');
        } catch (error: any) {
          showError(error.message || 'Failed to delete short');
        }
      },
      'Delete',
      'Delete',
      'Cancel'
    );
  };

  const handleTouchStart = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    swipeStartXRef.current = pageX;
    swipeStartYRef.current = pageY;
    isSwipeActiveRef.current = false;
    setIsSwipeActive(false);
  };

  const handleTouchMove = (event: any) => {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) return;

    const { pageX, pageY } = event.nativeEvent;
    const deltaX = pageX - swipeStartXRef.current;
    const deltaY = pageY - swipeStartYRef.current;

    if (isSwipeActiveRef.current) {
      // Once horizontal swipe is active, only translate leftwards
      if (deltaX < 0) {
        swipeAnimation.setValue(Math.max(deltaX, -SCREEN_WIDTH));
      } else {
        swipeAnimation.setValue(0);
      }
    } else {
      // Lock swipe horizontally if horizontal movement exceeds 5px and dominates vertical movement
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        if (deltaX < 0 && Math.abs(deltaX) > Math.abs(deltaY)) {
          isSwipeActiveRef.current = true;
          setIsSwipeActive(true);
          swipeAnimation.setValue(Math.max(deltaX, -SCREEN_WIDTH));
        }
      }
    }
  };

  const handleTouchEnd = (event: any, userId: string) => {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) return;

    const { pageX, pageY } = event.nativeEvent;
    const deltaX = pageX - swipeStartXRef.current;
    const deltaY = pageY - swipeStartYRef.current;
    const isLeftSwipe = deltaX < 0;
    
    // Swipe left recognized if horizontal swipe is locked and moved left
    if (isSwipeActiveRef.current && isLeftSwipe) {
      if (isNavigatingRef.current) {
        logger.debug('Swipe left detected but navigation already in progress, ignoring duplicate swipe');
        Animated.spring(swipeAnimation, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
        swipeStartXRef.current = null;
        swipeStartYRef.current = null;
        isSwipeActiveRef.current = false;
        setIsSwipeActive(false);
        return;
      }

      // Commit to navigation
      isNavigatingRef.current = true;
      lastNavigationUserIdRef.current = userId;

      logger.debug('Swipe left detected, navigating to profile:', userId);
      handleSwipeLeft(userId);
    } else {
      // Reset animation if not a valid left swipe
      Animated.spring(swipeAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }

    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    isSwipeActiveRef.current = false;
    setIsSwipeActive(false);
  };

  const handleTouchCancel = () => {
    if (isNavigatingRef.current) {
      // Ignore touch cancels if we are already in the process of navigating
      return;
    }
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    isSwipeActiveRef.current = false;
    setIsSwipeActive(false);
    Animated.spring(swipeAnimation, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  // Interleave full-screen native ad after every SHORTS_ADS_AFTER_EVERY reels.
  // Three independent caps must all permit a slot:
  //   1. UX gates: hasWatchedFiveReels + adsAllowedAfter20s.
  //   2. Per-session counter (defense-in-depth, resets on app restart).
  //   3. Persistent 5-per-8h cap (adCap, shared with home feed).
  // Whichever is most restrictive wins.
  const showShortsAds = !isWeb && !isExpoGo && !shortsAdsBroken && !adCap.isCapped;
  const shortsData = useMemo((): ShortsItem[] => {
    if (!showShortsAds || shorts.length === 0) return shorts as ShortsItem[];
    const result: ShortsItem[] = [];
    let adCount = 0;
    shorts.forEach((reel, i) => {
      result.push(reel);
      if ((i + 1) % SHORTS_ADS_AFTER_EVERY === 0 && i < shorts.length - 1) {
        const currentAdIndex = adCount++;
        if (!failedAdIndices.includes(currentAdIndex)) {
          result.push({ type: 'ad', adIndex: currentAdIndex });
        }
      }
    });
    return result;
  }, [shorts, showShortsAds, failedAdIndices]);

  useEffect(() => {
    shortsDataRef.current = shortsData;
  }, [shortsData]);

  // Reset activePrepared state when visible index changes
  useEffect(() => {
    setActiveVideoPrepared(false);
  }, [currentVisibleIndex]);

  // Set activeVideoPrepared to true if active video is already cached
  useEffect(() => {
    const activeVideo = shortsData[currentVisibleIndex];
    if (activeVideo && !isAdItem(activeVideo) && !!localVideoUris[activeVideo._id]) {
      setActiveVideoPrepared(true);
    }
  }, [currentVisibleIndex, shortsData, localVideoUris]);

  // Fallback: allow preloading next videos after 1.5s regardless of active video readiness
  useEffect(() => {
    if (activeVideoPrepared) return;
    const timer = setTimeout(() => {
      setActiveVideoPrepared(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [activeVideoPrepared, currentVisibleIndex]);

  // Cleanup videos that are far from viewport
  // Uses centralized stopAndUnloadVideo helper
  useEffect(() => {
    const cleanupDistance = 2; // Cleanup videos more than 2 positions away (since we keep 5 mounted)
    Object.keys(videoRefs.current).forEach((videoId) => {
      const videoIndex = shortsData.findIndex(s => !isAdItem(s) && s._id === videoId);
      if (videoIndex === -1) return;
      
      const distance = Math.abs(videoIndex - currentVisibleIndex);
      if (distance > cleanupDistance) {
        // Use centralized helper to ensure proper cleanup
        stopAndUnloadVideo(videoId);
        // Clean up from tracking refs to free memory
        delete activeStartedWithRemoteRef.current[videoId];
      }
    });
  }, [currentVisibleIndex, shortsData, stopAndUnloadVideo]);

  const handleVideoReady = useCallback((videoId: string) => {
    // When video is ready for display, if it didn't use a local URI, lock it to remote
    if (!localVideoUris[videoId]) {
      activeStartedWithRemoteRef.current[videoId] = true;
    }
    
    // If the ready video is the active one, mark active video as prepared
    const activeVideo = shortsDataRef.current[currentVisibleIndexRef.current];
    if (activeVideo && !isAdItem(activeVideo) && activeVideo._id === videoId) {
      setActiveVideoPrepared(true);
    }
  }, [localVideoUris]);

  // Sliding-Window Preloading and Local Cache Resolution Effect
  useEffect(() => {
    if (!shortsData || shortsData.length === 0) return;

    // Helper to prefetch video thumbnail using ExpoImage
    const prefetchThumbnail = (item: ShortsItem) => {
      if (!isAdItem(item)) {
        const thumbUrl = item.thumbnailUrl || item.imageUrl;
        if (thumbUrl) {
          ExpoImage.prefetch(thumbUrl);
        }
      }
    };

    // 1. Always preload active video immediately if not cached
    const activeItem = shortsData[currentVisibleIndex];
    if (activeItem && !isAdItem(activeItem)) {
      const baseUrl = activeItem.videoUrl || activeItem.mediaUrl || activeItem.imageUrl;
      if (baseUrl) {
        preloadVideoAsync(activeItem._id, baseUrl);
      }
      prefetchThumbnail(activeItem);
    }

    // 2. Preload previous video (backward scrolling support) immediately
    const prevIndex = currentVisibleIndex - 1;
    if (prevIndex >= 0) {
      const prevItem = shortsData[prevIndex];
      if (prevItem && !isAdItem(prevItem)) {
        const baseUrl = prevItem.videoUrl || prevItem.mediaUrl || prevItem.imageUrl;
        if (baseUrl) {
          preloadVideoAsync(prevItem._id, baseUrl);
        }
        prefetchThumbnail(prevItem);
      }
    }

    // 3. Preload next videos only when active video is prepared (ready or cached)
    let staggerTimeout: NodeJS.Timeout | null = null;
    if (activeVideoPrepared) {
      // Preload next video (index + 1)
      const nextIndex = currentVisibleIndex + 1;
      if (nextIndex < shortsData.length) {
        const nextItem = shortsData[nextIndex];
        if (nextItem && !isAdItem(nextItem)) {
          const baseUrl = nextItem.videoUrl || nextItem.mediaUrl || nextItem.imageUrl;
          if (baseUrl) {
            preloadVideoAsync(nextItem._id, baseUrl);
          }
          prefetchThumbnail(nextItem);
        }
      }

      // Preload second next video (index + 2) with a delay, or when next video is cached
      const secondNextIndex = currentVisibleIndex + 2;
      if (secondNextIndex < shortsData.length) {
        const secondNextItem = shortsData[secondNextIndex];
        if (secondNextItem && !isAdItem(secondNextItem)) {
          const baseUrl = secondNextItem.videoUrl || secondNextItem.mediaUrl || secondNextItem.imageUrl;
          if (baseUrl) {
            const nextItem = shortsData[nextIndex];
            const isNextCached = nextItem && !isAdItem(nextItem) && !!localVideoUris[nextItem._id];
            
            if (isNextCached) {
              preloadVideoAsync(secondNextItem._id, baseUrl);
              prefetchThumbnail(secondNextItem);
            } else {
              staggerTimeout = setTimeout(() => {
                preloadVideoAsync(secondNextItem._id, baseUrl);
                prefetchThumbnail(secondNextItem);
              }, 1200);
            }
          }
        }
      }
    }

    // 4. Synchronously check cache status for the sliding window to update localVideoUris and checkedVideoCacheIds state
    const minIndex = Math.max(0, currentVisibleIndex - 2);
    const maxIndex = Math.min(shortsData.length - 1, currentVisibleIndex + 2);
    const newUris: Record<string, string> = {};
    const checkedIds: string[] = [];

    for (let i = minIndex; i <= maxIndex; i++) {
      const item = shortsData[i];
      if (item && !isAdItem(item)) {
        const localUri = getLocalVideoUriSync(item._id);
        if (localUri) {
          newUris[item._id] = localUri;
        }
        checkedIds.push(item._id);
      }
    }

    setLocalVideoUris(prev => {
      let changed = false;
      const merged = { ...prev };
      for (const id of checkedIds) {
        const uri = newUris[id];
        if (uri) {
          if (prev[id] !== uri) {
            merged[id] = uri;
            changed = true;
          }
        } else if (prev[id]) {
          delete merged[id];
          changed = true;
        }
      }
      return changed ? merged : prev;
    });

    setCheckedVideoCacheIds(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const id of checkedIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    return () => {
      if (staggerTimeout) {
        clearTimeout(staggerTimeout);
      }
    };
  }, [currentVisibleIndex, shortsData, activeVideoPrepared]);

  // Deep link: scroll to specific short when effectiveShortId is set (URL or props). dataIndex accounts for ad slots when showShortsAds.
  useEffect(() => {
    if (!effectiveShortId || shorts.length === 0 || !isTransitionFinished) return;
    const reelIndex = shorts.findIndex(s => s._id === effectiveShortId);
    if (reelIndex === -1) return;
    const dataIndex = showShortsAds
      ? reelIndex + Math.floor(reelIndex / SHORTS_ADS_AFTER_EVERY)
      : reelIndex;
    setCurrentIndex(dataIndex);
    setCurrentVisibleIndex(dataIndex);
    const attemptScroll = (attempt: number = 0) => {
      if (attempt > 5) {
        isInitialScrollDoneRef.current = true;
        return;
      }
      setTimeout(() => {
        if (flatListRef.current) {
          try {
            flatListRef.current.scrollToIndex({ index: dataIndex, animated: false });
            isInitialScrollDoneRef.current = true;
          } catch {
            attemptScroll(attempt + 1);
          }
        } else {
          attemptScroll(attempt + 1);
        }
      }, 100 * (attempt + 1));
    };
    attemptScroll();
  }, [effectiveShortId, shorts, showShortsAds, isTransitionFinished]);



  // Preload next reel and track video views (reels only; skip when visible item is ad)
  useEffect(() => {
    // Clear any active timer for a previous short
    if (viewTimerRef.current) {
      clearTimeout(viewTimerRef.current);
      viewTimerRef.current = null;
    }

    const visibleItem = shortsData[currentVisibleIndex] as ShortsItem | undefined;
    if (visibleItem && !isAdItem(visibleItem)) {
      const currentShort = visibleItem as PostType;
      
      // Start a 1-second timer. User must stay on this short for 1s to count as a view.
      viewTimerRef.current = setTimeout(async () => {
        if (currentUser?._id && currentShort.user?._id === currentUser._id) {
          viewTimerRef.current = null;
          return;
        }
        const result = await logContentView(currentShort._id, 'short', { type: 'short', source: 'shorts_feed' });
        if (result.incremented) {
          const existing = shortsRef.current.find(short => short._id === currentShort._id);
          const emittedViewsCount = existing
            ? (((existing as any).viewsCount ?? (existing as any).views ?? 0) + 1)
            : null;
          setShorts(prev => prev.map(short => {
            if (short._id !== currentShort._id) return short;
            const nextViews = emittedViewsCount ?? (((short as any).viewsCount ?? (short as any).views ?? 0) + 1);
            return { ...short, viewsCount: nextViews, views: nextViews } as any;
          }));
          if (emittedViewsCount !== null) {
            realtimePostsService.emitLocalView(currentShort._id, emittedViewsCount, currentUser?._id);
          }
        }
        viewTimerRef.current = null;
      }, SHORT_VIEW_DWELL_MS);
    }
    for (let i = currentVisibleIndex + 1; i < shortsData.length; i++) {
      const nextItem = shortsData[i] as ShortsItem;
      if (nextItem && !isAdItem(nextItem)) {
        const nextShort = nextItem as PostType;
        setTimeout(() => logger.debug('Preloading next video:', nextShort._id), 1000);
        break;
      }
    }

    return () => {
      // Clear timer if user scrolls/swipes away before 2 seconds
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
    };
  }, [currentVisibleIndex, shortsData, getVideoUrl, currentUser?._id]);

  useEffect(() => {
    handlersRef.current = {
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      handleTouchCancel,
      handleDeleteShort,
      handleProfilePress,
      handleLike,
      handleComment,
      handleShare,
      handleSave,
      getVideoUrl,
      refetchShortWithFreshUrl: handleUrlRefetch,
      removeLocalVideoUri,
      handleSongPlayingChange,
      onVideoReady: handleVideoReady,
    };
  }, [
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    handleDeleteShort,
    handleProfilePress,
    handleLike,
    handleComment,
    handleShare,
    handleSave,
    getVideoUrl,
    handleUrlRefetch,
    removeLocalVideoUri,
    handleSongPlayingChange,
    handleVideoReady,
  ]);

  // Memoized video item component to prevent unnecessary re-renders
  // Renders either a reel (PostType) or a full-screen ShortsNativeAd (after every 5 reels, max 3).
  const renderShortItem = useCallback(({ item, index }: { item: ShortsItem; index: number }) => {
    if (isAdItem(item)) {
      return (
        <View style={[styles.shortItem, styles.shortItemAdWrapper, { height: containerHeight }]}>
          <ShortsNativeAd
            adIndex={item.adIndex}
            height={containerHeight}
            fillParent
            onImpression={() => {
              consecutiveAdFailuresRef.current = 0; // Reset on successful impression
              adsShownThisSessionRef.current += 1;
               setAdsShownThisSession((prev) => prev + 1);
              // Persistent 5-per-8h cap, shared with the home feed. Fire-and-forget;
              // adCap handles AsyncStorage write + listener notification internally.
              recordGoogleAdImpression();
            }}
            onLoadFailed={() => {
              consecutiveAdFailuresRef.current += 1;
              setFailedAdIndices(prev => {
                if (prev.includes(item.adIndex)) return prev;
                return [...prev, item.adIndex];
              });
              if (__DEV__) {
                console.warn(
                  `[AdMob] [DEV] Shorts ad slot failed to load (consecutive failures: ${consecutiveAdFailuresRef.current}).`
                );
              }
              if (consecutiveAdFailuresRef.current >= 3) {
                logger.warn(`[AdMob] 3 consecutive ad load failures. Wiping ad slots for session.`);
                setShortsAdsBroken(true);
              } else {
                logger.info(`[AdMob] Ad load failed (consecutive failures: ${consecutiveAdFailuresRef.current}/3). Tolerating transient failure.`);
              }
            }}
          />
        </View>
      );
    }

    // Reel item
    const isFollowing = followStates[item.user._id] || false;
    const isSaved = savedShorts.has(item._id);
    const isLiked = item.isLiked || false;
    const isActive = index === currentVisibleIndex;
    const shouldPreload = isScreenFocused && index === currentVisibleIndex + 1;
    const shouldRenderVideo = Math.abs(index - currentVisibleIndex) <= 1;

    return (
      <ShortsCell
        item={item}
        index={index}
        isActive={isActive}
        shouldPreload={shouldPreload}
        shouldRenderVideo={shouldRenderVideo}
        isVideoPlaying={isVideoPlaying}
        isScreenFocused={isScreenFocused}
        isMuted={props.isMuted !== undefined ? props.isMuted : isFeedMuted}
        currentUser={currentUser}
        containerHeight={containerHeight}
        isFollowing={isFollowing}
        isSaved={isSaved}
        isLiked={isLiked}
        localVideoUri={localVideoUris[item._id]}
        isCacheChecked={checkedVideoCacheIds.has(item._id)}
        isSavedShorts={props.isSavedShorts}
        effectiveUserId={effectiveUserId}
        handlers={handlersRef.current}
        videoRefs={videoRefs}
        currentPlayerRef={currentPlayerRef}
        progressCallbacks={progressCallbacks}
        lastVideoPositionRef={lastVideoPositionRef}
        activeStartedWithRemoteRef={activeStartedWithRemoteRef}
        showSwipeHint={showSwipeHint}
        fadeAnimation={fadeAnimation}
        likedShortIdsRef={likedShortIdsRef}
        videoCacheRef={videoCacheRef}
        appState={appState}
      />
    );
  }, [
    currentVisibleIndex,
    isVideoPlaying,
    isScreenFocused,
    props.isMuted,
    isFeedMuted,
    currentUser,
    containerHeight,
    followStates,
    savedShorts,
    localVideoUris,
    props.isSavedShorts,
    effectiveUserId,
    showSwipeHint,
    fadeAnimation,
    appState,
    checkedVideoCacheIds,
  ]);

  const keyExtractor = useCallback((item: ShortsItem) => {
    if (isAdItem(item)) return `ad-${item.adIndex}`;
    return item._id;
  }, []);


  // Track viewable items; handle ad vs reel. Frequency: set hasWatchedFiveReels when user has viewed reel at index >= 5.
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length === 0) return;
    const visibleItem = viewableItems[0];
    const newVisibleIndex = visibleItem.index;
    const item = visibleItem.item as ShortsItem;

    if (newVisibleIndex === undefined || newVisibleIndex === null || newVisibleIndex === currentVisibleIndexRef.current) return;

    if (!isInitialScrollDoneRef.current) {
      if (newVisibleIndex === targetInitialIndexRef.current) {
        isInitialScrollDoneRef.current = true;
      } else {
        return;
      }
    }

    // Pause previous short's audio immediately when user scrolls to another video.
    // NOTE: Only pause here — do NOT call audioManager.stopAll() which destructively
    // unloads the sound. SongPlayer handles full stop + unload when isVisible becomes false,
    // and audioManager.playSound() calls stopAll() before playing the next sound.
    if (currentPlayerRef.current) {
      currentPlayerRef.current.pauseAsync?.().catch(() => {});
      currentPlayerRef.current = null;
    }
    // Also pause the current active sound in audioManager to prevent overlapping audio
    audioManager.pauseCurrentSound().catch(() => {});

    const previousIndex = currentVisibleIndexRef.current;
    const previousItem = shortsDataRef.current[previousIndex] as ShortsItem | undefined;

    setCurrentVisibleIndex(newVisibleIndex);
    setCurrentIndex(newVisibleIndex);
    currentVisibleIndexRef.current = newVisibleIndex;

    // Reel view tracking is done here.

    // Pause previous video if previous item was a reel
    if (previousItem && !isAdItem(previousItem)) {
      const previousVideoId = previousItem._id;
      const previousVideo = videoRefs.current[previousVideoId];
      userPausedShortIdsRef.current.delete(previousVideoId);
      if (previousVideo) {
        previousVideo.pauseAsync().catch(() => {});
      }
    }

    if (activeVideoIdRef.current && item && !isAdItem(item) && item._id !== activeVideoIdRef.current) {
      activeVideoIdRef.current = null;
    }

    // If new visible item is a reel, mark it active for playback; if ad, leave video paused
    if (item && !isAdItem(item)) {
      activeVideoIdRef.current = item._id;
    } else {
      activeVideoIdRef.current = null;
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60, // Lower threshold so visibility triggers sooner during snap animation
    minimumViewTime: 50, // Reduced from 100ms — faster visibility detection after snap
  }).current;

  const showLoading = loading || !isTransitionFinished;

  if (showLoading) {
    return (
      <ErrorBoundary level="route">
        <View style={[styles.loadingContainer, { backgroundColor: '#000000' }]}>
          <LoadingGlobe size="large" color="#38BDF8" />
        </View>
      </ErrorBoundary>
    );
  }

  if (shorts.length === 0) {
    return null;
  }

  return (
    <ErrorBoundary level="route">
    <View 
      style={styles.container}
      onLayout={(e) => {
        const { height } = e.nativeEvent.layout;
        if (height > 0 && height !== containerHeight) {
          setContainerHeight(height);
        }
      }}
    >
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateX: swipeAnimation }],
        }}
      >
        <StatusBar 
          barStyle="light-content" 
          backgroundColor="transparent" 
          translucent={true}
        />

      {/* Premium Top Bar Overlay */}
      {(() => {
        // If it's a scoped view, we do NOT want to render the topBar overlay at all because the parent page renders its own header!
        if (effectiveUserId || props.isSavedShorts) {
          return null;
        }

        const currentShort = shorts[currentVisibleIndex] as PostType | undefined;
        const hasSong = !!(currentShort?.song?.songId && (currentShort.song.songId._id || typeof currentShort.song.songId === 'string'));
        const isMuted = currentShort ? (props.isMuted !== undefined ? props.isMuted : isFeedMuted) : false;
        
        return (
          <View style={styles.topBar}>
            <View style={styles.topBarContent}>
              {/* Left Back Button */}
              <TouchableOpacity
                style={styles.topBarButton}
                onPress={handleBack}
                accessibilityLabel="Go back"
                accessibilityRole="button"
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>

              {/* Centered Shorts Title */}
              <Text style={styles.topBarTitle}>Shorts</Text>

              {/* Right Mute Button - Always Visible for every Short */}
              {currentShort ? (
                <TouchableOpacity
                  style={styles.topBarButton}
                  onPress={() => {
                    if (!currentShort) return;
                    if (props.onMuteToggle) {
                      props.onMuteToggle();
                    } else {
                      audioManager.setSessionMuted(!audioManager.getSessionMuted());
                    }
                  }}
                  accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
                  accessibilityRole="button"
                >
                  <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={24} color="#fff" />
                </TouchableOpacity>
              ) : (
                <View style={styles.topBarButtonEmpty} />
              )}
            </View>
          </View>
        );
      })()}

      <AnyFlashList
        ref={flatListRef}
        estimatedItemSize={containerHeight}
        scrollEnabled={!isSwipeActive}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        data={shortsData}
        renderItem={renderShortItem}
        keyExtractor={keyExtractor}
        initialScrollIndex={(() => {
          if (!effectiveShortId || shorts.length === 0) return undefined;
          const reelIndex = shorts.findIndex(s => s._id === effectiveShortId);
          if (reelIndex === -1) return undefined;
          const dataIndex = showShortsAds ? reelIndex + Math.floor(reelIndex / SHORTS_ADS_AFTER_EVERY) : reelIndex;
          return dataIndex;
        })()}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        snapToInterval={containerHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum={true}
        onEndReached={loadMoreShorts}
        onEndReachedThreshold={0.3}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        directionalLockEnabled={false}
        alwaysBounceVertical={true}
        bounces={true}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentInset={{ top: 0, bottom: 0, left: 0, right: 0 }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Comment Modal */}
      {selectedShortId && (
        <PostComments
          postId={selectedShortId}
          visible={showCommentModal}
          comments={selectedShortComments}
          onClose={() => {
            setShowCommentModal(false);
            setSelectedShortId(null);
            setSelectedShortComments([]);
          }}
          onCommentAdded={handleCommentAdded}
        />
      )}

      {/* Share Modal */}
      {selectedShortForShare && (
        <ShareModal
          visible={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setSelectedShortForShare(null);
          }}
          post={{
            _id: selectedShortForShare._id,
            caption: selectedShortForShare.caption,
            imageUrl: selectedShortForShare.thumbnailUrl || selectedShortForShare.imageUrl || '',
            mediaUrl: selectedShortForShare.mediaUrl || selectedShortForShare.videoUrl,
            videoUrl: selectedShortForShare.videoUrl,
            user: selectedShortForShare.user,
          }}
        />
      )}
      </Animated.View>
    </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    paddingTop: 0,
    marginTop: 0,
    ...(isWeb && {
      maxWidth: isTablet ? 800 : 600,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  loadingContent: {
    alignItems: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xxl : 32,
  },
  loadingSpinner: {
    marginBottom: isTablet ? theme.spacing.lg : 16,
  },
  loadingTitle: {
    fontSize: isTablet ? theme.typography.h1.fontSize : 24,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    color: 'white',
    marginBottom: isTablet ? theme.spacing.sm : 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  loadingSubtitle: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('400'),
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    maxWidth: isTablet ? 500 : 300,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xxl : 32,
  },
  emptyTitle: {
    fontSize: isTablet ? theme.typography.h1.fontSize : 24,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    color: 'white',
    marginTop: isTablet ? theme.spacing.lg : 16,
    marginBottom: isTablet ? theme.spacing.sm : 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  emptyDescription: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('400'),
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: isTablet ? 28 : 24,
    marginBottom: isTablet ? theme.spacing.xl : 32,
    maxWidth: isTablet ? 500 : 300,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  createShortButton: {
    borderRadius: isTablet ? 30 : 25,
    overflow: 'hidden',
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  createShortGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xl : 24,
    paddingVertical: isTablet ? theme.spacing.md : 12,
  },
  createShortButtonText: {
    color: 'white',
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginLeft: isTablet ? theme.spacing.sm : 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  shortItem: {
    width: '100%',
    flex: 1,
    height: (isWeb ? '100vh' : Dimensions.get('window').height) as any,
    position: 'relative',
    backgroundColor: 'black',
  },
  shortItemAdWrapper: {
    height: SHORTS_ITEM_HEIGHT,
    overflow: 'hidden',
  },
  videoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: 'black',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 1,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
    zIndex: 1,
  },
  likeAnimationContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  likeParticleContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    zIndex: 14,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -35 }, { translateY: -35 }], // Fixed transform for stability
    zIndex: 10,
    width: 70, // Fixed dimensions to prevent flexing during re-renders
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    // Prevent layout shifts during re-renders
    flexShrink: 0,
    flexGrow: 0,
  },
  playButtonBlur: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  swipeHint: {
    position: 'absolute',
    top: 100,
    right: 20,
    zIndex: 15,
  },
  swipeHintBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  swipeHintText: {
    color: 'white',
    fontSize: isTablet ? theme.typography.small.fontSize + 1 : 12,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    marginLeft: isTablet ? 8 : 6,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  rightActions: {
    position: 'absolute',
    right: isTablet ? theme.spacing.lg : 12,
    bottom: Platform.OS === 'ios' ? (isWeb ? 110 : 106) : (isWeb ? 100 : 106),
    alignItems: 'center',
    zIndex: 5,
  },
  profileButton: {
    marginBottom: 16,
    position: 'relative',
  },
  actionsAvatarContainer: {
    width: isTablet ? 60 : 50,
    height: isTablet ? 60 : 50,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsGradientBorder: {
    width: isTablet ? 58 : 48,
    height: isTablet ? 58 : 48,
    borderRadius: isTablet ? 29 : 24,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsProfileImage: {
    width: isTablet ? 52 : 42,
    height: isTablet ? 52 : 42,
    borderRadius: isTablet ? 26 : 21,
    backgroundColor: '#333',
  },
  profileImage: {
    width: isTablet ? 60 : 50,
    height: isTablet ? 60 : 50,
    borderRadius: isTablet ? 30 : 25,
    borderWidth: 2,
    borderColor: 'white',
  },
  followButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3040',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  followingButton: {
    backgroundColor: '#2196F3',
    borderColor: 'white',
    borderWidth: 2,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 16,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isTablet ? 6 : 4,
  },
  likedContainer: {
  },
  actionText: {
    color: 'white',
    fontSize: isTablet ? theme.typography.small.fontSize + 1 : 12,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  bottomContent: {
    position: 'absolute',
    bottom: isWeb ? 30 : 96,
    left: 0,
    right: 80,
    paddingBottom: 0,
    paddingTop: 0,
    paddingHorizontal: 20,
    zIndex: 5,
  },
  bottomGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 0,
  },
  bottomContentInner: {
    position: 'relative',
    zIndex: 1,
  },
  userProfileSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bottomAvatarContainer: {
    width: 48,
    height: 48,
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomGradientBorder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomProfileImage: {
    width: 43,
    height: 43,
    borderRadius: 21.5,
    backgroundColor: '#333',
  },
  albumArtContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 5,
  },
  albumArtImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  albumArtInnerRing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2.5,
    borderColor: 'rgba(0,0,0,0.8)',
    backgroundColor: 'transparent',
    opacity: 0,
  },
  userDetails: {
    flex: 1,
    paddingTop: 0, // Reduced from 2 to 0 to move text up slightly
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'nowrap',
  },
  username: {
    color: 'white',
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginRight: 6,
    flexShrink: 1,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  cyclingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  cyclingText: {
    color: '#38BDF8',
    fontSize: 14,
    marginLeft: 6,
    fontFamily: getFontFamily('400'),
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  cyclingAnimatedWrapper: {
    height: 20,
    justifyContent: 'center',
    marginVertical: 4,
  },
  followingBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: isTablet ? theme.spacing.sm : 8,
    paddingVertical: isTablet ? 4 : 2,
    borderRadius: isTablet ? 12 : 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  followingText: {
    color: 'white',
    fontSize: isTablet ? theme.typography.small.fontSize : 10,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  caption: {
    color: 'rgba(255,255,255,0.98)',
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    lineHeight: isTablet ? 22 : 20,
    marginTop: 6,
    marginBottom: 0,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 6,
  },
  tagBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  tag: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tagBadgeGradient: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  tagTextGradient: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  songPlayerWrapper: {
    marginTop: 14,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'flex-start',
    zIndex: 100,
  },
  hiddenSongPlayer: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  inlineSong: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  inlineSongText: {
    color: '#38BDF8',
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('400'),
    marginLeft: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  inlineLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  inlineLocationText: {
    color: '#38BDF8',
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('400'),
    marginLeft: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 80 : 64,
    zIndex: 100,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 36 : 20,
    height: '100%',
    width: '100%',
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarButtonEmpty: {
    width: 40,
    height: 40,
  },
  topBarTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: getFontFamily('700'),
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  moreText: {
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: isWeb ? 8 : 77,
    alignSelf: 'center',
    width: 226,
    height: 24,
    justifyContent: 'center',
    zIndex: 20,
  },
  progressBarBackground: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  pinkMarker: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF2E93',
    top: 9,
    shadowColor: '#FF2E93',
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 3,
  },
  scrubberTooltip: {
    position: 'absolute',
    bottom: 24,
    backgroundColor: 'rgba(15, 15, 18, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    marginLeft: -25,
  },
  scrubberTooltipText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  modalContentStyle: {
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  modalLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyText: {
    fontSize: 15,
  },
  list: {
    maxHeight: 500,
  },
  listContent: {
    paddingBottom: 24,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    marginLeft: 12,
  },
  fullName: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalUsername: {
    fontSize: 13,
    marginTop: 2,
  },
});
