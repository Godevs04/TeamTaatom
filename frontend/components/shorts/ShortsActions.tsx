import React from 'react';
import { View, StyleSheet, TouchableOpacity, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';

interface ShortsActionsProps {
  shortId: string;
  userId: string;
  username: string;
  profilePic?: string;
  isLiked: boolean;
  likesCount: number;
  commentsCount: number;
  isSaved: boolean;
  isFollowing: boolean;
  isOwn: boolean;
  actionLoading: boolean;
  onProfilePress: (userId: string) => void;
  onLikePress: (shortId: string) => void;
  onCommentPress: (shortId: string) => void;
  onSharePress: () => void;
  onSavePress: (shortId: string) => void;
}

const ShortsActions = ({
  shortId,
  userId,
  username,
  profilePic,
  isLiked,
  likesCount,
  commentsCount,
  isSaved,
  isFollowing,
  isOwn,
  actionLoading,
  onProfilePress,
  onLikePress,
  onCommentPress,
  onSharePress,
  onSavePress,
}: ShortsActionsProps) => {
  const { theme } = useTheme();

  return (
    <View style={styles.rightActions} pointerEvents="box-none">
      {/* 1. Profile Picture Avatar with Follow Icon */}
      <TouchableOpacity
        style={styles.profileButton}
        onPress={() => onProfilePress(userId)}
        activeOpacity={0.8}
        accessibilityLabel={`View ${username || 'user'}'s profile`}
        accessibilityRole="button"
      >
        <View style={styles.avatarContainer}>
          <ExpoImage
            source={profilePic ? { uri: profilePic } : require('../../assets/avatars/male_avatar.png')}
            style={styles.profileImage}
            cachePolicy="memory-disk"
            placeholder={require('../../assets/avatars/male_avatar.png')}
            contentFit="cover"
            transition={200}
          />
          {/* Follow '+' indicator */}
          {!isOwn && (
            <View style={[styles.followIconWrapper, isFollowing && styles.followingActive]}>
              <Ionicons
                name={isFollowing ? "checkmark" : "add"}
                size={11}
                color="#FFF"
              />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* 2. Like Button */}
      <Pressable
        style={styles.actionButton}
        onPress={() => onLikePress(shortId)}
        disabled={actionLoading}
        accessibilityLabel={isLiked ? `Unlike, ${likesCount} likes` : `Like, ${likesCount} likes`}
        accessibilityRole="button"
        accessibilityState={{ disabled: actionLoading }}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: theme.colors.glassSurface, borderColor: theme.colors.glassBorder },
            isLiked && styles.likedContainer,
          ]}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={28}
            color={isLiked ? "#FF3040" : "white"}
          />
        </View>
        <Text style={styles.actionText}>{likesCount}</Text>
      </Pressable>

      {/* 3. Comment Button */}
      <Pressable
        style={styles.actionButton}
        onPress={() => onCommentPress(shortId)}
        accessibilityLabel={`Comment, ${commentsCount} comments`}
        accessibilityRole="button"
      >
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.glassSurface, borderColor: theme.colors.glassBorder }]}>
          <Ionicons name="chatbubble-outline" size={28} color="white" />
        </View>
        <Text style={styles.actionText}>{commentsCount}</Text>
      </Pressable>

      {/* 4. Share Button */}
      <Pressable
        style={styles.actionButton}
        onPress={onSharePress}
        accessibilityLabel="Share"
        accessibilityRole="button"
      >
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.glassSurface, borderColor: theme.colors.glassBorder }]}>
          <Ionicons name="paper-plane-outline" size={28} color="white" />
        </View>
      </Pressable>

      {/* 5. Save/Favorite Button */}
      <Pressable
        style={styles.actionButton}
        onPress={() => onSavePress(shortId)}
        accessibilityLabel={isSaved ? 'Remove from saved' : 'Save'}
        accessibilityRole="button"
      >
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.glassSurface, borderColor: theme.colors.glassBorder }]}>
          <Ionicons
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={28}
            color={isSaved ? "#FFD700" : "white"}
          />
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  rightActions: {
    position: 'absolute',
    right: 14,
    bottom: 160,
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 22,
    width: '100%',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  likedContainer: {
    borderColor: 'rgba(255, 48, 64, 0.25)',
    backgroundColor: 'rgba(255, 48, 64, 0.08)',
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  profileButton: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: 'white',
    backgroundColor: '#333',
  },
  followIconWrapper: {
    position: 'absolute',
    bottom: -2,
    backgroundColor: '#0066FF',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  followingActive: {
    backgroundColor: '#00C853',
  },
});

export default ShortsActions;
