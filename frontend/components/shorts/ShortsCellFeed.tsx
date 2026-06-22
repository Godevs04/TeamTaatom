import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageStyle,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
  Animated,
  AppStateStatus,
  Pressable,
  ActivityIndicator,
  Easing,
  FlatList,
} from 'react-native';
import { Video, ResizeMode, Audio, AVPlaybackStatus } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useRouter } from 'expo-router';
import LoadingGlobe from '../LoadingGlobe';

// Imports with rewritten relative paths (added an extra parent folder level)
import { useTheme } from '../../context/ThemeContext';
import { getPostById, getPostLikers } from '../../services/posts';
import { getProfile } from '../../services/profile';
import { PostType } from '../../types/post';
import { useAlert } from '../../context/AlertContext';
import PostComments from '../post/PostComments';
import { createLogger } from '../../utils/logger';
import SongPlayer from '../SongPlayer';
import { GlassModal } from '../ui/GlassModal';
import { theme } from '../../constants/theme';
import { audioManager } from '../../utils/audioManager';
import PostLocation from '../post/PostLocation';
import { geocodeAddress } from '../../utils/locationUtils';
import { ErrorBoundary } from '../../utils/errorBoundary';
import { savedEvents } from '../../utils/savedEvents';
import { triggerHaptic } from '../../utils/hapticFeedback';
import { shortsEvents } from '../../utils/shortsEvents';
import { getLocalVideoUriSync } from '../../src/utils/videoCache';

import { MarqueeText } from './MarqueeText';
import { CyclingMetadata } from './CyclingMetadata';

// Constants and utility functions required by the cell
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) {
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    return 'System';
  }
  return 'Roboto';
};

const TAB_BAR_HEIGHT = isWeb ? 70 : 88;
const SHORTS_ITEM_HEIGHT = SCREEN_HEIGHT;
const logger = createLogger('ShortsCellFeed');

const getScaledVideoDimensions = (width: number, height: number) => {
  const targetRatio = 9 / 16;
  const currentRatio = width / height;
  
  if (currentRatio > targetRatio) {
    const videoHeight = height;
    const videoWidth = height * targetRatio;
    return { width: videoWidth, height: videoHeight };
  } else {
    const videoWidth = width;
    const videoHeight = width / targetRatio;
    return { width: videoWidth, height: videoHeight };
  }
};

const videoSourceCache = new Map();
const getVideoSource = (uri) => {
  if (!uri) return undefined;
  if (!videoSourceCache.has(uri)) {
    const lowercaseUrl = uri.toLowerCase();
    const ext = (lowercaseUrl.includes('m3u8') || lowercaseUrl.includes('hls')) ? 'm3u8' : 'mp4';
    videoSourceCache.set(uri, { uri, overrideFileExtensionAndroid: ext });
  }
  return videoSourceCache.get(uri);
};

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

