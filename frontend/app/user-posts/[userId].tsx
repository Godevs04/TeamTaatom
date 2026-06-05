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

// Platform-specific constants
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
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

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const scrollOffsetRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);

  const initialIndex = index ? parseInt(index as string, 10) : 0;

  const getItemLayout = useCallback((_data: any, index: number) => ({
    length: 580,
    offset: 580 * index,
    index,
  }), []);

  const fetchUserPosts = useCallback(async () => {
    try {
      if (posts.length === 0) {
        setLoading(true);
      }
      
      // Fetch user info
      const userResponse = await api.get(`/profile/${userId}`);
      setUser(userResponse.data.profile);
      
      // Fetch user's posts
      const postsResponse = await api.get(`/posts/user/${userId}`);
      const fetchedPosts = (postsResponse.data.posts || []).sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
        const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
        return dateB - dateA;
      });
      setPosts(fetchedPosts);
      
    } catch (error) {
      logger.error('Error fetching user posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, postId]);

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
      return () => {
        shouldRestoreScrollRef.current = true;
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
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
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
