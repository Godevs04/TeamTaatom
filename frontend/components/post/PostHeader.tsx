import React, { useState, useEffect } from 'react';
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

export default function PostHeader({ post, onMenuPress, onReportPress, showReportButton }: PostHeaderProps) {
  const { theme } = useTheme();
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
            return (
              <View style={styles.inlineSong}>
                <Ionicons name="musical-notes" size={12} color={theme.colors.textPassive} />
                <Text style={[styles.inlineSongText, { color: theme.colors.textPassive }]} numberOfLines={1}>
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

