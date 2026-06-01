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
  BackHandler,
  Pressable,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode, AVPlaybackStatus, Audio } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
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
import { trackScreenView, trackEngagement } from '../../services/analytics';
import SongPlayer from '../../components/SongPlayer';
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

/** Shorts list item: either a reel (PostType) or a full-screen native ad slot. */
export type ShortsItem = PostType | { type: 'ad'; adIndex: number };

function isAdItem(item: ShortsItem): item is { type: 'ad'; adIndex: number } {
  return 'type' in item && item.type === 'ad';
}

const SHORTS_ADS_AFTER_EVERY = 5;
const MAX_SHORTS_ADS = 3;
const SHORTS_ADS_SESSION_DELAY_MS = 20000;
const SHORT_VIEW_DWELL_MS = 1000;

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
};

const videoSourceCache = new Map<string, { uri: string; overrideFileExtensionAndroid?: string }>();
const getVideoSource = (uri: string | null | undefined) => {
  if (!uri) return undefined;
  if (!videoSourceCache.has(uri)) {
    const lowercaseUrl = uri.toLowerCase();
    const ext = (lowercaseUrl.includes('m3u8') || lowercaseUrl.includes('hls')) ? 'm3u8' : 'mp4';
    videoSourceCache.set(uri, { uri, overrideFileExtensionAndroid: ext });
  }
  return videoSourceCache.get(uri);
};

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
const ShortCellMemo = React.memo(
  ({ render }: { render: () => React.ReactElement; cacheKey: string }) => render(),
  (prev, next) => prev.cacheKey === next.cacheKey
);

const MemoizedVideo = React.memo(
  React.forwardRef<Video, React.ComponentProps<typeof Video>>((props, ref) => {
    return <Video ref={ref} {...props} />;
  }),
  (prev, next) => {
    const prevUri = prev.source && typeof prev.source === 'object' && 'uri' in prev.source ? (prev.source as any).uri : null;
    const nextUri = next.source && typeof next.source === 'object' && 'uri' in next.source ? (next.source as any).uri : null;

    // Native expo-av players are fragile when parent UI state changes. Only
    // playback, mute, or source changes are allowed to reach the native Video.
    return (
      prev.shouldPlay === next.shouldPlay &&
      prev.isMuted === next.isMuted &&
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
}: ShortsProgressBarProps) => {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPressing, setIsPressing] = useState(false);

  const lastSeekTimeRef = useRef(0);
  const pendingSeekTimeoutRef = useRef<any>(null);
  const isPressingRef = useRef(false);

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
    const newProgress = Math.max(0, Math.min(1, pageX / SCREEN_WIDTH));
    setProgress(newProgress);

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
        // Enforce frame-accurate seeking using precise tolerance options in expo-av
        video.setPositionAsync(targetMs, {
          toleranceMillisBefore: 0,
          toleranceMillisAfter: 0,
        }).catch(() => {});
      }
      if (hasMusic && currentPlayerRef.current) {
        // Audio seek does not use tolerance parameters (to prevent codec rejection errors)
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
      lastSeekTimeRef.current = Date.now();
      performSeek();
    } else {
      const now = Date.now();
      const timeSinceLastSeek = now - lastSeekTimeRef.current;
      
      if (timeSinceLastSeek > 100) { // 100ms throttle prevents bridge congestion
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
        }, 100 - timeSinceLastSeek);
      }
    }
  };

  return (
    <View
      style={styles.progressBarContainer}
      onTouchStart={(e) => {
        setIsPressing(true);
        isPressingRef.current = true;
        
        // Pause players immediately when dragging starts to prevent auditory stuttering and visual racing
        const video = getVideoRef();
        if (video) {
          video.pauseAsync().catch(() => {});
        }
        if (hasMusic && currentPlayerRef.current) {
          currentPlayerRef.current.pauseAsync().catch(() => {});
        }
        
        handleTouch(e, true);
      }}
      onTouchMove={(e) => handleTouch(e, false)}
      onTouchEnd={(e) => {
        setIsPressing(false);
        isPressingRef.current = false;
        
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
      <View style={[styles.progressBarBackground, isPressing && { height: 14 }]} />
      <LinearGradient
        colors={['#50C878', '#1C73B4']} // beautiful premium green-blue gradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.progressBarFill,
          { width: `${progress * 100}%` },
          isPressing && { height: 14 },
        ]}
      />
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
}

function GradientIcon({ name, size }: { name: any; size: number }) {
  return (
    <MaskedView
      style={{ width: size, height: size }}
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
}: LocalShortsActionRailProps) => {
  const [localIsLiked, setLocalIsLiked] = useState(initialIsLiked);
  const [localLikesCount, setLocalLikesCount] = useState(initialLikesCount);
  const { showOptions, showSuccess } = useAlert();

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

  const handleCommentPressLocal = useCallback(() => {
    onCommentPress(shortId);
  }, [onCommentPress, shortId]);

  const handleSharePressLocal = useCallback(() => {
    onSharePress(short);
  }, [onSharePress, short]);

  const handleOptionsPress = useCallback(() => {
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
        <TouchableOpacity
          style={styles.profileButton}
          onPress={handleProfilePressLocal}
          activeOpacity={0.8}
          accessibilityLabel={`View ${username || 'user'}'s profile`}
          accessibilityRole="button"
        >
          <View style={styles.actionsAvatarContainer}>
            <LinearGradient
              colors={['#1C73B4', '#50C878']}
              style={styles.actionsGradientBorder}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <ExpoImage
                source={profileSource}
                style={styles.actionsProfileImage as ImageStyle}
                cachePolicy="memory-disk"
                placeholder={require('../../assets/avatars/male_avatar.png')}
                contentFit="cover"
                transition={200}
                onError={(e: any) => logger.warn('[shorts profile avatar] load failed', {
                  userId,
                  url: profilePic?.substring(0, 120),
                  error: e?.error || e?.nativeEvent?.error || String(e),
                })}
              />
            </LinearGradient>
            {currentUserLoaded && !isOwn && (
              <View style={[styles.followButton, isFollowing && styles.followingButton]}>
                <Ionicons
                  name={isFollowing ? "checkmark" : "add"}
                  size={12}
                  color="white"
                />
              </View>
            )}
          </View>
        </TouchableOpacity>

        <Pressable
          style={styles.actionButton}
          onPress={handleLikePressLocal}
          accessibilityLabel={localIsLiked ? `Unlike, ${localLikesCount} likes` : `Like, ${localLikesCount} likes`}
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
          <Text style={styles.actionText}>{localLikesCount}</Text>
        </Pressable>

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
      </View>

      {/* Options Button (Three dots - placed next to the username row at the bottom) */}
      <View style={[styles.optionsActionContainer, isScopedView && { bottom: Platform.OS === 'ios' ? 20 : 16 }]} pointerEvents="box-none">
        <Pressable
          style={styles.actionButton}
          onPress={handleOptionsPress}
          accessibilityLabel="More options"
          accessibilityRole="button"
        >
          <View style={styles.actionIconContainer}>
            <GradientIcon name="ellipsis-horizontal" size={28} />
          </View>
        </Pressable>
      </View>
    </View>
  );
});

