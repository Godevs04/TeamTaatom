import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ImageStyle,
  ActivityIndicator,
  Dimensions,
  Platform,
  Animated,
  AppState,
  BackHandler,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Video, Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { getShorts, getUserShorts, toggleLike, addComment, getPostById, deleteShort } from '../../services/posts';
import { toggleFollow } from '../../services/profile';
import { PostType } from '../../types/post';
import { getUserFromStorage } from '../../services/auth';
import { useRouter, useFocusEffect, useLocalSearchParams, useSegments } from 'expo-router';
import { useAlert } from '../../context/AlertContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PostComments from '../../components/post/PostComments';
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';
import { trackScreenView, trackPostView } from '../../services/analytics';
import { theme } from '../../constants/theme';
import { audioManager } from '../../utils/audioManager';
import { geocodeAddress } from '../../utils/locationUtils';
import { socketService } from '../../services/socket';
import ShareModal from '../../components/ShareModal';
import { ErrorBoundary } from '../../utils/errorBoundary';
import { ShortsNativeAd } from '../../components/ads/ShortsNativeAd';
import { useAdCap, recordGoogleAdImpression } from '../../services/adCap';
import Constants from 'expo-constants';

import { FlashList, FlashListRef } from '@shopify/flash-list';
const AnyFlashList = FlashList as any;
import { atom, atomFamily, RecoilRoot, useRecoilState, useRecoilValue, useSetRecoilState, useRecoilCallback } from 'recoil';
import ShortsCell from '../../components/shorts/ShortsCell';

/** Shorts list item: either a reel (PostType) or a full-screen native ad slot. */
export type ShortsItem = PostType | { type: 'ad'; adIndex: number };

function isAdItem(item: ShortsItem): item is { type: 'ad'; adIndex: number } {
  return 'type' in item && item.type === 'ad';
}

const SHORTS_ADS_AFTER_EVERY = 5;
const MAX_SHORTS_ADS = 3;
const SHORTS_ADS_SESSION_DELAY_MS = 20000;

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isExpoGo = (Constants as any)?.appOwnership === 'expo';
const logger = createLogger('ShortsScreen');

const TOP_BAR_HEIGHT = isWeb ? 56 : (isIOS ? 92 : 80);
const TAB_BAR_HEIGHT = isWeb ? 86 : 104;
const SHORTS_ITEM_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT - TOP_BAR_HEIGHT;

const LIKED_SHORTS_STORAGE_KEY = 'taatom_shorts_liked_ids';

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

function normalizeSearchParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export type ShortsScreenProps = {
  scopedUserId?: string;
  initialShortId?: string;
};

// ============================================
// RECOIL ATOMS & FAMILIES
// ============================================
export const activeShortIndexAtom = atom<number>({
  key: 'activeShortIndexAtom',
  default: 0,
});

export const videoPlayingFamily = atomFamily<boolean, string>({
  key: 'videoPlayingFamily',
  default: false,
});

export const videoReadyFamily = atomFamily<boolean, string>({
  key: 'videoReadyFamily',
  default: false,
});

export const videoBufferingFamily = atomFamily<boolean, string>({
  key: 'videoBufferingFamily',
  default: false,
});

