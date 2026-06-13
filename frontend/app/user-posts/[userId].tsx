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
import api from '../../services/api';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import logger from '../../utils/logger';
import { realtimePostsService } from '../../services/realtimePosts';
import { savedEvents } from '../../utils/savedEvents';
import { audioManager } from '../../utils/audioManager';
import { getImageAspectRatio } from '../../components/post/PostImage';

// Platform-specific constants
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

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
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

export default function UserPostsScreen() {
  const { userId, postId, postData, index } = useLocalSearchParams();
  const { theme } = useTheme();
  const router = useRouter();
  
  const initialPost = useRef<any>(null);
  if (postData && !initialPost.current) {
    try {
      initialPost.current = JSON.parse(postData as string);
    } catch (e) {
      logger.error('Failed to parse postData in UserPostsScreen:', e);
    }
  }

  const [posts, setPosts] = useState<any[]>(() => {
    if (initialPost.current) {
      return [initialPost.current];
    }
    return [];
  });
  const [loading, setLoading] = useState(!initialPost.current);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const scrollOffsetRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);

  const [initialIndex, setInitialIndex] = useState(0);
  const [postsPage, setPostsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

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

  const fetchUserPosts = useCallback(async () => {
    try {
      if (posts.length === 0) {
        setLoading(true);
      }
      
      // Fetch user info in parallel with initial posts fetch
      const userPromise = api.get(`/profile/${userId}`).then(res => {
        setUser(res.data.profile);
      }).catch(err => {
        logger.error('Error fetching user profile in posts detail:', err);
      });
      
      const limit = 20;
      let targetIndex = 0;
      if (postId && posts.length > 0) {
        const foundIndex = posts.findIndex((p: any) => p._id === postId);
        if (foundIndex !== -1) {
          targetIndex = foundIndex;
        }
      } else if (index) {
        targetIndex = parseInt(index as string, 10);
      }

      const targetPage = Math.floor(targetIndex / limit) + 1;
      const maxPageToFetch = Math.min(Math.max(1, targetPage), 5);

      const pagePromises = [];
      for (let p = 1; p <= maxPageToFetch; p++) {
        pagePromises.push(api.get(`/posts/user/${userId}?page=${p}&limit=${limit}`));
      }

      const [pagesResponses] = await Promise.all([
        Promise.all(pagePromises),
        userPromise
      ]);

      let fetchedPosts: any[] = [];
      for (const res of pagesResponses) {
        fetchedPosts = [...fetchedPosts, ...(res.data.posts || [])];
      }

      // De-duplicate just in case
      fetchedPosts = fetchedPosts.filter((p, i, self) => self.findIndex(t => t._id === p._id) === i);

      fetchedPosts.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
        const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
        return dateB - dateA;
      });
      
      let finalTargetIndex = targetIndex;
      if (postId) {
        const foundIndex = fetchedPosts.findIndex((p: any) => p._id === postId);
        if (foundIndex !== -1) {
          finalTargetIndex = foundIndex;
        }
      }
      
      setInitialIndex(finalTargetIndex);
      setPosts(fetchedPosts);
      
      setPostsPage(maxPageToFetch);
      const lastPageResponse = pagesResponses[pagesResponses.length - 1];
      const lastPagePosts = lastPageResponse?.data?.posts || [];
      setHasMorePosts(lastPagePosts.length === limit);

      // Scroll to target index programmatically once posts are loaded
      if (fetchedPosts.length > 0 && finalTargetIndex > 0) {
        requestAnimationFrame(() => {
          try {
            flatListRef.current?.scrollToIndex({
              index: finalTargetIndex,
              animated: false,
              viewPosition: 0,
            });
          } catch (err) {
            logger.debug('Programmatic scroll to index failed:', err);
          }
        });
      }
      
    } catch (error) {
      logger.error('Error fetching user posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, postId, index]);

  const loadMorePosts = useCallback(async () => {
    if (loadingMorePosts || !hasMorePosts || !userId) return;
    
    setLoadingMorePosts(true);
    const nextPage = postsPage + 1;
    const limit = 20;
    
    try {
      const postsResponse = await api.get(`/posts/user/${userId}?page=${nextPage}&limit=${limit}`);
      const pagePosts = postsResponse.data.posts || [];
      if (pagePosts.length > 0) {
        setPosts(prev => {
          const combined = [...prev, ...pagePosts];
          // Remove duplicates
          const unique = combined.filter((p, i, self) => self.findIndex(t => t._id === p._id) === i);
          return unique.sort((a: any, b: any) => {
            const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
            const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
            return dateB - dateA;
          });
        });
        setPostsPage(nextPage);
        setHasMorePosts(pagePosts.length === limit);
      } else {
        setHasMorePosts(false);
      }
    } catch (error) {
      logger.error('Error loading more user posts in details view:', error);
    } finally {
      setLoadingMorePosts(false);
    }
  }, [loadingMorePosts, hasMorePosts, userId, postsPage]);

  useEffect(() => {
    fetchUserPosts();
  }, [fetchUserPosts]);

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
        const isSaved = action === 'save';
        setPosts(prev => prev.map(post => (
          post._id === likedPostId
            ? { ...post, isSaved } as any
            : post
        )));
      }
    });

    return () => {
      unsubscribeLikes();
      unsubscribeLocalActions();
    };
  }, []);

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


  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUserPosts();
  }, [fetchUserPosts]);

  const renderPost = ({ item }: { item: any }) => (
    <OptimizedPhotoCard
      post={item}
      onRefresh={fetchUserPosts}
      isVisible={true}
      isCurrentlyVisible={visiblePostId === item._id}
    />
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      padding: theme.spacing.xs,
      marginRight: theme.spacing.sm,
    },
    headerTitle: {
      fontSize: theme.typography.h3.fontSize,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    emptyIcon: {
      marginBottom: theme.spacing.md,
    },
    emptyTitle: {
      fontSize: theme.typography.h3.fontSize,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    postsList: {
      flex: 1,
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar
          title="Posts"
          showBack={true}
          onBack={() => router.back()}
        />
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={theme.colors.primary} />
          <Text style={[styles.emptyMessage, { marginTop: theme.spacing.md }]}>
            Loading posts...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar
        title={user?.fullName ? `${user.fullName}'s Posts` : 'Posts'}
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
          initialScrollIndex={posts.length > 1 ? initialIndex : 0}
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={loadMorePosts}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMorePosts ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <LoadingGlobe size="small" color={theme.colors.primary} />
              </View>
            ) : null
          }
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
          onScroll={(e) => {
            if (e.target !== e.currentTarget) return;
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
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
