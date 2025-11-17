import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import HashtagText from '../HashtagText';
import { PostType } from '../../types/post';

interface PostCaptionProps {
  post: PostType;
}

export default function PostCaption({ post }: PostCaptionProps) {
  const { theme } = useTheme();

  if (!post.caption) return null;

  return (
    <View style={styles.captionContainer}>
      <HashtagText
        text={`${post.user.fullName} ${post.caption}`}
        style={styles.caption}
      />
      
      {/* Multiple images hint */}
      {post.images && post.images.length > 1 && (
        <View style={styles.multipleImagesHint}>
          <Ionicons name="swap-horizontal" size={14} color={theme.colors.textSecondary} />
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
    paddingBottom: 8,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
  multipleImagesHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  hintText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});

