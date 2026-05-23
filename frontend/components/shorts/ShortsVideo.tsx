import React, { useRef, useState, useEffect, memo, useCallback, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Image, TouchableOpacity, Text, Dimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Video, { VideoRef } from 'react-native-video';
import logger from '../../utils/logger';

interface ShortsVideoProps {
  videoId: string;
  videoUrl: string;
  imageUrl?: string;
  isActive: boolean;
  shouldRender: boolean;
  isMuted: boolean;
  volume: number;
  sourceVersion?: number;
  onReady?: () => void;
  onError?: (error: any) => void;
  onProgress?: (progress: { currentTime: number; seekableDuration: number }) => void;
}

const ShortsVideo = ({
  videoId,
  videoUrl,
  imageUrl,
  isActive,
  shouldRender,
  isMuted,
  volume,
  sourceVersion = 0,
  onReady,
  onError,
  onProgress,
}: ShortsVideoProps) => {
  const videoRef = useRef<VideoRef>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showPoster, setShowPoster] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

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

  // DETAILED LOGGING: Track first 2 shorts
  const isFirstTwoShorts = videoId && videoId.length > 0 && Math.random() < 0.4; // Rough heuristic
  
  // Log on mount and unmount
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
      logger.info(`[ShortsVideo] Component unmounted / cleaning up for video ${videoId}`);
    };
  }, [videoId]);

  // Reset ready state when videoUrl or sourceVersion changes (remount/source change)
  useEffect(() => {
    if (videoUrl) {
      logger.debug(`[ShortsVideo] videoUrl changed for ${videoId}, resetting state`);
    } else {
      logger.warn(`[ShortsVideo] videoUrl is EMPTY for ${videoId}, cannot play`);
    }
    setIsReady(false);
    setHasError(false);
    setShowPoster(true);
  }, [videoUrl, sourceVersion, videoId]);

  // Handle active status to control play/pause
  const isPaused = !isActive;

  const handleReadyForDisplay = useCallback(() => {
    if (!isReady) {
      setIsReady(true);
      setShowPoster(false);
      if (onReady) {
        onReady();
      }
      logger.debug(`[ShortsVideo] Video ${videoId} is ready for display`);
    }
  }, [isReady, videoId, onReady]);

  const handleVideoError = useCallback((error: any) => {
    logger.error(`[ShortsVideo] Error playing video ${videoId}:`, {
      error,
      videoUrl: videoUrl ? videoUrl.substring(0, 80) : 'EMPTY',
      timestamp: new Date().toISOString()
    });
    setHasError(true);
    if (onError) {
      onError(error);
    }
  }, [videoId, videoUrl, onError]);

  const handleRetry = useCallback(() => {
    logger.debug(`[ShortsVideo] Retrying video ${videoId} (attempt ${retryCount + 1})`);
    setHasError(false);
    setIsReady(false);
    setShowPoster(true);
    setRetryCount(retryCount + 1);
  }, [videoId, retryCount]);

  const handlePlaybackStatusUpdate = useCallback((status: any) => {
    if (status.isLoaded && onProgress) {
      onProgress({
        currentTime: (status.currentTime || 0) / 1000,
        seekableDuration: (status.duration || 0) / 1000,
      });
    }
  }, [onProgress]);

  return (
    <View style={styles.container}>
      {/* Thumbnail backdrop shown until video is ready — prevents black flash */}
      {showPoster && imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : showPoster ? (
        <View style={[StyleSheet.absoluteFill, styles.loaderContainer]}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
        </View>
      ) : null}

      {/* Error state — show instead of black screen */}
      {hasError && (
        <View style={[StyleSheet.absoluteFill, styles.errorContainer]}>
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
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={videoStyle}
          resizeMode="cover"
          repeat={true}
          paused={isPaused}
          muted={false}
          volume={1.0}
          onReadyForDisplay={handleReadyForDisplay}
          onError={handleVideoError}
          onProgress={handlePlaybackStatusUpdate}
          onLoad={handleLoad}
          bufferConfig={{
            minBufferMs: 2500,
            maxBufferMs: 10000,
            bufferForPlaybackMs: 1000,
            bufferForPlaybackAfterRebufferMs: 2000,
          }}
          ignoreSilentSwitch="obey"
          playInBackground={false}
          playWhenInactive={false}
          progressUpdateInterval={500}
        />
      )}

      {/* Spinner visible during the loading phase */}
      {shouldRender && !isReady && !hasError && (
        <View style={[StyleSheet.absoluteFill, styles.loaderContainer, { backgroundColor: 'transparent' }]}>
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
    zIndex: 10,
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
