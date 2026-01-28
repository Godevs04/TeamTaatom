import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
  Animated,
  AppState,
  BackHandler,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode, AVPlaybackStatus, Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { getShorts, getUserShorts, toggleLike, addComment, getPostById, deleteShort } from '../../services/posts';
import { toggleFollow } from '../../services/profile';
import { PostType } from '../../types/post';
import { getUserFromStorage } from '../../services/auth';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAlert } from '../../context/AlertContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PostComments from '../../components/post/PostComments';
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';
import { trackScreenView, trackEngagement, trackPostView } from '../../services/analytics';
import SongPlayer from '../../components/SongPlayer';
import { theme } from '../../constants/theme';
import { audioManager } from '../../utils/audioManager';
import PostLocation from '../../components/post/PostLocation';
import { geocodeAddress } from '../../utils/locationUtils';
import { socketService } from '../../services/socket';
import ShareModal from '../../components/ShareModal';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';
const logger = createLogger('ShortsScreen');

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
export default function ShortsScreen() {
  const [shorts, setShorts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Track visible index precisely using onViewableItemsChanged
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoStates, setVideoStates] = useState<{ [key: string]: boolean }>({});
  const [showPauseButton, setShowPauseButton] = useState<{ [key: string]: boolean }>({});
  const [showLikeAnimation, setShowLikeAnimation] = useState<{ [key: string]: boolean }>({});
  const [likeAnimationParticles, setLikeAnimationParticles] = useState<{ [key: string]: Array<{ id: string; x: number; y: number }> }>({});
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [savedShorts, setSavedShorts] = useState<Set<string>>(new Set());
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedShortId, setSelectedShortId] = useState<string | null>(null);
  const [selectedShortComments, setSelectedShortComments] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedShortForShare, setSelectedShortForShare] = useState<PostType | null>(null);
  const [followStates, setFollowStates] = useState<{ [key: string]: boolean }>({});
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [swipeStartY, setSwipeStartY] = useState<number | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [videoQuality, setVideoQuality] = useState<'low' | 'medium' | 'high'>('high');
  
  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<{ [key: string]: Video | null }>({});
  const pauseTimeoutRefs = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const likeAnimationRefs = useRef<{ [key: string]: Animated.Value }>({});
  const likeParticleRefs = useRef<{ [key: string]: ParticleAnimations }>({});
  const swipeAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;
  // Track currently active video to ensure only one plays at a time
  const activeVideoIdRef = useRef<string | null>(null);
  // Track last viewed short ID for analytics de-duplication
  const lastViewedShortIdRef = useRef<string | null>(null);
  // Guard to prevent duplicate navigation on rapid swipes
  const isNavigatingRef = useRef<boolean>(false);
  const lastNavigationUserIdRef = useRef<string | null>(null);
  const lastViewTimeRef = useRef<number>(0);
  const VIEW_DEBOUNCE_MS = 2000; // Prevent duplicate view events within 2 seconds
  // Ref to store loadShorts function for socket handlers (prevents stale closure)
  const loadShortsRef = useRef<(() => Promise<void>) | null>(null);
  // Refs for handlers to avoid recreating renderItem on every handler change
  const handlersRef = useRef({
    handleTouchStart: null as any,
    handleTouchMove: null as any,
    handleTouchEnd: null as any,
    toggleVideoPlayback: null as any,
    showPauseButtonTemporarily: null as any,
    handleDeleteShort: null as any,
    handleProfilePress: null as any,
    handleLike: null as any,
    handleComment: null as any,
    handleShare: null as any,
    handleSave: null as any,
    getVideoUrl: null as any,
    refetchShortWithFreshUrl: null as any,
    retryVideoLoad: null as any,
  });
  
  const { theme, mode } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
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
          setVideoStates(prev => ({ ...prev, [activeVideoIdRef.current!]: false }));
          logger.debug(`Paused current video: ${activeVideoIdRef.current}`);
        } catch (error) {
          logger.warn(`Error pausing current video:`, error);
        }
      }
      activeVideoIdRef.current = null;
    }
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
      
      // Update state
      setVideoStates(prev => {
        const newState = { ...prev };
        delete newState[videoId];
        return newState;
      });
      
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
      setVideoStates(prev => {
        const newState = { ...prev };
        delete newState[videoId];
        return newState;
      });
    }
  }, []);

  useEffect(() => {
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
      
      // Clear all pause timeouts
      Object.values(pauseTimeoutRefs.current).forEach(timeout => {
        clearTimeout(timeout);
      });
      pauseTimeoutRefs.current = {};
      
      // Clear video cache
      if (videoCacheRef.current) {
        videoCacheRef.current.clear();
      }
      
      // Reset active video tracking
      activeVideoIdRef.current = null;
      lastViewedShortIdRef.current = null;
    };
  }, [params.userId]);


  // Handle app backgrounding/foregrounding and screen focus/blur
  // Pause videos when screen loses focus or app goes to background
  // Uses centralized pauseCurrentVideo helper to prevent race conditions
  // Reset navigation guard when screen comes into focus (user navigated back)
  // CRITICAL: Refresh shorts feed when screen comes into focus (real-time updates after upload)
  useFocusEffect(
    useCallback(() => {
      // Reset navigation guard when returning to screen
      isNavigatingRef.current = false;
      lastNavigationUserIdRef.current = null;
      
      // Refresh shorts feed when screen comes into focus (handles real-time updates after upload)
      // Use a small delay to prevent unnecessary refreshes on every tab switch
      // This ensures newly uploaded shorts appear immediately when user navigates to shorts tab
      const refreshTimer = setTimeout(() => {
        // Only refresh if we're not filtering by a specific user (general feed)
        const userIdParam = params.userId;
        const shouldFilterByUser = userIdParam && typeof userIdParam === 'string';
        if (!shouldFilterByUser) {
          logger.debug('Shorts screen focused - refreshing feed for real-time updates');
          // Use ref to avoid stale closure issues
          const loadFn = loadShortsRef.current;
          if (loadFn) {
            loadFn();
          }
        }
      }, 300); // Small delay to prevent excessive refreshes on rapid tab switching
      
      return () => {
        clearTimeout(refreshTimer);
        // Cleanup on blur if needed
      };
    }, [params.userId])
  );

  useFocusEffect(
    useCallback(() => {
      // CRITICAL: Set audio mode for shorts playback (main speaker, not earpiece)
      // This ensures audio plays through main speaker even if call service changed it
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false, // CRITICAL: Use main speaker for shorts
      }).catch(err => {
        logger.error('Error setting audio mode for shorts:', err);
      });
      
      // Screen focused - resume current video if it exists
      if (activeVideoIdRef.current && shorts[currentVisibleIndex]) {
        const currentVideoId = shorts[currentVisibleIndex]._id;
        if (currentVideoId === activeVideoIdRef.current) {
          const video = videoRefs.current[currentVideoId];
          if (video) {
            video.playAsync().catch((error) => {
              logger.warn(`Error resuming video on focus:`, error);
            });
          }
        }
      }
      
      return () => {
        // Screen blurred (tab switch OR back press) - pause current video and stop all audio
        // This ensures video pauses immediately when user leaves Shorts screen
        pauseCurrentVideo();
        // Also stop any background audio from posts
        logger.debug('[Shorts] Stopping all audio - leaving shorts page');
        audioManager.stopAll().catch((error) => {
          logger.error('[Shorts] Error stopping audio:', error);
        });
      };
    }, [currentVisibleIndex, shorts, pauseCurrentVideo])
  );

  // Handle app state changes (background/foreground)
  // Uses centralized pauseCurrentVideo helper
  useEffect(() => {
    if (Platform.OS === 'web') return; // AppState not needed on web
    
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App going to background - pause current video and release resources
        pauseCurrentVideo();
        logger.debug('App backgrounded, paused current video');
      } else if (nextAppState === 'active') {
        // App coming to foreground - resume current video if screen is focused
        if (activeVideoIdRef.current && shorts[currentVisibleIndex]) {
          const currentVideoId = shorts[currentVisibleIndex]._id;
          if (currentVideoId === activeVideoIdRef.current) {
            const video = videoRefs.current[currentVideoId];
            if (video) {
              video.playAsync().catch((error) => {
                logger.warn(`Error resuming video on foreground:`, error);
              });
            }
          }
        }
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [currentVisibleIndex, shorts, pauseCurrentVideo]);

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
  // Pauses video then navigates back
  // If userId is in params, navigate back to that profile page
  // - If userId matches current user, go to own profile tab: /(tabs)/profile
  // - If userId is different, go to other user's profile: /profile/${userId}
  // Otherwise, use router.back() to go to previous screen
  const handleBack = useCallback(async () => {
    pauseCurrentVideo();
    
    // If we came from a profile page (userId param exists), navigate back to that profile
    if (params.userId && typeof params.userId === 'string') {
      // Check if this is the current user's own profile
      let isOwnProfile = false;
      try {
        if (currentUser?._id) {
          isOwnProfile = currentUser._id === params.userId;
        } else {
          // If currentUser not loaded yet, try to get it
          const user = await getUserFromStorage();
          isOwnProfile = user?._id === params.userId;
        }
      } catch (error) {
        logger.debug('Error checking if own profile:', error);
      }
      
      if (isOwnProfile) {
        // Navigate to own profile tab
        router.push('/(tabs)/profile');
      } else {
        // Navigate to other user's profile
        router.push(`/profile/${params.userId}`);
      }
    } else {
      // Otherwise, use normal back navigation
      router.back();
    }
  }, [pauseCurrentVideo, router, params.userId, currentUser]);

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

  // Cleanup videos that are far from viewport
  // Uses centralized stopAndUnloadVideo helper
  useEffect(() => {
    const cleanupDistance = 2; // Cleanup videos more than 1 position away (since we keep prev/current/next)
    Object.keys(videoRefs.current).forEach((videoId) => {
      const videoIndex = shorts.findIndex(s => s._id === videoId);
      if (videoIndex === -1) return;
      
      const distance = Math.abs(videoIndex - currentVisibleIndex);
      if (distance > cleanupDistance) {
        // Use centralized helper to ensure proper cleanup
        stopAndUnloadVideo(videoId);
      }
    });
  }, [currentVisibleIndex, shorts, stopAndUnloadVideo]);

  // Video cache for offline support
  const videoCacheRef = useRef<Map<string, { url: string; timestamp: number }>>(new Map());
  const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  // Get quality-adaptive video URL with caching
  // Priority: videoUrl > mediaUrl > imageUrl (for shorts, videoUrl should always be present)
  // CRITICAL: Signed URLs expire after 15 minutes, so cache is limited to 10 minutes
  const getVideoUrl = useCallback((item: PostType) => {
    // Prioritize videoUrl for shorts, fallback to mediaUrl or imageUrl
    const baseUrl = item.videoUrl || item.mediaUrl || item.imageUrl;
    const videoId = item._id;
    
    // Validate base URL exists
    if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
      logger.error(`Invalid video URL for item ${videoId}:`, {
        videoUrl: item.videoUrl,
        mediaUrl: item.mediaUrl,
        imageUrl: item.imageUrl
      });
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
            return cached.url;
          } else {
            // Cache is getting old, but still valid - return it but don't update cache timestamp
            // This will force a refresh on next call
            logger.debug(`Video ${videoId} cache is close to expiry (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
            return cached.url;
          }
        } else {
          // Base URL changed, clear cache for this item
          videoCacheRef.current.delete(videoId);
        }
      } else {
        // Cache expired, clear it
        logger.debug(`Video ${videoId} cache expired (${Math.round(cacheAge / 1000 / 60)} minutes old), clearing`);
        videoCacheRef.current.delete(videoId);
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
    
    logger.debug(`Video URL for ${videoId} (fresh):`, url.substring(0, 100) + '...');
    return url;
  }, [videoQuality]);
  
  // Track previous visible index to detect actual scroll changes
  const previousVisibleIndexRef = useRef<number>(-1);
  
  // Enhanced: Ensure video playback syncs with currentVisibleIndex changes
  // This effect guarantees previous video pauses and new video plays when scrolling
  // Runs after onViewableItemsChanged updates currentVisibleIndex
  useEffect(() => {
    // Only run if the visible index actually changed (not just shorts array content)
    if (previousVisibleIndexRef.current === currentVisibleIndex) {
      return;
    }
    
    if (!shorts[currentVisibleIndex]) return;

    // Update previous index
    previousVisibleIndexRef.current = currentVisibleIndex;

    // 🔥 Critical: Stop all previous Taatom library audio instantly on scroll
    audioManager.stopAll().catch(() => {});

    const currentShortId = shorts[currentVisibleIndex]._id.toString();
    const currentVideo = videoRefs.current[currentShortId];

    // Pause all other videos
    Object.keys(videoRefs.current).forEach(id => {
      if (id !== currentShortId) {
        videoRefs.current[id]?.pauseAsync().catch(() => {});
        setVideoStates(prev => ({ ...prev, [id]: false }));
      }
    });

    // Play current video
    if (currentVideo) {
      activeVideoIdRef.current = currentShortId;
      // Get current status and play if not already playing
      currentVideo.getStatusAsync().then((status) => {
        if (status.isLoaded) {
          // If music exists, ensure video is muted
          const hasMusic = !!(shorts[currentVisibleIndex]?.song?.songId?.s3Url);
          if (hasMusic) {
            currentVideo.setIsMutedAsync(true).catch(() => {});
            currentVideo.setVolumeAsync(0.0).catch(() => {});
          }
          
          // Play if not already playing
          if (!status.isPlaying) {
            currentVideo.playAsync().then(() => {
              setVideoStates(prev => ({ ...prev, [currentShortId]: true }));
              logger.debug(`Video ${currentShortId} started playing via useEffect`);
            }).catch((error) => {
              logger.error(`Video ${currentShortId} failed to play via useEffect:`, error);
              // Retry after short delay
              setTimeout(() => {
                currentVideo.playAsync().catch(() => {});
              }, 500);
            });
          } else {
            setVideoStates(prev => ({ ...prev, [currentShortId]: true }));
          }
        } else {
          // Video not loaded yet, wait for onLoad callback
          logger.debug(`Video ${currentShortId} not loaded yet, waiting for onLoad`);
        }
      }).catch((error) => {
        logger.error(`Failed to get status for video ${currentShortId}:`, error);
        // Try to play anyway
        currentVideo.playAsync().catch(() => {});
      });
    } else {
      // Video ref not available yet, mark as active for when it mounts
      activeVideoIdRef.current = currentShortId;
      setVideoStates(prev => ({ ...prev, [currentShortId]: true }));
      logger.debug(`Video ref not available for ${currentShortId}, will play when mounted`);
    }
  }, [currentVisibleIndex, shorts]);

  // Preload next video for smoother playback and track video views
  // Includes de-duplication to prevent duplicate view events on fast swiping
  // Uses currentVisibleIndex for accurate tracking
  useEffect(() => {
    if (shorts[currentVisibleIndex]) {
      const currentShort = shorts[currentVisibleIndex];
      const now = Date.now();
      
      // De-duplicate view tracking: only track if different short or enough time passed
      if (
        lastViewedShortIdRef.current !== currentShort._id ||
        (now - lastViewTimeRef.current) > VIEW_DEBOUNCE_MS
      ) {
        trackPostView(currentShort._id, {
          type: 'short',
          source: 'shorts_feed'
        });
        lastViewedShortIdRef.current = currentShort._id;
        lastViewTimeRef.current = now;
      }
    }
    
    if (currentVisibleIndex < shorts.length - 1) {
      const nextShort = shorts[currentVisibleIndex + 1];
      if (nextShort) {
        const nextVideoUrl = getVideoUrl(nextShort);
        // Preload video in background
        setTimeout(() => {
          // Video preloading happens automatically when Video component mounts
          logger.debug('Preloading next video:', nextShort._id);
        }, 1000);
      }
    }
  }, [currentVisibleIndex, shorts, getVideoUrl]);

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
      const short = response?.post || response;
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

  // Helper function to retry video loading
  const retryVideoLoad = useCallback((videoId: string, delay: number = 1000) => {
    setTimeout(() => {
      const video = videoRefs.current[videoId];
      if (video) {
        const short = shorts.find(s => s._id === videoId);
        if (short) {
          const videoUrl = getVideoUrl(short);
          video.unloadAsync().then(() => {
            video.loadAsync({ uri: videoUrl }).then(() => {
              video.playAsync().catch(() => {
                logger.error(`Video ${videoId} retry play failed`);
              });
            }).catch((loadError) => {
              logger.error(`Video ${videoId} retry load failed:`, loadError);
            });
          }).catch(() => {
            // If unload fails, try to reload directly
            video.loadAsync({ uri: videoUrl }).catch(() => {});
          });
        }
      }
    }, delay);
  }, [shorts, getVideoUrl]);

  const loadShorts = useCallback(async () => {
    try {
      setLoading(true);
      
      // CRITICAL: If userId is provided in params, filter to show only that user's shorts
      // This ensures when clicking from another user's profile, only their shorts are shown
      const userIdParam = params.userId;
      const shouldFilterByUser = userIdParam && typeof userIdParam === 'string';
      
      let response;
      if (shouldFilterByUser) {
        // Load only the specified user's shorts (from profile page)
        logger.debug(`Loading shorts for specific user: ${userIdParam}`);
        response = await getUserShorts(userIdParam, 1, 100); // Get more shorts for user-specific view
      } else {
        // Load all shorts (general feed)
        response = await getShorts(1, 20);
      }
      
      // Clear video cache when loading new shorts (old URLs might be expired)
      videoCacheRef.current.clear();
      setShorts(response.shorts);
      
      // Scroll to specific short if shortId is provided in params
      if (params.shortId && typeof params.shortId === 'string' && response.shorts.length > 0) {
        const targetIndex = response.shorts.findIndex(s => s._id === params.shortId);
        if (targetIndex !== -1) {
          // Set the index immediately so it's ready when FlatList renders
          setCurrentIndex(targetIndex);
          setCurrentVisibleIndex(targetIndex);
          
          // Use multiple attempts with increasing delays to ensure scroll works
          // This handles cases where FlatList isn't ready immediately
          const attemptScroll = (attempt: number = 0) => {
            if (attempt > 5) {
              logger.warn(`Failed to scroll to short ${params.shortId} after 5 attempts`);
              return;
            }
            
            setTimeout(() => {
              if (flatListRef.current) {
                try {
                  flatListRef.current.scrollToIndex({ 
                    index: targetIndex, 
                    animated: false 
                  });
                  logger.debug(`Successfully scrolled to short at index ${targetIndex}`);
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
          logger.warn(`Short ${params.shortId} not found in loaded shorts`);
        }
      }
      
      // Initialize follow states
      const followStatesMap: { [key: string]: boolean } = {};
      response.shorts.forEach((short: PostType) => {
        // Check if the user object has isFollowing property, otherwise default to false
        followStatesMap[short.user._id] = (short.user as any).isFollowing || false;
      });
      setFollowStates(followStatesMap);
    } catch (error) {
      logger.error('Error loading shorts', error);
      showError('Failed to load shorts');
    } finally {
      setLoading(false);
    }
  }, [params.userId, params.shortId, showError]);

  // Update ref whenever loadShorts changes (for socket handlers)
  useEffect(() => {
    loadShortsRef.current = loadShorts;
  }, [loadShorts]);

  // CRITICAL: Subscribe to Socket.IO events for real-time feed updates after loadShorts is defined
  // Listen for 'short:created' and 'invalidate:feed' events to refresh feed immediately
  useEffect(() => {
    const handleShortCreated = (payload: { shortId?: string }) => {
      logger.debug('Short created event received, refreshing feed:', payload);
      // Only refresh if we're not filtering by a specific user (general feed)
      const userIdParam = params.userId;
      const shouldFilterByUser = userIdParam && typeof userIdParam === 'string';
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
      const userIdParam = params.userId;
      const shouldFilterByUser = userIdParam && typeof userIdParam === 'string';
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
  }, [params.userId]); // Only depend on params.userId, not loadShorts (use ref instead)

  // Pause all videos except the specified one to ensure only one plays at a time
  const pauseAllVideosExcept = useCallback(async (activeVideoId: string | null) => {
    Object.keys(videoRefs.current).forEach(async (videoId) => {
      if (videoId !== activeVideoId && videoRefs.current[videoId]) {
        try {
          await videoRefs.current[videoId]?.pauseAsync();
          setVideoStates(prev => ({ ...prev, [videoId]: false }));
        } catch (error) {
          logger.warn(`Error pausing video ${videoId}:`, error);
        }
      }
    });
  }, []);

  const toggleVideoPlayback = useCallback((videoId: string) => {
    const video = videoRefs.current[videoId];
    if (video) {
      const isCurrentlyPlaying = videoStates[videoId];
      const newPlayState = !isCurrentlyPlaying;
      
      // Find the current short to check for music
      const currentShort = shorts.find(s => s._id === videoId);
      const hasMusic = !!(currentShort?.song?.songId?.s3Url);
      
      // If starting playback, pause all other videos first
      if (newPlayState) {
        pauseAllVideosExcept(videoId);
        activeVideoIdRef.current = videoId;
        // Update video state immediately for music sync
        setVideoStates(prev => ({ ...prev, [videoId]: true }));
        
        // Set video audio based on music presence
        if (hasMusic) {
          // If music exists, mute video
          video.setIsMutedAsync(true).catch(() => {});
          video.setVolumeAsync(0.0).catch(() => {});
        } else {
          // If no music, unmute video
          video.setIsMutedAsync(false).catch(() => {});
          video.setVolumeAsync(1.0).catch(() => {});
        }
      } else {
        if (activeVideoIdRef.current === videoId) {
          activeVideoIdRef.current = null;
        }
        // Update video state immediately for music sync
        setVideoStates(prev => ({ ...prev, [videoId]: false }));
      }
      
      video.setStatusAsync({
        shouldPlay: newPlayState,
      }).catch(() => {});
    }
  }, [videoStates, pauseAllVideosExcept, shorts]);

  const showPauseButtonTemporarily = (videoId: string) => {
    // Don't show pause button if like animation is showing
    if (showLikeAnimation[videoId]) {
      return;
    }
    
    setShowPauseButton(prev => ({ ...prev, [videoId]: true }));
    
    // Clear existing timeout
    if (pauseTimeoutRefs.current[videoId]) {
      clearTimeout(pauseTimeoutRefs.current[videoId]);
    }
    
    // Set new timeout
    pauseTimeoutRefs.current[videoId] = setTimeout(() => {
      setShowPauseButton(prev => ({ ...prev, [videoId]: false }));
    }, 2000);
  };

  const showLikeAnimationTemporarily = (shortId: string) => {
    // Initialize animation value if not exists
    if (!likeAnimationRefs.current[shortId]) {
      likeAnimationRefs.current[shortId] = new Animated.Value(0);
    }
    
    const animValue = likeAnimationRefs.current[shortId];
    
    // Reset animation
    animValue.setValue(0);
    
    // Show like animation
    setShowLikeAnimation(prev => ({ ...prev, [shortId]: true }));
    
    // Hide pause button while animation is showing
    setShowPauseButton(prev => ({ ...prev, [shortId]: false }));
    
    // Clear existing timeout
    if (pauseTimeoutRefs.current[shortId]) {
      clearTimeout(pauseTimeoutRefs.current[shortId]);
    }
    
    // Create multiple heart particles (Instagram-like)
    const particleCount = 6;
    const particles: Array<{ id: string; x: number; y: number }> = [];
    const particleAnims: ParticleAnimations = {};
    
    if (!likeParticleRefs.current[shortId]) {
      likeParticleRefs.current[shortId] = {};
    }
    
    for (let i = 0; i < particleCount; i++) {
      const particleId = `${shortId}-${Date.now()}-${i}`;
      // Random spread around center
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const distance = 30 + Math.random() * 40;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      
      particles.push({ id: particleId, x, y });
      
      // Create animation values for each particle
      particleAnims[particleId] = {
        scale: new Animated.Value(0),
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(0),
        translateX: new Animated.Value(0),
      };
    }
    
    likeParticleRefs.current[shortId] = particleAnims;
    setLikeAnimationParticles(prev => ({ ...prev, [shortId]: particles }));
    
    // Main heart animation: scale from 0.5 to 1.2, then back to 1, with fade
    Animated.sequence([
      // Scale up and fade in
      Animated.parallel([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      // Bounce effect
      Animated.spring(animValue, {
        toValue: 1.2,
        tension: 100,
        friction: 3,
        useNativeDriver: true,
      }),
      // Settle back
      Animated.spring(animValue, {
        toValue: 1,
        tension: 100,
        friction: 3,
        useNativeDriver: true,
      }),
      // Fade out
      Animated.timing(animValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Animate particles floating upward with fade
    particles.forEach((particle, index) => {
      const anims = particleAnims[particle.id];
      if (!anims) return;
      
      // Delay each particle slightly for staggered effect
      setTimeout(() => {
        Animated.parallel([
          // Scale up
          Animated.sequence([
            Animated.timing(anims.scale, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(anims.scale, {
              toValue: 0.6,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          // Fade in then out
          Animated.sequence([
            Animated.timing(anims.opacity, {
              toValue: 0.4, // Lower opacity for subtle effect
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(anims.opacity, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          // Float upward
          Animated.timing(anims.translateY, {
            toValue: -80 - Math.random() * 40,
            duration: 550,
            useNativeDriver: true,
          }),
          // Slight horizontal drift
          Animated.timing(anims.translateX, {
            toValue: particle.x,
            duration: 550,
            useNativeDriver: true,
          }),
        ]).start();
      }, index * 30); // Stagger particles
    });
    
    // Hide animation after 1.5 seconds
    pauseTimeoutRefs.current[shortId] = setTimeout(() => {
      setShowLikeAnimation(prev => ({ ...prev, [shortId]: false }));
      setLikeAnimationParticles(prev => {
        const newState = { ...prev };
        delete newState[shortId];
        return newState;
      });
      // Clean up particle refs
      if (likeParticleRefs.current[shortId]) {
        delete likeParticleRefs.current[shortId];
      }
    }, 1500);
  };

  const handleLike = async (shortId: string) => {
    if (actionLoading === shortId) return;
    
    // Show like animation immediately
    showLikeAnimationTemporarily(shortId);
    
    // Store previous state for error revert
    let previousState: { isLiked: boolean; likesCount: number } | null = null;
    
    try {
      setActionLoading(shortId);
      
      // Optimistic update: update UI immediately before API call
      // Use functional update to read from current state
      setShorts(prev => {
        const currentShort = prev.find(s => s._id === shortId);
        if (currentShort) {
          // Store previous state for potential revert
          previousState = {
            isLiked: currentShort.isLiked || false,
            likesCount: currentShort.likesCount || 0
          };
          
          const newIsLiked = !currentShort.isLiked;
          const newLikesCount = newIsLiked 
            ? (currentShort.likesCount || 0) + 1 
            : Math.max((currentShort.likesCount || 0) - 1, 0);
          
          // Update state immediately for instant feedback
          return prev.map(short => 
            short._id === shortId 
              ? { ...short, isLiked: newIsLiked, likesCount: newLikesCount }
              : short
          );
        }
        return prev;
      });
      
      const response = await toggleLike(shortId);
      
      // Update with actual response from server (in case of any discrepancy)
      setShorts(prev => prev.map(short => 
        short._id === shortId 
          ? { ...short, isLiked: response.isLiked, likesCount: response.likesCount }
          : short
      ));
      
      // Track engagement
      trackEngagement('like', 'short', shortId, {
        isLiked: response.isLiked
      });
      
      // No alert - silent update for better UX
    } catch (error) {
      logger.error('Error toggling like', error);
      
      // Revert optimistic update on error using stored previous state
      if (previousState) {
        setShorts(prev => prev.map(short => 
          short._id === shortId 
            ? { ...short, isLiked: previousState!.isLiked, likesCount: previousState!.likesCount }
            : short
        ));
      }
      
      showError('Failed to update like status');
    } finally {
      setActionLoading(null);
    }
  };

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
      } else {
        // Add to saved (prevent duplicates)
        if (!currentIds.includes(shortId)) {
          updatedIds = [...currentIds, shortId];
          await AsyncStorage.setItem('savedShorts', JSON.stringify(updatedIds));
          setSavedShorts(new Set(updatedIds));
          showSuccess('Saved to favorites!');
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
    
    // Load comments asynchronously to prevent UI blocking
    getPostById(shortId)
      .then(response => {
        setSelectedShortComments(response.post.comments || []);
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
    
    // Animate swipe gesture
    Animated.sequence([
      Animated.timing(swipeAnimation, {
        toValue: -1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Navigate to profile
      router.push(`/profile/${userId}`);
      
      // Reset animations
      swipeAnimation.setValue(0);
      fadeAnimation.setValue(1);
      
      // Reset navigation guard after navigation completes
      // Use a longer timeout to ensure navigation has completed
      setTimeout(() => {
        isNavigatingRef.current = false;
        lastNavigationUserIdRef.current = null;
      }, 1000);
    });
  };

  const handleDeleteShort = async (shortId: string) => {
    showConfirm(
      'Are you sure you want to delete this short?',
      async () => {
        try {
          await deleteShort(shortId);
          
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
    setSwipeStartX(pageX);
    setSwipeStartY(pageY);
  };

  const handleTouchMove = (event: any) => {
    if (swipeStartX === null || swipeStartY === null) return;
    
    const { pageX, pageY } = event.nativeEvent;
    const deltaX = pageX - swipeStartX;
    const deltaY = pageY - swipeStartY;
    
    // Only animate for left swipes (negative deltaX)
    // Right swipes should not trigger any animation or navigation
    if (deltaX < 0 && Math.abs(deltaX) > Math.abs(deltaY)) {
      const progress = Math.min(Math.abs(deltaX) / 100, 1);
      swipeAnimation.setValue(-progress);
    } else {
      // Reset animation if swiping right or vertical
      swipeAnimation.setValue(0);
    }
  };

  const handleTouchEnd = (event: any, userId: string) => {
    if (swipeStartX === null || swipeStartY === null) return;
    
    const { pageX, pageY } = event.nativeEvent;
    const deltaX = pageX - swipeStartX;
    const deltaY = pageY - swipeStartY;
    
    // Only trigger navigation for LEFT swipes (deltaX must be negative)
    // Right swipes (positive deltaX) should be ignored
    const horizontalRatio = Math.abs(deltaX) / (Math.abs(deltaY) || 1);
    const isLeftSwipe = deltaX < 0; // Negative deltaX means swipe left
    
    if (isLeftSwipe && horizontalRatio > 1.5 && Math.abs(deltaX) > 50) {
      // Check if navigation is already in progress to prevent duplicate navigations
      // This prevents rapid double swipes from causing duplicate navigation
      if (isNavigatingRef.current) {
        logger.debug('Swipe left detected but navigation already in progress, ignoring duplicate swipe');
        // Reset animation
        Animated.spring(swipeAnimation, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
        // Reset touch state
        setSwipeStartX(null);
        setSwipeStartY(null);
        return;
      }
      
      // Set guard immediately to prevent duplicate swipes
      isNavigatingRef.current = true;
      lastNavigationUserIdRef.current = userId;
      
      logger.debug('Swipe left detected, navigating to profile:', userId);
      handleSwipeLeft(userId);
    } else {
      // Reset animation if not a valid left swipe (right swipe or invalid gesture)
      Animated.spring(swipeAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
      
      if (!isLeftSwipe && Math.abs(deltaX) > 50) {
        logger.debug('Swipe right detected, ignoring (only left swipes navigate to profile)');
      }
    }
    
    setSwipeStartX(null);
    setSwipeStartY(null);
  };

  // CRITICAL: Update handlers ref whenever handlers change (prevents stale closures in renderShortItem)
  // This MUST be after all handlers are defined
  useEffect(() => {
    handlersRef.current = {
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      toggleVideoPlayback,
      showPauseButtonTemporarily,
      handleDeleteShort,
      handleProfilePress,
      handleLike,
      handleComment,
      handleShare,
      handleSave,
      getVideoUrl,
      refetchShortWithFreshUrl,
      retryVideoLoad,
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, toggleVideoPlayback, showPauseButtonTemporarily, handleDeleteShort, handleProfilePress, handleLike, handleComment, handleShare, handleSave, getVideoUrl, refetchShortWithFreshUrl, retryVideoLoad]);

  // Memoized video item component to prevent unnecessary re-renders
  // Only re-renders when relevant props change (currentVisibleIndex, videoStates, etc.)
  // CRITICAL: Conditionally renders Video component to prevent memory leaks
  // Only videos within 1 index of currentVisibleIndex are mounted
  const renderShortItem = useCallback(({ item, index }: { item: PostType; index: number }) => {
    // Calculate distance from currently visible item
    const distanceFromVisible = Math.abs(index - currentVisibleIndex);
    // Only render Video component if within 1 index (max 3 videos: prev, current, next)
    // This ensures previous videos are fully unmounted, preventing memory leaks
    const shouldRenderVideo = distanceFromVisible <= 1;
    
    // Get actual video playing state - only current visible video should play
    const videoState = videoStates[item._id];
    const isVideoPlaying = videoState !== undefined ? videoState : (index === currentVisibleIndex);
    const isFollowing = followStates[item.user._id] || false;
    const isSaved = savedShorts.has(item._id);
    const isLiked = item.isLiked || false;
    
    // Calculate pause button visibility and icon - isolated from like state to prevent flexing
    // Don't show pause button if like animation is showing
    const shouldShowPauseButton = !showLikeAnimation[item._id] && (showPauseButton[item._id] || !videoStates[item._id]);
    const pauseButtonIcon = videoStates[item._id] ? "pause" : "play";
    const shouldShowLikeAnimation = showLikeAnimation[item._id] || false;
    
    // Debug: Log song data
    if (item.song) {
      logger.info('Short has song data:', {
        shortId: item._id,
        hasSong: !!item.song,
        hasSongId: !!item.song.songId,
        songId: item.song.songId?._id || item.song.songId,
        hasS3Url: !!item.song.songId?.s3Url,
        s3Url: item.song.songId?.s3Url ? item.song.songId.s3Url.substring(0, 50) + '...' : 'NONE',
        title: item.song.songId?.title,
        artist: item.song.songId?.artist,
        startTime: item.song.startTime,
        volume: item.song.volume
      });
    } else {
      logger.debug('Short has NO song data:', { shortId: item._id });
    }

    return (
      <View style={styles.shortItem}>
          {/* Video Player with Gesture Handling */}
          <View
            style={styles.videoContainer}
            onTouchStart={handlersRef.current.handleTouchStart}
            onTouchMove={handlersRef.current.handleTouchMove}
            onTouchEnd={(event) => handlersRef.current.handleTouchEnd(event, item.user._id)}
          >
            <TouchableWithoutFeedback 
              onPress={() => {
                handlersRef.current.toggleVideoPlayback(item._id);
                handlersRef.current.showPauseButtonTemporarily(item._id);
              }}
              onLongPress={() => {
                // Only allow delete for own content
                if (item.user._id === currentUser?._id) {
                  handlersRef.current.handleDeleteShort(item._id);
                }
              }}
            >
              {/* Conditional rendering: Only mount Video component if within 1 index of visible */}
              {/* This ensures previous videos are fully unmounted, preventing memory leaks */}
              {shouldRenderVideo ? (
                <Video
                key={`video-${item._id}-${handlersRef.current.getVideoUrl(item)}`}
                ref={(ref) => {
                  videoRefs.current[item._id] = ref;
                }}
                source={{ uri: handlersRef.current.getVideoUrl(item) }}
                style={styles.shortVideo}
                resizeMode={ResizeMode.COVER}
                // Autoplay behavior: only play if this is the current visible index
                // Force play when index matches currentVisibleIndex to ensure consistent playback
                shouldPlay={index === currentVisibleIndex}
                isLooping
                // CRITICAL: Mute video when music is playing
                // If song exists with valid s3Url, video must be muted so only music plays
                // Also mute videos that are not in focus to save audio resources
                isMuted={(() => {
                  const hasMusic = !!(item.song?.songId && item.song.songId.s3Url);
                  const shouldMute = index !== currentVisibleIndex || hasMusic;
                  if (__DEV__ && index === currentVisibleIndex) {
                    logger.info('Video mute check:', {
                      shortId: item._id,
                      hasMusic,
                      isCurrentVisible: index === currentVisibleIndex,
                      shouldMute
                    });
                  }
                  return shouldMute;
                })()}
                volume={(() => {
                  const hasMusic = !!(item.song?.songId && item.song.songId.s3Url);
                  return hasMusic ? 0.0 : 1.0;
                })()}
                // Use onLoadStart to ensure video starts playing when it loads and is properly muted
                onLoadStart={() => {
                  logger.debug(`Video ${item._id} load started, index: ${index}, currentVisible: ${currentVisibleIndex}`);
                  if (index === currentVisibleIndex) {
                    const video = videoRefs.current[item._id];
                    if (video) {
                      // If music exists, ensure video is muted
                      const hasMusic = !!(item.song?.songId && item.song.songId.s3Url);
                      if (hasMusic) {
                        video.setIsMutedAsync(true).catch(() => {
                          // Silently handle mute errors
                        });
                        video.setVolumeAsync(0.0).catch(() => {
                          // Silently handle volume errors
                        });
                      }
                    }
                  }
                }}
                onError={(error) => {
                  // Handle video loading errors (likely expired signed URL)
                  logger.error(`Video ${item._id} failed to load:`, error);
                  
                  // Clear cache for this video URL to force refresh
                  videoCacheRef.current.delete(item._id);
                  
                  // Update state to show video failed
                  setVideoStates(prev => ({
                    ...prev,
                    [item._id]: false
                  }));
                  
                  // Check if this is likely an expired URL error (403, 404, or network error)
                  const errorMessage = typeof error === 'string' ? error : (error as any)?.message || '';
                  const isExpiredUrl = errorMessage.includes('403') || 
                                     errorMessage.includes('404') || 
                                     errorMessage.includes('Forbidden') ||
                                     errorMessage.includes('expired') ||
                                     errorMessage.includes('ExpiredRequest');
                  
                  // Retry loading with fresh URL from backend if this is the current visible video
                  if (index === currentVisibleIndex) {
                    if (isExpiredUrl) {
                      // URL likely expired - refetch short data to get fresh signed URL
                      logger.debug(`Video ${item._id} URL expired, refetching from backend...`);
                      handlersRef.current.refetchShortWithFreshUrl(item._id).then((freshShort: PostType | null) => {
                        if (freshShort && freshShort.mediaUrl) {
                          // Update the short in state with fresh URL
                          setShorts(prev => prev.map(s => 
                            s._id === item._id ? { ...s, mediaUrl: freshShort.mediaUrl, videoUrl: freshShort.videoUrl || s.videoUrl, imageUrl: freshShort.imageUrl || s.imageUrl } : s
                          ));
                          
                          // Clear cache and reload video with fresh URL
                          videoCacheRef.current.delete(item._id);
                          const video = videoRefs.current[item._id];
                          if (video) {
                            setTimeout(() => {
                              const freshVideoUrl = freshShort.mediaUrl || freshShort.videoUrl || freshShort.imageUrl;
                              video.unloadAsync().then(() => {
                                video.loadAsync({ uri: freshVideoUrl }).then(() => {
                                  video.playAsync().catch(() => {
                                    logger.error(`Video ${item._id} retry play failed after refresh`);
                                  });
                                }).catch((loadError) => {
                                  logger.error(`Video ${item._id} retry load failed after refresh:`, loadError);
                                });
                              }).catch(() => {
                                // If unload fails, try to reload with fresh URL
                                video.loadAsync({ uri: freshVideoUrl }).catch(() => {});
                              });
                            }, 500);
                          }
                        }
                      }).catch((refetchError: any) => {
                        logger.error(`Failed to refetch fresh URL for video ${item._id}:`, refetchError);
                        // Fallback: retry with current URL after delay
                        handlersRef.current.retryVideoLoad(item._id, 1000);
                      });
                    } else {
                      // Not an expired URL error, just retry loading
                      retryVideoLoad(item._id, 1000);
                    }
                  }
                }}
                onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
                  if (status.isLoaded) {
                    const wasPlaying = videoStates[item._id];
                    const isNowPlaying = status.isPlaying;
                    
                    // CRITICAL: If music exists, ensure video stays muted
                    const hasMusic = !!(item.song?.songId && item.song.songId.s3Url);
                    if (hasMusic && index === currentVisibleIndex) {
                      const video = videoRefs.current[item._id];
                      if (video && !status.isMuted) {
                        // Force mute if music is playing
                        video.setIsMutedAsync(true).catch(() => {});
                        video.setVolumeAsync(0.0).catch(() => {});
                      }
                    }
                    
                    // Ensure only one video plays at a time
                    // If this video started playing but it's not the active one, pause it
                    if (isNowPlaying && activeVideoIdRef.current !== item._id && activeVideoIdRef.current !== null) {
                      videoRefs.current[item._id]?.pauseAsync().catch(() => {
                        // Silently handle pause errors
                      });
                      return; // Don't update state if we're pausing it
                    }
                    
                    // Update active video ref when playback starts
                    if (isNowPlaying && index === currentVisibleIndex) {
                      activeVideoIdRef.current = item._id;
                    }
                    
                    // Always update video state to reflect actual playback status
                    setVideoStates(prev => {
                      const newState = {
                        ...prev,
                        [item._id]: isNowPlaying
                      };
                      
                      // Log state change for debugging
                      if (wasPlaying !== isNowPlaying) {
                        logger.debug(`Video ${item._id} ${isNowPlaying ? 'playing' : 'paused'}`);
                      }
                      
                      return newState;
                    });
                  } else if (status.error) {
                    // Handle playback errors
                    logger.error(`Video ${item._id} playback error:`, status.error);
                    // Clear cache and retry if this is the current visible video
                    if (index === currentVisibleIndex) {
                      videoCacheRef.current.delete(item._id);
                    }
                  }
                }}
                onLoad={(status) => {
                  // CRITICAL: Ensure video plays after it fully loads, especially for subsequent videos
                  if (status.isLoaded) {
                    logger.debug(`Video ${item._id} loaded successfully, isPlaying: ${status.isPlaying}, shouldPlay: ${index === currentVisibleIndex}`);
                    
                    // Initialize video state when video loads
                    setVideoStates(prev => ({
                      ...prev,
                      [item._id]: status.isPlaying || false
                    }));
                    
                    // CRITICAL FIX: Ensure video plays when it becomes visible and is loaded
                    // This fixes the black screen issue for subsequent videos
                    if (index === currentVisibleIndex) {
                      const video = videoRefs.current[item._id];
                      if (video) {
                        // Small delay to ensure video is fully ready
                        setTimeout(() => {
                          video.getStatusAsync().then((currentStatus) => {
                            if (currentStatus.isLoaded) {
                              // If music exists, ensure video is muted
                              const hasMusic = !!(item.song?.songId && item.song.songId.s3Url);
                              if (hasMusic) {
                                video.setIsMutedAsync(true).catch(() => {});
                                video.setVolumeAsync(0.0).catch(() => {});
                              }
                              
                              // Play video if it's not already playing
                              if (!currentStatus.isPlaying) {
                                activeVideoIdRef.current = item._id;
                                video.playAsync().then(() => {
                                  setVideoStates(prev => ({
                                    ...prev,
                                    [item._id]: true
                                  }));
                                  logger.debug(`Video ${item._id} started playing after load`);
                                }).catch((error) => {
                                  logger.error(`Video ${item._id} failed to play after load:`, error);
                                });
                              }
                            }
                          }).catch(() => {
                            // If status check fails, try to play anyway
                            video.playAsync().catch(() => {});
                          });
                        }, 100);
                      }
                    }
                  }
                }}
              />
              ) : (
                // Lightweight placeholder for unmounted videos
                // Maintains layout without consuming video resources
                <View style={styles.shortVideo} />
              )}
            </TouchableWithoutFeedback>
          </View>
          
          {/* Elegant Gradient Overlays */}
          <LinearGradient
            colors={['transparent', 'transparent']}
            style={styles.topGradient}
          />
          <LinearGradient
            colors={['transparent', 'transparent']}
            style={styles.bottomGradient}
          />
          
          {/* Like Animation - Shows when like button is clicked */}
          {shouldShowLikeAnimation && (() => {
            // Get or create animation value for this item
            if (!likeAnimationRefs.current[item._id]) {
              likeAnimationRefs.current[item._id] = new Animated.Value(0);
            }
            const animValue = likeAnimationRefs.current[item._id];
            
            // Create interpolated values for opacity and scale
            const opacity = animValue.interpolate({
              inputRange: [0, 0.5, 1, 1.2],
              outputRange: [0, 0.4, 0.5, 0.5], // Lower opacity for subtle effect
            });
            
            const scale = animValue.interpolate({
              inputRange: [0, 0.5, 1, 1.2],
              outputRange: [0.3, 0.8, 1, 1.2],
            });
            
            return (
              <Animated.View 
                style={[
                  styles.likeAnimationContainer,
                  {
                    opacity,
                    transform: [{ scale }],
                  },
                ]}
                pointerEvents="none"
              >
                <Ionicons 
                  name="heart" 
                  size={80} 
                  color="#FF3040" 
                />
              </Animated.View>
            );
          })()}

          {/* Play/Pause Overlay - Stable positioning to prevent flexing during like/unlike */}
          {shouldShowPauseButton && (
            <View 
              style={styles.playButton} 
              pointerEvents="none"
              collapsable={false}
            >
              <View style={styles.playButtonBlur}>
                <Ionicons 
                  name={pauseButtonIcon} 
                  size={50} 
                  color="white" 
                />
              </View>
            </View>
          )}

          {/* Swipe Hint */}
          {showSwipeHint && index === currentVisibleIndex && (
            <Animated.View style={[styles.swipeHint, { opacity: fadeAnimation }]}>
              <View style={styles.swipeHintBlur}>
                <Ionicons name="arrow-back" size={24} color="white" />
                <Text style={styles.swipeHintText}>Swipe left for profile</Text>
              </View>
            </Animated.View>
          )}
        
          {/* Right Side Action Buttons - Outside TouchableWithoutFeedback to prevent pause button flexing */}
          <View style={styles.rightActions} pointerEvents="box-none">
            {/* Profile Picture */}
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => handleProfilePress(item.user._id)}
            >
              <Image
                source={item.user.profilePic ? { uri: item.user.profilePic } : require('../../assets/avatars/male_avatar.png')}
                style={styles.profileImage}
                defaultSource={require('../../assets/avatars/male_avatar.png')}
                onError={() => {
                  logger.warn('Profile picture failed to load for user:', item.user._id);
                }}
              />
              {/* Follow Button - Only show if not own user */}
              {item.user._id !== currentUser?._id && (
                <View style={[styles.followButton, isFollowing && styles.followingButton]}>
                  <Ionicons 
                    name={isFollowing ? "checkmark" : "add"} 
                    size={12} 
                    color="white" 
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* Like Button */}
            <Pressable 
              style={styles.actionButton}
              onPress={() => {
                handlersRef.current.handleLike(item._id);
              }}
              disabled={actionLoading === item._id}
            >
              <View style={[styles.actionIconContainer, isLiked && styles.likedContainer]}>
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={28} 
                  color={isLiked ? "#FF3040" : "white"} 
                />
              </View>
              <Text style={styles.actionText}>{typeof item.likesCount === 'number' ? item.likesCount : 0}</Text>
            </Pressable>

            {/* Comment Button */}
            <Pressable 
              style={styles.actionButton}
              onPress={() => {
                handlersRef.current.handleComment(item._id);
              }}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="chatbubble-outline" size={28} color="white" />
              </View>
              <Text style={styles.actionText}>{item.commentsCount || 0}</Text>
            </Pressable>

            {/* Share Button */}
            <Pressable 
              style={styles.actionButton}
              onPress={() => {
                handlersRef.current.handleShare(item);
              }}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="paper-plane-outline" size={28} color="white" />
              </View>
            </Pressable>

            {/* Save Button */}
            <Pressable 
              style={styles.actionButton}
              onPress={() => {
                handlersRef.current.handleSave(item._id);
              }}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons 
                  name={isSaved ? "bookmark" : "bookmark-outline"} 
                  size={28} 
                  color={isSaved ? "#FFD700" : "white"} 
                />
              </View>
            </Pressable>
          </View>

          {/* Bottom Content with Elegant Design */}
          <View style={styles.bottomContent}>
            <LinearGradient
              colors={['transparent', 'transparent', 'transparent']}
              style={styles.bottomGradientOverlay}
            />
            
            <View style={styles.bottomContentInner}>
              <TouchableOpacity 
                style={styles.userProfileSection}
                onPress={(e) => {
                  e.stopPropagation?.(); // Prevent event from bubbling
                  handlersRef.current.handleProfilePress(item.user._id);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.avatarContainer}>
                <Image
                  source={item.user.profilePic ? { uri: item.user.profilePic } : require('../../assets/avatars/male_avatar.png')}
                  style={styles.userAvatar}
                  defaultSource={require('../../assets/avatars/male_avatar.png')}
                  onError={() => {
                    logger.warn('Profile picture failed to load for user:', item.user._id);
                  }}
                />
                  <View style={styles.avatarRing} />
                </View>
                <View style={styles.userDetails}>
                  <View style={styles.usernameRow}>
                  <Text style={styles.username}>{item.user.fullName}</Text>
                    {isFollowing && (
                      <View style={styles.followingBadge}>
                        <Text style={styles.followingText}>Following</Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Song - Instagram style inline */}
                  {item.song?.songId && (() => {
                    const song = item.song.songId;
                    const songTitle = song.title || 'Unknown Song';
                    const songArtist = song.artist || 'Unknown Artist';
                    return (
                      <View style={styles.inlineSong}>
                        <Ionicons name="musical-notes" size={12} color="rgba(255,255,255,0.85)" />
                        <Text style={styles.inlineSongText} numberOfLines={1}>
                          {songTitle} · {songArtist}
                        </Text>
                      </View>
                    );
                  })()}
                  
                  {/* Location - Instagram style inline */}
                  {item.location?.address && (() => {
                    const handleLocationPress = async () => {
                      try {
                        const address = item.location?.address;
                        if (address) {
                          const coordinates = await geocodeAddress(address);
                          if (coordinates) {
                            router.push({
                              pathname: '/map/current-location',
                              params: {
                                latitude: coordinates.latitude.toString(),
                                longitude: coordinates.longitude.toString(),
                                address,
                              }
                            });
                          } else {
                            router.push('/map/current-location');
                          }
                        }
                      } catch (error) {
                        logger.warn('Failed to geocode location:', error);
                        router.push('/map/current-location');
                      }
                    };
                    
                    return (
                      <TouchableOpacity 
                        style={styles.inlineLocation} 
                        onPress={handleLocationPress}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.85)" />
                        <Text style={styles.inlineLocationText} numberOfLines={1}>
                          {item.location.address}
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                  
                  {item.caption && (
                    <Text style={styles.caption} numberOfLines={2}>
                      {item.caption}
                    </Text>
                  )}
                  
                  {item.tags && item.tags.length > 0 && (
                    <View style={styles.tagsContainer}>
                      {item.tags.slice(0, 3).map((tag, tagIndex) => (
                        <View key={tagIndex} style={styles.tagBadge}>
                          <Text style={styles.tag}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              
              {/* Song Player - Hidden but active for audio playback */}
              {/* CRITICAL: Only render SongPlayer if song exists with valid s3Url */}
              {(() => {
                const hasSong = !!item.song?.songId;
                const hasS3Url = !!item.song?.songId?.s3Url;
                const shouldRender = hasSong && hasS3Url;
                
                if (__DEV__ && index === currentVisibleIndex) {
                  logger.info('SongPlayer render check:', {
                    shortId: item._id,
                    hasSong,
                    hasS3Url,
                    shouldRender,
                    songId: item.song?.songId?._id || item.song?.songId,
                    s3Url: item.song?.songId?.s3Url ? 'EXISTS' : 'MISSING'
                  });
                }
                
                return shouldRender ? (
                  <View style={styles.hiddenSongPlayer} pointerEvents="none">
                    <SongPlayer 
                      post={item} 
                      isVisible={index === currentVisibleIndex} 
                      autoPlay={isVideoPlaying} 
                    />
                  </View>
                ) : null;
              })()}
            </View>
          </View>
      </View>
    );
  }, [currentVisibleIndex, videoStates, followStates, savedShorts, actionLoading, currentUser, showPauseButton, showLikeAnimation, swipeAnimation, fadeAnimation]);

  // Memoize keyExtractor and getItemLayout at top level (before conditional returns)
  const keyExtractor = useCallback((item: PostType) => item._id, []);
  
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: SCREEN_HEIGHT,
    offset: SCREEN_HEIGHT * index,
    index,
  }), []);

  // Track viewable items to determine which video is actually visible
  // Uses 80% coverage threshold to ensure accurate visibility detection
  // MUST be defined before conditional returns to follow Rules of Hooks
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      const visibleItem = viewableItems[0];
      const newVisibleIndex = visibleItem.index;
      
      if (newVisibleIndex !== undefined && newVisibleIndex !== null && newVisibleIndex !== currentVisibleIndex) {
        // Update state immediately
        const previousIndex = currentVisibleIndex;
        setCurrentVisibleIndex(newVisibleIndex);
        setCurrentIndex(newVisibleIndex);
        
        // CRITICAL: Pause previous video FIRST before starting new one
        // This ensures clean transition and prevents multiple videos playing
        if (previousIndex !== newVisibleIndex && shorts[previousIndex]) {
          const previousVideoId = shorts[previousIndex]._id;
          const previousVideo = videoRefs.current[previousVideoId];
          if (previousVideo) {
            // Immediately pause previous video - don't wait for state updates
            previousVideo.pauseAsync()
              .then(() => {
                setVideoStates(prev => ({ ...prev, [previousVideoId]: false }));
                logger.debug(`Paused previous video: ${previousVideoId}`);
              })
              .catch((error) => {
                logger.warn(`Error pausing previous video ${previousVideoId}:`, error);
                // Still update state even if pause fails
                setVideoStates(prev => ({ ...prev, [previousVideoId]: false }));
              });
            
            // Unload video if it's far from viewport (more than 1 index away)
            // This fully releases GPU/memory resources
            if (Math.abs(previousIndex - newVisibleIndex) > 1) {
              stopAndUnloadVideo(previousVideoId);
            }
          }
        }
        
        // Clear active video ref before setting new one
        if (activeVideoIdRef.current && activeVideoIdRef.current !== shorts[newVisibleIndex]?._id) {
          activeVideoIdRef.current = null;
        }
        
        // Mark new video as active - useEffect will handle actual playback
        // This ensures state is updated immediately for shouldPlay prop
        if (shorts[newVisibleIndex]) {
          const newVideoId = shorts[newVisibleIndex]._id;
          activeVideoIdRef.current = newVideoId;
          // Update video state immediately so shouldPlay prop works
          setVideoStates(prev => ({ ...prev, [newVideoId]: true }));
        }
      }
    }
  }, [shorts, stopAndUnloadVideo, currentVisibleIndex]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80, // Item is considered visible when 80% is on screen
    minimumViewTime: 100, // Minimum time item must be visible (ms)
  }).current;

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#FF3040" style={styles.loadingSpinner} />
            <Text style={styles.loadingTitle}>Loading Shorts</Text>
            <Text style={styles.loadingSubtitle}>Discover amazing content</Text>
          </View>
        </View>
      </View>
    );
  }

  if (shorts.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-outline" size={80} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyTitle}>No Shorts Available</Text>
          <Text style={styles.emptyDescription}>
            Be the first to create amazing short videos and share your stories with the world.
          </Text>
          <TouchableOpacity 
            style={styles.createShortButton}
            onPress={() => router.push('/(tabs)/post')}
          >
            <LinearGradient
              colors={['#FF3040', '#FF6B6B']}
              style={styles.createShortGradient}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.createShortButtonText}>Create Short</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent" 
        translucent={true}
      />

      {/* Back Button UI - Visible at top-left */}
      {/* Pauses video before navigation to ensure clean state */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        ref={flatListRef}
        data={shorts}
        renderItem={renderShortItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        initialScrollIndex={(() => {
          // Calculate initial scroll index from params if shortId is provided
          if (params.shortId && typeof params.shortId === 'string' && shorts.length > 0) {
            const index = shorts.findIndex(s => s._id === params.shortId);
            return index !== -1 ? index : undefined;
          }
          return undefined;
        })()}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onScrollToIndexFailed={(info) => {
          // Handle scroll to index failure gracefully
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
          });
        }}
        // Performance optimizations for video-heavy feed:
        // - removeClippedSubviews: Unmount off-screen items to free memory
        // - initialNumToRender: Only render 3 items initially for faster first paint
        // - maxToRenderPerBatch: Render 2 items per batch to prevent jank
        // - windowSize: Keep 5 screen heights of items in memory (2.5 above + 2.5 below)
        removeClippedSubviews={true}
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={5}
        updateCellsBatchingPeriod={50} // Batch updates every 50ms for better performance
        onScroll={handleScroll}
        scrollEventThrottle={16}
        directionalLockEnabled={false}
        alwaysBounceVertical={true}
        bounces={true}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentInset={{ top: 0, bottom: 0, left: 0, right: 0 }}
        // Use onViewableItemsChanged for precise visibility tracking
        // This ensures we know exactly which video is visible (80% coverage threshold)
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
            imageUrl: selectedShortForShare.imageUrl,
            mediaUrl: selectedShortForShare.mediaUrl || selectedShortForShare.videoUrl,
            videoUrl: selectedShortForShare.videoUrl,
            user: selectedShortForShare.user,
          }}
        />
      )}
    </View>
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
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
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
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
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
    height: SCREEN_HEIGHT,
    position: 'relative',
    backgroundColor: 'black',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: 'black',
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
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
    zIndex: 15,
    width: 80,
    height: 80,
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
    right: isTablet ? theme.spacing.lg : 16,
    bottom: isTablet ? 140 : 120,
    alignItems: 'center',
    zIndex: 5,
  },
  profileButton: {
    marginBottom: isTablet ? theme.spacing.xl : 20,
    position: 'relative',
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  followingButton: {
    backgroundColor: '#2196F3',
    borderColor: 'white',
    borderWidth: 2,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  actionIconContainer: {
    width: isTablet ? 60 : 50,
    height: isTablet ? 60 : 50,
    borderRadius: isTablet ? 30 : 25,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isTablet ? 6 : 4,
  },
  likedContainer: {
    backgroundColor: 'rgba(255, 48, 64, 0.2)',
  },
  actionText: {
    color: 'white',
    fontSize: isTablet ? theme.typography.small.fontSize + 1 : 12,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 80,
    // Tab bar is frozen (visible) on shorts page (88px height on mobile, 70px on web)
    // Add padding to ensure text content (name, location, caption, hashtags) is above the tab bar
    paddingBottom: Platform.OS === 'ios' ? (isWeb ? 102 : 122) : (isWeb ? 102 : 112), // Tab bar height (88/70) + safe area
    paddingTop: 16,
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
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  avatarRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  userDetails: {
    flex: 1,
    paddingTop: 0, // Reduced from 2 to 0 to move text up slightly
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4, // Reduced from 6 to move text up slightly
    flexWrap: 'wrap',
  },
  username: {
    color: 'white',
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginRight: isTablet ? theme.spacing.sm : 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
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
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  caption: {
    color: 'rgba(255,255,255,0.98)',
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    lineHeight: isTablet ? 22 : 20,
    marginTop: 2, // Small margin to separate from location
    marginBottom: isTablet ? theme.spacing.md : 8, // Reduced from 10 to move text up
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
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    color: 'rgba(255,255,255,0.85)',
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
    color: 'rgba(255,255,255,0.85)',
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
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    zIndex: 100,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});