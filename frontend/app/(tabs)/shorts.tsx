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
import { savedEvents } from '../../utils/savedEvents';
import { triggerHaptic } from '../../utils/hapticFeedback';
import { shortsEvents } from '../../utils/shortsEvents';
import { preloadVideoAsync, getLocalVideoUri, removeCachedVideo } from '../../src/utils/videoCache';

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

interface MarqueeTextProps {
  text: string;
  style?: any;
  containerStyle?: any;
  icon?: React.ReactNode;
}

const MarqueeText = React.memo(({ text, style, containerStyle, icon }: MarqueeTextProps) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    animatedValue.setValue(0);
    if (textWidth > 0 && containerWidth > 0 && textWidth > containerWidth) {
      const offset = textWidth - containerWidth + 24; // 24px extra buffer
      
      const startAnimation = () => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(1500),
            Animated.timing(animatedValue, {
              toValue: -offset,
              duration: offset * 30, // 30ms per pixel
              useNativeDriver: true,
            }),
            Animated.delay(1500),
            Animated.timing(animatedValue, {
              toValue: 0,
              duration: offset * 30,
              useNativeDriver: true,
            }),
          ])
        ).start();
      };

      startAnimation();
    }
    return () => {
      animatedValue.stopAnimation();
    };
  }, [textWidth, containerWidth, text]);

  const onTextLayout = (e: any) => {
    const { width } = e.nativeEvent.layout;
    setTextWidth(width);
  };

  const onContainerLayout = (e: any) => {
    const { width } = e.nativeEvent.layout;
    setContainerWidth(width);
  };

  return (
    <View 
      style={[{ flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }, containerStyle]}
      onLayout={onContainerLayout}
    >
      {icon}
      <View style={{ overflow: 'hidden', flex: 1, marginLeft: icon ? 6 : 0 }}>
        <Animated.View
          style={{
            flexDirection: 'row',
            transform: [{ translateX: animatedValue }],
            alignSelf: 'flex-start',
          }}
        >
          <Text
            style={[style, { flexShrink: 0, flexGrow: 0 }]}
            onLayout={onTextLayout}
            numberOfLines={1}
          >
            {text}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
});

MarqueeText.displayName = 'MarqueeText';

interface CyclingMetadataProps {
  song?: {
    songId?: {
      title?: string;
      artist?: string;
    } | string | null;
  } | null;
  location?: {
    address?: string;
  } | null;
  onLocationPress: (e: any) => void;
}

const CyclingMetadata = React.memo(({ song, location, onLocationPress }: CyclingMetadataProps) => {
  const songIdObj = typeof song?.songId === 'object' ? song?.songId : null;
  const songTitle = songIdObj?.title;
  const songArtist = songIdObj?.artist;
  const hasSong = !!(songTitle || songArtist);
  const hasLocation = !!location?.address;

  // If neither is present, show nothing
  if (!hasSong && !hasLocation) return null;

  // If only one is present, show it statically without animation
  if (hasSong && !hasLocation) {
    const displayText = `${songTitle || 'Unknown Song'} · ${songArtist || 'Unknown Artist'}`;
    return (
      <View style={styles.cyclingContainer}>
        <Ionicons name="musical-notes" size={12} color="#38BDF8" />
        <Text style={styles.cyclingText} numberOfLines={1}>
          {displayText}
        </Text>
      </View>
    );
  }

  if (!hasSong && hasLocation) {
    return (
      <TouchableOpacity 
        style={styles.cyclingContainer} 
        onPress={onLocationPress}
        activeOpacity={0.7}
      >
        <Ionicons name="location" size={12} color="#38BDF8" />
        <Text style={styles.cyclingText} numberOfLines={1}>
          {location.address}
        </Text>
      </TouchableOpacity>
    );
  }

  // Both song and location are present -> cycle every 2 seconds
  const [showLocation, setShowLocation] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      // Step 1: Fade out & Slide up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateAnim, {
          toValue: -10,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Step 2: Toggle content and position text below
        setShowLocation(prev => !prev);
        translateAnim.setValue(10);
        
        // Step 3: Fade in & Slide back to center
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(translateAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 2000); // 2 seconds delay

    return () => clearInterval(interval);
  }, []);

  const songText = `${songTitle || 'Unknown Song'} · ${songArtist || 'Unknown Artist'}`;

  return (
    <Animated.View
      style={[
        styles.cyclingAnimatedWrapper,
        {
          opacity: fadeAnim,
          transform: [{ translateY: translateAnim }],
        }
      ]}
    >
      {showLocation ? (
        <TouchableOpacity 
          style={styles.cyclingContainer} 
          onPress={onLocationPress}
          activeOpacity={0.7}
        >
          <Ionicons name="location" size={12} color="#38BDF8" />
          <Text style={styles.cyclingText} numberOfLines={1}>
            {location.address}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.cyclingContainer}>
          <Ionicons name="musical-notes" size={12} color="#38BDF8" />
          <Text style={styles.cyclingText} numberOfLines={1}>
            {songText}
          </Text>
        </View>
      )}
    </Animated.View>
  );
});

CyclingMetadata.displayName = 'CyclingMetadata';


/**
 * Memo wrapper around a single shorts cell. The parent computes a small
 * `cacheKey` string of every state slice that affects this cell's rendered
 * output (visibility, isPlaying, isMuted, isSaved, isFollowing, like state,
 * pause-button overlay, like-animation overlay, source-version key, etc.)
 * and passes the cell's JSX as a thunk via `render`.
 *
 * React.memo's custom comparator only checks `cacheKey`. When a sibling
 * cell's state changes, that sibling's cacheKey changes but THIS cell's
 * doesn't, so React.memo skips re-rendering this cell entirely — even
 * though the parent's `renderShortItem` ran with a fresh closure. That's
 * what stops the "tap Like on cell A also re-renders cells B and C" cost
 * that was the dominant remaining stutter source after the in-cell state-
 * coalescing pass.
 *
 * If we ever need to invalidate every visible cell at once (e.g. on theme
 * change), include the relevant value in the cacheKey.
 */
interface ShortsCellProps {
  item: PostType;
  index: number;
  currentVisibleIndex: number;
  isVideoPlaying: boolean;
  isScreenFocused: boolean;
  isMuted: boolean;
  currentUser: any;
  containerHeight: number;
  isFollowing: boolean;
  isSaved: boolean;
  isLiked: boolean;
  localVideoUris: Record<string, string>;
  isCacheChecked: boolean;
  isSavedShorts?: boolean;
  effectiveUserId?: string | null;
  handlers: any;
  videoRefs: React.MutableRefObject<Record<string, Video | null>>;
  currentPlayerRef: React.MutableRefObject<Audio.Sound | null>;
  progressCallbacks: React.MutableRefObject<Record<string, (position: number, duration: number) => void>>;
  lastVideoPositionRef: React.MutableRefObject<Record<string, number>>;
  activeStartedWithRemoteRef: React.MutableRefObject<Record<string, boolean>>;
  showSwipeHint: boolean;
  fadeAnimation: Animated.Value;
  likedShortIdsRef: React.MutableRefObject<Set<string>>;
  videoCacheRef: React.MutableRefObject<Map<string, { url: string; timestamp: number }>>;
  appState: AppStateStatus;
}

