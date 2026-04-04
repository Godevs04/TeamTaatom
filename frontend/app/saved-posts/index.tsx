import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import { getPostById } from '../../services/posts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../../utils/logger';
import { PostType } from '../../types/post';

const logger = createLogger('SavedPostsScreen');

// Platform-specific constants
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';

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
      
      // Load saved IDs from AsyncStorage
      const savedShorts = await AsyncStorage.getItem('savedShorts');
      const savedPosts = await AsyncStorage.getItem('savedPosts');
      
      let shortsArr: string[] = [];
      let postsArr: string[] = [];
      
      try {
        if (savedShorts) {
          const parsed = JSON.parse(savedShorts);
          shortsArr = Array.isArray(parsed) ? parsed : [];
        }
      } catch (error) {
        logger.warn('Failed to parse savedShorts', error);
      }
      
      try {
        if (savedPosts) {
          const parsed = JSON.parse(savedPosts);
          postsArr = Array.isArray(parsed) ? parsed : [];
        }
      } catch (error) {
        logger.warn('Failed to parse savedPosts', error);
      }
      
      // Combine and deduplicate
      const allIds = [...postsArr, ...shortsArr];
      const uniqueIds = Array.from(new Set(allIds));
      
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
      
      allResults.forEach((batchResults, batchIndex) => {
        batchResults.forEach((r, itemIndex) => {
          if (r.status === 'fulfilled') {
            const val: any = (r as any).value;
            const item = val.post || val;
            if (item && item._id) {
              if (!itemMap.has(item._id)) {
                itemMap.set(item._id, item);
                items.push(item);
              }
            }
          }
        });
      });
      
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

  // Scroll to specific post if postId is provided
  useEffect(() => {
    if (postId && posts.length > 0 && flatListRef.current) {
      const postIndex = posts.findIndex(post => post._id === postId);
      if (postIndex !== -1) {
        // Small delay to ensure FlatList is rendered
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: postIndex,
            animated: true,
            viewPosition: 0.5, // Center the post in the view
          });
        }, 300);
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Saved Posts</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Saved Posts</Text>
      </View>

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
            // Fallback if scrollToIndex fails
            logger.debug('Scroll to index failed:', info);
            // Retry after a delay
            setTimeout(() => {
              if (postId && flatListRef.current) {
                const postIndex = posts.findIndex(post => post._id === postId);
                if (postIndex !== -1) {
                  flatListRef.current?.scrollToIndex({
                    index: postIndex,
                    animated: true,
                  });
                }
              }
            }, 500);
          }}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="bookmark-outline" size={64} color={theme.colors.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Saved Posts</Text>
          <Text style={[styles.emptyMessage, { color: theme.colors.textSecondary }]}>
            Save posts you love to view later
          </Text>
        </View>
      )}
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
    fontSize: isTablet ? 22 : 18,
    fontWeight: '700',
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
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
  },
});
