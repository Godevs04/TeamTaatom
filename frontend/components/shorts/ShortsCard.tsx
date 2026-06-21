import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import FastImage from '../ui/FastImage';
import { optimizeCloudinaryUrl } from '../../utils/imageCache';
import ShortsCell from './ShortsCell';
import { PostType } from '../../types/post';
import { formatViewCount } from '../../utils/numberFormat';

const { width: screenWidth } = Dimensions.get('window');
const GRID_GAP = 2;
const horizontalPadding = 0;
const profileColumnWidth = (screenWidth - (horizontalPadding * 2) - (GRID_GAP * 2)) / 3;

interface ShortsCardProps {
  item: PostType;
  isThumbnail?: boolean;
  isSelected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  showBookmark?: boolean;
  profileTheme?: any;
  style?: StyleProp<ViewStyle>;
  
  // Scoped props for full screen ShortsCell mode (isThumbnail = false)
  index?: number;
  currentVisibleIndex?: number;
  isScreenFocused?: boolean;
  currentUser?: any;
  isFollowing?: boolean;
  isSaved?: boolean;
  isMuted?: boolean;
  actionLoading?: boolean;
  sourceVersion?: number;
  getVideoUrl?: (item: PostType) => string;
  onProfilePress?: (userId: string) => void;
  onLikePress?: (shortId: string) => void;
  onCommentPress?: (shortId: string) => void;
  onSharePress?: (short: PostType) => void;
  onSavePress?: (shortId: string) => void;
  onDeletePress?: (shortId: string) => void;
  onLocationPress?: (address: string) => void;
  onSongPlayingChange?: (sound: any) => void;
  onTouchStart?: (e: any) => void;
  onTouchMove?: (e: any) => void;
  onTouchEnd?: (e: any, userId: string) => void;
  videoReady?: boolean;
  onVideoReady?: (shortId: string) => void;
  videoPlaying?: boolean;
  onVideoPlaybackChange?: (shortId: string, isPlaying: boolean) => void;
  videoRefCallback?: (ref: any) => void;
  onError?: (shortId: string, error: any) => void;
}