function ShortsScreenContent(props: ShortsScreenProps = {}) {
  const [shorts, setShorts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const isScreenFocusedRef = useRef(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [savedShorts, setSavedShorts] = useState<Set<string>>(new Set());
  const [mutedShorts, setMutedShorts] = useState<Set<string>>(new Set());
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedShortId, setSelectedShortId] = useState<string | null>(null);
  const [selectedShortComments, setSelectedShortComments] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedShortForShare, setSelectedShortForShare] = useState<PostType | null>(null);
  const [followStates, setFollowStates] = useState<{ [key: string]: boolean }>({});
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const [videoQuality, setVideoQuality] = useState<'low' | 'medium' | 'high'>('high');

  const [sourceVersions, setSourceVersions] = useState<Record<string, number>>({});
  const lastMuteEnforceAtRef = useRef<Record<string, number>>({});

  const [hasWatchedFiveReels, setHasWatchedFiveReels] = useState(false);
  const [adsAllowedAfter20s, setAdsAllowedAfter20s] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAdsAllowedAfter20s(true), SHORTS_ADS_SESSION_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  const adsShownThisSessionRef = useRef(0);
  const [adsShownThisSession, setAdsShownThisSession] = useState(0);
  const adCap = useAdCap();
  const [shortsAdsBroken, setShortsAdsBroken] = useState(false);

  const flatListRef = useRef<FlashListRef<ShortsItem>>(null);
  const videoRefs = useRef<{ [key: string]: Video | null }>({});
  const swipeAnimation = useRef(new Animated.Value(0)).current;
  const activeVideoIdRef = useRef<string | null>(null);
  const currentPlayerRef = useRef<Audio.Sound | null>(null);
  const lastVideoPositionRef = useRef<Record<string, number>>({});
  const shortsRef = useRef<PostType[]>([]);
  shortsRef.current = shorts;
  const lastViewedShortIdRef = useRef<string | null>(null);
  const isNavigatingRef = useRef<boolean>(false);
  const lastNavigationUserIdRef = useRef<string | null>(null);
  const shouldClearParamsOnNextFocusRef = useRef<boolean>(false);
  const lastViewTimeRef = useRef<number>(0);
  const VIEW_DEBOUNCE_MS = 2000;
  const loadShortsRef = useRef<((isBackground?: boolean) => Promise<void>) | null>(null);
  
  // Cursor pagination variables
  const nextCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const likedShortIdsRef = useRef<Set<string>>(new Set());

  const handlersRef = useRef({
    handleTouchStart: null as any,
    handleTouchMove: null as any,
    handleTouchEnd: null as any,
    toggleVideoPlayback: null as any,
    handleDeleteShort: null as any,
    handleProfilePress: null as any,
    handleLike: null as any,
    handleComment: null as any,
    handleShare: null as any,
    handleSave: null as any,
    getVideoUrl: null as any,
    refetchShortWithFreshUrl: null as any,
    retryVideoLoad: null as any,
    handlePanGesture: null as any,
    handlePanStateChange: null as any,
  });
  
  const { mode, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const topInset = insets.top || 0;
  const bottomInset = insets.bottom || 0;
  const dynamicTopBarHeight = isWeb ? 56 : (56 + topInset);
  const dynamicTabBarHeight = isWeb ? 70 : (isIOS ? (bottomInset > 0 ? 56 + bottomInset : 64) : 68);
  
  const [measuredItemHeight, setMeasuredItemHeight] = useState<number | null>(null);
  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > 0) {
      setMeasuredItemHeight(height);
    }
  }, []);

  const dynamicItemHeight = measuredItemHeight ?? (SCREEN_HEIGHT - dynamicTabBarHeight - dynamicTopBarHeight);
  const router = useRouter();
  const params = useLocalSearchParams();
  const segments = useSegments();

  const effectiveUserId =
    props.scopedUserId ?? normalizeSearchParam(params.userId as string | string[] | undefined);
  const effectiveShortId =
    props.initialShortId ?? normalizeSearchParam(params.shortId as string | string[] | undefined);

  const isOnTabShorts = segments.includes('(tabs)') && segments.includes('shorts');
  const isUserShortsStack = segments.includes('user-shorts');
  const shortsPlaybackSurfaceActive = isOnTabShorts || isUserShortsStack;
  const { showSuccess, showError, showConfirm } = useAlert();
  const { handleScroll } = useScrollToHideNav();

  // Recoil state integration
  const [currentVisibleIndex, setCurrentVisibleIndex] = useRecoilState(activeShortIndexAtom);

  const setVideoPlayingState = useRecoilCallback(({ set }) => (videoId: string, isPlaying: boolean) => {
    set(videoPlayingFamily(videoId), isPlaying);
  }, []);

  const setVideoReadyState = useRecoilCallback(({ set }) => (videoId: string, isReady: boolean) => {
    set(videoReadyFamily(videoId), isReady);
  }, []);

  const setVideoBufferingState = useRecoilCallback(({ set }) => (videoId: string, isBuffering: boolean) => {
    set(videoBufferingFamily(videoId), isBuffering);
  }, []);

  const pauseCurrentVideo = useRecoilCallback(({ set }) => async () => {
    if (activeVideoIdRef.current) {
      set(videoPlayingFamily(activeVideoIdRef.current), false);
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

  const handleSongPlayingChange = useCallback((s: Audio.Sound | null) => {
    currentPlayerRef.current = s;
    if (!s) return;
    const activeId = activeVideoIdRef.current;
    if (!activeId) return;
    const video = videoRefs.current[activeId];
    if (!video) return;
    const activeItem = shortsRef.current?.find((it: any) => it && !isAdItem(it) && it._id === activeId) as PostType | undefined;
    if (!activeItem || !activeItem.song?.songId?._id) return;
    const startSec = activeItem.song?.startTime || 0;
    const endSec = activeItem.song?.endTime;
    const segmentMs = endSec && endSec > startSec ? (endSec - startSec) * 1000 : 60000;
    video.getStatusAsync().then((status: any) => {
      if (!status?.isLoaded || typeof status.positionMillis !== 'number') return;
      const audioOffsetMs = status.positionMillis % segmentMs;
      s.setPositionAsync(startSec * 1000 + audioOffsetMs).catch(() => {});
    }).catch(() => {});
  }, []);

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
        .catch(() => {});
    }
    audioManager.stopAll().catch(() => {});
  }, []);

  const stopAndUnloadVideo = useRecoilCallback(({ set }) => async (videoId: string) => {
    const video = videoRefs.current[videoId];
    if (!video) return;
    try {
      const status = await video.getStatusAsync();
      if (status.isLoaded) {
        await video.pauseAsync();
      }
      if (status.isLoaded && typeof video.unloadAsync === 'function') {
        await video.unloadAsync();
      }
      delete videoRefs.current[videoId];
      set(videoPlayingFamily(videoId), false);
      set(videoReadyFamily(videoId), false);
      set(videoBufferingFamily(videoId), false);
      logger.debug(`Stopped and unloaded video: ${videoId}`);
    } catch (error) {
      logger.warn(`Error stopping/unloading video ${videoId}:`, error);
      delete videoRefs.current[videoId];
      set(videoPlayingFamily(videoId), false);
      set(videoReadyFamily(videoId), false);
      set(videoBufferingFamily(videoId), false);
    }
  }, []);

  useEffect(() => {
    loadShorts();
    loadCurrentUser();
    loadSavedShorts();
    trackScreenView('shorts');
    
    return () => {
      const cleanupPromises = Object.values(videoRefs.current).map(async (video) => {
        if (video) {
          try {
            const status = await video.getStatusAsync();
            if (status.isLoaded && typeof video.unloadAsync === 'function') {
              await video.unloadAsync();
            }
          } catch (error) {
            logger.debug('Video cleanup error (expected on unmount):', error);
          }
        }
      });
      Promise.all(cleanupPromises).catch(() => {});
      videoRefs.current = {};
      
      activeVideoIdRef.current = null;
      lastViewedShortIdRef.current = null;

      if (currentPlayerRef.current) {
        currentPlayerRef.current.pauseAsync?.().catch(() => {});
        currentPlayerRef.current = null;
      }
      audioManager.stopAll().catch(() => {});
    };
  }, [effectiveUserId]);

  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
      lastNavigationUserIdRef.current = null;

      if (shouldClearParamsOnNextFocusRef.current && isOnTabShorts) {
        shouldClearParamsOnNextFocusRef.current = false;
        router.replace('/(tabs)/shorts');
      }

      const refreshTimer = setTimeout(() => {
        const shouldFilterByUser = !!effectiveUserId;
        if (!shouldFilterByUser) {
          logger.debug('Shorts screen focused - refreshing feed for real-time updates');
          const loadFn = loadShortsRef.current;
          if (loadFn) loadFn(true);
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
      isScreenFocusedRef.current = true;
      setIsScreenFocused(true);
      audioManager.unfreeze();

      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      }).catch(err => {
        logger.error('Error setting audio mode for shorts:', err);
      });

      const currentShort = shortsRef.current?.[currentVisibleIndex];
      if (currentShort) {
        const currentVideoId = currentShort._id;
        
        setSourceVersions(prev => {
          const nextVersions = { ...prev };
          for (let i = -1; i <= 1; i++) {
            const indexToBump = currentVisibleIndex + i;
            const itemToBump = shortsRef.current?.[indexToBump];
            if (itemToBump && !isAdItem(itemToBump)) {
              nextVersions[itemToBump._id] = (prev[itemToBump._id] || 0) + 1;
            }
          }
          return nextVersions;
        });

        activeVideoIdRef.current = currentVideoId;
        setVideoPlayingState(currentVideoId, true);
        const video = videoRefs.current[currentVideoId];
        if (video) {
          logger.debug(`[Shorts] Resuming video playback on focus: ${currentVideoId}`);
          video.playAsync().catch((error) => {
            logger.warn(`Error resuming video on focus:`, error);
          });
        }
      }

      return () => {
        isScreenFocusedRef.current = false;
        setIsScreenFocused(false);
        audioManager.freeze(3000);

        pauseCurrentVideo();
        if (currentPlayerRef.current) {
          currentPlayerRef.current.pauseAsync?.().catch(() => {});
          currentPlayerRef.current = null;
        }

        logger.debug('[Shorts] Pausing current video and leaving shorts page');
        audioManager.stopAll().catch(() => {});
      };
    }, [currentVisibleIndex, pauseCurrentVideo])
  );

  useEffect(() => {
    if (!shortsPlaybackSurfaceActive) {
      isScreenFocusedRef.current = false;
      setIsScreenFocused(false);
      pauseCurrentVideo();
      if (currentPlayerRef.current) {
        currentPlayerRef.current.pauseAsync?.().catch(() => {});
        currentPlayerRef.current = null;
      }
      audioManager.stopAll().catch(() => {});
    }
  }, [shortsPlaybackSurfaceActive, pauseCurrentVideo]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        pauseCurrentVideo();
        if (currentPlayerRef.current) {
          currentPlayerRef.current.pauseAsync?.().catch(() => {});
          currentPlayerRef.current = null;
        }
        audioManager.stopAll().catch(() => {});
        logger.debug('App backgrounded, paused current video and audio');
      } else if (nextAppState === 'active') {
        if (shorts[currentVisibleIndex]) {
          const currentVideoId = shorts[currentVisibleIndex]._id;
          activeVideoIdRef.current = currentVideoId;
          setVideoPlayingState(currentVideoId, true);
          const video = videoRefs.current[currentVideoId];
          if (video) {
            video.playAsync().catch((error) => {
              logger.warn(`Error resuming video on foreground:`, error);
            });
          }
        }
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [currentVisibleIndex, shorts, pauseCurrentVideo]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      pauseCurrentVideo();
      return false;
    });

    return () => {
      backHandler.remove();
    };
  }, [pauseCurrentVideo]);

  const handleBack = useCallback(async () => {
    pauseCurrentVideo();

    if (effectiveUserId) {
      if (router.canGoBack?.()) {
        router.back();
        return;
      }
      router.replace(`/profile/${effectiveUserId}`);
      return;
    }

    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  }, [pauseCurrentVideo, router, effectiveUserId]);

  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        try {
          await fetch('https://www.google.com/favicon.ico', {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          setVideoQuality('high');
        } catch (fetchError) {
          clearTimeout(timeoutId);
          logger.debug('[ShortsScreen] Network quality probe failed, keeping current quality setting', fetchError);
        }
      } catch (error) {
        logger.debug('[ShortsScreen] Network status check error (non-critical):', error);
      }
    };
    
    checkNetworkStatus();
    const interval = setInterval(checkNetworkStatus, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Cleanup videos far from viewport using Recoil
  useEffect(() => {
    const cleanupDistance = 2;
    Object.keys(videoRefs.current).forEach((videoId) => {
      const videoIndex = shorts.findIndex(s => s._id === videoId);
      if (videoIndex === -1) return;
      
      const distance = Math.abs(videoIndex - currentVisibleIndex);
      if (distance > cleanupDistance) {
        stopAndUnloadVideo(videoId);
      }
    });
  }, [currentVisibleIndex, shorts, stopAndUnloadVideo]);

  const videoCacheRef = useRef<Map<string, { url: string; timestamp: number }>>(new Map());

  const getVideoUrl = useCallback((item: PostType) => {
    const baseUrl = item.videoUrl || item.mediaUrl || item.imageUrl;
    const videoId = item._id;
    
    const isFirstTwoShorts = shorts.length > 0 && shorts.indexOf(item) < 2;
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
    
    if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
      logger.error(`Invalid video URL for item ${videoId}:`, {
        videoUrl: item.videoUrl,
        mediaUrl: item.mediaUrl,
        imageUrl: item.imageUrl,
        isFirstTwoShorts
      });
      return '';
    }
    
    const CACHE_MAX_AGE = 10 * 60 * 1000;
    
    const cached = videoCacheRef.current.get(videoId);
    if (cached) {
      const cacheAge = Date.now() - cached.timestamp;
      if (cacheAge < CACHE_MAX_AGE) {
        const cachedBaseUrl = cached.url.split('?')[0];
        const currentBaseUrl = baseUrl.split('?')[0];
        if (cachedBaseUrl === currentBaseUrl) {
          if (cacheAge < (CACHE_MAX_AGE - 2 * 60 * 1000)) {
            return cached.url;
          } else {
            logger.debug(`Video ${videoId} cache is close to expiry (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
            return cached.url;
          }
        } else {
          videoCacheRef.current.delete(videoId);
        }
      } else {
        logger.debug(`Video ${videoId} cache expired (${Math.round(cacheAge / 1000 / 60)} minutes old), clearing`);
        videoCacheRef.current.delete(videoId);
      }
    }
    
    let url = baseUrl.trim();
    if (!url.includes('?') && videoQuality !== 'high') {
      url = `${baseUrl}?q=${videoQuality}`;
    } else if (videoQuality !== 'high' && url.includes('?')) {
      url = `${baseUrl}&q=${videoQuality}`;
    }
    
    videoCacheRef.current.set(videoId, {
      url,
      timestamp: Date.now()
    });
    
    return url;
  }, [videoQuality, shorts]);
  
  const previousVisibleIndexRef = useRef<number>(-1);
  
  const loadSavedShorts = async () => {
    try {
      const stored = await AsyncStorage.getItem('savedShorts');
      if (!stored) {
        setSavedShorts(new Set());
        return;
      }
      
      let arr: string[] = [];
      try {
        const parsed = JSON.parse(stored);
        arr = Array.isArray(parsed) ? parsed : [];
      } catch (parseError) {
        logger.warn('Failed to parse savedShorts, resetting to empty array', parseError);
        await AsyncStorage.setItem('savedShorts', JSON.stringify([]));
        arr = [];
      }
      
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

  const refetchShortWithFreshUrl = useCallback(async (shortId: string): Promise<PostType | null> => {
    try {
      logger.debug(`Refetching short ${shortId} to get fresh signed URL...`);
      const response = await getPostById(shortId);
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

  const retryVideoLoad = useCallback((videoId: string, delay: number = 1000) => {
    setTimeout(() => {
      const video = videoRefs.current[videoId];
      if (!video) {
        logger.debug(`Video ${videoId} ref is null, skipping retry`);
        return;
      }
      
      const short = shorts.find(s => s._id === videoId);
      if (!short) {
        logger.debug(`Short ${videoId} not found, skipping retry`);
        return;
      }
      
      const videoUrl = getVideoUrl(short);
      
      if (typeof video.unloadAsync === 'function') {
        video.unloadAsync().then(() => {
          const videoAfterUnload = videoRefs.current[videoId];
          if (videoAfterUnload && typeof videoAfterUnload.loadAsync === 'function') {
            videoAfterUnload.loadAsync({ uri: videoUrl }).then(() => {
              const videoForPlay = videoRefs.current[videoId];
              if (videoForPlay && typeof videoForPlay.playAsync === 'function') {
                videoForPlay.playAsync().catch(() => {
                  logger.error(`Video ${videoId} retry play failed`);
                });
              }
            }).catch((loadError) => {
              logger.error(`Video ${videoId} retry load failed:`, loadError);
              setSourceVersions(prev => ({ ...prev, [videoId]: (prev[videoId] ?? 0) + 1 }));
            });
          }
        }).catch(() => {
          const videoAfterError = videoRefs.current[videoId];
          if (videoAfterError && typeof videoAfterError.loadAsync === 'function') {
            videoAfterError.loadAsync({ uri: videoUrl }).catch(() => {
              setSourceVersions(prev => ({ ...prev, [videoId]: (prev[videoId] ?? 0) + 1 }));
            });
          }
        });
      } else {
        if (typeof video.loadAsync === 'function') {
          video.loadAsync({ uri: videoUrl }).catch(() => {
            setSourceVersions(prev => ({ ...prev, [videoId]: (prev[videoId] ?? 0) + 1 }));
          });
        }
      }
    }, delay);
  }, [shorts, getVideoUrl]);

  // Refactored: Fetch shorts using Cursor Pagination
  const loadShorts = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      nextCursorRef.current = null;
      hasMoreRef.current = true;

      logger.info(`[LOAD_SHORTS] Starting to load shorts via Cursor Pagination`, {
        effectiveUserId,
        effectiveShortId,
        timestamp: new Date().toISOString()
      });

      const shouldFilterByUser = !!effectiveUserId;

      if (effectiveShortId && !shouldFilterByUser) {
        try {
          const raw = await getPostById(effectiveShortId);
          const singleShort: PostType | null = raw?.post || raw || null;
          if (singleShort) {
            logger.info(`[LOAD_SHORTS] Loaded specific short:`, {
              shortId: singleShort._id,
              hasVideoUrl: !!singleShort.videoUrl,
              hasMediaUrl: !!singleShort.mediaUrl,
              hasImageUrl: !!singleShort.imageUrl
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
        
        try {
          const response = (await getShorts(null as any, 10)) as any;
          logger.info(`[LOAD_SHORTS] Loaded full feed (${response.shorts?.length || 0} shorts)`, {
            timestamp: new Date().toISOString()
          });
          
          if (response.shorts && response.shorts.length > 0) {
            response.shorts.slice(0, 2).forEach((s: any, idx: number) => {
              logger.info(`[LOAD_SHORTS] First 2 shorts - Short ${idx}:`, {
                shortId: s._id,
                hasVideoUrl: !!s.videoUrl,
                hasMediaUrl: !!s.mediaUrl,
                hasImageUrl: !!s.imageUrl
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
            const kept = prev.filter(s => !ids.has(s._id));
            return [...kept, ...merged];
          });
          const followStatesMap: { [key: string]: boolean } = {};
          response.shorts.forEach((short: PostType) => {
            followStatesMap[short.user._id] = (short.user as any).isFollowing || false;
          });
          setFollowStates(followStatesMap);
          nextCursorRef.current = response.pagination?.nextCursor || response.nextCursor || null;
          hasMoreRef.current = response.pagination?.hasNextPage !== undefined 
            ? response.pagination.hasNextPage 
            : (response.hasNextPage !== undefined ? response.hasNextPage : (response.shorts || []).length >= 10);
        } catch (e) {
          logger.warn('Failed to load full feed in background:', e);
        }
        return;
      }

      let response: any;
      if (shouldFilterByUser) {
        logger.debug(`Loading shorts for specific user: ${effectiveUserId}`);
        response = (await getUserShorts(effectiveUserId, null as any, 10)) as any;
      } else {
        response = (await getShorts(null as any, 10)) as any;
      }

      logger.info(`[LOAD_SHORTS] Loaded shorts (${response.shorts?.length || 0} shorts)`, {
        timestamp: new Date().toISOString()
      });
      
      if (response.shorts && response.shorts.length > 0) {
        response.shorts.slice(0, 2).forEach((s: any, idx: number) => {
          logger.info(`[LOAD_SHORTS] First 2 shorts - Short ${idx}:`, {
            shortId: s._id,
            hasVideoUrl: !!s.videoUrl,
            hasMediaUrl: !!s.mediaUrl,
            hasImageUrl: !!s.imageUrl
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
      setShorts(merged);
      
      nextCursorRef.current = response.pagination?.nextCursor || response.nextCursor || null;
      hasMoreRef.current = response.pagination?.hasNextPage !== undefined 
        ? response.pagination.hasNextPage 
        : (response.hasNextPage !== undefined ? response.hasNextPage : (response.shorts || []).length >= 10);

      const followStatesMap: { [key: string]: boolean } = {};
      response.shorts.forEach((short: PostType) => {
        followStatesMap[short.user._id] = (short.user as any).isFollowing || false;
      });
      setFollowStates(followStatesMap);
    } catch (error) {
      logger.error('Error loading shorts', error);
      showError('Failed to load shorts');
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, effectiveShortId, showError]);

  useEffect(() => {
    loadShortsRef.current = loadShorts;
  }, [loadShorts]);

  // Refactored: Fetch more shorts using the compound nextCursor
  const loadMoreShorts = useCallback(async () => {
    if (!hasMoreRef.current || isLoadingMore || !!effectiveUserId || !!effectiveShortId) return;
    try {
      setIsLoadingMore(true);
      const cursor = nextCursorRef.current;
      
      let response: any;
      if (effectiveUserId) {
        response = (await getUserShorts(effectiveUserId, cursor as any, 10)) as any;
      } else {
        response = (await getShorts(cursor as any, 10)) as any;
      }
      
      const newShorts: PostType[] = response.shorts || [];
      if (newShorts.length === 0) {
        hasMoreRef.current = false;
        return;
      }
      
      nextCursorRef.current = response.pagination?.nextCursor || response.nextCursor || null;
      hasMoreRef.current = response.pagination?.hasNextPage !== undefined 
        ? response.pagination.hasNextPage 
        : (response.hasNextPage !== undefined ? response.hasNextPage : newShorts.length >= 10);
      
      const mapped = newShorts.map((s) => {
        const fromStorage = likedShortIdsRef.current.has(s._id);
        const isLiked = s.isLiked || fromStorage;
        const likesCount = isLiked && fromStorage && !s.isLiked ? Math.max(s.likesCount ?? 0, 1) : (s.likesCount ?? 0);
        return { ...s, isLiked, likesCount };
      });
      
      setShorts(prev => {
        const existingIds = new Set(prev.map(s => s._id));
        return [...prev, ...mapped.filter((s) => !existingIds.has(s._id))];
      });
      
      const followStatesMap: { [key: string]: boolean } = {};
      newShorts.forEach((s) => { followStatesMap[s.user._id] = (s.user as any).isFollowing || false; });
      setFollowStates(prev => ({ ...prev, ...followStatesMap }));
    } catch (error) {
      logger.error('Error loading more shorts', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [effectiveUserId, effectiveShortId, isLoadingMore]);

  // Load persisted liked short IDs on mount
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

  // Socket update listeners
  useEffect(() => {
    const handleShortCreated = (payload: { shortId?: string }) => {
      logger.debug('Short created event received, refreshing feed:', payload);
      const shouldFilterByUser = !!effectiveUserId;
      if (!shouldFilterByUser) {
        const loadFn = loadShortsRef.current;
        if (loadFn) {
          loadFn();
        }
      }
    };
    
    const handleInvalidateFeed = () => {
      logger.debug('Feed invalidation event received, refreshing shorts feed');
      const shouldFilterByUser = !!effectiveUserId;
      if (!shouldFilterByUser) {
        const loadFn = loadShortsRef.current;
        if (loadFn) {
          loadFn();
        }
      }
    };
    
    socketService.subscribe('short:created', handleShortCreated).catch(err => {
      logger.warn('Error subscribing to short:created event:', err);
    });
    
    socketService.subscribe('invalidate:feed', handleInvalidateFeed).catch(err => {
      logger.warn('Error subscribing to invalidate:feed event:', err);
    });
    
    return () => {
      socketService.unsubscribe('short:created', handleShortCreated);
      socketService.unsubscribe('invalidate:feed', handleInvalidateFeed);
    };
  }, [effectiveUserId]);

  const toggleVideoPlayback = useRecoilCallback(({ snapshot, set }) => async (videoId: string) => {
    const isCurrentlyPlaying = await snapshot.getPromise(videoPlayingFamily(videoId));
    const newPlayState = !isCurrentlyPlaying;
    set(videoPlayingFamily(videoId), newPlayState);

    const video = videoRefs.current[videoId];
    if (video) {
      const currentShort = shorts.find(s => s._id === videoId);
      const hasMusic = !!(currentShort?.song?.songId?._id);

      if (newPlayState) {
        Object.keys(videoRefs.current).forEach(id => {
          if (id !== videoId) {
            set(videoPlayingFamily(id), false);
            videoRefs.current[id]?.pauseAsync().catch(() => {});
          }
        });
        activeVideoIdRef.current = videoId;
        if (hasMusic) {
          video.setIsMutedAsync(true).catch(() => {});
          video.setVolumeAsync(0.0).catch(() => {});
        } else {
          video.setIsMutedAsync(false).catch(() => {});
          video.setVolumeAsync(1.0).catch(() => {});
        }
      } else {
        if (activeVideoIdRef.current === videoId) {
          activeVideoIdRef.current = null;
        }
      }
      video.setStatusAsync({ shouldPlay: newPlayState }).catch(() => {});
    }
  }, [shorts]);

  const handleLike = async (shortId: string) => {
    if (actionLoading === shortId) return;
    
    let previousState: { isLiked: boolean; likesCount: number } | null = null;
    
    try {
      setActionLoading(shortId);
      
      setShorts(prev => {
        const currentShort = prev.find(s => s._id === shortId);
        if (currentShort) {
          previousState = {
            isLiked: currentShort.isLiked || false,
            likesCount: currentShort.likesCount || 0
          };
          
          const nextLiked = !currentShort.isLiked;
          const nextCount = nextLiked 
            ? (currentShort.likesCount || 0) + 1 
            : Math.max(0, (currentShort.likesCount || 0) - 1);
            
          return prev.map(s => 
            s._id === shortId 
              ? { ...s, isLiked: nextLiked, likesCount: nextCount } 
              : s
          );
        }
        return prev;
      });

      const response = await toggleLike(shortId);
      
      if (response && response.likesCount !== undefined) {
        setShorts(prev => prev.map(s => 
          s._id === shortId 
            ? { ...s, isLiked: response.isLiked, likesCount: response.likesCount } 
            : s
        ));
        
        if (response.isLiked) {
          likedShortIdsRef.current.add(shortId);
        } else {
          likedShortIdsRef.current.delete(shortId);
        }
        await AsyncStorage.setItem(LIKED_SHORTS_STORAGE_KEY, JSON.stringify(Array.from(likedShortIdsRef.current)));
      }
    } catch (error) {
      logger.error('Error toggling like', error);
      
      if (previousState) {
        setShorts(prev => prev.map(s => 
          s._id === shortId 
            ? { ...s, isLiked: (previousState as any).isLiked, likesCount: (previousState as any).likesCount } 
            : s
        ));
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleComment = async (shortId: string) => {
    try {
      setSelectedShortId(shortId);
      setShowCommentModal(true);
      
      const response = await getPostById(shortId);
      const short = response?.post || response;
      if (short && short.comments) {
        setSelectedShortComments(short.comments);
      }
    } catch (error) {
      logger.error('Error fetching comments', error);
      showError('Failed to load comments');
    }
  };

  const handleCommentAdded = (newComment: any) => {
    if (!selectedShortId) return;
    
    setSelectedShortComments(prev => [...prev, newComment]);
    
    setShorts(prev => prev.map(s => {
      if (s._id === selectedShortId) {
        return {
          ...s,
          commentsCount: (s.commentsCount || 0) + 1
        };
      }
      return s;
    }));
  };

  const handleShare = (short: PostType) => {
    setSelectedShortForShare(short);
    setShowShareModal(true);
  };

  const handleSave = async (shortId: string) => {
    try {
      const nextSaved = new Set(savedShorts);
      if (nextSaved.has(shortId)) {
        nextSaved.delete(shortId);
        showSuccess('Short removed from saved');
      } else {
        nextSaved.add(shortId);
        showSuccess('Short saved successfully!');
      }
      setSavedShorts(nextSaved);
      await AsyncStorage.setItem('savedShorts', JSON.stringify(Array.from(nextSaved)));
    } catch (error) {
      logger.error('Error saving short', error);
      showError('Failed to save short');
    }
  };

  const handleProfilePress = useCallback(async (userId: string) => {
    pauseCurrentVideo();
    router.push(`/profile/${userId}`);
  }, [pauseCurrentVideo, router]);

  const handleFollow = async (userId: string) => {
    try {
      const isCurrentlyFollowing = followStates[userId] || false;
      const response = await toggleFollow(userId);
      
      if (response) {
        setFollowStates(prev => ({
          ...prev,
          [userId]: !isCurrentlyFollowing
        }));
        
        showSuccess(isCurrentlyFollowing ? 'Unfollowed user' : 'Following user!');
      }
    } catch (error) {
      logger.error('Error toggling follow state', error);
      showError('Failed to update follow status');
    }
  };

  const handleSwipeLeft = useCallback((userId: string) => {
    pauseCurrentVideo();
    router.push(`/profile/${userId}`);
  }, [pauseCurrentVideo, router]);

  const handleTouchStart = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    swipeStartXRef.current = pageX;
    swipeStartYRef.current = pageY;
  };

  const handleTouchMove = (event: any) => {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) return;

    const { pageX, pageY } = event.nativeEvent;
    const deltaX = pageX - swipeStartXRef.current;
    const deltaY = pageY - swipeStartYRef.current;

    if (deltaX < 0 && Math.abs(deltaX) > Math.abs(deltaY)) {
      const progress = Math.min(Math.abs(deltaX) / 100, 1);
      swipeAnimation.setValue(-progress);
    } else {
      swipeAnimation.setValue(0);
    }
  };

  const handleTouchEnd = (event: any, userId: string) => {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) return;

    const { pageX, pageY } = event.nativeEvent;
    const deltaX = pageX - swipeStartXRef.current;
    const deltaY = pageY - swipeStartYRef.current;
    
    const horizontalRatio = Math.abs(deltaX) / (Math.abs(deltaY) || 1);
    const isLeftSwipe = deltaX < 0;
    
    if (isLeftSwipe && horizontalRatio > 1.5 && Math.abs(deltaX) > 50) {
      if (isNavigatingRef.current) {
        Animated.spring(swipeAnimation, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
        swipeStartXRef.current = null;
        swipeStartYRef.current = null;
        return;
      }

      isNavigatingRef.current = true;
      lastNavigationUserIdRef.current = userId;

      logger.debug('Swipe left detected, navigating to profile:', userId);
      handleSwipeLeft(userId);
    } else {
      Animated.spring(swipeAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }

    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
  };

  const handleDeleteShort = async (shortId: string) => {
    showConfirm(
      'Are you sure you want to delete this short?',
      async () => {
        try {
          await deleteShort(shortId);
          await audioManager.stopAll();
          
          // Remove from local state
          setShorts(prev => prev.filter(short => short._id !== shortId));
          
          // Remove from saved shorts if it exists there
          const savedShortsVal = await AsyncStorage.getItem('savedShorts');
          if (savedShortsVal) {
            const savedIds = JSON.parse(savedShortsVal);
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

  const handlePanGesture = useCallback((event: any) => {
    const { translationX } = event.nativeEvent;
    
    // Only handle left swipes (translationX is negative)
    if (translationX < 0) {
      // Calculate progress (from 0 to 1) based on a distance of 120px for full swipe
      const progress = Math.min(Math.abs(translationX) / 120, 1);
      swipeAnimation.setValue(-progress);
    } else {
      swipeAnimation.setValue(0);
    }
  }, [swipeAnimation]);

  const handlePanStateChange = useCallback((event: any, userId: string) => {
    const { state, translationX, velocityX } = event.nativeEvent;
    
    if (state === State.END) {
      const isLeftSwipe = translationX < 0;
      // Trigger navigation if they swiped left by more than 60px or had high left velocity
      if (isLeftSwipe && (Math.abs(translationX) > 60 || velocityX < -500)) {
        // Check if navigation is already in progress to prevent duplicate navigations
        if (isNavigatingRef.current) {
          logger.debug('Pan swipe left detected but navigation already in progress, ignoring duplicate swipe');
          Animated.spring(swipeAnimation, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
          return;
        }

        // Set guard immediately to prevent duplicate swipes
        isNavigatingRef.current = true;
        lastNavigationUserIdRef.current = userId;

        logger.debug('Pan swipe left detected, navigating to profile:', userId);
        handleSwipeLeft(userId);
      } else {
        // Reset animation with a spring if not a valid left swipe (right swipe or invalid gesture)
        Animated.spring(swipeAnimation, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      }
    }
  }, [swipeAnimation, handleSwipeLeft]);

  const showShortsAds = !isWeb && !isExpoGo && hasWatchedFiveReels && adsAllowedAfter20s && !adCap.isCapped && !shortsAdsBroken;
  const shortsData = useMemo((): ShortsItem[] => {
    if (!showShortsAds || shorts.length === 0) return shorts as ShortsItem[];
    const maxSlots = Math.min(
      MAX_SHORTS_ADS,
      Math.max(0, 3 - adsShownThisSession),
      adCap.remainingSlots,
    );
    if (maxSlots <= 0) return shorts as ShortsItem[];
    const result: ShortsItem[] = [];
    let adCount = 0;
    shorts.forEach((reel, i) => {
      result.push(reel);
      if (adCount < maxSlots && (i + 1) % SHORTS_ADS_AFTER_EVERY === 0 && i < shorts.length - 1) {
        result.push({ type: 'ad', adIndex: adCount++ });
      }
    });
    return result;
  }, [shorts, showShortsAds, adsShownThisSession, adCap.remainingSlots]);

  // Deep Link Scroll Effect
  useEffect(() => {
    if (!effectiveShortId || shorts.length === 0) return;
    const reelIndex = shorts.findIndex(s => s._id === effectiveShortId);
    if (reelIndex === -1) return;
    const maxSlots = Math.min(
      MAX_SHORTS_ADS,
      Math.max(0, 3 - adsShownThisSession),
      adCap.remainingSlots,
    );
    const dataIndex = showShortsAds
      ? reelIndex + Math.min(Math.floor(reelIndex / SHORTS_ADS_AFTER_EVERY), maxSlots)
      : reelIndex;
    setCurrentVisibleIndex(dataIndex);
    const attemptScroll = (attempt: number = 0) => {
      if (attempt > 5) return;
      setTimeout(() => {
        if (flatListRef.current) {
          try {
            flatListRef.current.scrollToIndex({ index: dataIndex, animated: false });
          } catch {
            attemptScroll(attempt + 1);
          }
        } else {
          attemptScroll(attempt + 1);
        }
      }, 100 * (attempt + 1));
    };
    attemptScroll();
  }, [effectiveShortId, shorts, showShortsAds, adsShownThisSession, adCap.remainingSlots]);

  // Playback synchronization effect
  useEffect(() => {
    const visibleItem = shortsData[currentVisibleIndex] as ShortsItem | undefined;
    const isReel = visibleItem && !isAdItem(visibleItem);

    if (!isReel) {
      Object.keys(videoRefs.current).forEach(id => {
        setVideoPlayingState(id, false);
        videoRefs.current[id]?.pauseAsync().catch(() => {});
      });
      activeVideoIdRef.current = null;
      return;
    }

    const currentShortId = (visibleItem as PostType)._id.toString();
    const currentVideo = videoRefs.current[currentShortId];
    
    Object.keys(videoRefs.current).forEach(id => {
      if (id !== currentShortId) {
        setVideoPlayingState(id, false);
        videoRefs.current[id]?.pauseAsync().catch(() => {});
      }
    });

    if (currentVideo) {
      activeVideoIdRef.current = currentShortId;
      currentVideo.getStatusAsync().then((status) => {
        if (status.isLoaded) {
          const hasMusic = !!((visibleItem as PostType)?.song?.songId?._id);
          if (hasMusic) {
            currentVideo.setIsMutedAsync(true).catch(() => {});
            currentVideo.setVolumeAsync(0.0).catch(() => {});
          }
          if (!status.isPlaying) {
            currentVideo.playAsync().then(() => {
              setVideoPlayingState(currentShortId, true);
              logger.debug(`Video ${currentShortId} started playing via useEffect`);
            }).catch((error) => {
              logger.error(`Video ${currentShortId} failed to play via useEffect:`, error);
              setTimeout(() => { currentVideo.playAsync().catch(() => {}); }, 500);
            });
          } else {
            setVideoPlayingState(currentShortId, true);
          }
        }
      }).catch((error) => {
        logger.error(`Failed to get status for video ${currentShortId}:`, error);
        currentVideo.playAsync().catch(() => {});
      });
    } else {
      activeVideoIdRef.current = currentShortId;
      setVideoPlayingState(currentShortId, true);
      logger.debug(`Video ref not available for ${currentShortId}, will play when mounted`);
    }
  }, [currentVisibleIndex, shortsData]);

  // Preload and track views
  useEffect(() => {
    const visibleItem = shortsData[currentVisibleIndex] as ShortsItem | undefined;
    if (visibleItem && !isAdItem(visibleItem)) {
      const currentShort = visibleItem as PostType;
      const now = Date.now();
      if (
        lastViewedShortIdRef.current !== currentShort._id ||
        (now - lastViewTimeRef.current) > VIEW_DEBOUNCE_MS
      ) {
        trackPostView(currentShort._id, { type: 'short', source: 'shorts_feed' });
        lastViewedShortIdRef.current = currentShort._id;
        lastViewTimeRef.current = now;
      }
    }
    for (let i = currentVisibleIndex + 1; i < shortsData.length; i++) {
      const nextItem = shortsData[i] as ShortsItem;
      if (nextItem && !isAdItem(nextItem)) {
        const nextShort = nextItem as PostType;
        const nextUrl = getVideoUrl(nextShort);
        if (nextUrl) {
          Asset.fromURI(nextUrl).downloadAsync().catch(err => {
            logger.debug('Silent video prefetch failed in useEffect:', err);
          });
        }
        break;
      }
    }
  }, [currentVisibleIndex, shortsData, getVideoUrl]);

  // Keep handlers Ref updated
  useEffect(() => {
    handlersRef.current = {
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      toggleVideoPlayback,
      handleDeleteShort,
      handleProfilePress,
      handleLike,
      handleComment,
      handleShare,
      handleSave,
      getVideoUrl,
      refetchShortWithFreshUrl,
      retryVideoLoad,
      handlePanGesture,
      handlePanStateChange,
    };
  }, [
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    toggleVideoPlayback,
    handleDeleteShort,
    handleProfilePress,
    handleLike,
    handleComment,
    handleShare,
    handleSave,
    getVideoUrl,
    refetchShortWithFreshUrl,
    retryVideoLoad,
    handlePanGesture,
    handlePanStateChange,
  ]);

  const renderShortItem = useCallback(({ item, index }: { item: ShortsItem; index: number }) => {
    if (isAdItem(item)) {
      return (
        <View style={[styles.shortItem, styles.shortItemAdWrapper, { height: dynamicItemHeight }]}>
          <ShortsNativeAd
            adIndex={item.adIndex}
            height={dynamicItemHeight}
            fillParent
            onImpression={() => {
              adsShownThisSessionRef.current += 1;
              setAdsShownThisSession((prev) => Math.min(3, prev + 1));
              recordGoogleAdImpression();
            }}
            onLoadFailed={() => {
              setShortsAdsBroken(true);
            }}
          />
        </View>
      );
    }

    const isVisibleNow = index === currentVisibleIndex;
    const isFollowing = followStates[item.user._id] || false;
    const isSaved = savedShorts.has(item._id);
    const isMuted = mutedShorts.has(item._id);

    const onPanStateChange = (event: any) => {
      handlersRef.current.handlePanStateChange(event, item.user._id);
    };

    return (
      <Animated.View style={[
        styles.shortItem, 
        { height: dynamicItemHeight },
        isVisibleNow && {
          transform: [{
            translateX: swipeAnimation.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-SCREEN_WIDTH, 0, 0],
            })
          }]
        }
      ]}>
        <PanGestureHandler
          activeOffsetX={[-30, 0]}
          failOffsetY={[-20, 20]}
          onGestureEvent={isVisibleNow ? handlersRef.current.handlePanGesture : undefined}
          onHandlerStateChange={isVisibleNow ? onPanStateChange : undefined}
          enabled={isVisibleNow && !isNavigatingRef.current}
        >
          <View style={StyleSheet.absoluteFillObject}>
            <ShortsCell
              item={item}
              index={index}
              isScreenFocused={isScreenFocused}
              currentUser={currentUser}
              isFollowing={isFollowing}
              isSaved={isSaved}
              isMuted={isMuted}
              actionLoading={actionLoading === item._id}
              sourceVersion={sourceVersions[item._id] ?? 0}
              getVideoUrl={handlersRef.current.getVideoUrl}
              onProfilePress={handlersRef.current.handleProfilePress}
              onLikePress={handlersRef.current.handleLike}
              onCommentPress={handlersRef.current.handleComment}
              onSharePress={handlersRef.current.handleShare}
              onSavePress={handlersRef.current.handleSave}
              onDeletePress={handlersRef.current.handleDeleteShort}
              onLocationPress={(address) => {
                geocodeAddress(address).then((coordinates) => {
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
                }).catch(() => {
                  router.push('/map/current-location');
                });
              }}
              onSongPlayingChange={handleSongPlayingChange}
              onTouchStart={handlersRef.current.handleTouchStart}
              onTouchMove={handlersRef.current.handleTouchMove}
              onTouchEnd={(event) => handlersRef.current.handleTouchEnd(event, item.user._id)}
              videoRefCallback={(ref) => {
                videoRefs.current[item._id] = ref;
              }}
              onError={(shortId, error) => {
                handlersRef.current.retryVideoLoad(shortId, 1000);
              }}
            />
          </View>
        </PanGestureHandler>
      </Animated.View>
    );
  }, [currentVisibleIndex, followStates, savedShorts, mutedShorts, currentUser, isScreenFocused, actionLoading, sourceVersions, dynamicItemHeight, swipeAnimation]);

  const keyExtractor = useCallback((item: ShortsItem) => {
    if (isAdItem(item)) return `ad-${item.adIndex}`;
    return item._id;
  }, []);

  const overrideItemLayout = useCallback((
    layout: { span?: number; size?: number },
    item: ShortsItem,
    index: number,
    maxColumns: number,
    extraData?: any
  ) => {
    layout.size = dynamicItemHeight;
  }, [dynamicItemHeight]);

  const onViewableItemsChanged = useRecoilCallback(({ set }) => ({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length === 0) return;
    const visibleItem = viewableItems[0];
    const newVisibleIndex = visibleItem.index;
    const item = visibleItem.item as ShortsItem;

    if (newVisibleIndex === undefined || newVisibleIndex === null || newVisibleIndex === currentVisibleIndex) return;

    if (currentPlayerRef.current) {
      currentPlayerRef.current.pauseAsync?.().catch(() => {});
      currentPlayerRef.current = null;
    }

    const previousIndex = currentVisibleIndex;
    const previousItem = shortsData[previousIndex] as ShortsItem | undefined;

    set(activeShortIndexAtom, newVisibleIndex);

    if (item && !isAdItem(item)) {
      const reelIndex = shortsData.slice(0, newVisibleIndex).filter((x: ShortsItem) => !isAdItem(x)).length;
      if (reelIndex >= 5) setHasWatchedFiveReels(true);
    }

    if (previousItem && !isAdItem(previousItem)) {
      const previousVideoId = previousItem._id;
      set(videoPlayingFamily(previousVideoId), false);
      const previousVideo = videoRefs.current[previousVideoId];
      if (previousVideo) {
        previousVideo.pauseAsync().catch(() => {});
      }
    }

    if (activeVideoIdRef.current && item && !isAdItem(item) && item._id !== activeVideoIdRef.current) {
      activeVideoIdRef.current = null;
    }

    if (item && !isAdItem(item)) {
      activeVideoIdRef.current = item._id;
      set(videoPlayingFamily(item._id), true);
    } else {
      activeVideoIdRef.current = null;
    }

    const nextIndex = newVisibleIndex + 1;
    if (nextIndex < shortsData.length) {
      const nextItem = shortsData[nextIndex];
      if (nextItem && !isAdItem(nextItem)) {
        const nextUrl = getVideoUrl(nextItem);
        if (nextUrl) {
          Asset.fromURI(nextUrl).downloadAsync().catch(err => {
            logger.debug('Silent prefetch failed in onViewableItemsChanged:', err);
          });
        }
      }
    }
  }, [shortsData, currentVisibleIndex, getVideoUrl]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 50,
  }).current;

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#FF3040" style={styles.loadingSpinner} />
            <Text style={styles.loadingTitle}>Loading Shorts</Text>
            <Text style={styles.loadingSubtitle}>
              {effectiveUserId ? 'Loading this user’s shorts…' : 'Discover amazing content'}
            </Text>
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
          <Text style={styles.emptyTitle}>
            {effectiveUserId ? 'No Shorts Yet' : 'No Shorts Available'}
          </Text>
          <Text style={styles.emptyDescription}>
            {effectiveUserId
              ? 'This user hasn’t posted any shorts yet.'
              : 'Be the first to create amazing short videos and share your stories with the world.'}
          </Text>
          {!effectiveUserId && (
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
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0D1B2A' : '#F0F4F8' }]}>
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent" 
        translucent={true}
      />

      {/* Opaque Top Bar */}
      <View style={[styles.topBarContainer, { height: dynamicTopBarHeight, paddingTop: dynamicTopBarHeight - 56, backgroundColor: isDark ? '#0D1B2A' : '#FFFFFF' }]}>
        <View style={styles.topBarContent}>
          {!effectiveUserId ? (
            <Pressable onPress={handleBack} style={styles.topBarButton} accessibilityLabel="Back" accessibilityRole="button">
              <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#122236'} />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}

          <Text style={[styles.topBarTitle, { color: isDark ? '#FFFFFF' : '#122236' }]}>Shorts</Text>

          {(() => {
            const currentShort = shorts[currentVisibleIndex] as PostType | undefined;
            const hasSong = !!(currentShort?.song?.songId && currentShort.song.songId._id);
            if (!hasSong) {
              return <View style={{ width: 40 }} />;
            }
            const isMuted = currentShort ? mutedShorts.has(currentShort._id) : false;
            return (
              <Pressable
                style={styles.topBarButton}
                onPress={() => {
                  if (!currentShort) return;
                  setMutedShorts(prev => {
                    const next = new Set(prev);
                    if (next.has(currentShort._id)) next.delete(currentShort._id);
                    else next.add(currentShort._id);
                    return next;
                  });
                }}
                accessibilityLabel={isMuted ? 'Unmute song' : 'Mute song'}
                accessibilityRole="button"
              >
                <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={24} color={isDark ? '#FFFFFF' : '#122236'} />
              </Pressable>
            );
          })()}
        </View>
      </View>
      
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.25)', 'transparent']}
        style={[styles.topBarShadow, { top: dynamicTopBarHeight }]}
      />

      <View
        style={[styles.shortsListClip, {
          position: 'absolute',
          top: dynamicTopBarHeight,
          bottom: dynamicTabBarHeight,
          left: 0,
          right: 0,
        }]}
        onLayout={handleContainerLayout}
      >
        <AnyFlashList
          ref={flatListRef}
          data={shortsData}
          renderItem={renderShortItem}
          keyExtractor={keyExtractor}
          overrideItemLayout={overrideItemLayout}
          estimatedItemSize={dynamicItemHeight}
          initialScrollIndex={(() => {
            if (!effectiveShortId || shorts.length === 0) return undefined;
            const reelIndex = shorts.findIndex(s => s._id === effectiveShortId);
            if (reelIndex === -1) return undefined;
            const maxSlots = Math.min(MAX_SHORTS_ADS, Math.max(0, 3 - adsShownThisSession));
            const dataIndex = showShortsAds ? reelIndex + Math.min(Math.floor(reelIndex / SHORTS_ADS_AFTER_EVERY), maxSlots) : reelIndex;
            return dataIndex;
          })()}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          snapToInterval={dynamicItemHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum={true}
          onScrollToIndexFailed={(info) => {
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
            });
          }}
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
      </View>

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

// Recoil Wrapper Root to support localized Recoil states
export default function ShortsScreen(props: ShortsScreenProps = {}) {
  return (
    <ErrorBoundary level="route">
      <RecoilRoot>
        <ShortsScreenContent {...props} />
      </RecoilRoot>
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
  shortsListClip: {
    position: 'absolute',
    left: 0,
    right: 0,
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
    height: SHORTS_ITEM_HEIGHT,
    position: 'relative',
    backgroundColor: 'black',
  },
  shortItemAdWrapper: {
    height: SHORTS_ITEM_HEIGHT,
    overflow: 'hidden',
  },
  topBarContainer: {
    height: TOP_BAR_HEIGHT,
    backgroundColor: '#000000',
    paddingTop: TOP_BAR_HEIGHT - 56,
    justifyContent: 'flex-end',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 8,
  },
  topBarContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topBarButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: getFontFamily('600'),
    textAlign: 'center',
  },
  topBarShadow: {
    position: 'absolute',
    top: TOP_BAR_HEIGHT,
    left: 0,
    right: 0,
    height: 8,
    zIndex: 99,
  },
});