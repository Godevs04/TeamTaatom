import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import HashtagMentionText from '../HashtagMentionText';
import { PostType } from '../../types/post';
import { useRouter } from 'expo-router';

interface PostCaptionProps {
  post: PostType;
}

export default function PostCaption({ post }: PostCaptionProps) {
  const { theme } = useTheme();
  const router = useRouter();

  if (!post.caption) return null;

  const handleUserPress = () => {
    router.push(`/profile/${post.user._id}`);
  };

  return (
    <View style={styles.captionContainer}>
      <View style={styles.captionWrapper}>
        <Text style={[styles.captionText, { color: theme.colors.text }]}>
          <Text 
            onPress={handleUserPress}
            style={[styles.username, { color: theme.colors.text }]}
          >
            {post.user.fullName}{' '}
          </Text>
      <HashtagMentionText
            text={post.caption}
            style={[styles.caption, { color: theme.colors.text }]}
            postId={post._id}
      />
        </Text>
      </View>
      
      {/* Multiple images hint */}
      {post.images && post.images.length > 1 && (
        <View style={[styles.multipleImagesHint, { backgroundColor: theme.colors.background + '60' }]}>
          <View style={[styles.hintIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
            <Ionicons name="swap-horizontal" size={12} color={theme.colors.primary} />
          </View>
          <Text style={[styles.hintText, { color: theme.colors.textSecondary }]}>
            Swipe to see {post.images.length} photos
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  captionContainer: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  captionWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  captionText: {
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  username: {
    fontWeight: '600',
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
  multipleImagesHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 5,
  },
  hintIconContainer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

