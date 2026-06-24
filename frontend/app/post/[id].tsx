import React, { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getPostById } from '../../services/posts';
import { trackPostView } from '../../services/analytics';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import { createLogger } from '../../utils/logger';
import { savedEvents, normalizeId } from '../../utils/savedEvents';

const logger = createLogger('PostDetail');

export default function PostDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  const [post, setRawPost] = useState<any>(null);
  const setPost = (value: React.SetStateAction<any>) => {
    setRawPost((prev) => {
      const resolved = typeof value === 'function' ? (value as any)(prev) : value;
      if (resolved && (savedEvents.isDeleted(resolved._id) || savedEvents.isDeleted(resolved.id))) {
        return null;
      }
      return resolved;
    });
  };
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch post details
  const fetchPost = useCallback(async (isRefresh = false) => {
    try {
      if (!id) {
        logger.error('No post ID provided');
        return;
      }
      const response = await getPostById(id as string);
      if (response?.post) {
        if (savedEvents.isDeleted(response.post._id)) {
          router.back();
          return;
        }
        let postData = response.post;
        if (isRefresh) {
          // Explicit refresh: override the local savedEvents cache with the server's fresh data
          savedEvents.setLikesState(postData._id, postData.isLiked || false, postData.likesCount || 0);
          savedEvents.setCommentsCount(postData._id, postData.commentsCount || (postData.comments ? postData.comments.length : 0));
        } else {
          // Normal load: use the local savedEvents cache if present to preserve unsynced interactions
          const localLikesState = savedEvents.getLikesState(postData._id);
          if (localLikesState) {
            postData = {
              ...postData,
              isLiked: localLikesState.isLiked,
              likesCount: localLikesState.likesCount
            };
          }
          const localCommentsCount = savedEvents.getCommentsCount(postData._id);
          if (localCommentsCount !== undefined) {
            postData = {
              ...postData,
              commentsCount: localCommentsCount
            };
          }
        }
        setPost(postData);
      } else {
        router.back();
      }
    } catch (error) {
      logger.error('Failed to fetch post:', error);
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPost(true);
    setRefreshing(false);
  }, [fetchPost]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  useEffect(() => {
    if (!id) return;
    const unsubscribeLocalActions = savedEvents.addPostActionListener((likedPostId, action, data) => {
      if (normalizeId(likedPostId) !== normalizeId(id)) return;

      if (action === 'like' || action === 'unlike') {
        const isLiked = action === 'like';
        const likesCount = data?.likesCount ?? 0;
        setPost(prev => prev ? { ...prev, isLiked, likesCount } : null);
      } else if (action === 'save' || action === 'unsave') {
        const isSaved = action === 'save';
        setPost(prev => prev ? { ...prev, isSaved } : null);
      } else if (action === 'comment') {
        if (data && typeof data.commentsCount === 'number') {
          setPost(prev => prev ? { ...prev, commentsCount: data.commentsCount } : null);
        }
      } else if (action === 'delete') {
        router.back();
      }
    });

    return () => {
      unsubscribeLocalActions();
    };
  }, [id]);

  // View tracking: send view event after 2 seconds (2-second rule)
  useEffect(() => {
    if (!post?._id) return;

    const timer = setTimeout(() => {
      trackPostView(post._id, { type: post.type || 'photo', source: 'post_detail' });
    }, 2000);

    return () => clearTimeout(timer);
  }, [post?._id]);

  if (loading || !post) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
        <View style={[styles.header, { borderBottomWidth: 0 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={isDark ? '#fff' : '#000'} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      {/* Header with back button */}
      <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#e0e0e0' }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        bounces={true} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={isDark ? '#fff' : '#000'}
            colors={[isDark ? '#fff' : '#000']}
          />
        }
      >
        <OptimizedPhotoCard 
          post={post} 
          isCurrentlyVisible={true} 
          onRefresh={fetchPost}
          onPress={() => {}}
        />
      </ScrollView>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
});