LocalShortsActionRail.displayName = 'LocalShortsActionRail';


export default function ShortsScreen(props: ShortsScreenProps = {}) {
  const [shorts, setShorts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Track visible index precisely using onViewableItemsChanged
  const [currentVisibleIndex, setCurrentVisibleIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const isScreenFocusedRef = useRef(true);
  const [videoStates, setVideoStates] = useState<{ [key: string]: boolean }>({});
  const [containerHeight, setContainerHeight] = useState(SCREEN_HEIGHT - TAB_BAR_HEIGHT);
  const [showPauseButton, setShowPauseButton] = useState<{ [key: string]: boolean }>({});
  const [showLikeAnimation, setShowLikeAnimation] = useState<{ [key: string]: boolean }>({});
  const [likeAnimationParticles, setLikeAnimationParticles] = useState<{ [key: string]: Array<{ id: string; x: number; y: number }> }>({});
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
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [videoQuality, setVideoQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [expandedCaptions, setExpandedCaptions] = useState<{ [key: string]: boolean }>({});

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

  // Per-short source-URL "version". Bumped when onError refetches a fresh
  // signed URL — appended to the Video's key so React fully unmounts the
  // expo-av native player and remounts it with the new source. The previous
  // approach of manually calling unloadAsync/loadAsync inside nested setTimeouts
  // raced with scroll/unmount and was a likely cause of native player crashes.
  const [sourceVersions, setSourceVersions] = useState<Record<string, number>>({});
  // Throttle for the defensive mute-enforcement inside onPlaybackStatusUpdate
  // (status callbacks fire ~5x/sec per video; firing setIsMutedAsync each time
  // is bridge churn that has been correlated with native crashes on Android).
  const lastMuteEnforceAtRef = useRef<Record<string, number>>({});

  // Frequency control: no ad before 5 reels watched, no ad before 20s session, max 3 ads per Shorts session
  const [hasWatchedFiveReels, setHasWatchedFiveReels] = useState(false);
  const [adsAllowedAfter20s, setAdsAllowedAfter20s] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAdsAllowedAfter20s(true), SHORTS_ADS_SESSION_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Hard cap: track ads shown this session; never insert more than 3 ad slots total
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

  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<{ [key: string]: Video | null }>({});
  // Two timeout namespaces. Previously a single `pauseTimeoutRefs[id]` slot was
  // shared by the pause-button hide timer AND the like-animation hide timer,
  // so a tap-then-like (or vice versa) on the same cell within 1.5s overwrote
  // the slot and orphaned the first timer. Splitting them prevents stale
  // callbacks from setting state on stale data.
  const pauseTimeoutRefs = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const likeAnimTimeoutRefs = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const lastTapRef = useRef<Record<string, number>>({});
  const tapTimeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});
  const likeDebounceRefs = useRef<Record<string, { timer: NodeJS.Timeout; targetState: boolean; originalState: boolean; originalLikesCount: number }>>({});

  // Helpers that no-op when the per-id value hasn't changed. The previous
  // pattern `setState(prev => ({ ...prev, [id]: value }))` always allocated a
  // new object reference, even when value === prev[id], which churned
  // renderShortItem's deps and re-rendered every visible cell on every video
  // load/play/pause/viewability event. Coalescing eliminates the redundant
  // re-renders entirely.
  const updateKeyedBool = useCallback((
    setter: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>,
    key: string,
    value: boolean
  ) => {
    setter((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);
  const likeAnimationRefs = useRef<{ [key: string]: Animated.Value }>({});
  const likeParticleRefs = useRef<{ [key: string]: ParticleAnimations }>({});
  const swipeAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;
  // Track currently active video to ensure only one plays at a time
  const activeVideoIdRef = useRef<string | null>(null);
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
  const activeRecoveryTimerRef = useRef<any>(null);
  // When we blur with userId in params (e.g. tab switch), clear params on next focus so Shorts shows all users
  const shouldClearParamsOnNextFocusRef = useRef<boolean>(false);
  const lastViewTimeRef = useRef<number>(0);
  const VIEW_DEBOUNCE_MS = SHORT_VIEW_DWELL_MS; // Prevent duplicate view events within 1 second
  // Ref to store loadShorts function for socket handlers (prevents stale closure)
  const loadShortsRef = useRef<(() => Promise<void>) | null>(null);
  const currentPageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Persisted liked short IDs so likes survive app restart (server is source of truth; this merges when API omits isLiked)
  const likedShortIdsRef = useRef<Set<string>>(new Set());
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
    handleVideoTap: null as any,
  });
  
  const { theme, mode } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const segments = useSegments();

  const effectiveUserId =
    props.scopedUserId ?? normalizeSearchParam(params.userId as string | string[] | undefined);
  const effectiveShortId =
    props.initialShortId ?? normalizeSearchParam(params.shortId as string | string[] | undefined);
  const lastEffectiveUserIdRef = useRef<string | undefined>(effectiveUserId);

  const isOnTabShorts = segments.includes('(tabs)') && segments.includes('shorts');
  const isUserShortsStack = segments.includes('user-shorts');
  const shortsPlaybackSurfaceActive = isOnTabShorts || isUserShortsStack;
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
          updateKeyedBool(setVideoStates, activeVideoIdRef.current!, false);
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

      // Update state — coalesce: skip the new-object allocation when the key
      // wasn't there to begin with.
      setVideoStates(prev => {
        if (!(videoId in prev)) return prev;
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
        if (!(videoId in prev)) return prev;
        const newState = { ...prev };
        delete newState[videoId];
        return newState;
      });
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
      
      // Clear all pause timeouts, like-anim timeouts, tap timeouts, and debounced like timers.
      Object.values(pauseTimeoutRefs.current).forEach(timeout => clearTimeout(timeout));
      Object.values(likeAnimTimeoutRefs.current).forEach(timeout => clearTimeout(timeout));
      Object.values(tapTimeoutRefs.current).forEach(timeout => clearTimeout(timeout));
      Object.values(likeDebounceRefs.current).forEach(item => clearTimeout(item.timer));
      pauseTimeoutRefs.current = {};
      likeAnimTimeoutRefs.current = {};
      tapTimeoutRefs.current = {};
      likeDebounceRefs.current = {};

      // Drop animated-value refs so we don't leak Animated.Value instances.
      likeAnimationRefs.current = {};
      likeParticleRefs.current = {};
      
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
      // playing video but hears nothing, or the video itself refuses to start
      // because the session mode conflicts with the previous tab's setting.
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 0, // MIX_WITH_OTHERS — required for video + song coexistence
        interruptionModeAndroid: 1, // DO_NOT_MIX (default; Android handles mixing via audioFocus)
      }).catch(err => {
        logger.error('Error setting audio mode for shorts:', err);
      });

      // Screen focused - resume current video if it exists
      if (activeVideoIdRef.current && shorts[currentVisibleIndex]) {
        const currentVideoId = shorts[currentVisibleIndex]._id;
        if (currentVideoId === activeVideoIdRef.current) {
          const video = videoRefs.current[currentVideoId];
          if (video) {
            const hasSong = !!(shorts[currentVisibleIndex].song?.songId?._id || shorts[currentVisibleIndex].song?.songId);
            const expectedMute = hasSong || false;
            video.setIsMutedAsync(expectedMute).catch(() => {});
            video.setVolumeAsync(expectedMute ? 0.0 : 1.0).catch(() => {});
            video.playAsync().catch((error) => {
              logger.warn(`Error resuming video on focus:`, error);
            });
          }
        }
      }

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
        if (currentPlayerRef.current) {
          currentPlayerRef.current.pauseAsync?.().catch(() => {});
          currentPlayerRef.current = null;
        }
        logger.debug('[Shorts] Stopping all audio - leaving shorts page');
        audioManager.stopAll().catch(() => {});
      };
    }, [currentVisibleIndex, shorts, pauseCurrentVideo])
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
  // Uses centralized pauseCurrentVideo helper
  useEffect(() => {
    if (Platform.OS === 'web') return; // AppState not needed on web
    
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App going to background - pause current video and audio
        pauseCurrentVideo();
        if (currentPlayerRef.current) {
          currentPlayerRef.current.pauseAsync?.().catch(() => {});
          currentPlayerRef.current = null;
        }
        audioManager.stopAll().catch(() => {});
        logger.debug('App backgrounded, paused current video and audio');
      } else if (nextAppState === 'active') {
        // App coming to foreground - resume current video if screen is focused
        if (activeVideoIdRef.current && shorts[currentVisibleIndex] && isScreenFocusedRef.current) {
          const currentVideoId = shorts[currentVisibleIndex]._id;
          if (currentVideoId === activeVideoIdRef.current) {
            const video = videoRefs.current[currentVideoId];
            if (video) {
              const hasSong = !!(shorts[currentVisibleIndex].song?.songId?._id || shorts[currentVisibleIndex].song?.songId);
              const expectedMute = hasSong || false;
              video.setIsMutedAsync(expectedMute).catch(() => {});
              video.setVolumeAsync(expectedMute ? 0.0 : 1.0).catch(() => {});
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
    
    // DETAILED LOGGING: Track URL resolution for first 2 shorts
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
  }, [videoQuality, shorts]);
  
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
      
      // Check if unloadAsync exists before calling
      if (typeof video.unloadAsync === 'function') {
        video.unloadAsync().then(() => {
          // Re-check video ref after unload (it might have been cleared)
          const videoAfterUnload = videoRefs.current[videoId];
          if (videoAfterUnload && typeof videoAfterUnload.loadAsync === 'function') {
            videoAfterUnload.loadAsync({ uri: videoUrl }).then(() => {
              const videoForPlay = videoRefs.current[videoId];
              if (videoForPlay && typeof videoForPlay.playAsync === 'function') {
                const hasSong = !!(short?.song?.songId?._id || short?.song?.songId);
                const expectedMute = hasSong || false;
                videoForPlay.setIsMutedAsync(expectedMute).catch(() => {});
                videoForPlay.setVolumeAsync(expectedMute ? 0.0 : 1.0).catch(() => {});
                videoForPlay.playAsync().catch(() => {
                  logger.error(`Video ${videoId} retry play failed`);
                });
              }
            }).catch((loadError) => {
              logger.error(`Video ${videoId} retry load failed:`, loadError);
              // Bump source version to force a clean remount with a fresh URL fetch on next render.
              // Without this, the Video sits in a broken state showing a black surface forever
              // until the user scrolls away and back.
              setSourceVersions(prev => ({ ...prev, [videoId]: (prev[videoId] ?? 0) + 1 }));
            });
          }
        }).catch(() => {
          // If unload fails, try to reload directly (re-check video ref)
          const videoAfterError = videoRefs.current[videoId];
          if (videoAfterError && typeof videoAfterError.loadAsync === 'function') {
            videoAfterError.loadAsync({ uri: videoUrl }).catch(() => {
              setSourceVersions(prev => ({ ...prev, [videoId]: (prev[videoId] ?? 0) + 1 }));
            });
          }
        });
      } else {
        // If unloadAsync doesn't exist, try to reload directly
        if (typeof video.loadAsync === 'function') {
          video.loadAsync({ uri: videoUrl }).catch(() => {
            setSourceVersions(prev => ({ ...prev, [videoId]: (prev[videoId] ?? 0) + 1 }));
          });
        }
      }
    }, delay);
  }, [shorts, getVideoUrl]);

  const loadShorts = useCallback(async () => {
    try {
      setLoading(true);
      currentPageRef.current = 1;
      hasMoreRef.current = true;

      logger.info(`[LOAD_SHORTS] Starting to load shorts`, {
        effectiveUserId,
        effectiveShortId,
        timestamp: new Date().toISOString()
      });

      const shouldFilterByUser = !!effectiveUserId;

      // When a specific shortId is provided (opened from notification / feed tap)
      // without a userId filter, show that short immediately then load the full feed.
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
      setShorts(merged);
      if (!shouldFilterByUser) {
        hasMoreRef.current = (response.shorts || []).length >= 10;
      }

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

  // Update ref whenever loadShorts changes (for socket handlers)
  useEffect(() => {
    loadShortsRef.current = loadShorts;
  }, [loadShorts]);

  const loadMoreShorts = useCallback(async () => {
    if (!hasMoreRef.current || isLoadingMore || !!effectiveUserId || !!effectiveShortId) return;
    try {
      setIsLoadingMore(true);
      const nextPage = currentPageRef.current + 1;
      const response = await getShorts(nextPage, 10);
      const newShorts: PostType[] = response.shorts || [];
      if (newShorts.length === 0) {
        hasMoreRef.current = false;
        return;
      }
      currentPageRef.current = nextPage;
      hasMoreRef.current = newShorts.length >= 10;
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

  // Pause all videos except the specified one to ensure only one plays at a time
  const pauseAllVideosExcept = useCallback(async (activeVideoId: string | null) => {
    Object.keys(videoRefs.current).forEach(async (videoId) => {
      if (videoId !== activeVideoId && videoRefs.current[videoId]) {
        try {
          await videoRefs.current[videoId]?.pauseAsync();
          updateKeyedBool(setVideoStates, videoId, false);
        } catch (error) {
          logger.warn(`Error pausing video ${videoId}:`, error);
        }
      }
    });
  }, [updateKeyedBool]);

  const toggleVideoPlayback = useCallback((videoId: string) => {
    const video = videoRefs.current[videoId];
    if (video) {
      const isCurrentlyPlaying = videoStates[videoId];
      const newPlayState = !isCurrentlyPlaying;
      
      // Find the current short to check for music
      const currentShort = shorts.find(s => s._id === videoId);
       const hasMusic = !!(currentShort?.song?.songId?._id || currentShort?.song?.songId);

      // If starting playback, pause all other videos first
      if (newPlayState) {
        pauseAllVideosExcept(videoId);
        activeVideoIdRef.current = videoId;
        // Update video state immediately for music sync (coalesced)
        updateKeyedBool(setVideoStates, videoId, true);
        
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
        updateKeyedBool(setVideoStates, videoId, false);
      }

      video.setStatusAsync({
        shouldPlay: newPlayState,
      }).catch(() => {});
    }
  }, [videoStates, pauseAllVideosExcept, shorts, updateKeyedBool]);

  const showPauseButtonTemporarily = (videoId: string) => {
    // Don't show pause button if like animation is showing
    if (showLikeAnimation[videoId]) {
      return;
    }

    updateKeyedBool(setShowPauseButton, videoId, true);

    // Clear existing pause-button timeout (separate slot from like-anim).
    if (pauseTimeoutRefs.current[videoId]) {
      clearTimeout(pauseTimeoutRefs.current[videoId]);
    }

    // Set new timeout
    pauseTimeoutRefs.current[videoId] = setTimeout(() => {
      updateKeyedBool(setShowPauseButton, videoId, false);
    }, 2000);
  };

  const showLikeAnimationTemporarily = useCallback((shortId: string) => {
    // Initialize animation value if not exists
    if (!likeAnimationRefs.current[shortId]) {
      likeAnimationRefs.current[shortId] = new Animated.Value(0);
    }
    
    const animValue = likeAnimationRefs.current[shortId];
    
    // Reset animation
    animValue.setValue(0);

    // Show like animation (coalesced — no-op if already true)
    updateKeyedBool(setShowLikeAnimation, shortId, true);

    // Hide pause button while animation is showing (coalesced)
    updateKeyedBool(setShowPauseButton, shortId, false);
    
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
    
    // Hide animation after 1.5 seconds.
    // Use the separate likeAnim slot so a follow-up tap-to-pause on the same
    // cell within 1.5s doesn't orphan this timer.
    if (likeAnimTimeoutRefs.current[shortId]) {
      clearTimeout(likeAnimTimeoutRefs.current[shortId]);
    }
    likeAnimTimeoutRefs.current[shortId] = setTimeout(() => {
      updateKeyedBool(setShowLikeAnimation, shortId, false);
      setLikeAnimationParticles(prev => {
        if (!prev[shortId]) return prev;
        const newState = { ...prev };
        delete newState[shortId];
        return newState;
      });
      // Clean up particle refs
      if (likeParticleRefs.current[shortId]) {
        delete likeParticleRefs.current[shortId];
      }
    }, 1500);
  }, [updateKeyedBool]);

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

    // If forceLike is true and it's already liked, strictly show the heart animation and return
    if (forceLike && originalIsLiked) {
      showLikeAnimationTemporarily(shortId);
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
      showLikeAnimationTemporarily(shortId);
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
  }, [showLikeAnimationTemporarily, executeLikeApiCall]);

  const handleVideoTap = useCallback((videoId: string) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[videoId] ?? 0;
    const delay = 300; // ms window for double tap

    if (now - lastTap < delay) {
      // Double tap detected!
      if (tapTimeoutRefs.current[videoId]) {
        clearTimeout(tapTimeoutRefs.current[videoId]);
        delete tapTimeoutRefs.current[videoId];
      }
      
      // Double tap strictly sets isLiked = true and fires the heart animation.
      // It must NEVER unlike the video if it is already liked.
      handleLike(videoId, true);
      
      lastTapRef.current[videoId] = 0;
    } else {
      lastTapRef.current[videoId] = now;
      
      if (tapTimeoutRefs.current[videoId]) {
        clearTimeout(tapTimeoutRefs.current[videoId]);
      }
      
      tapTimeoutRefs.current[videoId] = setTimeout(() => {
        handlersRef.current.toggleVideoPlayback(videoId);
        handlersRef.current.showPauseButtonTemporarily(videoId);
        delete tapTimeoutRefs.current[videoId];
      }, delay);
    }
  }, [handleLike]);

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
    swipeStartXRef.current = pageX;
    swipeStartYRef.current = pageY;
  };

  const handleTouchMove = (event: any) => {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) return;

    const { pageX, pageY } = event.nativeEvent;
    const deltaX = pageX - swipeStartXRef.current;
    const deltaY = pageY - swipeStartYRef.current;

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
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) return;

    const { pageX, pageY } = event.nativeEvent;
    const deltaX = pageX - swipeStartXRef.current;
    const deltaY = pageY - swipeStartYRef.current;
    
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
        swipeStartXRef.current = null;
        swipeStartYRef.current = null;
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

    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
  };

  // Interleave full-screen native ad after every SHORTS_ADS_AFTER_EVERY reels.
  // Three independent caps must all permit a slot:
  //   1. UX gates: hasWatchedFiveReels + adsAllowedAfter20s.
  //   2. Per-session counter (defense-in-depth, resets on app restart).
  //   3. Persistent 5-per-8h cap (adCap, shared with home feed).
  // Whichever is most restrictive wins.
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
        const currentAdIndex = adCount++;
        if (!failedAdIndices.includes(currentAdIndex)) {
          result.push({ type: 'ad', adIndex: currentAdIndex });
        }
      }
    });
    return result;
  }, [shorts, showShortsAds, adsShownThisSession, adCap.remainingSlots, failedAdIndices]);

  // Deep link: scroll to specific short when effectiveShortId is set (URL or props). dataIndex accounts for ad slots when showShortsAds.
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
    setCurrentIndex(dataIndex);
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

  // Enhanced: Ensure video playback syncs with currentVisibleIndex (uses shortsData; ad = pause all, reel = play)
  useEffect(() => {
    if (previousVisibleIndexRef.current === currentVisibleIndex) return;
    const visibleItem = shortsData[currentVisibleIndex] as ShortsItem | undefined;
    const isReel = visibleItem && !isAdItem(visibleItem);
    previousVisibleIndexRef.current = currentVisibleIndex;
    
    // Clear any pending recovery check when visible video changes
    if (activeRecoveryTimerRef.current) {
      clearTimeout(activeRecoveryTimerRef.current);
      activeRecoveryTimerRef.current = null;
    }

    // NOTE: Do NOT call audioManager.stopAll() here.
    // SongPlayer handles its own lifecycle via isVisible/autoPlay props,
    // and audioManager.playSound() already calls stopAll() before playing a new sound.
    // Calling stopAll() here creates a race condition that destroys audio before SongPlayer can play.

    if (!isReel) {
      Object.keys(videoRefs.current).forEach(id => {
        videoRefs.current[id]?.pauseAsync().catch(() => {});
      });
      activeVideoIdRef.current = null;
      return;
    }

    const currentShortId = (visibleItem as PostType)._id.toString();
    const currentVideo = videoRefs.current[currentShortId];
    // Pause non-current videos but do NOT reset their videoStates to false.
    // videoStates tracks whether the user intentionally paused a video.
    // When returning to a video, its previous state is preserved so the song
    // auto-plays if the video was playing when the user scrolled away.
    Object.keys(videoRefs.current).forEach(id => {
      if (id !== currentShortId) {
        videoRefs.current[id]?.pauseAsync().catch(() => {});
      }
    });

    if (currentVideo) {
      activeVideoIdRef.current = currentShortId;
      currentVideo.getStatusAsync().then((status) => {
        if (status.isLoaded) {
          const hasMusic = !!((visibleItem as PostType)?.song?.songId?._id || (visibleItem as PostType)?.song?.songId);
          if (hasMusic) {
            currentVideo.setIsMutedAsync(true).catch(() => {});
            currentVideo.setVolumeAsync(0.0).catch(() => {});
          } else {
            currentVideo.setIsMutedAsync(false).catch(() => {});
            currentVideo.setVolumeAsync(1.0).catch(() => {});
          }
          if (!status.isPlaying) {
            currentVideo.playAsync().then(() => {
              updateKeyedBool(setVideoStates, currentShortId, true);
              logger.debug(`Video ${currentShortId} started playing via useEffect`);
            }).catch((error) => {
              logger.error(`Video ${currentShortId} failed to play via useEffect:`, error);
              setTimeout(() => { currentVideo.playAsync().catch(() => {}); }, 500);
            });
          } else {
            updateKeyedBool(setVideoStates, currentShortId, true);
          }
        } else {
          logger.debug(`Video ${currentShortId} not loaded yet, waiting for onLoad`);
          
          // RECOVERY MECHANISM:
          // If the visible video is not loaded yet (e.g. failed load in background due to expired URL),
          // schedule a recovery check after 1.5 seconds. If it's still not loaded, we force-refetch the fresh signed URL.
          activeRecoveryTimerRef.current = setTimeout(() => {
            const checkVideo = videoRefs.current[currentShortId];
            if (checkVideo) {
              checkVideo.getStatusAsync().then((checkStatus) => {
                if (!checkStatus.isLoaded) {
                  logger.warn(`Video ${currentShortId} still not loaded after 1.5s - triggering URL refetch recovery`);
                  handlersRef.current.refetchShortWithFreshUrl(currentShortId).then((freshShort: PostType | null) => {
                    const freshVideoUrl = freshShort?.videoUrl || freshShort?.mediaUrl || freshShort?.imageUrl;
                    if (freshShort && freshVideoUrl) {
                      setShorts(prev => prev.map(s =>
                        s._id === currentShortId
                          ? { ...s, mediaUrl: freshShort.mediaUrl, videoUrl: freshShort.videoUrl || s.videoUrl, imageUrl: freshShort.imageUrl || s.imageUrl }
                          : s
                      ));
                      setSourceVersions(prev => ({
                        ...prev,
                        [currentShortId]: (prev[currentShortId] ?? 0) + 1,
                      }));
                      logger.info(`Successfully recovered visible video ${currentShortId} with fresh signed URL`);
                    } else {
                      handlersRef.current.retryVideoLoad(currentShortId, 200);
                    }
                  }).catch(() => {
                    handlersRef.current.retryVideoLoad(currentShortId, 200);
                  });
                }
              }).catch(() => {});
            }
          }, 1500);
        }
      }).catch((error) => {
        logger.error(`Failed to get status for video ${currentShortId}:`, error);
        const hasMusic = !!((visibleItem as PostType)?.song?.songId?._id || (visibleItem as PostType)?.song?.songId);
        currentVideo.setIsMutedAsync(hasMusic).catch(() => {});
        currentVideo.setVolumeAsync(hasMusic ? 0.0 : 1.0).catch(() => {});
        currentVideo.playAsync().catch(() => {});
      });
    } else {
      activeVideoIdRef.current = currentShortId;
      updateKeyedBool(setVideoStates, currentShortId, true);
      logger.debug(`Video ref not available for ${currentShortId}, will play when mounted`);
    }

    return () => {
      if (activeRecoveryTimerRef.current) {
        clearTimeout(activeRecoveryTimerRef.current);
        activeRecoveryTimerRef.current = null;
      }
    };
  }, [currentVisibleIndex, shortsData, updateKeyedBool]);

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
      handleVideoTap,
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, toggleVideoPlayback, showPauseButtonTemporarily, handleDeleteShort, handleProfilePress, handleLike, handleComment, handleShare, handleSave, getVideoUrl, refetchShortWithFreshUrl, retryVideoLoad, handleVideoTap]);

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
              setAdsShownThisSession((prev) => Math.min(3, prev + 1));
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
    const distanceFromVisible = index - currentVisibleIndex;
    // Mount the currently-visible reel AND its immediate neighbours (prev + next)
    // so the upcoming video can buffer while the user watches the current one.
    // This eliminates the "split-second black flash" when scrolling because the
    // next Video component is already mounted and pre-loading its stream.
    // Memory note: each expo-av Video holds a hardware decoder + GPU surface;
    // three concurrent decoders (prev + current + next) is the sweet spot.
    // The cleanup effect at distance > 2 unloads anything further out, and
    // the blur handler unloads ALL decoders when the user leaves the tab.
    const shouldRenderVideo = Math.abs(distanceFromVisible) <= 1;

    const videoState = videoStates[item._id];
    // Only treat the video as "playing" once it has actually reported playback
    // (via onLoad / onPlaybackStatusUpdate). The previous optimistic fallback
    // (`index === currentVisibleIndex` when state is undefined) caused SongPlayer
    // to autoplay the (smaller, faster-loading) audio file before the video had
    // finished buffering — so the user heard music before seeing the reel, and
    // a tap-pause during that gap couldn't sync the two streams.
    const isCellVideoPlaying = videoState === true && isVideoPlaying;
    const isFollowing = followStates[item.user._id] || false;
    const isSaved = savedShorts.has(item._id);
    const isLiked = item.isLiked || false;
    
    // Calculate pause button visibility and icon - isolated from like state to prevent flexing
    // Don't show pause button if like animation is showing
    // Only show play/pause overlay when the user explicitly taps. Previously
    // `!videoStates[item._id]` also triggered it, which flashed a "play"
    // button during the brief load/transition window on scroll.
    const shouldShowPauseButton = !showLikeAnimation[item._id] && !!showPauseButton[item._id];
    const pauseButtonIcon = videoStates[item._id] ? "pause" : "play";
    const shouldShowLikeAnimation = showLikeAnimation[item._id] || false;
    
    if (__DEV__ && index === currentVisibleIndex) {
      if (item.song) {
        logger.debug('Short has song data:', { shortId: item._id, songId: item.song.songId?._id || item.song.songId });
      } else {
        logger.debug('Short has NO song data:', { shortId: item._id });
      }
    }

    // Pipe-separated key of every state slice that affects this cell's
    // output. ShortCellMemo skips re-render if this string is identical to
    // its previous value — meaning a state change for a different cell
    // doesn't pay the cost of re-rendering this one. Pipe-string is cheap
    // to build and compare; deliberately avoiding JSON.stringify per cell.
    const isOwn = item.user._id === currentUser?._id;
    const isVisibleNow = index === currentVisibleIndex;
    const cacheKey =
      `${item._id}|${index}|${isVisibleNow ? 1 : 0}|` +
      `${isCellVideoPlaying ? 1 : 0}|${mutedShorts.has(item._id) ? 1 : 0}|` +
      `${isSaved ? 1 : 0}|${isFollowing ? 1 : 0}|` +
      `${shouldShowPauseButton ? 1 : 0}|${shouldShowLikeAnimation ? 1 : 0}|` +
      `${sourceVersions[item._id] ?? 0}|` +
      `${item.commentsCount ?? 0}|${item.viewsCount ?? 0}|` +
      `${isOwn ? 1 : 0}|${isScreenFocused ? 1 : 0}|${containerHeight}|${expandedCaptions[item._id] ? 1 : 0}`;

    return (
      <ShortCellMemo cacheKey={cacheKey} render={() => (
      <View style={[styles.shortItem, { height: containerHeight }]}>
          {/* Video Player with Gesture Handling */}
          <View
            style={styles.videoContainer}
            onTouchStart={handlersRef.current.handleTouchStart}
            onTouchMove={handlersRef.current.handleTouchMove}
            onTouchEnd={(event) => handlersRef.current.handleTouchEnd(event, item.user._id)}
          >
            <TouchableWithoutFeedback
              onPress={() => {
                handlersRef.current.handleVideoTap(item._id);
              }}
              onLongPress={() => {
                // Only allow delete for own content
                if (item.user._id === currentUser?._id) {
                  handlersRef.current.handleDeleteShort(item._id);
                }
              }}
              accessible={true}
              accessibilityLabel="Tap to play or pause video"
              accessibilityRole="button"
            >
              {/* TouchableWithoutFeedback uses React.Children.only — wrap the backdrop
                  + Video pair in a single View so it sees one child. The wrapper fills
                  the parent so taps still hit anywhere. */}
              <View style={styles.shortVideo}>
              {/* Always show thumbnail backdrop so there's never a black surface.
                  The Video layers on top; once its first frame decodes, it
                  naturally covers the image — no opacity hack needed. */}
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
              {/* Only mount Video component if within 1 index of visible */}
              {shouldRenderVideo && (
                <MemoizedVideo
                key={`video-${item._id}-${sourceVersions[item._id] ?? 0}`}
                ref={(ref) => {
                  videoRefs.current[item._id] = ref;
                  if (index < 2) {
                    logger.info(`[RENDER_VIDEO] Video component mounted for short at index ${index}:`, {
                      shortId: item._id,
                      shouldRenderVideo,
                      sourceVersion: sourceVersions[item._id] ?? 0,
                      timestamp: new Date().toISOString()
                    });
                  }
                }}
                source={getVideoSource(handlersRef.current.getVideoUrl(item))}
                style={[
                  styles.shortVideo,
                  StyleSheet.absoluteFillObject,
                ]}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={index === currentVisibleIndex && isVideoPlaying}
                isLooping
                progressUpdateIntervalMillis={100}
                 isMuted={index !== currentVisibleIndex || !!(item.song?.songId?._id || item.song?.songId)}
                 volume={(() => {
                   const hasMusic = !!(item.song?.songId?._id || item.song?.songId);
                   return hasMusic ? 0.0 : 1.0;
                 })()}
                 onLoadStart={() => {
                   logger.debug(`Video ${item._id} load started, index: ${index}, currentVisible: ${currentVisibleIndex}`);
                   if (index < 2) {
                     logger.info(`[RENDER_VIDEO] onLoadStart for short at index ${index}:`, {
                       shortId: item._id,
                       timestamp: new Date().toISOString()
                     });
                   }
                   if (index === currentVisibleIndex) {
                     const video = videoRefs.current[item._id];
                     if (video) {
                       // If music exists (by songId), ensure video is muted so only SongPlayer audio plays
                       const hasMusic = !!(item.song?.songId?._id || item.song?.songId);
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
                onReadyForDisplay={() => {
                  logger.debug(`Video ${item._id} ready for display`);
                }}
                onError={(error) => {
                  // Handle video loading errors (likely expired signed URL or timeout).
                  // Strategy: don't manually call unload/load on the native player —
                  // those calls race with React's lifecycle and have crashed expo-av
                  // when the user scrolls during the retry. Instead refresh the URL
                  // via setShorts and bump a per-item key version so React fully
                  // unmounts the old player and remounts a clean one with the new URL.
                  logger.error(`Video ${item._id} failed to load:`, error);
                  videoCacheRef.current.delete(item._id);
                  updateKeyedBool(setVideoStates, item._id, false);

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
                    handlersRef.current
                      .refetchShortWithFreshUrl(item._id)
                      .then((freshShort: PostType | null) => {
                        const freshVideoUrl = freshShort?.videoUrl || freshShort?.mediaUrl || freshShort?.imageUrl;
                        if (!freshShort || !freshVideoUrl) {
                          handlersRef.current.retryVideoLoad(item._id, 1000);
                          return;
                        }
                        // Swap the URL in feed state.
                        setShorts(prev => prev.map(s =>
                          s._id === item._id
                            ? { ...s, mediaUrl: freshShort.mediaUrl, videoUrl: freshShort.videoUrl || s.videoUrl, imageUrl: freshShort.imageUrl || s.imageUrl }
                            : s
                        ));
                        // Bump source version → key changes → Video remounts cleanly.
                        setSourceVersions(prev => ({
                          ...prev,
                          [item._id]: (prev[item._id] ?? 0) + 1,
                        }));
                      })
                      .catch((refetchError: any) => {
                        logger.error(`Failed to refetch fresh URL for video ${item._id}:`, refetchError);
                        handlersRef.current.retryVideoLoad(item._id, 1000);
                      });
                  } else {
                    handlersRef.current.retryVideoLoad(item._id, 1000);
                  }
                }}
                onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
                  if (status.isLoaded) {
                    if (index === currentVisibleIndex) {
                      const cb = progressCallbacks.current[item._id];
                      if (cb) {
                        cb(status.positionMillis, status.durationMillis || 1);
                      }
                    }
                    const wasPlaying = videoStates[item._id];
                    const isNowPlaying = status.isPlaying;
                    
                    // CRITICAL: If music exists, ensure video stays muted
                    const hasMusic = !!(item.song?.songId?._id || item.song?.songId);
                    if (hasMusic && index === currentVisibleIndex) {
                      const video = videoRefs.current[item._id];
                      if (video && !status.isMuted) {
                        // Throttle to once/second per video. Status callbacks fire
                        // ~5x/sec; calling setIsMutedAsync/setVolumeAsync that
                        // often was bridge churn correlated with native crashes.
                        const now = Date.now();
                        const lastEnforce = lastMuteEnforceAtRef.current[item._id] ?? 0;
                        if (now - lastEnforce > 1000) {
                          lastMuteEnforceAtRef.current[item._id] = now;
                          video.setIsMutedAsync(true).catch(() => {});
                          video.setVolumeAsync(0.0).catch(() => {});
                        }
                      }
                    }
                    
                    // Ensure only one video plays at a time.
                    // Gate by the source of truth (currentVisibleIndex) rather
                    // than the ref — the ref can lag during scroll transitions
                    // and falsely pause the video that just became visible,
                    // causing intermittent "won't play" behaviour.
                    if (isNowPlaying && (index !== currentVisibleIndex || !isScreenFocusedRef.current)) {
                      videoRefs.current[item._id]?.pauseAsync().catch(() => {
                        // Silently handle pause errors
                      });
                      return; // Don't update state if we're pausing it
                    }
                    
                    // Update active video ref when playback starts
                    if (isNowPlaying && index === currentVisibleIndex) {
                      activeVideoIdRef.current = item._id;
                    }

                    // Detect video loop restart and sync audio back to startTime.
                    // When isLooping is true, expo-av restarts the video natively
                    // without firing didJustFinish. We detect the loop by checking
                    // if the position jumped backwards significantly.
                    if (isNowPlaying && index === currentVisibleIndex && status.positionMillis !== undefined) {
                      const lastPos = lastVideoPositionRef.current[item._id] ?? 0;
                      const curPos = status.positionMillis;
                      // A backwards jump of >500ms while playing = the video looped
                      if (lastPos > 500 && curPos < lastPos - 500) {
                        const hasMusic = !!(item.song?.songId?._id || item.song?.songId);
                        if (hasMusic && currentPlayerRef.current) {
                          const startSec = item.song?.startTime || 0;
                          const endSec = item.song?.endTime;
                          const songStartMs = startSec * 1000;
                          // Compensate for the video having already advanced `curPos` ms
                          // past the loop point by the time this status update fires.
                          // Without the offset, audio resets to exactly startTime while
                          // the video is already curPos ms in, leaving audio ~100ms behind
                          // the visual after every loop. Wrap within the audio segment
                          // length so the seek never lands past endTime.
                          const segmentMs = endSec && endSec > startSec ? (endSec - startSec) * 1000 : 60000;
                          const audioOffsetMs = curPos % segmentMs;
                          currentPlayerRef.current.setPositionAsync(songStartMs + audioOffsetMs).catch(() => {});
                        }
                      }
                      lastVideoPositionRef.current[item._id] = curPos;
                    }
                    
                    // Only update video state when playback status actually changes
                    // to avoid unnecessary re-renders (onPlaybackStatusUpdate fires ~30x/sec).
                    // Only sync 'true' (playing) state from native player. We do NOT sync 'false' (paused)
                    // automatically here, because native player temporarily reports isPlaying=false
                    // during re-renders, buffering, or loop transitions, which would cause the background song
                    // player to stutter. User-initiated pause and screen transitions explicitly set videoStates to false.
                    if (isNowPlaying && wasPlaying !== true) {
                      logger.debug(`Video ${item._id} playing`);
                      updateKeyedBool(setVideoStates, item._id, true);
                    }
                  } else if ((status as any).error) {
                    // Handle playback errors
                    logger.error(`Video ${item._id} playback error:`, (status as any).error);
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

                    // Initialize video state when video loads (coalesced)
                    updateKeyedBool(setVideoStates, item._id, !!status.isPlaying);
                    
                    // CRITICAL FIX: Ensure video plays when it becomes visible and is loaded
                    // This fixes the black screen issue for subsequent videos
                    if (index === currentVisibleIndex && isScreenFocusedRef.current) {
                      const video = videoRefs.current[item._id];
                      if (video) {
                        // onLoad fires when video is ready — call play immediately (no setTimeout delay)
                        video.getStatusAsync().then((currentStatus) => {
                          if (currentStatus.isLoaded) {
                            // If music exists (by songId), ensure video is muted
                            const hasMusic = !!(item.song?.songId?._id || item.song?.songId);
                            if (hasMusic) {
                              video.setIsMutedAsync(true).catch(() => {});
                              video.setVolumeAsync(0.0).catch(() => {});
                            } else {
                              video.setIsMutedAsync(false).catch(() => {});
                              video.setVolumeAsync(1.0).catch(() => {});
                            }

                            // Play video if it's not already playing
                            if (!currentStatus.isPlaying) {
                              activeVideoIdRef.current = item._id;
                              video.playAsync().then(() => {
                                updateKeyedBool(setVideoStates, item._id, true);
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
                      }
                    }
                  }
                }}
              />
              )}
              </View>
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
          {showSwipeHint && !effectiveUserId && index === currentVisibleIndex && (
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
            onProfilePress={handlersRef.current.handleProfilePress}
            onLikePress={handlersRef.current.handleLike}
            onCommentPress={handlersRef.current.handleComment}
            onSharePress={handlersRef.current.handleShare}
            onSavePress={handlersRef.current.handleSave}
            isScopedView={!!effectiveUserId}
          />

          {/* Bottom Content with Elegant Design */}
          <View style={[styles.bottomContent, !!effectiveUserId && { paddingBottom: Platform.OS === 'ios' ? 20 : 16 }]}>
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
                accessibilityLabel={`View ${item.user.username || 'user'}'s profile`}
                accessibilityRole="button"
              >
                <View style={styles.avatarContainer}>
                <ExpoImage
                  source={item.user.profilePic ? { uri: item.user.profilePic } : require('../../assets/avatars/male_avatar.png')}
                  style={styles.userAvatar as ImageStyle}
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
                        <Ionicons name="musical-notes" size={12} color="#38BDF8" />
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
                        <Ionicons name="location-outline" size={12} color="#38BDF8" />
                        <Text style={styles.inlineLocationText} numberOfLines={1}>
                          {item.location.address}
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                  
                  {item.caption ? (() => {
                    const isExpanded = !!expandedCaptions[item._id];
                    const canExpand = item.caption.length > 80;
                    const showTags = isExpanded;
                    return (
                      <TouchableOpacity 
                        activeOpacity={0.9}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          setExpandedCaptions(prev => ({
                            ...prev,
                            [item._id]: !prev[item._id]
                          }));
                        }}
                      >
                        <Text 
                          style={styles.caption} 
                          numberOfLines={isExpanded ? undefined : 2}
                        >
                          {item.caption}
                          {canExpand && !isExpanded && (
                            <Text style={styles.moreText}> ...more</Text>
                          )}
                          {canExpand && isExpanded && (
                            <Text style={styles.moreText}>  less</Text>
                          )}
                        </Text>
                        
                        {showTags && item.tags && item.tags.length > 0 && (
                          <View style={styles.tagsContainer}>
                            {item.tags.slice(0, 3).map((tag, tagIndex) => (
                              <LinearGradient
                                key={tagIndex}
                                colors={['#1C73B4', '#50C878']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.tagBadgeGradient}
                              >
                                <Text style={styles.tagTextGradient}>#{tag}</Text>
                              </LinearGradient>
                            ))}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })() : null}
                </View>
              </TouchableOpacity>
              
              {/* Song Player - Hidden but active for audio playback */}
              {/* CRITICAL: Only render SongPlayer if song exists with valid s3Url */}
              {/* Render SongPlayer whenever a populated song object exists — even if the URL is missing.
                 SongPlayer will fetch a fresh URL via getSongById if s3Url/cloudinaryUrl are null. */}
              {!!(item.song?.songId && (item.song.songId._id || typeof item.song.songId === 'string')) && (
                  <View style={styles.hiddenSongPlayer} pointerEvents="none">
                    <SongPlayer
                      post={item}
                      isVisible={isScreenFocused && index === currentVisibleIndex}
                      autoPlay={isCellVideoPlaying}
                      externalMuted={mutedShorts.has(item._id)}
                      onPlayingChange={handleSongPlayingChange}
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
              getVideoRef={() => videoRefs.current[item._id]}
              hasMusic={!!(item.song?.songId?._id || item.song?.songId)}
              songStartSec={item.song?.startTime}
              songEndSec={item.song?.endTime}
              currentPlayerRef={currentPlayerRef}
              progressCallbacks={progressCallbacks}
              lastVideoPositionRef={lastVideoPositionRef}
            />
          )}
      </View>
      )} />
    );
    // swipeAnimation / fadeAnimation are Animated.Value refs from useRef ---
    // their identity never changes, so they don't belong in the deps array.
    // Including them was harmless but signaled false volatility.
  }, [currentVisibleIndex, videoStates, followStates, savedShorts, mutedShorts, currentUser, showPauseButton, showLikeAnimation, isScreenFocused, sourceVersions, containerHeight, expandedCaptions, isVideoPlaying]);

  const keyExtractor = useCallback((item: ShortsItem) => {
    if (isAdItem(item)) return `ad-${item.adIndex}`;
    return item._id;
  }, []);

  const getItemLayout = useCallback((_data: any, index: number) => ({
    length: containerHeight,
    offset: containerHeight * index,
    index,
  }), [containerHeight]);

  // Track viewable items; handle ad vs reel. Frequency: set hasWatchedFiveReels when user has viewed reel at index >= 5.
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length === 0) return;
    const visibleItem = viewableItems[0];
    const newVisibleIndex = visibleItem.index;
    const item = visibleItem.item as ShortsItem;

    if (newVisibleIndex === undefined || newVisibleIndex === null || newVisibleIndex === currentVisibleIndex) return;

    // Pause previous short's audio immediately when user scrolls to another video.
    // NOTE: Only pause here — do NOT call audioManager.stopAll() which destructively
    // unloads the sound. SongPlayer handles full stop + unload when isVisible becomes false,
    // and audioManager.playSound() calls stopAll() before playing the next sound.
    if (currentPlayerRef.current) {
      currentPlayerRef.current.pauseAsync?.().catch(() => {});
      currentPlayerRef.current = null;
    }

    const previousIndex = currentVisibleIndex;
    const previousItem = shortsData[previousIndex] as ShortsItem | undefined;

    setCurrentVisibleIndex(newVisibleIndex);
    setCurrentIndex(newVisibleIndex);

    // If visible item is a reel, track max reel index for frequency (hasWatchedFiveReels)
    if (item && !isAdItem(item)) {
      const reelIndex = shortsData.slice(0, newVisibleIndex).filter((x: ShortsItem) => !isAdItem(x)).length;
      const threshold = __DEV__ ? 1 : 5;
      if (reelIndex >= threshold) setHasWatchedFiveReels(true);
    }

    // Pause previous video if previous item was a reel
    if (previousItem && !isAdItem(previousItem)) {
      const previousVideoId = previousItem._id;
      const previousVideo = videoRefs.current[previousVideoId];
      if (previousVideo) {
        previousVideo.pauseAsync()
          .then(() => {
            updateKeyedBool(setVideoStates, previousVideoId, false);
          })
          .catch(() => {
            updateKeyedBool(setVideoStates, previousVideoId, false);
          });
        // Do NOT call stopAndUnloadVideo here: the Video component may still
        // be mounted in the FlatList window, and unloadAsync leaves it in a
        // black/unloaded state with no trigger to reload when the user
        // scrolls back. Unmounting (via shouldRenderVideo / windowSize) is
        // what frees resources — pauseAsync above is enough to stop playback.
      }
    }

    if (activeVideoIdRef.current && item && !isAdItem(item) && item._id !== activeVideoIdRef.current) {
      activeVideoIdRef.current = null;
    }

    // If new visible item is a reel, mark it active for playback; if ad, leave video paused
    if (item && !isAdItem(item)) {
      activeVideoIdRef.current = item._id;
      updateKeyedBool(setVideoStates, item._id, true);
    } else {
      activeVideoIdRef.current = null;
    }
  }, [shortsData, stopAndUnloadVideo, currentVisibleIndex, updateKeyedBool]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60, // Lower threshold so visibility triggers sooner during snap animation
    minimumViewTime: 50, // Reduced from 100ms — faster visibility detection after snap
  }).current;

  if (!loading && shorts.length === 0) {
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
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent" 
        translucent={true}
      />

      {/* Premium Top Bar Overlay */}
      {(() => {
        const currentShort = shorts[currentVisibleIndex] as PostType | undefined;
        const hasSong = !!(currentShort?.song?.songId && (currentShort.song.songId._id || typeof currentShort.song.songId === 'string'));
        const isMuted = currentShort ? mutedShorts.has(currentShort._id) : false;
        
        return (
          <View style={[styles.topBar, effectiveUserId && { height: 60, backgroundColor: 'transparent' }]}>
            {!effectiveUserId && (
              <LinearGradient
                colors={['#0F0F12', '#000000']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              />
            )}
            <View style={[styles.topBarContent, effectiveUserId && { paddingTop: 10, height: 60 }]}>
              {/* Left Back Button */}
              {!effectiveUserId ? (
                <TouchableOpacity
                  style={styles.topBarButton}
                  onPress={handleBack}
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                >
                  <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
              ) : (
                <View style={styles.topBarButtonEmpty} />
              )}

              {/* Centered Shorts Title */}
              {!effectiveUserId && <Text style={styles.topBarTitle}>Shorts</Text>}

              {/* Right Mute Button */}
              {hasSong ? (
                <TouchableOpacity
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
                  <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={24} color="#fff" />
                </TouchableOpacity>
              ) : (
                <View style={styles.topBarButtonEmpty} />
              )}
            </View>
          </View>
        );
      })()}

      <FlatList
        ref={flatListRef}
        data={shortsData}
        renderItem={renderShortItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
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
        snapToInterval={containerHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        // Stops a fast flick from carrying past one page and snapping back —
        // user lands on the next reel exactly, no overshoot.
        disableIntervalMomentum={true}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
          });
        }}
        removeClippedSubviews={true}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={5}
        updateCellsBatchingPeriod={10}
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
    height: SHORTS_ITEM_HEIGHT,
    position: 'relative',
    backgroundColor: 'black',
  },
  shortItemAdWrapper: {
    height: SHORTS_ITEM_HEIGHT,
    overflow: 'hidden',
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
    right: isTablet ? theme.spacing.lg : 12,
    bottom: Platform.OS === 'ios' ? (isWeb ? 90 : 170) : (isWeb ? 80 : 160),
    alignItems: 'center',
    zIndex: 5,
  },
  optionsActionContainer: {
    position: 'absolute',
    right: isTablet ? theme.spacing.lg : 12,
    bottom: Platform.OS === 'ios' ? (isWeb ? 16 : 96) : (isWeb ? 12 : 86),
    alignItems: 'center',
    zIndex: 5,
  },
  profileButton: {
    marginBottom: isTablet ? theme.spacing.xl : 20,
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
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: isTablet ? 6 : 4,
  },
  likedContainer: {
    borderColor: 'rgba(80, 200, 120, 0.25)',
    backgroundColor: 'rgba(28, 115, 180, 0.08)',
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
    bottom: 0,
    left: 0,
    right: 80,
    // SHORTS_ITEM_HEIGHT already excludes TAB_BAR_HEIGHT, so only a small
    // padding is needed to keep content off the very bottom edge
    paddingBottom: Platform.OS === 'ios' ? (isWeb ? 16 : 96) : (isWeb ? 16 : 86),
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
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
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
    height: Platform.OS === 'ios' ? 100 : 80,
    zIndex: 100,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
    height: '100%',
    width: '100%',
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
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
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  progressBarBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressBarFill: {
    height: 10,
  },
});
