import React, { useState, useEffect, memo } from 'react';
// Strike 20: Initial Audio Mount & Viewability Mandate integration.
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';
import { PostType } from '../../types/post';
import PostLocation from './PostLocation';
import { imageCacheManager } from '../../utils/imageCacheManager';

const DEFAULT_AVATAR = require('../../assets/avatars/male_avatar.png');

interface PostHeaderProps {
  post: PostType;
  onMenuPress: () => void;
  onReportPress?: () => void;
  showReportButton?: boolean;
}

function PostHeader({ post, onMenuPress, onReportPress, showReportButton }: PostHeaderProps) {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark' || theme.colors.background === '#0B1A2B' || theme.colors.background === '#000000';
  const router = useRouter();

  // Handle case where user might be undefined (from fallback user object)
  const user = post.user || {
    _id: 'unknown',
    fullName: 'Unknown User',
    profilePic: ''
  };

  const profileUrl = user.profilePic || '';
  const cachedProfilePic = profileUrl ? imageCacheManager.getCachedPathSync(profileUrl) : '';
  const [imageFailed, setImageFailed] = useState(false);

  // Reset failed state when the post changes (handles FlashList recycling)
  useEffect(() => { setImageFailed(false); }, [post._id, profileUrl]);

  const showPlaceholder = !cachedProfilePic || imageFailed;

  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.userInfo}
        onPress={() => {
          if (user._id && user._id !== 'unknown') {
            router.push(`/profile/${user._id}`);
          }
        }}
        disabled={!user._id || user._id === 'unknown'}
      >
        {showPlaceholder ? (
          <Image
            source={DEFAULT_AVATAR}
            style={[styles.profilePic, { borderColor: theme.colors.border }]}
          />
        ) : (
          <Image
            source={{ uri: cachedProfilePic }}
            style={[styles.profilePic, { borderColor: theme.colors.border }]}
            onLoad={() => imageCacheManager.cacheAfterDisplay(profileUrl)}
            onError={() => setImageFailed(true)}
          />
        )}
        <View style={styles.userDetails}>
          <Text style={[styles.username, { color: theme.colors.text }]}>
            {user.fullName || 'Unknown User'}
          </Text>
          
          {/* Song - Instagram style inline */}
          {post.song?.songId && (() => {
            const song = post.song.songId;
            const songTitle = song.title || 'Unknown Song';
            const songArtist = song.artist || 'Unknown Artist';
            const subtitleBlue = isDark ? '#38BDF8' : '#1C73B4';
            return (
              <View style={styles.inlineSong}>
                <Ionicons name="musical-notes" size={12} color={subtitleBlue} />
                <Text style={[styles.inlineSongText, { color: subtitleBlue }]} numberOfLines={1}>
                  {songTitle} · {songArtist}
                </Text>
              </View>
            );
          })()}
          
          <PostLocation post={post} />
        </View>
      </TouchableOpacity>

      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userDetails: {
    flex: 1,
  },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
  },
  profilePicPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  inlineSong: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 2,
  },
  inlineSongText: {
    fontSize: 12,
    marginLeft: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    padding: 4,
  },
});

export default memo(PostHeader, (prevProps, nextProps) => {
  return (
    prevProps.showReportButton === nextProps.showReportButton &&
    prevProps.onMenuPress === nextProps.onMenuPress &&
    prevProps.onReportPress === nextProps.onReportPress &&
    prevProps.post._id === nextProps.post._id &&
    prevProps.post.user?._id === nextProps.post.user?._id &&
    prevProps.post.user?.fullName === nextProps.post.user?.fullName &&
    prevProps.post.user?.profilePic === nextProps.post.user?.profilePic &&
    prevProps.post.song?.songId?.title === nextProps.post.song?.songId?.title &&
    prevProps.post.song?.songId?.artist === nextProps.post.song?.songId?.artist &&
    prevProps.post.location?.address === nextProps.post.location?.address
  );
});

