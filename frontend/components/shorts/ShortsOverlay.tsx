import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, TouchableWithoutFeedback, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PostType } from '../../types/post';
import SongPlayer from '../SongPlayer';
import { useTheme } from '../../context/ThemeContext';
import { BlurView } from 'expo-blur';
import ShortsActions from './ShortsActions';

interface ShortsOverlayProps {
  post: PostType;
  isActive: boolean;
  videoPlaying: boolean;
  onVideoPlaybackChange: (shortId: string, isPlaying: boolean) => void;
  isFollowing: boolean;
  isScreenFocused: boolean;
  isMuted: boolean;
  onProfilePress: (userId: string) => void;
  onLocationPress: (address: string) => void;
  onSongPlayingChange: (sound: any) => void;
  // State-isolated action props
  currentUser: any;
  isSaved: boolean;
  actionLoading: boolean;
  onLikePress: (shortId: string) => void;
  onCommentPress: (shortId: string) => void;
  onSharePress: (short: PostType) => void;
  onSavePress: (shortId: string) => void;
  onDeletePress: (shortId: string) => void;
  // Gesture props
  onTouchStart: (e: any) => void;
  onTouchMove: (e: any) => void;
  onTouchEnd: (e: any, userId: string) => void;
}

const ShortsOverlay = ({
  post,
  isActive,
  videoPlaying,
  onVideoPlaybackChange,
  isFollowing,
  isScreenFocused,
  isMuted,
  onProfilePress,
  onLocationPress,
  onSongPlayingChange,
  currentUser,
  isSaved,
  actionLoading,
  onLikePress,
  onCommentPress,
  onSharePress,
  onSavePress,
  onDeletePress,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: ShortsOverlayProps) => {
  const { theme, isDark } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  // Absolute State Isolation: manage likes, counts, and interactive animations locally
  const [localIsLiked, setLocalIsLiked] = useState(post.isLiked || false);
  const [localLikesCount, setLocalLikesCount] = useState(post.likesCount || 0);
  const [showPauseButton, setShowPauseButton] = useState(false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);

  const likeAnimValue = useRef(new Animated.Value(0)).current;
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number | null>(null);

  // Seed from the post only when the cell switches to a different short. Like
  // toggles stay local so parent post.isLiked changes cannot disturb playback.
  useEffect(() => {
    setLocalIsLiked(post.isLiked || false);
    setLocalLikesCount(post.likesCount || 0);
  }, [post._id]);

  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
      }
    };
  }, []);

  const toggleVideoPlayback = useCallback(() => {
    const nextPlaying = !videoPlaying;
    onVideoPlaybackChange(post._id, nextPlaying);

    setShowPauseButton(true);
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
    }
    pauseTimerRef.current = setTimeout(() => {
      setShowPauseButton(false);
    }, 800);
  }, [videoPlaying, onVideoPlaybackChange, post._id]);

  const handleDoubleTapLike = useCallback(() => {
    if (!localIsLiked) {
      setLocalIsLiked(true);
      setLocalLikesCount(prev => prev + 1);
      onLikePress(post._id);
    }

    // Heart popping animation
    setShowLikeAnimation(true);
    likeAnimValue.setValue(0);
    Animated.sequence([
      Animated.spring(likeAnimValue, {
        toValue: 1.2,
        tension: 140,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(likeAnimValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowLikeAnimation(false);
    });
  }, [localIsLiked, onLikePress, post._id]);

  const handlePress = useCallback(() => {
    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current < 300) {
      handleDoubleTapLike();
    } else {
      toggleVideoPlayback();
    }
    lastTapRef.current = now;
  }, [handleDoubleTapLike, toggleVideoPlayback]);

  const handleLongPress = useCallback(() => {
    if (post.user._id === currentUser?._id) {
      onDeletePress(post._id);
    }
  }, [post.user._id, currentUser?._id, onDeletePress, post._id]);

  const handleLikePressLocal = useCallback(() => {
    const nextIsLiked = !localIsLiked;
    setLocalIsLiked(nextIsLiked);
    setLocalLikesCount(prev => prev + (nextIsLiked ? 1 : -1));
    onLikePress(post._id);
  }, [localIsLiked, onLikePress, post._id]);

  const handleShareLocal = useCallback(() => {
    onSharePress(post);
  }, [onSharePress, post]);

  // Heart pop animation values
  const likeOpacity = likeAnimValue.interpolate({
    inputRange: [0, 0.5, 1, 1.2],
    outputRange: [0, 0.4, 0.5, 0.5],
  });

  const likeScale = likeAnimValue.interpolate({
    inputRange: [0, 0.5, 1, 1.2],
    outputRange: [0.3, 0.8, 1, 1.2],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Full screen touch area for gestures and video controls */}
      <View
        style={StyleSheet.absoluteFill}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={(e) => onTouchEnd(e, post.user._id)}
      >
        <TouchableWithoutFeedback
          onPress={handlePress}
          onLongPress={handleLongPress}
          accessible={true}
          accessibilityLabel="Tap to play or pause video, double tap to like"
          accessibilityRole="button"
        >
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </View>

      {/* Atmospheric gradient overlay behind bottom info to boost legibility */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
        style={styles.gradientOverlay}
        pointerEvents="none"
      />

      <View style={styles.bottomContent} pointerEvents="box-none">
        <View style={styles.overlayContainer}>
          {/* Profile and caption container */}
          <TouchableOpacity
            style={styles.profileSection}
            onPress={() => onProfilePress(post.user._id)}
            activeOpacity={0.8}
            accessibilityLabel={`View ${post.user.username || 'user'}'s profile`}
            accessibilityRole="button"
          >
            <View style={styles.avatarWrapper}>
              <ExpoImage
                source={post.user.profilePic ? { uri: post.user.profilePic } : require('../../assets/avatars/male_avatar.png')}
                style={styles.avatar as any}
                cachePolicy="memory-disk"
                placeholder={require('../../assets/avatars/male_avatar.png')}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.avatarBorder} />
            </View>
            
            <View style={styles.userDetails}>
              <View style={styles.usernameRow}>
                <Text style={styles.fullName}>{post.user.fullName}</Text>
                {isFollowing && (
                  <View style={styles.followingBadge}>
                    <Text style={styles.followingText}>Following</Text>
                  </View>
                )}
              </View>

              {/* Glassmorphic Caption Card */}
              {post.caption && (
                <BlurView
                  intensity={75}
                  tint={isDark ? 'dark' : 'light'}
                  style={[styles.captionCard, { overflow: 'hidden', backgroundColor: isDark ? 'rgba(10, 18, 32, 0.45)' : 'rgba(255, 255, 255, 0.45)', borderColor: theme.colors.glassBorder }]}
                >
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      setIsExpanded(!isExpanded);
                    }}
                    style={styles.captionPressable}
                  >
                    <Text style={[styles.captionText, { color: '#38BDF8', fontWeight: isExpanded ? '400' : 'bold' }]}>
                      {isExpanded ? post.caption : '...'}
                    </Text>
                  </Pressable>
                </BlurView>
              )}

              {/* Tag Badges */}
              {isExpanded && post.tags && post.tags.length > 0 && (
                <View style={styles.tagsRow}>
                  {post.tags.slice(0, 3).map((tag, i) => (
                    <View key={i} style={[styles.tagBadge, { backgroundColor: theme.colors.primary + '24', borderColor: theme.colors.primary + '66' }]}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Song Badge - Instagram Style */}
              {post.song?.songId && (
                <View style={[styles.inlineBadge, { backgroundColor: theme.colors.glassSurface, borderColor: theme.colors.glassBorder }]}>
                  <Ionicons name="musical-notes" size={13} color="#38BDF8" />
                  <Text style={[styles.inlineBadgeText, { color: '#38BDF8' }]} numberOfLines={1}>
                    {post.song.songId.title || 'Original Audio'} · {post.song.songId.artist || 'Unknown Artist'}
                  </Text>
                </View>
              )}

              {/* Location Badge - Linked to interactive map */}
              {post.location?.address && (
                <TouchableOpacity
                  style={[styles.inlineBadge, styles.locationBadge, { backgroundColor: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.2)' }]}
                  onPress={() => onLocationPress(post.location.address)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="location" size={13} color="#38BDF8" />
                  <Text style={[styles.inlineBadgeText, styles.locationText, { color: '#38BDF8' }]} numberOfLines={1}>
                    {post.location.address}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action buttons (Likes, Comments, Saves, Shares, profile nav) */}
      <ShortsActions
        shortId={post._id}
        userId={post.user._id}
        username={post.user.username || ''}
        profilePic={post.user.profilePic}
        isLiked={localIsLiked}
        likesCount={localLikesCount}
        commentsCount={post.commentsCount || 0}
        isSaved={isSaved}
        isFollowing={isFollowing}
        isOwn={post.user._id === currentUser?._id}
        actionLoading={actionLoading}
        onProfilePress={onProfilePress}
        onLikePress={handleLikePressLocal}
        onCommentPress={onCommentPress}
        onSharePress={handleShareLocal}
        onSavePress={onSavePress}
      />

      {/* Big heart popping double tap indicator */}
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

      {/* Translucent Play/Pause overlay */}
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
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomContent: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 90,
    height: 320,
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  overlayContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    width: '100%',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
  },
  avatarBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  userDetails: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fullName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  followingBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  followingText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  captionCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 10,
  },
  captionPressable: {
    width: '100%',
  },
  captionText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 14,
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tagBadge: {
    backgroundColor: 'rgba(0, 102, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 102, 255, 0.4)',
  },
  tagText: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: '600',
  },
  inlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inlineBadgeText: {
    color: '#FFF',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
    maxWidth: 200,
  },
  locationBadge: {
    borderColor: 'rgba(0, 229, 255, 0.2)',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  locationText: {
    color: '#00E5FF',
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

export default React.memo(ShortsOverlay);
