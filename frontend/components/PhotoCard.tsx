import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { PostType } from '../types/post';
import { toggleLike, addComment } from '../services/posts';
import { getUserFromStorage } from '../services/auth';
import CommentBox from './CommentBox';

interface PhotoCardProps {
  post: PostType;
  onRefresh?: () => void;
  onPress?: () => void;
}

export default function PhotoCard({
  post,
  onRefresh,
  onPress,
}: PhotoCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.comments || []);

  const handleLike = async () => {
    try {
      const response = await toggleLike(post._id);
      setIsLiked(response.isLiked);
      setLikesCount(response.likesCount);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update like');
      console.error('Like error:', error);
    }
  };

  const handleComment = async (text: string) => {
    try {
      const response = await addComment(post._id, text);
      setComments(prev => [...prev, response.comment]);
      if (onRefresh) onRefresh();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to add comment');
      console.error('Comment error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={{ uri: post.user?.profilePic || 'https://via.placeholder.com/40' }}
          style={styles.avatar}
        />
        <View style={styles.headerText}>
          <Text style={styles.username}>{post.user?.fullName || 'Unknown User'}</Text>
          {post.location?.address && (
            <Text style={styles.location}>{post.location.address}</Text>
          )}
        </View>
      </View>

      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <Image source={{ uri: post.imageUrl }} style={styles.image} />
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={24}
            color={isLiked ? theme.colors.error : theme.colors.text}
          />
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => setShowComments(!showComments)}
          style={styles.actionButton}
        >
          <Ionicons
            name="chatbubble-outline"
            size={24}
            color={theme.colors.text}
          />
        </TouchableOpacity>
      </View>

      {likesCount > 0 && (
        <Text style={styles.likesText}>
          {likesCount} {likesCount === 1 ? 'like' : 'likes'}
        </Text>
      )}

      <View style={styles.caption}>
        <Text style={styles.captionText}>
          <Text style={styles.username}>{post.user?.fullName || 'Unknown User'}</Text>
          {' '}{post.caption}
        </Text>
      </View>

      {comments.length > 0 && (
        <TouchableOpacity
          onPress={() => setShowComments(!showComments)}
          style={styles.commentsPreview}
        >
          <Text style={styles.commentsText}>
            View all {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </Text>
        </TouchableOpacity>
      )}

      {showComments && (
        <CommentBox
          comments={comments}
          onAddComment={handleComment}
          onClose={() => setShowComments(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: theme.spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  username: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: theme.colors.text,
  },
  location: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  actions: {
    flexDirection: 'row',
    padding: theme.spacing.md,
  },
  actionButton: {
    marginRight: theme.spacing.md,
  },
  likesText: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  caption: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  captionText: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
    lineHeight: 20,
  },
  commentsPreview: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  commentsText: {
    fontSize: theme.typography.small.fontSize,
    color: theme.colors.textSecondary,
  },
});