const ShortsCell = React.memo((props: ShortsCellProps) => {
  const {
    item,
    index,
    currentVisibleIndex,
    isVideoPlaying,
    isScreenFocused,
    isMuted: isMutedProp,
    currentUser,
    containerHeight,
    isFollowing,
    isSaved,
    isLiked,
    localVideoUris,
    isCacheChecked,
    isSavedShorts,
    effectiveUserId,
    handlers,
    videoRefs,
    currentPlayerRef,
    progressCallbacks,
    lastVideoPositionRef,
    activeStartedWithRemoteRef,
    showSwipeHint,
    fadeAnimation,
    likedShortIdsRef,
    videoCacheRef,
    appState,
  } = props;

  const isActive = index === currentVisibleIndex;

  // Local States
  const [videoReady, setVideoReady] = useState(false);
  const [showPauseButton, setShowPauseButton] = useState(false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [sourceVersion, setSourceVersion] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [likeParticles, setLikeAnimationParticles] = useState<Array<{ id: string; x: number; y: number }>>([]);
  const [isMuted, setIsMuted] = useState(isMutedProp);

  // Sync mute state from props
  useEffect(() => {
    setIsMuted(isMutedProp);
  }, [isMutedProp]);

  // Reset user-paused state when scrolling away so it auto-plays next time
  useEffect(() => {
    if (!isActive) {
      setUserPaused(false);
    }
  }, [isActive]);

  const router = useRouter();

  // Local Refs
  const videoRef = useRef<Video | null>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const likeAnimTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const likeAnimationVal = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef<Record<string, any>>({});
  const lastMuteEnforceAtRef = useRef<number>(0);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      if (likeAnimTimeoutRef.current) clearTimeout(likeAnimTimeoutRef.current);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, []);

  const retryVideoLoadLocally = () => {
    setTimeout(() => {
      setSourceVersion(prev => prev + 1);
      setVideoReady(false);
    }, 1000);
  };

  // Sync playback state based on visibility and focus
  const shouldPlay = isActive && isVideoPlaying && isScreenFocused && !userPaused && appState === 'active';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (shouldPlay) {
      video.getStatusAsync().then((status) => {
        if (status.isLoaded && !status.isPlaying) {
          video.playAsync().then(() => {
            setIsPlaying(true);
          }).catch(() => {});
        }
      }).catch(() => {});
    } else {
      video.getStatusAsync().then((status) => {
        if (status.isLoaded && status.isPlaying) {
          video.pauseAsync().then(() => {
            setIsPlaying(false);
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [shouldPlay]);

  // Sync native video player's mute/volume when isMuted, isActive, or song changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const hasMusic = !!(item.song?.songId?._id || item.song?.songId);
    const shouldMuteVideo = !isActive || hasMusic || isMuted;
    video.getStatusAsync().then((status) => {
      if (status.isLoaded) {
        video.setIsMutedAsync(shouldMuteVideo).catch(() => {});
        video.setVolumeAsync(shouldMuteVideo ? 0.0 : 1.0).catch(() => {});
      }
    }).catch(() => {});
  }, [isMuted, isActive, item.song]);

  // Recovery check inside ShortsCell
  useEffect(() => {
    if (!isActive || videoReady || !isScreenFocused || appState !== 'active') return;
    
    const timer = setTimeout(() => {
      const video = videoRef.current;
      if (video) {
        video.getStatusAsync().then((status) => {
          if (!status.isLoaded) {
            logger.warn(`Video ${item._id} still not loaded after 1.5s - triggering URL refetch recovery`);
            handlers.refetchShortWithFreshUrl(item._id)
              .then((freshShort: PostType | null) => {
                if (freshShort) {
                  setSourceVersion(prev => prev + 1);
                  setVideoReady(false);
                  logger.info(`Successfully recovered visible video ${item._id} with fresh signed URL`);
                } else {
                  retryVideoLoadLocally();
                }
              })
              .catch(() => {
                retryVideoLoadLocally();
              });
          }
        }).catch(() => {});
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isActive, videoReady, isScreenFocused, appState]);

  const showLikeAnimationTemporarily = () => {
    likeAnimationVal.setValue(0);
    setShowLikeAnimation(true);
    setShowPauseButton(false);

    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }

    const particleCount = 6;
    const particles: Array<{ id: string; x: number; y: number }> = [];
    const localParticleAnims: Record<string, any> = {};

    for (let i = 0; i < particleCount; i++) {
      const particleId = `${item._id}-${Date.now()}-${i}`;
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const distance = 30 + Math.random() * 40;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      particles.push({ id: particleId, x, y });
      localParticleAnims[particleId] = {
        scale: new Animated.Value(0),
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(0),
        translateX: new Animated.Value(0),
      };
    }

    particleAnims.current = localParticleAnims;
    setLikeAnimationParticles(particles);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(likeAnimationVal, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(likeAnimationVal, {
        toValue: 1.2,
        tension: 100,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.spring(likeAnimationVal, {
        toValue: 1,
        tension: 100,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.timing(likeAnimationVal, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    particles.forEach((particle, particleIndex) => {
      const anims = localParticleAnims[particle.id];
      if (!anims) return;

      setTimeout(() => {
        Animated.parallel([
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
          Animated.sequence([
            Animated.timing(anims.opacity, {
              toValue: 0.4,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(anims.opacity, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anims.translateY, {
            toValue: -80 - Math.random() * 40,
            duration: 550,
            useNativeDriver: true,
          }),
          Animated.timing(anims.translateX, {
            toValue: particle.x,
            duration: 550,
            useNativeDriver: true,
          }),
        ]).start();
      }, particleIndex * 30);
    });

    if (likeAnimTimeoutRef.current) {
      clearTimeout(likeAnimTimeoutRef.current);
    }
    likeAnimTimeoutRef.current = setTimeout(() => {
      setShowLikeAnimation(false);
      setLikeAnimationParticles([]);
    }, 1500);
  };

  const handleCellVideoTap = () => {
    const now = Date.now();
    const delay = 300;
    const videoId = item._id;

    if (now - lastTapRef.current < delay) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      
      const originalIsLiked = likedShortIdsRef.current.has(videoId) || item.isLiked || false;
      
      if (originalIsLiked) {
        showLikeAnimationTemporarily();
        return;
      }

      handlers.handleLike(videoId, true);
      showLikeAnimationTemporarily();
      
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
      
      tapTimeoutRef.current = setTimeout(() => {
        setUserPaused(prev => {
          const next = !prev;
          setShowPauseButton(true);
          if (pauseTimeoutRef.current) {
            clearTimeout(pauseTimeoutRef.current);
          }
          pauseTimeoutRef.current = setTimeout(() => {
            setShowPauseButton(false);
          }, 1500);
          
          return next;
        });
        tapTimeoutRef.current = null;
      }, delay);
    }
  };

  const distanceFromVisible = index - currentVisibleIndex;
  const shouldRenderVideo = Math.abs(distanceFromVisible) <= 1 && isCacheChecked;

  const isCellVideoPlaying = isPlaying && isVideoPlaying;
  const isOwn = item.user._id === currentUser?._id;
  const isScopedView = !!effectiveUserId || isSavedShorts;
  const progressBottom = isScopedView ? (Platform.OS === 'web' ? 8 : 20) : (Platform.OS === 'web' ? 8 : 77);
  const progressHeight = 24;
  const clearance = 16;
  const bottomContentOffset = progressBottom + progressHeight + clearance;
  
  const shouldShowPauseButton = !showLikeAnimation && showPauseButton;
  const pauseButtonIcon = isPlaying ? "pause" : "play";

  return (
    <View style={[
      styles.shortItem, 
      { 
        height: containerHeight,
        paddingBottom: isScopedView ? 0 : TAB_BAR_HEIGHT,
      }
    ]}>
        {/* Video Player with Gesture Handling */}
        <View
          style={[
            styles.videoContainer,
            { bottom: isScopedView ? 100 : 0 }
          ]}
          onTouchStart={handlers.handleTouchStart}
          onTouchMove={handlers.handleTouchMove}
          onTouchEnd={(event) => handlers.handleTouchEnd(event, item.user._id)}
          onTouchCancel={handlers.handleTouchCancel}
        >
          <TouchableWithoutFeedback
            onPress={handleCellVideoTap}
            onLongPress={() => {
              if (item.user._id === currentUser?._id) {
                handlers.handleDeleteShort(item._id);
              }
            }}
            accessible={true}
            accessibilityLabel="Tap to play or pause video"
            accessibilityRole="button"
          >
            <View style={[
              styles.shortVideo,
              StyleSheet.absoluteFillObject
            ]}>
            {item.imageUrl ? (
              <ExpoImage
                source={{ uri: item.imageUrl }}
                style={[styles.shortVideo as ImageStyle, StyleSheet.absoluteFillObject]}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
                onError={(e: any) => logger.warn('[shorts thumbnail] load failed', {
                  shortId: item._id,
                  url: item.imageUrl?.substring(0, 120),
                  error: e?.error || e?.nativeEvent?.error || String(e),
                })}
              />
            ) : (
              <View style={[styles.shortVideo, StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
                <LoadingGlobe size="small" color="rgba(255,255,255,0.6)" />
              </View>
            )}
            {shouldRenderVideo && (
              <ShortsVideoPlayerComponent
              key={`video-${item._id}-${sourceVersion}`}
              ref={(ref) => {
                videoRef.current = ref;
                if (ref) {
                  videoRefs.current[item._id] = ref;
                } else {
                  delete videoRefs.current[item._id];
                }
              }}
              source={getVideoSource(handlers.getVideoUrl(item))}
              style={[
                styles.shortVideo,
                StyleSheet.absoluteFillObject,
                { opacity: videoReady ? 1 : 0 }
              ]}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={shouldPlay}
              isLooping
              progressUpdateIntervalMillis={100}
              isMuted={!isActive || !!(item.song?.songId?._id || item.song?.songId) || isMuted}
              volume={(!!(item.song?.songId?._id || item.song?.songId) || isMuted) ? 0.0 : 1.0}
              onLoadStart={() => {
                logger.debug(`Video ${item._id} load started, index: ${index}, currentVisible: ${currentVisibleIndex}`);
              }}
              onReadyForDisplay={() => {
                logger.debug(`Video ${item._id} ready for display`);
                setVideoReady(true);
                if (handlers.onVideoReady) {
                  handlers.onVideoReady(item._id);
                }
              }}
              onError={(error) => {
                logger.error(`Video ${item._id} failed to load:`, error);
                videoCacheRef.current.delete(item._id);
                if (localVideoUris[item._id]) {
                  handlers.removeLocalVideoUri(item._id);
                }
                delete activeStartedWithRemoteRef.current[item._id];
                setIsPlaying(false);
                setVideoReady(false);

                const errorMessage = typeof error === 'string' ? error : (error as any)?.message || '';
                const errorCode = (error as any)?.code;
                const errorDomain = (error as any)?.domain;
                const isTimeoutError =
                  errorCode === -1001 ||
                  errorCode === '-1001' ||
                  errorDomain === 'NSURLErrorDomain' ||
                  /(-1001|NSURLErrorDomain|timeout|Timeout|timed out)/.test(errorMessage);
                const isExpiredUrl = /(403|404|Forbidden|expired|ExpiredRequest)/.test(errorMessage);

                if (isExpiredUrl || isTimeoutError) {
                  const errorType = isTimeoutError ? 'timeout' : 'expired URL';
                  logger.debug(`Video ${item._id} ${errorType} — refetching fresh signed URL`, { errorCode, errorDomain, errorMessage });
                  handlers.refetchShortWithFreshUrl(item._id)
                    .then((freshShort: PostType | null) => {
                      const freshVideoUrl = freshShort?.videoUrl || freshShort?.mediaUrl || freshShort?.imageUrl;
                      if (!freshShort || !freshVideoUrl) {
                        retryVideoLoadLocally();
                        return;
                      }
                      setSourceVersion(prev => prev + 1);
                      setVideoReady(false);
                    })
                    .catch((refetchError: any) => {
                      logger.error(`Failed to refetch fresh URL for video ${item._id}:`, refetchError);
                      retryVideoLoadLocally();
                    });
                } else {
                  retryVideoLoadLocally();
                }
              }}
              onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
                if (status.isLoaded) {
                  if (isActive) {
                    const cb = progressCallbacks.current[item._id];
                    if (cb) {
                      cb(status.positionMillis, status.durationMillis || 1);
                    }
                  }
                  const wasPlaying = isPlaying;
                  const isNowPlaying = status.isPlaying;
                  
                  const hasMusic = !!(item.song?.songId?._id || item.song?.songId);
                  const shouldMuteVideo = !isActive || hasMusic || isMuted;
                  if (isActive) {
                    const video = videoRef.current;
                    if (video) {
                      if (shouldMuteVideo && !status.isMuted) {
                        const now = Date.now();
                        const lastEnforce = lastMuteEnforceAtRef.current;
                        if (now - lastEnforce > 1000) {
                          lastMuteEnforceAtRef.current = now;
                          video.setIsMutedAsync(true).catch(() => {});
                          video.setVolumeAsync(0.0).catch(() => {});
                        }
                      } else if (!shouldMuteVideo && status.isMuted) {
                        const now = Date.now();
                        const lastEnforce = lastMuteEnforceAtRef.current;
                        if (now - lastEnforce > 1000) {
                          lastMuteEnforceAtRef.current = now;
                          video.setIsMutedAsync(false).catch(() => {});
                          video.setVolumeAsync(1.0).catch(() => {});
                        }
                      }
                    }
                  }
                  
                  if (isNowPlaying && (!isActive || !isScreenFocused)) {
                    videoRef.current?.pauseAsync().catch(() => {});
                    return;
                  }
                  
                  if (isNowPlaying && isActive) {
                    currentPlayerRef.current = null;
                  }

                  if (isNowPlaying && isActive && status.positionMillis !== undefined) {
                    const lastPos = lastVideoPositionRef.current[item._id] ?? 0;
                    const curPos = status.positionMillis;
                    if (lastPos > 500 && curPos < lastPos - 500) {
                      if (hasMusic && currentPlayerRef.current) {
                        const startSec = item.song?.startTime || 0;
                        const endSec = item.song?.endTime;
                        const songStartMs = startSec * 1000;
                        const segmentMs = endSec && endSec > startSec ? (endSec - startSec) * 1000 : 60000;
                        const audioOffsetMs = curPos % segmentMs;
                        currentPlayerRef.current.setPositionAsync(songStartMs + audioOffsetMs).catch(() => {});
                      }
                    }
                    lastVideoPositionRef.current[item._id] = curPos;
                  }
                  
                  if (isNowPlaying && wasPlaying !== true) {
                    logger.debug(`Video ${item._id} playing`);
                    setIsPlaying(true);
                  }
                } else if ((status as any).error) {
                  logger.error(`Video ${item._id} playback error:`, (status as any).error);
                  if (isActive) {
                    videoCacheRef.current.delete(item._id);
                    if (localVideoUris[item._id]) {
                      handlers.removeLocalVideoUri(item._id);
                    }
                  }
                }
              }}
              onLoad={(status) => {
                if (status.isLoaded) {
                  logger.debug(`Video ${item._id} loaded successfully, isPlaying: ${status.isPlaying}, shouldPlay: ${isActive}`);
                  setIsPlaying(status.isPlaying);
                  
                  if (isActive && isScreenFocused && !userPaused) {
                    const video = videoRef.current;
                    if (video) {
                      const hasMusic = !!(item.song?.songId?._id || item.song?.songId);
                      const shouldMuteVideo = hasMusic || isMuted;
                      video.setIsMutedAsync(shouldMuteVideo).catch(() => {});
                      video.setVolumeAsync(shouldMuteVideo ? 0.0 : 1.0).catch(() => {});

                      if (!status.isPlaying) {
                        video.playAsync().then(() => {
                          setIsPlaying(true);
                          logger.debug(`Video ${item._id} started playing after load`);
                        }).catch((error) => {
                          logger.error(`Video ${item._id} failed to play after load:`, error);
                        });
                      }
                    }
                  }
                }
              }}
            />
            )}
            </View>
          </TouchableWithoutFeedback>
        </View>
        
        <LinearGradient
          colors={['transparent', 'transparent']}
          style={styles.topGradient}
        />
        <LinearGradient
          colors={['transparent', 'transparent']}
          style={styles.bottomGradient}
        />
        
        {showLikeAnimation && (() => {
          const opacity = likeAnimationVal.interpolate({
            inputRange: [0, 0.5, 1, 1.2],
            outputRange: [0, 0.4, 0.5, 0.5],
          });
          
          const scale = likeAnimationVal.interpolate({
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
              <MaskedView
                style={{ width: 80, height: 80 }}
                maskElement={
                  <Ionicons name="heart" size={80} color="#000000" />
                }
              >
                <LinearGradient
                  colors={['#50C878', '#1C73B4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1 }}
                />
              </MaskedView>
            </Animated.View>
          );
        })()}

        {likeParticles.map((particle) => {
          const anims = particleAnims.current[particle.id];
          if (!anims) return null;
          
          return (
            <Animated.View
              key={particle.id}
              style={[
                styles.likeAnimationContainer,
                {
                  position: 'absolute',
                  transform: [
                    { translateX: anims.translateX },
                    { translateY: anims.translateY },
                    { scale: anims.scale },
                  ],
                  opacity: anims.opacity,
                },
              ]}
              pointerEvents="none"
            >
              <Ionicons name="heart" size={24} color="#50C878" />
            </Animated.View>
          );
        })}

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

        {showSwipeHint && !effectiveUserId && isActive && (
          <Animated.View style={[styles.swipeHint, { opacity: fadeAnimation }]}>
            <View style={styles.swipeHintBlur}>
              <Ionicons name="arrow-back" size={24} color="white" />
              <Text style={styles.swipeHintText}>Swipe left for profile</Text>
            </View>
          </Animated.View>
        )}
      
        <LocalShortsActionRail
          short={item}
          shortId={item._id}
          userId={item.user._id}
          username={item.user.username}
          profilePic={item.user.profilePic}
          initialIsLiked={isLiked}
          initialLikesCount={typeof item.likesCount === 'number' ? item.likesCount : 0}
          commentsCount={item.commentsCount || 0}
          isSaved={isSaved}
          isFollowing={isFollowing}
          isOwn={isOwn}
          currentUserLoaded={!!currentUser?._id}
          onProfilePress={handlers.handleProfilePress}
          onLikePress={handlers.handleLike}
          onCommentPress={handlers.handleComment}
          onSharePress={handlers.handleShare}
          onSavePress={handlers.handleSave}
          isScopedView={isScopedView}
          isPlaying={isCellVideoPlaying}
        />

        <View 
          style={[
            styles.bottomContent, 
            { bottom: bottomContentOffset }
          ]}
        >
          <LinearGradient
            colors={['transparent', 'transparent', 'transparent']}
            style={styles.bottomGradientOverlay}
          />
          
          <View style={styles.bottomContentInner}>
            <View style={styles.userProfileSection}>
              <TouchableOpacity
                style={styles.bottomAvatarContainer}
                onPress={(e) => {
                  e.stopPropagation?.();
                  handlers.handleProfilePress(item.user._id);
                }}
                activeOpacity={0.7}
                accessibilityLabel={`View ${item.user.username || 'user'}'s profile`}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={['#50C878', '#1C73B4']}
                  style={styles.bottomGradientBorder}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <ExpoImage
                    source={item.user.profilePic ? { uri: item.user.profilePic } : require('../../assets/avatars/male_avatar.png')}
                    style={styles.bottomProfileImage as ImageStyle}
                    cachePolicy="memory-disk"
                    placeholder={require('../../assets/avatars/male_avatar.png')}
                    contentFit="cover"
                    transition={200}
                    onError={(e: any) => logger.warn('[shorts bottom avatar] load failed', {
                      userId: item.user._id,
                      url: item.user.profilePic?.substring(0, 120),
                      error: e?.error || e?.nativeEvent?.error || String(e),
                    })}
                  />
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.userDetails}>
                <View style={styles.usernameRow}>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handlers.handleProfilePress(item.user._id);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.username}>@{item.user.username || item.user._id}</Text>
                  </TouchableOpacity>
                  
                  {isFollowing && (
                    <View style={styles.followingBadge}>
                      <Text style={styles.followingText}>Following</Text>
                    </View>
                  )}
                </View>

                <CyclingMetadata
                  song={item.song}
                  location={item.location}
                  onLocationPress={async (e) => {
                    e.stopPropagation?.();
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
                              photo: item.imageUrl || '',
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
                  }}
                />
              </View>
            </View>

            {item.caption ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={(e) => {
                  e.stopPropagation?.();
                  setIsCaptionExpanded(prev => !prev);
                }}
              >
                <Text 
                  style={styles.caption} 
                  numberOfLines={isCaptionExpanded ? undefined : 2}
                >
                  {item.caption}
                </Text>
              </TouchableOpacity>
            ) : null}
            
            {!!(item.song?.songId && (item.song.songId._id || typeof item.song.songId === 'string')) && (
                <View style={styles.hiddenSongPlayer} pointerEvents="none">
                  <SongPlayer
                    post={item}
                    isVisible={isScreenFocused && isActive}
                    shouldPreload={isScreenFocused && index === currentVisibleIndex + 1}
                    autoPlay={isCellVideoPlaying}
                    externalMuted={isMuted}
                    onPlayingChange={handlers.handleSongPlayingChange}
                  />
                </View>
            )}
          </View>
        </View>
        {shouldRenderVideo && (
          <ShortsProgressBar
            shortId={item._id}
            index={index}
            currentVisibleIndex={currentVisibleIndex}
            getVideoRef={() => videoRef.current}
            hasMusic={!!(item.song?.songId?._id || item.song?.songId)}
            songStartSec={item.song?.startTime}
            songEndSec={item.song?.endTime}
            currentPlayerRef={currentPlayerRef}
            progressCallbacks={progressCallbacks}
            lastVideoPositionRef={lastVideoPositionRef}
            isScopedView={isScopedView}
          />
        )}
    </View>
  );
});
ShortsCell.displayName = 'ShortsCell';

const ShortsVideoPlayerComponent = React.forwardRef<Video, React.ComponentProps<typeof Video>>((props, ref) => {
  const localRef = useRef<Video | null>(null);

  const combinedRef = useCallback((node: Video | null) => {
    localRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      (ref as any).current = node;
    }
  }, [ref]);

  useEffect(() => {
    return () => {
      if (localRef.current) {
        logger.debug(`[ShortsVideoPlayerComponent] Unloading video player on unmount`);
        localRef.current.unloadAsync().catch((err) => {
          logger.debug(`[ShortsVideoPlayerComponent] Failed to unload video on unmount:`, err);
        });
      }
    };
  }, []);

  return <Video ref={combinedRef} {...props} />;
});
ShortsVideoPlayerComponent.displayName = 'ShortsVideoPlayerComponent';

const MemoizedVideo = React.memo(
  ShortsVideoPlayerComponent,
  (prev, next) => {
    const prevUri = prev.source && typeof prev.source === 'object' && 'uri' in prev.source ? (prev.source as any).uri : null;
    const nextUri = next.source && typeof next.source === 'object' && 'uri' in next.source ? (next.source as any).uri : null;

    // Native expo-av players are fragile when parent UI state changes. Only
    // playback, mute, volume, or source changes are allowed to reach the native Video.
    return (
      prev.shouldPlay === next.shouldPlay &&
      prev.isMuted === next.isMuted &&
      prev.volume === next.volume &&
      prevUri === nextUri
    );
  }
);
MemoizedVideo.displayName = 'MemoizedShortsVideo';

interface ShortsProgressBarProps {
  shortId: string;
  index: number;
  currentVisibleIndex: number;
  getVideoRef: () => Video | null;
  hasMusic: boolean;
  songStartSec?: number;
  songEndSec?: number;
  currentPlayerRef: React.MutableRefObject<Audio.Sound | null>;
  progressCallbacks: React.MutableRefObject<Record<string, (position: number, duration: number) => void>>;
  lastVideoPositionRef: React.MutableRefObject<Record<string, number>>;
  isScopedView?: boolean;
}

const ShortsProgressBar = ({
  shortId,
  index,
  currentVisibleIndex,
  getVideoRef,
  hasMusic,
  songStartSec,
  songEndSec,
  currentPlayerRef,
  progressCallbacks,
  lastVideoPositionRef,
  isScopedView,
}: ShortsProgressBarProps) => {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPressing, setIsPressing] = useState(false);

  const lastSeekTimeRef = useRef(0);
  const pendingSeekTimeoutRef = useRef<any>(null);
  const isPressingRef = useRef(false);

  const lastTouchTimeRef = useRef(0);
  const lastTouchXRef = useRef(0);
  const lastHapticProgressRef = useRef(0);

  useEffect(() => {
    if (index !== currentVisibleIndex) {
      setProgress(0);
      return;
    }

    progressCallbacks.current[shortId] = (pos: number, dur: number) => {
      setDuration(dur);
      if (dur > 0 && !isPressingRef.current) {
        setProgress(pos / dur);
      }
    };

    return () => {
      delete progressCallbacks.current[shortId];
      if (pendingSeekTimeoutRef.current) {
        clearTimeout(pendingSeekTimeoutRef.current);
      }
    };
  }, [shortId, index, currentVisibleIndex]);

  const handleTouch = (event: any, forceSeek = false) => {
    if (duration <= 0) return;
    
    const pageX = event.nativeEvent.pageX;
    const leftOffset = (SCREEN_WIDTH - 226) / 2;
    const newProgress = Math.max(0, Math.min(1, (pageX - leftOffset) / 226));
    setProgress(newProgress);

    const now = Date.now();
    const timeDelta = now - lastTouchTimeRef.current;
    const xDelta = pageX - lastTouchXRef.current;
    const velocity = timeDelta > 0 ? Math.abs(xDelta / timeDelta) : 0;
    lastTouchTimeRef.current = now;
    lastTouchXRef.current = pageX;

    // Kinesthetic Feedback: haptic ticks on 10% steps
    const currentStep = Math.floor(newProgress * 10);
    const lastStep = Math.floor(lastHapticProgressRef.current * 10);
    if (currentStep !== lastStep) {
      triggerHaptic('light');
    }


    lastHapticProgressRef.current = newProgress;

    const targetMs = newProgress * duration;
    
    // Calculate music seek offset
    const startSec = songStartSec || 0;
    const endSec = songEndSec;
    const songStartMs = startSec * 1000;
    const segmentMs = endSec && endSec > startSec ? (endSec - startSec) * 1000 : 60000;
    const audioOffsetMs = targetMs % segmentMs;
    const finalAudioMs = songStartMs + audioOffsetMs;

    const performSeek = () => {
      const video = getVideoRef();
      if (video) {
        if (forceSeek) {
          // Enforce frame-accurate seeking using precise tolerance options on touch start/end
          video.setPositionAsync(targetMs, {
            toleranceMillisBefore: 0,
            toleranceMillisAfter: 0,
          }).catch(() => {});
        } else {
          // Fast seek during active drag to avoid UI stuttering
          video.setPositionAsync(targetMs).catch(() => {});
        }
      }
      if (forceSeek && hasMusic && currentPlayerRef.current) {
        // Audio seek does not use tolerance parameters (to prevent codec rejection errors)
        // We only seek the background audio player on initial touch (forceSeek = true)
        // because the final seek is handled separately on touch end.
        // This avoids audio thread clogging during active drag.
        currentPlayerRef.current.setPositionAsync(finalAudioMs).catch(() => {});
      }
      // Update lastVideoPosition immediately to prevent false loop detection triggers
      lastVideoPositionRef.current[shortId] = targetMs;
    };

    if (forceSeek) {
      if (pendingSeekTimeoutRef.current) {
        clearTimeout(pendingSeekTimeoutRef.current);
        pendingSeekTimeoutRef.current = null;
      }
      lastSeekTimeRef.current = now;
      performSeek();
    } else {
      const timeSinceLastSeek = now - lastSeekTimeRef.current;
      const throttleDelay = 80; // Fixed 80ms throttle window for continuous seeks
      
      if (timeSinceLastSeek > throttleDelay) {
        if (pendingSeekTimeoutRef.current) {
          clearTimeout(pendingSeekTimeoutRef.current);
          pendingSeekTimeoutRef.current = null;
        }
        lastSeekTimeRef.current = now;
        performSeek();
      } else {
        // Schedule a trailing edge seek to catch final move coordinates
        if (pendingSeekTimeoutRef.current) {
          clearTimeout(pendingSeekTimeoutRef.current);
        }
        pendingSeekTimeoutRef.current = setTimeout(() => {
          lastSeekTimeRef.current = Date.now();
          performSeek();
          pendingSeekTimeoutRef.current = null;
        }, throttleDelay - timeSinceLastSeek);
      }
    }
  };

  const formatSeconds = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const lineThick = isPressing ? 8 : 3;

  return (
    <View
      style={[
        styles.progressBarContainer,
        isScopedView && { bottom: isWeb ? 8 : 20 }
      ]}
      onTouchStart={(e) => {
        setIsPressing(true);
        isPressingRef.current = true;
        triggerHaptic('medium');
        
        // Pause players immediately when dragging starts to prevent auditory stuttering and visual racing
        const video = getVideoRef();
        if (video) {
          video.pauseAsync().catch(() => {});
        }
        if (hasMusic && currentPlayerRef.current) {
          currentPlayerRef.current.pauseAsync().catch(() => {});
        }
        
        lastTouchTimeRef.current = Date.now();
        lastTouchXRef.current = e.nativeEvent.pageX;
        handleTouch(e, true);
      }}
      onTouchMove={(e) => handleTouch(e, false)}
      onTouchEnd={(e) => {
        setIsPressing(false);
        isPressingRef.current = false;
        triggerHaptic('success');
        
        if (pendingSeekTimeoutRef.current) {
          clearTimeout(pendingSeekTimeoutRef.current);
          pendingSeekTimeoutRef.current = null;
        }
        
        // Calculate final exact seek coordinates on release
        const finalTargetMs = progress * duration;
        const startSec = songStartSec || 0;
        const endSec = songEndSec;
        const songStartMs = startSec * 1000;
        const segmentMs = endSec && endSec > startSec ? (endSec - startSec) * 1000 : 60000;
        const audioOffsetMs = finalTargetMs % segmentMs;
        const finalAudioMs = songStartMs + audioOffsetMs;

        const video = getVideoRef();
        
        // Seek to final precise destination simultaneously and resume play smoothly with CRITICAL BUFFER LOCK
        const executeFinalSeekAndPlay = async () => {
          const video = getVideoRef();
          const audio = hasMusic ? currentPlayerRef.current : null;

          try {
            // Pause explicitly first to reset players stream state (prevents stale buffer playing)
            if (video) {
              await video.pauseAsync().catch(() => {});
            }
            if (audio) {
              await audio.pauseAsync().catch(() => {});
            }

            // Perform seek operations with robust retry loop and backoff
            const seekVideo = async () => {
              if (!video) return;
              for (let i = 0; i < 3; i++) {
                try {
                  await video.setPositionAsync(finalTargetMs, {
                    toleranceMillisBefore: 0,
                    toleranceMillisAfter: 0,
                  });
                  return; // success
                } catch (e) {
                  logger.warn(`Video seek attempt ${i + 1} failed:`, e);
                  if (i === 2) throw e;
                  await new Promise((resolve) => setTimeout(resolve, 50));
                }
              }
            };

            const seekAudio = async () => {
              if (!audio) return;
              for (let i = 0; i < 3; i++) {
                try {
                  await audio.setPositionAsync(finalAudioMs);
                  return; // success
                } catch (e) {
                  logger.warn(`Audio seek attempt ${i + 1} failed:`, e);
                  if (i === 2) throw e;
                  await new Promise((resolve) => setTimeout(resolve, 50));
                }
              }
            };

            // Update last video position immediately to prevent false loop detection triggers
            lastVideoPositionRef.current[shortId] = finalTargetMs;

            // Wait for both seeks to complete (ignoring individual catch rejections so one doesn't abort the other)
            await Promise.all([
              seekVideo().catch((err) => logger.error("Final video seek failed after retries:", err)),
              seekAudio().catch((err) => logger.error("Final audio seek failed after retries:", err)),
            ]);

            // Once seeking is completed, resume playback
            if (video) {
              await video.playAsync().catch(() => {});
            }
            if (audio) {
              await audio.playAsync().catch(() => {});
            }
          } catch (err) {
            logger.error("Error in executeFinalSeekAndPlay:", err);
            // Safe fallback
            if (video) video.playAsync().catch(() => {});
            if (audio) audio.playAsync().catch(() => {});
          }
        };
        
        executeFinalSeekAndPlay();
      }}
    >
      {/* Straight line horizontal bar */}
      <View style={[styles.progressBarBackground, { height: lineThick, borderRadius: lineThick / 2 }]}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${progress * 100}%`, height: lineThick, borderRadius: lineThick / 2, overflow: 'hidden' }
          ]}
        >
          <LinearGradient
            colors={['#50C878', '#1C73B4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      </View>



      {/* Tooltip on scrubbing */}
      {isPressing && duration > 0 && (
        <View style={[styles.scrubberTooltip, { left: `${Math.max(10, Math.min(80, progress * 100))}%` }]}>
          <Text style={styles.scrubberTooltipText}>
            {formatSeconds(progress * duration)} / {formatSeconds(duration)}
          </Text>
        </View>
      )}
    </View>
  );
};

const likeRailListeners = new Map<string, Set<(isLiked: boolean) => void>>();

const emitLikeRailState = (shortId: string, isLiked: boolean) => {
  likeRailListeners.get(shortId)?.forEach((listener) => listener(isLiked));
};

interface LocalShortsActionRailProps {
  short: PostType;
  shortId: string;
  userId: string;
  username?: string;
  profilePic?: string;
  initialIsLiked: boolean;
  initialLikesCount: number;
  commentsCount: number;
  isSaved: boolean;
  isFollowing: boolean;
  isOwn: boolean;
  currentUserLoaded: boolean;
  onProfilePress: (userId: string) => void;
  onLikePress: (shortId: string) => void;
  onCommentPress: (shortId: string) => void;
  onSharePress: (short: PostType) => void;
  onSavePress: (shortId: string) => void;
  isScopedView?: boolean;
  isPlaying: boolean;
}

function GradientIcon({ name, size }: { name: any; size: number }) {
  return (
    <MaskedView
      style={{ width: size, height: size }}
      pointerEvents="none"
      maskElement={
        <Ionicons name={name} size={size} color="#000000" />
      }
    >
      <LinearGradient
        colors={['#1C73B4', '#50C878']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      />
    </MaskedView>
  );
}

const LocalShortsActionRail = React.memo(({
  shortId,
  short,
  userId,
  username,
  profilePic,
  initialIsLiked,
  initialLikesCount,
  commentsCount,
  isSaved,
  isFollowing,
  isOwn,
  currentUserLoaded,
  onProfilePress,
  onLikePress,
  onCommentPress,
  onSharePress,
  onSavePress,
  isScopedView,
  isPlaying,
}: LocalShortsActionRailProps) => {
  const [localIsLiked, setLocalIsLiked] = useState(initialIsLiked);
  const [localLikesCount, setLocalLikesCount] = useState(initialLikesCount);
  const { showOptions, showSuccess } = useAlert();
  const router = useRouter();
  const { theme } = useTheme();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [likers, setLikers] = useState<any[]>([]);

  // 360-degree rotation animation setup for the album art disc
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isPlaying) {
      // Smooth linear looping rotation
      spinValue.setValue(0);
      spinAnimRef.current = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 4000, // 4 seconds for one full loop
          useNativeDriver: true,
          easing: Easing.linear,
        })
      );
      spinAnimRef.current.start();
    } else {
      if (spinAnimRef.current) {
        spinAnimRef.current.stop();
        spinAnimRef.current = null;
      }
    }
    return () => {
      if (spinAnimRef.current) {
        spinAnimRef.current.stop();
      }
    };
  }, [isPlaying]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const albumArtSource = useMemo(() => {
    const DEFAULT_ALBUM_ART = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=120&auto=format&fit=crop';
    const thumbnailUrl = short.song?.songId?.thumbnailUrl || (typeof short.song?.songId === 'object' && short.song?.songId?.thumbnailUrl);
    return thumbnailUrl ? { uri: thumbnailUrl } : { uri: DEFAULT_ALBUM_ART };
  }, [short.song]);

  useEffect(() => {
    setLocalIsLiked(initialIsLiked);
    setLocalLikesCount(initialLikesCount);
  }, [shortId, initialIsLiked, initialLikesCount]);

  useEffect(() => {
    const listener = (nextLiked: boolean) => {
      setLocalIsLiked((wasLiked) => {
        if (wasLiked === nextLiked) return wasLiked;
        setLocalLikesCount((count) => nextLiked ? count + 1 : Math.max(count - 1, 0));
        return nextLiked;
      });
    };
    const listeners = likeRailListeners.get(shortId) ?? new Set<(isLiked: boolean) => void>();
    listeners.add(listener);
    likeRailListeners.set(shortId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        likeRailListeners.delete(shortId);
      }
    };
  }, [shortId]);


  const handleProfilePressLocal = useCallback(() => {
    onProfilePress(userId);
  }, [onProfilePress, userId]);

  const handleLikePressLocal = useCallback(() => {
    setLocalIsLiked((wasLiked) => {
      const nextLiked = !wasLiked;
      setLocalLikesCount((count) => nextLiked ? count + 1 : Math.max(count - 1, 0));
      return nextLiked;
    });
    onLikePress(shortId);
  }, [onLikePress, shortId]);

  const handleLikesPress = useCallback(async () => {
    setShowModal(true);
    setLoading(true);
    try {
      const data = await getPostById(shortId);
      const likes = data?.data?.post?.likes || data?.post?.likes || data?.likes || [];
      if (likes.length > 0) {
        const profiles = await Promise.all(
          likes.map(async (uid: string) => {
            try {
              const res = await getProfile(uid);
              return res?.profile || null;
            } catch (err) {
              return null;
            }
          })
        );
        setLikers(profiles.filter(Boolean));
      } else {
        setLikers([]);
      }
    } catch (error) {
      logger.warn('Failed to load likers for short:', error);
    } finally {
      setLoading(false);
    }
  }, [shortId]);

  const handleCommentPressLocal = useCallback(() => {
    onCommentPress(shortId);
  }, [onCommentPress, shortId]);

  const handleSharePressLocal = useCallback(() => {
    onSharePress(short);
  }, [onSharePress, short]);

  const handleOptionsPress = useCallback(() => {
    logger.debug('Options menu pressed for short:', shortId);
    showOptions(
      'Reel Options',
      [
        {
          text: isSaved ? 'Remove from Saved' : 'Save Reel',
          onPress: () => onSavePress(shortId),
        },
        {
          text: 'Share Reel',
          onPress: handleSharePressLocal,
        },
        {
          text: 'Report Reel',
          onPress: () => {
            showSuccess('Thank you for reporting. We will review this content shortly.', 'Report Submitted');
          },
          style: 'destructive',
        },
      ],
      undefined,
      true,
      'Cancel'
    );
  }, [showOptions, showSuccess, isSaved, shortId, onSavePress, handleSharePressLocal]);

  const profileSource = useMemo(
    () => profilePic ? { uri: profilePic } : require('../../assets/avatars/male_avatar.png'),
    [profilePic]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Vertical actions rail (moved higher, containing Profile, Like, Comment, Share) */}
      <View style={[styles.rightActions, isScopedView && { bottom: Platform.OS === 'ios' ? 94 : 88 }]} pointerEvents="box-none">
        <View style={styles.profileButton}>
          <Animated.View style={[styles.actionsAvatarContainer, { transform: [{ rotate: spin }] }]}>
            <View style={styles.albumArtContainer}>
              <ExpoImage
                source={albumArtSource}
                style={styles.albumArtImage as ImageStyle}
                cachePolicy="memory-disk"
                placeholder={{ uri: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=120&auto=format&fit=crop' }}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.albumArtInnerRing} />
            </View>
          </Animated.View>
        </View>

        <View style={styles.actionButton}>
          <Pressable
            onPress={handleLikePressLocal}
            accessibilityLabel={localIsLiked ? `Unlike` : `Like`}
            accessibilityRole="button"
          >
            <View style={[styles.actionIconContainer, localIsLiked && styles.likedContainer]}>
              {localIsLiked ? (
                <GradientIcon name="heart" size={28} />
              ) : (
                <Ionicons
                  name="heart-outline"
                  size={28}
                  color="white"
                />
              )}
            </View>
          </Pressable>
          <TouchableOpacity
            onPress={handleLikesPress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          >
            <Text style={styles.actionText}>{localLikesCount}</Text>
          </TouchableOpacity>
        </View>

        <Pressable
          style={styles.actionButton}
          onPress={handleCommentPressLocal}
          accessibilityLabel={`Comment, ${commentsCount || 0} comments`}
          accessibilityRole="button"
        >
          <View style={styles.actionIconContainer}>
            <GradientIcon name="chatbubble-outline" size={28} />
          </View>
          <Text style={styles.actionText}>{commentsCount || 0}</Text>
        </Pressable>

        <Pressable
          style={styles.actionButton}
          onPress={handleSharePressLocal}
          accessibilityLabel="Share"
          accessibilityRole="button"
        >
          <View style={styles.actionIconContainer}>
            <GradientIcon name="paper-plane-outline" size={28} />
          </View>
        </Pressable>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleOptionsPress}
          accessibilityLabel="More options"
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <View style={styles.actionIconContainer}>
            <GradientIcon name="ellipsis-vertical" size={28} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Likes Detail View Modal */}
      <GlassModal visible={showModal} onClose={() => setShowModal(false)} style={styles.modalContentStyle}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Likes</Text>
          <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.modalLoadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : likers.length === 0 ? (
          <View style={styles.modalEmptyContainer}>
            <Text style={[styles.modalEmptyText, { color: theme.colors.textSecondary }]}>No likes yet</Text>
          </View>
        ) : (
          <FlatList
            data={likers}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.userRow}
                onPress={() => {
                  setShowModal(false);
                  router.push(`/profile/${item._id}`);
                }}
              >
                {item.profilePic ? (
                  <Image source={{ uri: item.profilePic }} style={styles.avatar as ImageStyle} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.border }]}>
                    <Ionicons name="person" size={20} color={theme.colors.textSecondary} />
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={[styles.fullName, { color: theme.colors.text }]}>{item.fullName}</Text>
                  {item.username && (
                    <Text style={[styles.modalUsername, { color: theme.colors.textSecondary }]}>@{item.username}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            nestedScrollEnabled={true}
          />
        )}
      </GlassModal>
    </View>
  );
});

LocalShortsActionRail.displayName = 'LocalShortsActionRail';

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

  const [shorts, setShorts] = useState<PostType[]>(() => {
    return isGeneralFeed ? globalCachedShorts : [];
  });
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
      Promise.all(
        firstShorts.map(async (item: any) => {
          const localUri = await getLocalVideoUri(item._id);
          if (localUri) {
            initialUris[item._id] = localUri;
          }
        })
      ).then(() => {
        setLocalVideoUris((prev) => ({ ...prev, ...initialUris }));
        setCheckedVideoCacheIds((prev) => {
          const next = new Set(prev);
          firstShorts.forEach((s) => next.add(s._id));
          return next;
        });
      });
    }
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
        await Promise.all(
          firstShorts.map(async (item: any) => {
            const localUri = await getLocalVideoUri(item._id);
            if (localUri) {
              initialUris[item._id] = localUri;
            }
          })
        );
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
            const localUri = await getLocalVideoUri(singleShort._id);
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
      await Promise.all(
        firstShorts.map(async (item: any) => {
          const localUri = await getLocalVideoUri(item._id);
          if (localUri) {
            initialUris[item._id] = localUri;
          }
        })
      );
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

      showError('Failed to update like status');
    }
  }, [showError]);

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
  }, [executeLikeApiCall]);



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
  const showShortsAds = !isWeb && !isExpoGo && !shortsAdsBroken;
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
    const cleanupDistance = 1; // Cleanup videos more than 1 position away (since we keep 3 mounted)
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

    // 1. Always preload active video immediately if not cached
    const activeItem = shortsData[currentVisibleIndex];
    if (activeItem && !isAdItem(activeItem)) {
      const baseUrl = activeItem.videoUrl || activeItem.mediaUrl || activeItem.imageUrl;
      if (baseUrl) {
        preloadVideoAsync(activeItem._id, baseUrl);
      }
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
            } else {
              staggerTimeout = setTimeout(() => {
                preloadVideoAsync(secondNextItem._id, baseUrl);
              }, 1200);
            }
          }
        }
      }
    }

    // 4. Poll/check file existence for the sliding window to update localVideoUris and checkedVideoCacheIds state
    const minIndex = Math.max(0, currentVisibleIndex - 2);
    const maxIndex = Math.min(shortsData.length - 1, currentVisibleIndex + 2);
    let active = true;
    const checkCachedVideos = async () => {
      const newUris: Record<string, string> = {};
      const checkedIds: string[] = [];

      for (let i = minIndex; i <= maxIndex; i++) {
        const item = shortsData[i];
        if (item && !isAdItem(item)) {
          const localUri = await getLocalVideoUri(item._id);
          if (localUri) {
            newUris[item._id] = localUri;
          }
          checkedIds.push(item._id);
        }
      }
      if (active) {
        setLocalVideoUris(prev => {
          let changed = false;
          const merged = { ...prev };
          for (const id of Object.keys(newUris)) {
            if (prev[id] !== newUris[id]) {
              merged[id] = newUris[id];
              changed = true;
            }
          }
          if (changed) {
            return merged;
          }
          return prev;
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
      }
    };

    checkCachedVideos();
    const interval = setInterval(checkCachedVideos, 1000);

    return () => {
      active = false;
      clearInterval(interval);
      if (staggerTimeout) {
        clearTimeout(staggerTimeout);
      }
    };
  }, [currentVisibleIndex, shortsData, activeVideoPrepared, localVideoUris]);

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

    return (
      <ShortsCell
        item={item}
        index={index}
        currentVisibleIndex={currentVisibleIndex}
        isVideoPlaying={isVideoPlaying}
        isScreenFocused={isScreenFocused}
        isMuted={props.isMuted !== undefined ? props.isMuted : isFeedMuted}
        currentUser={currentUser}
        containerHeight={containerHeight}
        isFollowing={isFollowing}
        isSaved={isSaved}
        isLiked={isLiked}
        localVideoUris={localVideoUris}
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
            imageUrl: selectedShortForShare.imageUrl,
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
