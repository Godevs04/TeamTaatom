import React, { useState } from 'react';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasMoreLines, setHasMoreLines] = useState(false);

  if (!post.caption) return null;

  // Handle case where user might be undefined
  const user = post.user || {
    _id: 'unknown',
    fullName: 'Unknown User',
    profilePic: ''
  };

  const handleUserPress = () => {
    if (user._id && user._id !== 'unknown') {
      router.push(`/profile/${user._id}`);
    }
  };

  const handleTextLayout = (e: any) => {
    if (!isExpanded) {
      setHasMoreLines(e.nativeEvent.lines.length > 3);
    }
  };

  return (
    <View style={styles.captionContainer}>
      <View style={styles.captionWrapper}>
        <Text 
          style={[styles.captionText, { color: theme.colors.text }]}
          numberOfLines={isExpanded ? undefined : 3}
          onTextLayout={handleTextLayout}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Text 
            onPress={handleUserPress}
            style={[styles.username, { color: theme.colors.text }]}
          >
            {user.fullName || 'Unknown User'}{' '}
          </Text>
          <HashtagMentionText
            text={post.caption}
            style={[styles.caption, { color: theme.colors.text }]}
            postId={post._id}
          />
        </Text>
      </View>
      {hasMoreLines && !isExpanded && (
        <TouchableOpacity
          onPress={() => setIsExpanded(true)}
          style={styles.moreButton}
          activeOpacity={0.7}
        >
          <Text style={[styles.moreButtonText, { color: theme.colors.textSecondary }]}>
            Read more
          </Text>
        </TouchableOpacity>
      )}
      {isExpanded && hasMoreLines && (
        <TouchableOpacity
          onPress={() => setIsExpanded(false)}
          style={styles.moreButton}
          activeOpacity={0.7}
        >
          <Text style={[styles.moreButtonText, { color: theme.colors.textSecondary }]}>
            show less
          </Text>
        </TouchableOpacity>
      )}
      
      {/* Multiple images hint */}
      {post.images && post.images.length > 1 && (
        <View style={[styles.multipleImagesHint, { backgroundColor: theme.colors.background + '60' }]}>
          <View style={[styles.hintIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
            <Ionicons name="swap-horizontal" size={12} color={theme.colors.primary} />
          </View>
          <Text style={[styles.hintText, { color: theme.colors.textPassive }]}>
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
    zIndex: 10,
  },
  captionWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  captionText: {
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
    textAlign: 'left', // Ensure proper text alignment
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
  moreButton: {
    marginTop: 4,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  moreButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

