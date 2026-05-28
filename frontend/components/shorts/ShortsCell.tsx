import React, { memo, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { PostType } from '../../types/post';
import ShortsVideo from './ShortsVideo';
import ShortsOverlay from './ShortsOverlay';

const MemoizedShortsVideo = memo(
  ShortsVideo,
  (prevProps, nextProps) => {
    // Directive 2: Brutally restrict the comparator to only trigger on critical play, mute, or url changes
    return (
      prevProps.isActive === nextProps.isActive &&
      prevProps.isMuted === nextProps.isMuted &&
      prevProps.videoUrl === nextProps.videoUrl
    );
  }
);

interface ShortsCellProps {
  item: PostType;
  index: number;
  currentVisibleIndex: number;
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
  videoReady: boolean;
  onVideoReady: (shortId: string) => void;
  videoPlaying: boolean;
  onVideoPlaybackChange: (shortId: string, isPlaying: boolean) => void;
  videoRefCallback?: (ref: any) => void;
  onError: (shortId: string, error: any) => void;
}

const SHORTS_PRELOAD_WINDOW = 2; // Flagship ±2 preloading strategy

const ShortsCell = ({
  item,
  index,
  currentVisibleIndex,
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
  videoReady,
  onVideoReady,
  videoPlaying,
  onVideoPlaybackChange,
  videoRefCallback,
  onError,
}: ShortsCellProps) => {
  const distanceFromVisible = index - currentVisibleIndex;
  const shouldRenderVideo = Math.abs(distanceFromVisible) <= SHORTS_PRELOAD_WINDOW;
  const isActive = index === currentVisibleIndex && isScreenFocused;

  // Directive 1: Strict Prop Equality Enforcement
  // Wrap functions in useCallback and objects in useMemo

  const handleVideoReady = useCallback(() => {
    onVideoReady(item._id);
  }, [item._id, onVideoReady]);

  const handleVideoError = useCallback((error: any) => {
    onError(item._id, error);
  }, [item._id, onError]);

  const handleVideoProgress = useCallback(() => {
    // Loop syncing or time updates can go here if needed in future
  }, []);

  const videoUrl = useMemo(() => {
    return getVideoUrl(item);
  }, [getVideoUrl, item]);

  return (
    <View style={styles.container}>
      <View style={styles.videoContainer}>
        <MemoizedShortsVideo
          videoId={item._id}
          videoUrl={videoUrl}
          imageUrl={item.imageUrl}
          isActive={isActive && videoPlaying}
          shouldRender={shouldRenderVideo}
          isMuted={!isActive || !!item.song?.songId?._id}
          volume={item.song?.songId?._id ? 0.0 : 1.0}
          sourceVersion={sourceVersion}
          videoRefCallback={videoRefCallback}
          onReady={handleVideoReady}
          onError={handleVideoError}
          onProgress={handleVideoProgress}
        />
      </View>

      <ShortsOverlay
        post={item}
        isActive={isActive}
        videoPlaying={videoPlaying}
        onVideoPlaybackChange={onVideoPlaybackChange}
        isFollowing={isFollowing}
        isScreenFocused={isScreenFocused}
        isMuted={isMuted}
        onProfilePress={onProfilePress}
        onLocationPress={onLocationPress}
        onSongPlayingChange={onSongPlayingChange}
        currentUser={currentUser}
        isSaved={isSaved}
        actionLoading={actionLoading}
        onLikePress={onLikePress}
        onCommentPress={onCommentPress}
        onSharePress={onSharePress}
        onSavePress={onSavePress}
        onDeletePress={onDeletePress}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
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
});

export default memo(ShortsCell);