export default function ShortsCard({
  item,
  isThumbnail = false,
  isSelected = false,
  onPress,
  onLongPress,
  showBookmark = false,
  profileTheme = {},
  style,
  
  // Full player pass-through props
  index = 0,
  currentVisibleIndex = 0,
  isScreenFocused = false,
  currentUser,
  isFollowing = false,
  isSaved = false,
  isMuted = false,
  actionLoading = false,
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
  videoReady = false,
  onVideoReady,
  videoPlaying = false,
  onVideoPlaybackChange,
  videoRefCallback,
  onError,
}: ShortsCardProps) {
  const [hasFailed, setHasFailed] = useState(false);

  // Sync failed state on item changes (recycling list items)
  useEffect(() => {
    setHasFailed(false);
  }, [item._id]);

  if (!isThumbnail) {
    if (!getVideoUrl || !onProfilePress || !onLikePress || !onCommentPress || !onSharePress || !onSavePress || !onDeletePress || !onLocationPress || !onSongPlayingChange || !onTouchStart || !onTouchMove || !onTouchEnd || !onVideoReady || !onVideoPlaybackChange || !onError) {
      // In case we are missing standard player props, render a fallback player or placeholder
      return (
        <View style={[styles.container, styles.fullPlayerFallback, style]}>
          <Ionicons name="videocam" size={48} color="#fff" />
          <Text style={styles.fallbackText}>Shorts Player Unavailable</Text>
        </View>
      );
    }

    return (
      <ShortsCell
        item={item}
        index={index}
        currentVisibleIndex={currentVisibleIndex}
        isScreenFocused={isScreenFocused}
        currentUser={currentUser}
        isFollowing={isFollowing}
        isSaved={isSaved}
        isMuted={isMuted}
        actionLoading={actionLoading}
        sourceVersion={sourceVersion}
        getVideoUrl={getVideoUrl}
        onProfilePress={onProfilePress}
        onLikePress={onLikePress}
        onCommentPress={onCommentPress}
        onSharePress={onSharePress}
        onSavePress={onSavePress}
        onDeletePress={onDeletePress}
        onLocationPress={onLocationPress}
        onSongPlayingChange={onSongPlayingChange}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        videoReady={videoReady}
        onVideoReady={onVideoReady}
        videoPlaying={videoPlaying}
        onVideoPlaybackChange={onVideoPlaybackChange}
        videoRefCallback={videoRefCallback}
        onError={onError}
      />
    );
  }

  // Helper function to check if URL represents video files
  const isVideo = (url: any) => {
    if (typeof url !== 'string') return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    
    // If the URL has a common image extension, it's not a video
    if (
      cleanUrl.endsWith('.jpg') ||
      cleanUrl.endsWith('.jpeg') ||
      cleanUrl.endsWith('.png') ||
      cleanUrl.endsWith('.webp') ||
      cleanUrl.endsWith('.gif') ||
      cleanUrl.endsWith('.heic')
    ) {
      return false;
    }

    return (
      cleanUrl.endsWith('.mp4') ||
      cleanUrl.endsWith('.mov') ||
      cleanUrl.endsWith('.m4v') ||
      cleanUrl.endsWith('.webm') ||
      cleanUrl.endsWith('.m3u8') ||
      cleanUrl.includes('/videos/') ||
      cleanUrl.includes('/shorts/') ||
      url === (item as any).videoUrl
    );
  };

  const itemAny = item as any;
  const rawUri =
    item.imageUrl && !isVideo(item.imageUrl)
      ? item.imageUrl
      : itemAny.thumbnailUrl && !isVideo(itemAny.thumbnailUrl)
      ? itemAny.thumbnailUrl
      : '';
  const uri = rawUri ? optimizeCloudinaryUrl(rawUri, { width: 300, height: 300 }) : '';

  const cardBg = profileTheme.cardBg || '#121212';
  const gapBorderColor = profileTheme.gapBorderColor || 'transparent';
  const textSecondary = profileTheme.textSecondary || 'rgba(255,255,255,0.6)';

  return (
    <Pressable
      style={[
        styles.postThumbnail,
        {
          backgroundColor: cardBg,
          borderColor: isSelected ? '#1C73B4' : gapBorderColor,
        },
        style,
      ]}
      onLongPress={onLongPress}
      onPress={onPress}
    >
      {uri && !hasFailed ? (
        <FastImage
          source={{ uri }}
          style={styles.thumbnailImage as any}
          contentFit="cover"
          onError={() => setHasFailed(true)}
        />
      ) : (
        <View style={[styles.placeholderThumbnail, { backgroundColor: cardBg + '80' }]}>
          <Ionicons name="videocam-outline" size={28} color={textSecondary} />
        </View>
      )}

      {/* Center Play Icon Overlay */}
      <View style={[styles.playIconOverlay, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
        <Ionicons name="play" size={22} color="#FFFFFF" />
      </View>

      {/* Bookmark Overlay for Saved Shorts */}
      {showBookmark && (
        <View style={[styles.bookmarkOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <Ionicons name="bookmark" size={16} color="#FFFFFF" />
        </View>
      )}

      {/* View count overlay — bottom-left */}
      <View style={styles.viewCountOverlay}>
        <Ionicons name="eye-outline" size={11} color="#FFFFFF" />
        <Text style={styles.viewCountText}>
          {formatViewCount((item as any).viewsCount)}
        </Text>
      </View>

      {/* Selection Overlay */}
      {isSelected && (
        <View style={[styles.selectionOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.4)' }]}>
          <View style={styles.checkmarkCircle}>
            <LinearGradient
              colors={['#1C73B4', '#50C878']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    width: '100%',
    backgroundColor: '#000',
  },
  fullPlayerFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  postThumbnail: {
    width: profileColumnWidth,
    aspectRatio: 9 / 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -24 }, { translateY: -24 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  bookmarkOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  viewCountOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 20,
  },
  viewCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  checkmarkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
