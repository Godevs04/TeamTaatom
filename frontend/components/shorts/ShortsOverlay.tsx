import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PostType } from '../../types/post';
import SongPlayer from '../SongPlayer';
import { useTheme } from '../../context/ThemeContext';

interface ShortsOverlayProps {
  post: PostType;
  isActive: boolean;
  isVideoPlaying: boolean;
  isFollowing: boolean;
  isScreenFocused: boolean;
  isMuted: boolean;
  onProfilePress: (userId: string) => void;
  onLocationPress: (address: string) => void;
  onSongPlayingChange: (sound: any) => void;
}

const ShortsOverlay = ({
  post,
  isActive,
  isVideoPlaying,
  isFollowing,
  isScreenFocused,
  isMuted,
  onProfilePress,
  onLocationPress,
  onSongPlayingChange,
}: ShortsOverlayProps) => {
  const { theme } = useTheme();

  return (
    <View style={styles.bottomContent} pointerEvents="box-none">
      {/* Dynamic atmospheric gradient overlay behind bottom info to boost legibility */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
        style={styles.gradientOverlay}
        pointerEvents="none"
      />

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
              <View style={[styles.captionCard, { backgroundColor: theme.colors.glassSurface, borderColor: theme.colors.glassBorder }]}>
                <Text style={styles.captionText} numberOfLines={2}>
                  {post.caption}
                </Text>
              </View>
            )}
            
            {/* Tag Badges */}
            {post.tags && post.tags.length > 0 && (
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
                <Ionicons name="musical-notes" size={13} color="rgba(255,255,255,0.9)" />
                <Text style={styles.inlineBadgeText} numberOfLines={1}>
                  {post.song.songId.title || 'Original Audio'} · {post.song.songId.artist || 'Unknown Artist'}
                </Text>
              </View>
            )}

            {/* Location Badge - Linked to interactive map */}
            {post.location?.address && (
              <TouchableOpacity
                style={[styles.inlineBadge, styles.locationBadge, { backgroundColor: theme.colors.glassSurface, borderColor: theme.colors.glassBorder }]}
                onPress={() => onLocationPress(post.location.address)}
                activeOpacity={0.7}
              >
                <Ionicons name="location" size={13} color="#00E5FF" />
                <Text style={[styles.inlineBadgeText, styles.locationText]} numberOfLines={1}>
                  {post.location.address}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* DISABLED: SongPlayer for shorts
          REASON: Server returns muxed MP4 (video + audio combined)
          Playing separate audio stream causes desync.
          Audio is already in the video file from server.
          
          SongPlayer is only used for home page (showPlayPause=true)
          where we need separate audio control.
      */}
      {/* Hidden SongPlayer orchestrator to control background track audio seamlessly */}
      {!!(post.song?.songId && post.song.songId._id) && false && (
        <View style={styles.hiddenSongPlayer} pointerEvents="none">
          <SongPlayer
            post={post}
            isVisible={isActive}
            autoPlay={isVideoPlaying}
            externalMuted={isMuted}
            onPlayingChange={onSongPlayingChange}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bottomContent: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 90,
    height: 320,
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
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
  hiddenSongPlayer: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});

export default ShortsOverlay;
