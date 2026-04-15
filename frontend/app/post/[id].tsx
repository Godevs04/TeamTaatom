import React, { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, ScrollView, ActivityIndicator, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getPostById, toggleLike } from '../../services/posts';
import PostHeader from '../../components/post/PostHeader';
import PostActions from '../../components/post/PostActions';
import PostCaption from '../../components/post/PostCaption';
import PostLikesCount from '../../components/post/PostLikesCount';
import PostComments from '../../components/post/PostComments';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PostDetail');
const { width: screenWidth } = Dimensions.get('window');

export default function PostDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { isDark } = useTheme();

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [comments, setComments] = useState<any[]>([]);

  // Fetch post details
  useEffect(() => {
    const fetchPost = async () => {
      try {
        if (!id) {
          logger.error('No post ID provided');
          return;
        }

        const response = await getPostById(id as string);
        if (response?.post) {
          setPost(response.post);
          setIsLiked(response.post.isLiked || false);
          setComments(response.post.comments || []);
        }
      } catch (error) {
        logger.error('Failed to fetch post:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  // Handle like toggle
  const handleLike = useCallback(async () => {
    try {
      if (!id) return;

      const result = await toggleLike(id as string);
      setIsLiked(result.isLiked);

      // Update post like count
      if (post) {
        setPost({
          ...post,
          likesCount: result.likesCount,
          isLiked: result.isLiked
        });
      }
    } catch (error) {
      logger.error('Failed to toggle like:', error);
    }
  }, [id, post]);

  // Handle comment added
  const handleCommentAdded = useCallback((newComment: any) => {
    setComments(prev => [newComment, ...prev]);
    if (post) {
      setPost({
        ...post,
        commentsCount: (post.commentsCount || 0) + 1
      });
    }
  }, [post]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const imageHeight = Math.min(screenWidth, 500);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={true}>
        {/* Post Image */}
        {post.imageUrl && (
          <Image
            source={{ uri: post.imageUrl }}
            style={[styles.image, { height: imageHeight }]}
            resizeMode="cover"
          />
        )}

        <View style={styles.content}>
          {/* Post Header (User info) */}
          <PostHeader post={post} showReportButton={true} />

          {/* Likes Count */}
          {post.likesCount > 0 && (
            <PostLikesCount likesCount={post.likesCount} />
          )}

          {/* Post Caption */}
          <PostCaption post={post} />

          {/* Actions (Like, Comment, Share, Save) */}
          <PostActions
            isLiked={isLiked}
            isSaved={post.isSaved || false}
            onLike={handleLike}
            onComment={() => setCommentsVisible(true)}
            onShare={() => {
              // Share functionality
              logger.debug('Share post:', post._id);
            }}
            onSave={() => {
              // Save functionality
              logger.debug('Save post:', post._id);
            }}
            showBookmark={true}
          />

          {/* Comments count indicator */}
          {comments.length > 0 && (
            <TouchableOpacity
              onPress={() => setCommentsVisible(true)}
              style={styles.viewCommentsBtn}
            >
              <Ionicons
                name="chatbubble-outline"
                size={14}
                color={isDark ? '#999' : '#666'}
                style={{ marginRight: 6 }}
              />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Comments Modal */}
      <PostComments
        visible={commentsVisible}
        postId={id as string}
        comments={comments}
        onClose={() => setCommentsVisible(false)}
        onCommentAdded={handleCommentAdded}
        commentsDisabled={post.commentsDisabled || false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  viewCommentsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
});
