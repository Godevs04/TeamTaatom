import React, { useRef, useState, useEffect, memo, useCallback, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Image, TouchableOpacity, Text, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import logger from '../../utils/logger';
import { activeShortIndexAtom, videoPlayingFamily, videoReadyFamily, videoBufferingFamily } from '../../app/(tabs)/shorts';

interface ShortsVideoProps {
  videoId: string;
  videoUrl: string;
  imageUrl?: string;
  index: number;
  isMuted: boolean;
  volume: number;
  sourceVersion?: number;
  videoRefCallback?: (ref: Video | null) => void;
  onError?: (error: any) => void;
}

const ShortsVideo = ({
  videoId,
  videoUrl,
  imageUrl,
  index,
  isMuted,
  volume,
  sourceVersion = 0,
  videoRefCallback,
  onError,
}: ShortsVideoProps) => {
  const [showPoster, setShowPoster] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [hasError, setHasError] = useState(false);
  const posterOpacity = useRef(new Animated.Value(1)).current;
  const lastVideoRef = useRef<Video | null>(null);

  // Recoil states
  const activeIndex = useRecoilValue(activeShortIndexAtom);
  const isPlaying = useRecoilValue(videoPlayingFamily(videoId));
  const setVideoReady = useSetRecoilState(videoReadyFamily(videoId));
  const setVideoBuffering = useSetRecoilState(videoBufferingFamily(videoId));
  const isBuffering = useRecoilValue(videoBufferingFamily(videoId));
  const isReady = useRecoilValue(videoReadyFamily(videoId));

  const shouldRender = Math.abs(index - activeIndex) <= 2;
  const isActive = index === activeIndex && isPlaying;

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  const videoStyle = useMemo(() => {
    if (!aspectRatio) {
      return StyleSheet.absoluteFillObject;
    }
    const containerRatio = screenWidth / screenHeight;
    if (aspectRatio < containerRatio) {
      return {
        position: 'absolute' as const,
        height: '100%' as const,
        aspectRatio,
        alignSelf: 'center' as const,
      };
    } else {
      return {
        position: 'absolute' as const,
        width: '100%' as const,
        aspectRatio,
        alignSelf: 'center' as const,
      };
    }
  }, [aspectRatio, screenWidth, screenHeight]);

  const handleLoad = useCallback((data: any) => {
    if (data?.naturalSize) {
      const { width, height } = data.naturalSize;
      if (width && height) {
        setAspectRatio(width / height);
        logger.debug(`[ShortsVideo] Video metadata loaded for ${videoId}. naturalSize: ${width}x${height}, ratio: ${width / height}`);
      }
    }
  }, [videoId]);

  // Log on mount and unmount & handle explicit unloadAsync on unmount
  useEffect(() => {
    logger.info(`[ShortsVideo] Component mounted for video ${videoId}:`, {
      videoUrl: videoUrl ? videoUrl.substring(0, 80) : 'EMPTY',
      imageUrl: imageUrl ? imageUrl.substring(0, 80) : 'EMPTY',
      isActive,
      shouldRender,
      sourceVersion,
      timestamp: new Date().toISOString()
    });
    
    return () => {
      logger.info(`[ShortsVideo] Component unmounting/cleaning up for video ${videoId}`);
      const videoToUnload = lastVideoRef.current;
      if (videoToUnload) {
        logger.debug(`[ShortsVideo] Unmounting: calling unloadAsync for ${videoId}`);
        videoToUnload.unloadAsync().catch(err => {
          logger.debug(`[ShortsVideo] Error unloading video ${videoId} on unmount (non-blocking):`, err);
        });
      }
      setVideoReady(false);
      setVideoBuffering(false);
    };
  }, [videoId]);

  // Reset ready state when videoUrl or sourceVersion changes (remount/source change)
  useEffect(() => {
    if (videoUrl) {
      logger.debug(`[ShortsVideo] videoUrl changed for ${videoId}, resetting state`);
    } else {
      logger.warn(`[ShortsVideo] videoUrl is EMPTY for ${videoId}, cannot play`);
    }
    setIsLoaded(false);
    setPositionMillis(0);
    setHasError(false);
    setShowPoster(true);
    posterOpacity.setValue(1);
    setVideoReady(false);
    setVideoBuffering(false);
  }, [videoUrl, sourceVersion, videoId]);

  // Virtualization cleanups: reset internal loader states when unrendered
  useEffect(() => {
    if (!shouldRender) {
      setIsLoaded(false);
      setPositionMillis(0);
      setShowPoster(true);
      posterOpacity.setValue(1);
      setVideoReady(false);
      setVideoBuffering(false);
    }
  }, [shouldRender]);

  const handleReadyForDisplay = useCallback(() => {
    setVideoReady(true);
    setVideoBuffering(false);
    logger.debug(`[ShortsVideo] Video ${videoId} is ready for display`);
  }, [videoId, setVideoReady, setVideoBuffering]);

  // Thumbnail visible computed state to prevent blank flashes
  const thumbnailVisible = !(isLoaded && positionMillis > 0);

  // Poster crossfade effect
  useEffect(() => {
    if (!thumbnailVisible) {
      Animated.timing(posterOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowPoster(false);
      });
    } else {
      setShowPoster(true);
      posterOpacity.setValue(1);
    }
  }, [thumbnailVisible]);

  const handleVideoError = useCallback((error: any) => {
    logger.error(`[ShortsVideo] Error playing video ${videoId}:`, {
      error,
      videoUrl: videoUrl ? videoUrl.substring(0, 80) : 'EMPTY',
      timestamp: new Date().toISOString()
    });
    setHasError(true);
    setVideoReady(false);
    setVideoBuffering(false);
    if (onError) {
      onError(error);
    }
  }, [videoId, videoUrl, onError, setVideoReady, setVideoBuffering]);

  const handleRetry = useCallback(() => {
    logger.debug(`[ShortsVideo] Retrying video ${videoId} (attempt ${retryCount + 1})`);
    setHasError(false);
    setIsLoaded(false);
    setPositionMillis(0);
    setShowPoster(true);
    posterOpacity.setValue(1);
    setVideoReady(false);
    setVideoBuffering(false);
    setRetryCount(retryCount + 1);
  }, [videoId, retryCount]);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoaded(true);
      setPositionMillis(status.positionMillis);
      setVideoBuffering(status.isBuffering);
    } else {
      setIsLoaded(false);
      const errStatus = status as any;
      if (errStatus.error) {
        handleVideoError(errStatus.error);
      }
    }
  }, [handleVideoError, setVideoBuffering]);

  return (
    <View style={styles.container}>
      {/* Thumbnail backdrop shown until video is ready — prevents black flash */}
      {showPoster && imageUrl ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: posterOpacity, zIndex: 2 }]}>
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        </Animated.View>
      ) : showPoster ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.loaderContainer, { opacity: posterOpacity, zIndex: 2 }]}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
        </Animated.View>
      ) : null}

      {/* Error state — show instead of black screen */}
      {hasError && (
        <View style={[StyleSheet.absoluteFill, styles.errorContainer, { zIndex: 4 }]}>
          <Ionicons name="alert-circle" size={48} color="rgba(255,255,255,0.7)" />
          <Text style={styles.errorText}>Failed to load video</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Video component - only rendered when shouldRender is true and no error */}
      {shouldRender && !hasError && (
        <Video
          ref={(ref) => {
            if (ref) {
              lastVideoRef.current = ref;
            } else {
              const videoToUnload = lastVideoRef.current;
              if (videoToUnload) {
                videoToUnload.pauseAsync()
                  .then(() => videoToUnload.unloadAsync())
                  .catch(err => logger.debug(`[ShortsVideo] Ref cleanup unload failed:`, err));
                lastVideoRef.current = null;
              }
            }
            if (videoRefCallback) {
              videoRefCallback(ref);
            }
          }}
          source={{
            uri: videoUrl,
            ...(videoUrl.includes('hls=master') || videoUrl.includes('.m3u8')
              ? { overrideFileExtensionOrMimeType: 'm3u8' }
              : {})
          }}
          style={videoStyle}
          resizeMode={ResizeMode.COVER}
          isLooping={true}
          shouldPlay={isActive}
          isMuted={isMuted}
          volume={volume}
          onReadyForDisplay={handleReadyForDisplay}
          onError={handleVideoError}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onLoad={handleLoad}
          onLoadStart={() => setVideoBuffering(true)}
          progressUpdateIntervalMillis={500}
        />
      )}

      {/* Spinner visible during the loading/buffering phase */}
      {shouldRender && (isBuffering || !isReady) && !hasError && (
        <View style={[StyleSheet.absoluteFill, styles.loaderContainer, { backgroundColor: 'transparent', zIndex: 3 }]}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  loaderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default memo(ShortsVideo);
