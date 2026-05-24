import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useRecoilState, useRecoilValue } from 'recoil';
import { PostType } from '../../types/post';
import ShortsVideo from './ShortsVideo';
import ShortsActions from './ShortsActions';
import ShortsOverlay from './ShortsOverlay';
import logger from '../../utils/logger';
import { trackPostView } from '../../services/analytics';
import { activeShortIndexAtom, videoPlayingFamily, videoReadyFamily } from '../../app/(tabs)/shorts';

interface ShortsCellProps {
  item: PostType;
  index: number;
  isScreenFocused: boolean;
  currentUser: any;
  isFollowing: boolean;
  isSaved: boolean;
  isMuted: boolean;
  actionLoading: boolean;
  sourceVersion?: number;
  getVideoUrl: (item: PostType) => string;
  onProfilePress: (userId: string) => void;
  onLikePress: (shortId: string) => void;
  onCommentPress: (shortId: string) => void;
  onSharePress: (short: PostType) => void;
  onSavePress: (shortId: string) => void;
  onDeletePress: (shortId: string) => void;
  onLocationPress: (address: string) => void;
  onSongPlayingChange: (sound: any) => void;
  onTouchStart: (e: any) => void;
  onTouchMove: (e: any) => void;
  onTouchEnd: (e: any, userId: string) => void;
  videoRefCallback?: (ref: any) => void;
  onError: (shortId: string, error: any) => void;
}

