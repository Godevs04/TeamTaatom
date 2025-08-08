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
import { PostType, CommentType } from '../types/post';
import { UserType } from '../types/user';
import { likePost, unlikePost, getComments, addComment } from '../services/firestore';
import { getCurrentUser } from '../services/auth';
import { CommentBox } from './CommentBox';

interface PhotoCardProps {
  post: PostType;
  userData?: UserType;
  onPress?: () => void;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
  post,
  userData,
  onPress,
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentType[]>([]);

  const currentUser = getCurrentUser();

  React.useEffect(() => {
    if (currentUser && post.likes?.includes(currentUser.uid)) {
      setIsLiked(true);
    }
  }, [post.likes, currentUser]);

  React.useEffect(() => {
    if (showComments) {
      const unsubscribe = getComments(post.postId, (comments) => {
        setComments(comments);
      });
      return unsubscribe;
    }
  }, [showComments, post.postId]);

  const handleLike = async () => {
    if (!currentUser) return;

    try {
      if (isLiked) {
        await unlikePost(post.postId, currentUser.uid);
        setLikesCount(prev => prev - 1);
      } else {
        await likePost(post.postId, currentUser.uid);
        setLikesCount(prev => prev + 1);
      }
      setIsLiked(!isLiked);
    } catch (error) {
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const handleComment = async (text: string) => {
    if (!currentUser) return;

    try {
      await addComment(post.postId, {
        uid: currentUser.uid,
        text,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={{ uri: userData?.profilePic || 'https://via.placeholder.com/40' }}
          style={styles.avatar}
        />
        <View style={styles.headerText}>
          <Text style={styles.username}>{userData?.fullName || 'Unknown User'}</Text>
          {post.placeName && (
            <Text style={styles.location}>{post.placeName}</Text>
          )}
        </View>
      </View>

      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <Image source={{ uri: post.photoUrl }} style={styles.image} />
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
          <Text style={styles.username}>{userData?.fullName || 'Unknown User'}</Text>
          {' '}{post.comment}
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