// Extracted cell block
interface ShortsCellProps {
  item: PostType;
  index: number;
  isActive: boolean;
  shouldPreload: boolean;
  shouldRenderVideo: boolean;
  isVideoPlaying: boolean;
  isScreenFocused: boolean;
  isMuted: boolean;
  currentUser: any;
  containerHeight: number;
  isFollowing: boolean;
  isSaved: boolean;
  isLiked: boolean;
  localVideoUri?: string;
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

export const ShortsCell = React.memo((props: ShortsCellProps) => {
  const {
    item,
    index,
    isActive,
    shouldPreload,
    shouldRenderVideo,
    isVideoPlaying,
    isScreenFocused,
    isMuted: isMutedProp,
    currentUser,
    containerHeight,
    isFollowing,
    isSaved,
    isLiked,
    localVideoUri,
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
  // BUG 15: Animated opacity for crossfade from thumbnail -> video
  const videoOpacity = useRef(new Animated.Value(0)).current;

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      if (likeAnimTimeoutRef.current) clearTimeout(likeAnimTimeoutRef.current);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, []);

  // BUG 15: Reset video ready state & opacity when cell is recycled for a new item
  useEffect(() => {
    setVideoReady(false);
    videoOpacity.setValue(0);
  }, [item._id]);

  // Reset ready state when shouldRenderVideo changes to false (unmounted)
  useEffect(() => {
    if (!shouldRenderVideo) {
      setVideoReady(false);
      videoOpacity.setValue(0);
    }
  }, [shouldRenderVideo]);

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
      video.playAsync().then(() => {
        setIsPlaying(true);
      }).catch(() => {});
    } else {
      video.pauseAsync().then(() => {
        setIsPlaying(false);
      }).catch(() => {});
    }
  }, [shouldPlay, isActive]);

  // Sync native video player's mute/volume when isMuted, isActive, or song changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const hasMusic = !!(item.song?.songId?._id || item.song?.songId);
    const shouldMuteVideo = !isActive || hasMusic || isMuted;
    video.setIsMutedAsync(shouldMuteVideo).catch(() => {});
    video.setVolumeAsync(shouldMuteVideo ? 0.0 : 1.0).catch(() => {});
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

  const isCellVideoPlaying = isPlaying && isVideoPlaying;
  const isOwn = item.user._id === currentUser?._id;
  const isScopedView = !!effectiveUserId || isSavedShorts;
  const progressBottom = Platform.OS === 'web' ? 8 : 77;
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
            { bottom: 0 }
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
            <View style={StyleSheet.absoluteFillObject}>
              {(item.thumbnailUrl || item.imageUrl) ? (
                <ExpoImage
                  source={{ uri: item.thumbnailUrl || item.imageUrl }}
                  style={[styles.shortVideo as ImageStyle, StyleSheet.absoluteFillObject]}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  transition={0}
                  onError={(e: any) => logger.warn('[shorts thumbnail] load failed', {
                    shortId: item._id,
                    url: (item.thumbnailUrl || item.imageUrl)?.substring(0, 120),
                    error: e?.error || e?.nativeEvent?.error || String(e),
                  })}
                />
              ) : (
                <View style={[styles.shortVideo, StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
                  <LoadingGlobe size="small" color="rgba(255,255,255,0.6)" />
                </View>
              )}
              {shouldRenderVideo && (
                // BUG 15: Wrap in Animated.View — opacity crossfades thumbnail->video;
                // translateY keeps the native SurfaceView off-screen until first frame ready
                // so the black punch-through never shows over the thumbnail.
                <Animated.View
                  style={[
                    styles.shortVideo,
                    StyleSheet.absoluteFillObject,
                    {
                      opacity: videoOpacity,
                      transform: [{ translateY: videoReady ? 0 : 9999 }],
                    },
                  ]}
                  pointerEvents={videoReady ? 'none' : 'none'}
                >
                <MemoizedVideo
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
                style={[styles.shortVideo, StyleSheet.absoluteFillObject]}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={shouldPlay}
                isLooping
                progressUpdateIntervalMillis={100}
                isMuted={!isActive || !!(item.song?.songId?._id || item.song?.songId) || isMuted}
                volume={(!!(item.song?.songId?._id || item.song?.songId) || isMuted) ? 0.0 : 1.0}
                onLoadStart={() => {
                  logger.debug(`Video ${item._id} load started, index: ${index}, isActive: ${isActive}`);
                }}
                onReadyForDisplay={() => {
                  logger.debug(`Video ${item._id} ready for display`);
                  setVideoReady(true);
                  // BUG 15: Crossfade the video in over 200ms
                  Animated.timing(videoOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                  }).start();
                  if (handlers.onVideoReady) {
                    handlers.onVideoReady(item._id);
                  }
                }}
                onError={(error) => {
                  logger.error(`Video ${item._id} failed to load:`, error);
                  videoCacheRef.current.delete(item._id);
                  if (localVideoUri) {
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
                    
                    if (isNowPlaying && isActive && status.positionMillis !== undefined) {
                      const lastPos = lastVideoPositionRef.current[item._id] ?? 0;
                      const curPos = status.positionMillis;
                      if (lastPos > 500 && curPos < lastPos - 500) {
                        const audio = audioManager.getCurrentSound() || currentPlayerRef.current;
                        if (hasMusic && audio) {
                          const startSec = item.song?.startTime || 0;
                          const endSec = item.song?.endTime;
                          const songStartMs = startSec * 1000;
                          const segmentMs = endSec && endSec > startSec ? (endSec - startSec) * 1000 : 60000;
                          const audioOffsetMs = curPos % segmentMs;
                          audio.setPositionAsync(songStartMs + audioOffsetMs).catch(() => {});
                        }
                      }
                      lastVideoPositionRef.current[item._id] = curPos;
                    }
                    
                    if (isNowPlaying !== wasPlaying) {
                      logger.debug(`Video ${item._id} playing status changed: ${isNowPlaying}`);
                      setIsPlaying(isNowPlaying);

                      if (isNowPlaying && isActive) {
                        const audio = audioManager.getCurrentSound() || currentPlayerRef.current;
                        if (hasMusic && audio && status.positionMillis !== undefined) {
                          const startSec = item.song?.startTime || 0;
                          const endSec = item.song?.endTime;
                          const songStartMs = startSec * 1000;
                          const segmentMs = endSec && endSec > startSec ? (endSec - startSec) * 1000 : 60000;
                          const audioOffsetMs = status.positionMillis % segmentMs;
                          logger.debug(`Syncing audio position to video play transition offset: ${songStartMs + audioOffsetMs}`);
                          audio.setPositionAsync(songStartMs + audioOffsetMs).catch(() => {});
                        }
                      }
                    }
                  } else if ((status as any).error) {
                    logger.error(`Video ${item._id} playback error:`, (status as any).error);
                    if (isActive) {
                      videoCacheRef.current.delete(item._id);
                      if (localVideoUri) {
                        handlers.removeLocalVideoUri(item._id);
                      }
                    }
                  }
                }}
                onLoad={(status) => {
                  if (status.isLoaded) {
                    logger.debug(`Video ${item._id} loaded successfully, isPlaying: ${status.isPlaying}, shouldPlay: ${isActive}`);
                    setIsPlaying(status.isPlaying);
                    
                    const savedPos = lastVideoPositionRef.current[item._id];
                    const video = videoRef.current;
                    if (video && savedPos && savedPos > 0) {
                      logger.debug(`Seeking video ${item._id} to saved position: ${savedPos}`);
                      video.setPositionAsync(savedPos).catch((err) => {
                        logger.error(`Failed to seek video to saved position:`, err);
                      });
                    }

                    if (isActive && isScreenFocused && !userPaused) {
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
                </Animated.View>
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
                               photo: item.thumbnailUrl || item.imageUrl || '',
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
                    shouldPreload={shouldPreload}
                    autoPlay={isCellVideoPlaying}
                    externalMuted={isMuted}
                    onPlayingChange={handlers.handleSongPlayingChange}
                    getVideoPosition={() => lastVideoPositionRef.current[item._id] || 0}
                  />
                </View>
            )}
          </View>
        </View>
        {shouldRenderVideo && isActive && (
          <ShortsProgressBar
            shortId={item._id}
            index={index}
            isActive={isActive}
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

interface ShortsProgressBarProps {
  shortId: string;
  index: number;
  isActive: boolean;
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
  isActive,
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

  const progressRef = useRef(0);
  const durationRef = useRef(0);

  const lastSeekTimeRef = useRef(0);
  const pendingSeekTimeoutRef = useRef<any>(null);
  const isPressingRef = useRef(false);

  const lastTouchTimeRef = useRef(0);
  const lastTouchXRef = useRef(0);
  const lastHapticProgressRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      progressRef.current = 0;
      return;
    }

    progressCallbacks.current[shortId] = (pos: number, dur: number) => {
      setDuration(dur);
      durationRef.current = dur;
      if (dur > 0 && !isPressingRef.current) {
        const newProg = pos / dur;
        setProgress(newProg);
        progressRef.current = newProg;
      }
    };

    return () => {
      delete progressCallbacks.current[shortId];
      if (pendingSeekTimeoutRef.current) {
        clearTimeout(pendingSeekTimeoutRef.current);
      }
    };
  }, [shortId, index, isActive]);

  const handleTouch = (event: any, forceSeek = false) => {
    if (durationRef.current <= 0) return;
    
    const pageX = event.nativeEvent.pageX;
    const leftOffset = (SCREEN_WIDTH - 226) / 2;
    const newProgress = Math.max(0, Math.min(1, (pageX - leftOffset) / 226));
    setProgress(newProgress);
    progressRef.current = newProgress;

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

    const targetMs = newProgress * durationRef.current;
    
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
        // Fast seek always, no tolerance parameters to avoid UI freeze/stutter
        video.setPositionAsync(targetMs).catch(() => {});
      }
      const audio = hasMusic ? (audioManager.getCurrentSound() || currentPlayerRef.current) : null;
      if (forceSeek && audio) {
        audio.setPositionAsync(finalAudioMs).catch(() => {});
      }
      // Update last video position immediately to prevent false loop detection triggers
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
      style={styles.progressBarContainer}
      onTouchStart={(e) => {
        setIsPressing(true);
        isPressingRef.current = true;
        triggerHaptic('medium');
        
        // Pause players immediately when dragging starts to prevent auditory stuttering and visual racing
        const video = getVideoRef();
        if (video) {
          video.pauseAsync().catch(() => {});
        }
        const audio = hasMusic ? (audioManager.getCurrentSound() || currentPlayerRef.current) : null;
        if (audio) {
          audio.pauseAsync().catch(() => {});
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
        
        // Calculate final exact seek coordinates on release using refs to ensure accurate coordinates
        const finalTargetMs = progressRef.current * durationRef.current;
        const startSec = songStartSec || 0;
        const endSec = songEndSec;
        const songStartMs = startSec * 1000;
        const segmentMs = endSec && endSec > startSec ? (endSec - startSec) * 1000 : 60000;
        const audioOffsetMs = finalTargetMs % segmentMs;
        const finalAudioMs = songStartMs + audioOffsetMs;

        const video = getVideoRef();
        
        // Seek to final precise destination simultaneously and resume play smoothly
        const executeFinalSeekAndPlay = async () => {
          const video = getVideoRef();
          const audio = hasMusic ? (audioManager.getCurrentSound() || currentPlayerRef.current) : null;

          try {
            // Pause explicitly first to reset players stream state (prevents stale buffer playing)
            if (video) {
              await video.pauseAsync().catch(() => {});
            }
            if (audio) {
              await audio.pauseAsync().catch(() => {});
            }

            // Update last video position immediately to prevent false loop detection triggers
            lastVideoPositionRef.current[shortId] = finalTargetMs;

            // Wait for both seeks to complete (ignoring individual catch rejections so one doesn't abort the other)
            await Promise.all([
              video ? video.setPositionAsync(finalTargetMs).catch((err) => logger.error("Final video seek failed:", err)) : Promise.resolve(),
              audio ? audio.setPositionAsync(finalAudioMs).catch((err) => logger.error("Final audio seek failed:", err)) : Promise.resolve(),
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

export const emitLikeRailState = (shortId: string, isLiked: boolean) => {
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
      const response = await getPostLikers(shortId, 1, 100);
      const likersList = response?.likers || (response as any)?.data?.likers || [];
      setLikers(likersList);
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
      <View style={styles.rightActions} pointerEvents="box-none">
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

// Extracted styles block
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
