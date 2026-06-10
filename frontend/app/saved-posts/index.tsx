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
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import { getPostById } from '../../services/posts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../../utils/logger';
import { PostType } from '../../types/post';
import { realtimePostsService } from '../../services/realtimePosts';
import { savedEvents } from '../../utils/savedEvents';
import { audioManager } from '../../utils/audioManager';
import { getImageAspectRatio } from '../../components/post/PostImage';

// Platform-specific constants
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';

const getPostCardHeight = (post: any) => {
  if (!post) return 580;
  
  // 1. Container margin bottom (20) + glassCard borders (~1.5)
  let height = 21.5;
  
  // 2. PostHeader
  let userDetailsHeight = 18; // username height
  if (post.song?.songId) {
    userDetailsHeight += 22; // song info height
  }
  if (post.location?.address) {
    userDetailsHeight += 18; // location info height
  }
  const headerHeight = Math.max(40, userDetailsHeight) + 24;
  height += headerHeight;
  
  // 3. PostImage
  const containerWidth = screenWidth - 32; // marginHorizontal 16 on each side
  const aspect = getImageAspectRatio(post);
  height += containerWidth / aspect;
  
  // 4. PostActions
  height += 48; // 24 icon + 8 button padding + 16 actions padding
  
  // 5. PostLikesCount
  const likesCount = post.likesCount || 0;
  const commentsCount = Array.isArray(post.comments) ? post.comments.length : 0;
  if (likesCount > 0 || commentsCount > 0) {
    height += 22; // 18 height + 4 paddingBottom
  }
  
  // 6. PostCaption
  if (post.caption) {
    const text = `${post.user?.fullName || 'Unknown User'} ${post.caption}`;
    const paragraphs = text.split('\n');
    const charsPerLine = Math.floor((screenWidth - 64) / 8.2);
    let lines = 0;
    for (const para of paragraphs) {
      lines += Math.max(1, Math.ceil(para.length / charsPerLine));
    }
    lines = Math.min(3, lines);
    height += lines * 20 + 16; // lines * lineHeight (20) + vertical padding (6 paddingTop + 10 paddingBottom)
  }
  
  return height;
};

const logger = createLogger('SavedPostsScreen');

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
  const errorCode = reason?.response?.data?.error?.code || reason?.response?.data?.code;
  const message = reason?.response?.data?.error?.message || reason?.response?.data?.message || reason?.message || '';

  // Only delete saved items if we get an explicit application error indicating the item is gone/private
  if (status === 403 && errorCode === 'AUTH_1006') return true;
  if (status === 404 && errorCode === 'RES_3001') return true;
  if (status === 410) return true;

  return (
    (status === 401 && typeof message === 'string' && message.toLowerCase().includes('not available'))
  );
};

export default function SavedPostsScreen() {
  const { postId, postData, index } = useLocalSearchParams();
  const { theme } = useTheme();
  const router = useRouter();
  
  const initialPost = useRef<any>(null);
  if (postData && !initialPost.current) {
    try {
      initialPost.current = JSON.parse(postData as string);
    } catch (e) {
      logger.error('Failed to parse postData in SavedPostsScreen:', e);
    }
  }

  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollOffsetRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);

  const [scrollIndex, setScrollIndex] = useState(index ? parseInt(index as string, 10) : 0);

  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  const visiblePostIdRef = useRef<string | null>(null);
  useEffect(() => {
    visiblePostIdRef.current = visiblePostId;
  }, [visiblePostId]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      let maxPercent = -1;
      let visibleItem = null;
      for (const token of viewableItems) {
        const percent = token.percentVisible ?? 0;
        if (percent > maxPercent) {
          maxPercent = percent;
          visibleItem = token.item;
        }
      }
      if (visibleItem) {
        setVisiblePostId(visibleItem._id);
      }
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 200,
  }).current;

  useFocusEffect(
    useCallback(() => {
      if (shouldRestoreScrollRef.current && scrollOffsetRef.current > 0) {
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: scrollOffsetRef.current, animated: false });
        });
        shouldRestoreScrollRef.current = false;
      }
      
      // Unfreeze audio on focus
      audioManager.unfreeze();

      return () => {
        shouldRestoreScrollRef.current = true;
        audioManager.freeze(3000);
        audioManager.stopAll().catch((error) => {
          logger.error('Error stopping audio on blur:', error);
        });
      };
    }, [])
  );

  const getItemLayout = useCallback((data: any, index: number) => {
    if (!data) return { length: 580, offset: 580 * index, index };
    
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += getPostCardHeight(data[i]);
    }
    return {
      length: getPostCardHeight(data[index]),
      offset,
      index,
    };
  }, []);

  const loadSavedPosts = useCallback(async () => {
    try {
      if (posts.length === 0) {
        setLoading(true);
      }
      
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
      
      const orderedItems = uniqueIds
        .map(id => itemMap.get(id))
        .filter((item): item is PostType => !!item && item.type !== 'short' && !item.videoUrl);
      setPosts(orderedItems);

      // Resolve scroll target index based on clicked postId
      if (postId) {
        const foundIdx = orderedItems.findIndex(p => p._id === postId);
        if (foundIdx !== -1) {
          setScrollIndex(foundIdx);
        } else if (index) {
          setScrollIndex(parseInt(index as string, 10));
        }
      } else if (index) {
        setScrollIndex(parseInt(index as string, 10));
      }
    } catch (error) {
      logger.error('Error loading saved posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [postId, index]);

  useEffect(() => {
    loadSavedPosts();
  }, [loadSavedPosts]);

  useEffect(() => {
    const unsubscribeLikes = realtimePostsService.subscribeToLikes(({ postId: likedPostId, isLiked, likesCount }) => {
      setPosts(prev => prev.map(post => (
        post._id === likedPostId
          ? { ...post, isLiked, likesCount } as any
          : post
      )));
    });

    const unsubscribeLocalActions = savedEvents.addPostActionListener((likedPostId, action, data) => {
      if (action === 'like' || action === 'unlike') {
        const isLiked = action === 'like';
        const likesCount = data?.likesCount ?? 0;
        setPosts(prev => prev.map(post => (
          post._id === likedPostId
            ? { ...post, isLiked, likesCount } as any
            : post
        )));
      } else if (action === 'save' || action === 'unsave') {
        const isBookmarked = action === 'save';
        setPosts(prev => prev.map(post => (
          post._id === likedPostId
            ? { ...post, isSaved: isBookmarked } as any
            : post
        )));
      }
    });

    return () => {
      unsubscribeLikes();
      unsubscribeLocalActions();
    };
  }, []);


  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSavedPosts();
  }, [loadSavedPosts]);

  const renderPost = ({ item }: { item: PostType }) => (
    <OptimizedPhotoCard
      post={item}
      onRefresh={loadSavedPosts}
      isVisible={true}
      isCurrentlyVisible={visiblePostId === item._id}
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
          initialScrollIndex={scrollIndex}
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onScroll={(e) => {
            if (e.target !== e.currentTarget) return;
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
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
            try {
              const layout = getItemLayout(posts, info.index);
              flatListRef.current?.scrollToOffset({ offset: layout.offset, animated: false });
              
              // Secondary reinforcement within the render frame lifecycle
              requestAnimationFrame(() => {
                try {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: false,
                    viewPosition: 0,
                  });
                } catch (err) {
                  logger.debug('Secondary scrollToIndex failed:', err);
                }
              });
            } catch (e) {
              logger.error('Scroll fallback failed:', e);
            }
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
