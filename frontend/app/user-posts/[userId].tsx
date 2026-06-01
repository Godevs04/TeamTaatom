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

// Platform-specific constants
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

export default function UserPostsScreen() {
  const { userId, postId } = useLocalSearchParams();
  const { theme } = useTheme();
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const scrollOffsetRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);

  const fetchUserPosts = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch user info
      const userResponse = await api.get(`/profile/${userId}`);
      setUser(userResponse.data.profile);
      
      // Fetch user's posts
      const postsResponse = await api.get(`/posts/user/${userId}`);
      setPosts(postsResponse.data.posts || []);
      
    } catch (error) {
      logger.error('Error fetching user posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserPosts();
  }, [fetchUserPosts]);

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
