import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Dimensions,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import { getPostById } from '../../services/posts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../../utils/logger';
import { PostType } from '../../types/post';
import { realtimePostsService } from '../../services/realtimePosts';

const logger = createLogger('SavedPostsScreen');

// Platform-specific constants
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';

const readSavedIds = async (key: 'savedShorts' | 'savedPosts'): Promise<string[]> => {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
  } catch (error) {
    logger.warn(`Failed to parse ${key}`, error);
    try {
      await AsyncStorage.setItem(key, JSON.stringify([]));
    } catch {}
    return [];
  }
};

const isSavedItemUnavailable = (reason: any): boolean => {
  const status = reason?.response?.status;
  const message = reason?.response?.data?.error?.message || reason?.response?.data?.message || reason?.message || '';

  return (
    status === 403 ||
    status === 404 ||
    status === 410 ||
    (status === 401 && typeof message === 'string' && message.toLowerCase().includes('not available'))
  );
};

export default function SavedPostsScreen() {
  const { postId } = useLocalSearchParams();
  const { theme } = useTheme();
  const router = useRouter();
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const loadSavedPosts = useCallback(async () => {
    try {
      setLoading(true);
      
      const postsArr = await readSavedIds('savedPosts');
      const uniqueIds = Array.from(new Set(postsArr));
      
      if (uniqueIds.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }
      
      // Load all posts in batches
      const batchSize = 10;
      const batches: string[][] = [];
      for (let i = 0; i < uniqueIds.length; i += batchSize) {
        batches.push(uniqueIds.slice(i, i + batchSize));
      }
      
      const allResults = await Promise.all(
        batches.map(batch => 
          Promise.allSettled(batch.map(id => getPostById(id)))
        )
      );
      
      const items: PostType[] = [];
      const itemMap = new Map<string, PostType>();
      const failedIds: string[] = [];
      
      allResults.forEach((batchResults, batchIndex) => {
        batchResults.forEach((r, itemIndex) => {
          if (r.status === 'fulfilled') {
            const val: any = (r as any).value;
            const item = val?.data?.post || val?.post || val;
            if (item && item._id) {
              if (!itemMap.has(item._id)) {
                itemMap.set(item._id, item);
                items.push(item);
              }
            }
          } else {
            const id = batches[batchIndex][itemIndex];
            if (isSavedItemUnavailable((r as any).reason)) {
              failedIds.push(id);
            }
          }
        });
      });

      if (failedIds.length > 0) {
        const cleanedPosts = postsArr.filter(id => !failedIds.includes(id));
        await AsyncStorage.setItem('savedPosts', JSON.stringify(cleanedPosts));
        logger.debug(`Cleaned up ${failedIds.length} unavailable saved posts`);
      }
      
      // Sort by creation date (newest first)
      items.sort((a, b) => {
        const dateA = new Date((a as any).createdAt || (a as any).created_at || 0).getTime();
        const dateB = new Date((b as any).createdAt || (b as any).created_at || 0).getTime();
        return dateB - dateA;
      });
      
      setPosts(items);
    } catch (error) {
      logger.error('Error loading saved posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSavedPosts();
  }, [loadSavedPosts]);

  useEffect(() => {
    const unsubscribe = realtimePostsService.subscribeToLikes(({ postId, isLiked, likesCount }) => {
      setPosts(prev => prev.map(post => (
        post._id === postId
          ? { ...post, isLiked, likesCount } as any
          : post
      )));
    });
    return unsubscribe;
  }, []);

  // Scroll to specific post if postId is provided
  useEffect(() => {
    if (postId && posts.length > 0 && flatListRef.current) {
      const postIndex = posts.findIndex(post => post._id === postId);
      if (postIndex !== -1) {
        // Small delay to ensure FlatList is rendered
        setTimeout(() => {
          try {
            flatListRef.current?.scrollToIndex({
              index: postIndex,
              animated: false,
              viewPosition: 0, // Align post to the top of the view instantly
            });
          } catch (error) {
            logger.debug('Initial scrollToIndex failed:', error);
          }
        }, 100);
      }
    }
  }, [postId, posts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSavedPosts();
  }, [loadSavedPosts]);

  const renderPost = ({ item }: { item: PostType }) => (
    <OptimizedPhotoCard
      post={item}
      onRefresh={loadSavedPosts}
      isVisible={true}
      isCurrentlyVisible={false}
      showBookmark={true}
    />
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar
          title="Saved Posts"
          showBack={true}
          onBack={() => router.back()}
        />
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar
        title="Saved Posts"
        showBack={true}
        onBack={() => router.back()}
      />

      {/* Posts List */}
      {posts.length > 0 ? (
        <FlatList
          ref={flatListRef}
          style={styles.postsList}
          data={posts}
          keyExtractor={(item) => item._id}
          renderItem={renderPost}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          onScrollToIndexFailed={(info) => {
            logger.debug('Scroll to index failed, applying offset fallback:', info);
            const offset = info.averageItemLength * info.index;
            flatListRef.current?.scrollToOffset({ offset, animated: false });
            setTimeout(() => {
              try {
                flatListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: false,
                  viewPosition: 0,
                });
              } catch (e) {
                logger.error('Scroll fallback failed:', e);
              }
            }, 50);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: isTablet ? 22 : 17,
    fontWeight: '600',
  },
  postsList: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
  },
});
