import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';
import { PostType } from '../../types/post';
import PostLocation from './PostLocation';

interface PostHeaderProps {
  post: PostType;
  onMenuPress: () => void;
}

export default function PostHeader({ post, onMenuPress }: PostHeaderProps) {
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.userInfo}
        onPress={() => router.push(`/profile/${post.user._id}`)}
      >
        <Image
          source={{
            uri: post.user.profilePic || 'https://via.placeholder.com/40',
          }}
          style={styles.profilePic}
        />
        <View style={styles.userDetails}>
          <Text style={[styles.username, { color: theme.colors.text }]}>
            {post.user.fullName}
          </Text>
          <PostLocation post={post} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuButton}
        onPress={onMenuPress}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.text} />
      </TouchableOpacity>
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
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  menuButton: {
    padding: 4,
  },
});