const ShortsCell = ({
  item,
  index,
  isScreenFocused,
  currentUser,
  isFollowing,
  isSaved,
  isMuted,
  actionLoading,
  sourceVersion = 0,
  getVideoUrl,
  onProfilePress,
  onLikePress,
  onCommentPress,
  onSharePress,
  onSavePress,
  onDeletePress,
  onLocationPress,
  onSongPlayingChange,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  videoRefCallback,
  onError,
}: ShortsCellProps) => {
  const [showPauseButton, setShowPauseButton] = useState(false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [localSourceVersion, setLocalSourceVersion] = useState(sourceVersion);
  const likeAnimValue = useRef(new Animated.Value(0)).current;
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cacheRetryCountRef = useRef<number>(0);
  
  const [views, setViews] = useState(item.viewsCount || (item as any).views || 0);
  const hasViewedRef = useRef(false);
  const viewTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Recoil playback decoupling
  const activeIndex = useRecoilValue(activeShortIndexAtom);
  const [videoPlaying, setVideoPlaying] = useRecoilState(videoPlayingFamily(item._id));
  const videoReady = useRecoilValue(videoReadyFamily(item._id));

  const isActive = index === activeIndex && isScreenFocused;

  // Sync views count state when active item changes
  useEffect(() => {
    setViews(item.viewsCount || (item as any).views || 0);
    hasViewedRef.current = false;
  }, [item._id]);

  // Track video view when playing actively for 2.5 seconds
  useEffect(() => {
    const isActivelyPlaying = isActive && videoPlaying;

    if (isActivelyPlaying && !hasViewedRef.current) {
      viewTimerRef.current = setTimeout(() => {
        hasViewedRef.current = true;
        trackPostView(item._id, { type: 'short', source: 'shorts_feed' });
        setViews(prev => prev + 1);
      }, 2500);
    } else {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
    }

    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
    };
  }, [isActive, videoPlaying, item._id]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
      }
    };
  }, []);

  // Handle video errors and trigger recovery
  const handleVideoError = useCallback((error: any) => {
    logger.error(`[ShortsCell] Video error for ${item._id}:`, error);
    
    const isCacheMissError = 
      error?.message?.toLowerCase().includes('cache') ||
      error?.message?.toLowerCase().includes('not found') ||
      error?.message?.toLowerCase().includes('file') ||
      error?.message?.toLowerCase().includes('enoent');
    
    if (isCacheMissError && cacheRetryCountRef.current < 2) {
      logger.debug(`[ShortsCell] Cache miss detected, triggering re-download (attempt ${cacheRetryCountRef.current + 1})`);
      cacheRetryCountRef.current += 1;
      setLocalSourceVersion(prev => prev + 1);
    } else {
      cacheRetryCountRef.current = 0;
      onError(item._id, error);
    }
  }, [item._id, onError]);

  const toggleVideoPlayback = () => {
    const nextPlaying = !videoPlaying;
    setVideoPlaying(nextPlaying);
    showPauseButtonTemporarily();
  };

  const showPauseButtonTemporarily = () => {
    setShowPauseButton(true);
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
    }
    pauseTimerRef.current = setTimeout(() => {
      setShowPauseButton(false);
    }, 800);
  };

  const handleDoubleTapLike = () => {
    if (!item.isLiked) {
      onLikePress(item._id);
    }
    
    setShowLikeAnimation(true);
    likeAnimValue.setValue(0);
    Animated.sequence([
      Animated.spring(likeAnimValue, {
        toValue: 1.2,
        tension: 140,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.delay(300),
      Animated.timing(likeAnimValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowLikeAnimation(false);
    });
  };

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      runOnJS(handleDoubleTapLike)();
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onStart(() => {
      runOnJS(toggleVideoPlayback)();
    });

  const longPressGesture = Gesture.LongPress()
    .onStart(() => {
      if (item.user._id === currentUser?._id) {
        runOnJS(onDeletePress)(item._id);
      }
    });

  const composedGesture = Gesture.Race(
    Gesture.Exclusive(doubleTapGesture, singleTapGesture),
    longPressGesture
  );

  const handleVideoProgress = () => {
    // Progress callback can be used for syncing if needed
  };

  const likeOpacity = likeAnimValue.interpolate({
    inputRange: [0, 0.5, 1, 1.2],
    outputRange: [0, 0.4, 0.5, 0.5],
  });

  const likeScale = likeAnimValue.interpolate({
    inputRange: [0, 0.5, 1, 1.2],
    outputRange: [0.3, 0.8, 1, 1.2],
  });

  return (
    <View style={styles.container}>
      <View
        style={styles.videoContainer}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={(e) => onTouchEnd(e, item.user._id)}
      >
        <GestureDetector gesture={composedGesture}>
          <View 
            style={StyleSheet.absoluteFill}
            accessible={true}
            accessibilityLabel="Tap to play or pause video, double tap to like"
            accessibilityRole="button"
          >
            <ShortsVideo
              videoId={item._id}
              videoUrl={getVideoUrl(item)}
              imageUrl={item.imageUrl}
              index={index}
              isMuted={!isActive || !!item.song?.songId?._id || isMuted}
              volume={item.song?.songId?._id ? 0.0 : 1.0}
              sourceVersion={localSourceVersion}
              videoRefCallback={videoRefCallback}
              onError={handleVideoError}
            />
          </View>
        </GestureDetector>
      </View>

      <ShortsOverlay
        post={item}
        isActive={isActive}
        isVideoPlaying={videoPlaying}
        isFollowing={isFollowing}
        isScreenFocused={isScreenFocused}
        isMuted={isMuted}
        onProfilePress={onProfilePress}
        onLocationPress={onLocationPress}
        onSongPlayingChange={onSongPlayingChange}
      />

      <ShortsActions
        shortId={item._id}
        userId={item.user._id}
        username={item.user.username || ''}
        profilePic={item.user.profilePic}
        isLiked={item.isLiked || false}
        likesCount={item.likesCount || 0}
        commentsCount={item.commentsCount || 0}
        isSaved={isSaved}
        isFollowing={isFollowing}
        isOwn={item.user._id === currentUser?._id}
        actionLoading={actionLoading}
        onProfilePress={onProfilePress}
        onLikePress={onLikePress}
        onCommentPress={onCommentPress}
        onSharePress={() => onSharePress(item)}
        onSavePress={onSavePress}
      />

      {showLikeAnimation && (
        <Animated.View
          style={[
            styles.likeAnimationContainer,
            {
              opacity: likeOpacity,
              transform: [{ scale: likeScale }],
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="heart" size={80} color="#FF3040" />
        </Animated.View>
      )}

      {showPauseButton && (
        <View style={styles.playButton} pointerEvents="none">
          <View style={styles.playButtonBlur}>
            <Ionicons name={videoPlaying ? 'pause' : 'play'} size={50} color="white" />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  likeAnimationContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  playButton: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  playButtonBlur: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
});

export default memo(ShortsCell);
