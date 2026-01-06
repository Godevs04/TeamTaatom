import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Share,
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
import { getShorts, toggleLike, addComment, getPostById, deleteShort } from '../../services/posts';
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

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';
const logger = createLogger('ShortsScreen');

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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [savedShorts, setSavedShorts] = useState<Set<string>>(new Set());
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedShortId, setSelectedShortId] = useState<string | null>(null);
  const [selectedShortComments, setSelectedShortComments] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [followStates, setFollowStates] = useState<{ [key: string]: boolean }>({});
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [swipeStartY, setSwipeStartY] = useState<number | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [videoQuality, setVideoQuality] = useState<'low' | 'medium' | 'high'>('high');
  
  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<{ [key: string]: Video | null }>({});
  const pauseTimeoutRefs = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const swipeAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;
  // Track currently active video to ensure only one plays at a time
  const activeVideoIdRef = useRef<string | null>(null);
  // Track last viewed short ID for analytics de-duplication
  const lastViewedShortIdRef = useRef<string | null>(null);
  const lastViewTimeRef = useRef<number>(0);
  const VIEW_DEBOUNCE_MS = 2000; // Prevent duplicate view events within 2 seconds
  
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
  }, []);

  // Handle app backgrounding/foregrounding and screen focus/blur
  // Pause videos when screen loses focus or app goes to background
  // Uses centralized pauseCurrentVideo helper to prevent race conditions
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
  const handleBack = useCallback(() => {
    pauseCurrentVideo();
    router.back();
  }, [pauseCurrentVideo, router]);

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
          // Network probe failed - log warning but don't downgrade quality unnecessarily
          // The video URL itself may still be accessible even if favicon check fails
          logger.warn('Network quality probe failed, keeping current quality setting', fetchError);
          // Only downgrade if we're currently on high quality and probe consistently fails
          // This prevents unnecessary quality drops when CDN is accessible but probe fails
        }
      } catch (error) {
        // Outer catch for any unexpected errors
        logger.warn('Network status check error (non-critical):', error);
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
  const getVideoUrl = useCallback((item: PostType) => {
    const baseUrl = item.mediaUrl || item.imageUrl;
    const videoId = item._id;
    
    // Check cache first
    const cached = videoCacheRef.current.get(videoId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.url;
    }
    
    // Generate URL based on quality
    let url = baseUrl;
    if (videoQuality === 'low') {
      url = `${baseUrl}?q=low`;
    } else if (videoQuality === 'medium') {
      url = `${baseUrl}?q=medium`;
    }
    
    // Cache the URL
    videoCacheRef.current.set(videoId, {
      url,
      timestamp: Date.now()
    });
    
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
      currentVideo.playAsync().catch(() => {});
      setVideoStates(prev => ({ ...prev, [currentShortId]: true }));
    } else {
      // Video ref not available yet, mark as active for when it mounts
      activeVideoIdRef.current = currentShortId;
      setVideoStates(prev => ({ ...prev, [currentShortId]: true }));
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

  const loadShorts = async () => {
    try {
      setLoading(true);
      const response = await getShorts(1, 20);
      setShorts(response.shorts);
      
      // Scroll to specific short if shortId is provided in params
      if (params.shortId && typeof params.shortId === 'string' && response.shorts.length > 0) {
        const targetIndex = response.shorts.findIndex(s => s._id === params.shortId);
        if (targetIndex !== -1 && flatListRef.current) {
          // Use setTimeout to ensure FlatList is rendered before scrolling
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ 
              index: targetIndex, 
              animated: false 
            });
            setCurrentIndex(targetIndex);
            setCurrentVisibleIndex(targetIndex);
          }, 100);
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
  };

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

  const handleLike = async (shortId: string) => {
    if (actionLoading === shortId) return;
    
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
      await Share.share({
        message: `Check out this amazing short by ${short.user.fullName}: ${short.caption}`,
        url: short.mediaUrl || short.imageUrl,
      });
      
      // Track share engagement
      trackEngagement('share', 'short', short._id);
    } catch (error) {
      logger.error('Error sharing', error);
      showError('Failed to share');
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
    router.push(`/profile/${userId}`);
  };

  const handleSwipeLeft = (userId: string) => {
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
    
    // Update animation based on horizontal movement
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      const progress = Math.min(Math.abs(deltaX) / 100, 1);
      swipeAnimation.setValue(-progress);
    }
  };

  const handleTouchEnd = (event: any, userId: string) => {
    if (swipeStartX === null || swipeStartY === null) return;
    
    const { pageX, pageY } = event.nativeEvent;
    const deltaX = pageX - swipeStartX;
    const deltaY = pageY - swipeStartY;
    
    // Only trigger swipe if horizontal movement is significantly greater
    const horizontalRatio = Math.abs(deltaX) / (Math.abs(deltaY) || 1);
    if (horizontalRatio > 1.5 && Math.abs(deltaX) > 50) {
      logger.debug('Swipe left detected, navigating to profile:', userId);
      handleSwipeLeft(userId);
    } else {
      // Reset animation if not a valid swipe
      Animated.spring(swipeAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
    
    setSwipeStartX(null);
    setSwipeStartY(null);
  };

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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={(event) => handleTouchEnd(event, item.user._id)}
          >
            <TouchableWithoutFeedback 
              onPress={() => {
                toggleVideoPlayback(item._id);
                showPauseButtonTemporarily(item._id);
              }}
              onLongPress={() => {
                // Only allow delete for own content
                if (item.user._id === currentUser?._id) {
                  handleDeleteShort(item._id);
                }
              }}
            >
              {/* Conditional rendering: Only mount Video component if within 1 index of visible */}
              {/* This ensures previous videos are fully unmounted, preventing memory leaks */}
              {shouldRenderVideo ? (
                <Video
                ref={(ref) => {
                  videoRefs.current[item._id] = ref;
                }}
                source={{ uri: getVideoUrl(item) }}
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
                      video.playAsync().catch(() => {
                        // Silently handle play errors
                      });
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
                  }
                }}
                onLoad={(status) => {
                  // Initialize video state when video loads
                  if (status.isLoaded) {
                    setVideoStates(prev => ({
                      ...prev,
                      [item._id]: status.isPlaying || false
                    }));
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
          
          {/* Play/Pause Overlay */}
          {(showPauseButton[item._id] || !videoStates[item._id]) && (
            <View style={styles.playButton}>
              <View style={styles.playButtonBlur}>
                <Ionicons 
                  name={videoStates[item._id] ? "pause" : "play"} 
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
        
          {/* Right Side Action Buttons */}
          <View style={styles.rightActions}>
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
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleLike(item._id)}
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
            </TouchableOpacity>

            {/* Comment Button */}
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleComment(item._id)}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="chatbubble-outline" size={28} color="white" />
              </View>
              <Text style={styles.actionText}>{item.commentsCount || 0}</Text>
            </TouchableOpacity>

            {/* Share Button */}
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleShare(item)}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="paper-plane-outline" size={28} color="white" />
              </View>
            </TouchableOpacity>

            {/* Save Button */}
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleSave(item._id)}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons 
                  name={isSaved ? "bookmark" : "bookmark-outline"} 
                  size={28} 
                  color={isSaved ? "#FFD700" : "white"} 
                />
              </View>
            </TouchableOpacity>
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
                onPress={() => handleProfilePress(item.user._id)}
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
  }, [currentVisibleIndex, videoStates, followStates, savedShorts, actionLoading, currentUser, showPauseButton, swipeAnimation, fadeAnimation, handleTouchStart, handleTouchMove, handleTouchEnd, toggleVideoPlayback, showPauseButtonTemporarily, handleDeleteShort, handleProfilePress, handleLike, handleComment, handleShare, handleSave, getVideoUrl, shorts]);

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
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -35 }, { translateY: -35 }],
    zIndex: 10,
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
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 20,
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
    paddingTop: 2,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
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
    marginBottom: isTablet ? theme.spacing.md : 10,
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