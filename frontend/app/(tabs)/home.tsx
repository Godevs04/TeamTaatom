import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator, 
  Image, 
  RefreshControl, 
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ScrollView
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { Ionicons } from '@expo/vector-icons';
import { getPosts } from '../../services/posts';
import { PostType } from '../../types/post';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import { getUserFromStorage } from '../../services/auth';
import { useRouter, useFocusEffect } from 'expo-router';
import { imageCacheManager } from '../../utils/imageCacheManager';
import AnimatedHeader from '../../components/AnimatedHeader';
import api from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export default function HomeScreen() {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unseenMessageCount, setUnseenMessageCount] = useState(0);
  const { theme, mode } = useTheme();
  const { showError } = useAlert();
  const router = useRouter();

  const fetchPosts = useCallback(async (pageNum: number = 1, shouldAppend: boolean = false) => {
    try {
      console.log('Fetching posts for page:', pageNum);
      const response = await getPosts(pageNum, 10); // Reduced from 20 to 10 for better mobile performance
      
      console.log('Received posts:', response.posts.length);
      response.posts.forEach((post, index) => {
        console.log(`Post ${index}:`, {
          id: post._id,
          imageUrl: post.imageUrl,
          hasImageUrl: !!post.imageUrl
        });
      });
      
      if (shouldAppend) {
        setPosts(prev => [...prev, ...response.posts]);
      } else {
        setPosts(response.posts);
      }
      
      setHasMore(response.pagination.hasNextPage);
      setPage(pageNum);
      
      // Preload images for better performance
      if (response.posts.length > 0) {
        response.posts.forEach((post, index) => {
          if (post.imageUrl && index < 5) { // Preload first 5 images
            console.log('Preloading image:', post.imageUrl);
            imageCacheManager.prefetchImage(post.imageUrl).catch((err: any) => 
              console.warn('Failed to preload image:', err)
            );
          }
        });
      }
    } catch (error: any) {
      console.error('Failed to fetch posts:', error);
      // Don't show error popup, just log it
      // Posts will show as empty, user can pull to refresh
    }
  }, []);

  const fetchUnseenMessageCount = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');
      let myUserId = '';
      if (userData) {
        try {
          myUserId = JSON.parse(userData)._id;
        } catch {}
      }
      
      if (!token || !myUserId) return;
      
      const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${API_BASE_URL}/chat`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      const chats = data.chats || [];
      
      // Calculate total unseen messages
      let totalUnseen = 0;
      chats.forEach((chat: any) => {
        if (chat.messages && Array.isArray(chat.messages)) {
          const otherUser = chat.participants.find((p: any) => 
            (p._id ? p._id.toString() : p.toString()) !== myUserId
          );
          if (otherUser) {
            const unseen = chat.messages.filter((msg: any) => 
              msg.sender && 
              (msg.sender._id ? msg.sender._id.toString() : msg.sender.toString()) === 
              (otherUser._id ? otherUser._id.toString() : otherUser.toString()) &&
              !msg.seen
            ).length;
            totalUnseen += unseen;
          }
        }
      });
      
      setUnseenMessageCount(totalUnseen);
    } catch (error) {
      console.error('Error fetching unseen message count:', error);
      // Silently fail - don't show error to user
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        // Load current user first
        const user = await getUserFromStorage();
        setCurrentUser(user);
        
        // Fetch unseen message count
        await fetchUnseenMessageCount();
        
        // Try to load posts without blocking on connectivity test
        console.log('Loading posts...');
        await fetchPosts(1, false);
      } catch (error) {
        console.error('Error loading initial data:', error);
        // Don't show error popup, just log it
        console.log('Failed to load posts, will retry on refresh');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [fetchPosts, fetchUnseenMessageCount]);

  // Refresh unseen count when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchUnseenMessageCount();
    }, [fetchUnseenMessageCount])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchPosts(1, false),
      fetchUnseenMessageCount()
    ]);
    setRefreshing(false);
  }, [fetchPosts, fetchUnseenMessageCount]);

  const handleLoadMore = useCallback(async () => {
    if (!loading && hasMore) {
      await fetchPosts(page + 1, true);
    }
  }, [loading, hasMore, page, fetchPosts]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    safeArea: {
      flex: 1,
    },

    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.background,
    },
    emptyImageContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      alignItems: 'center',
      ...theme.shadows.medium,
    },
    emptyImage: {
      width: 120,
      height: 120,
      borderRadius: theme.borderRadius.lg,
      opacity: 0.8,
    },
    emptyTitle: {
      fontSize: theme.typography.h2.fontSize,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    emptyDescription: {
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 280,
    },
    postsContainer: {
      flex: 1,
    },
    postsList: {
      paddingHorizontal: 0,
      paddingBottom: 20,
    },
    loadMoreContainer: {
      padding: theme.spacing.md,
      alignItems: 'center',
    },
  });

  const renderHeader = () => <AnimatedHeader unseenMessageCount={unseenMessageCount} />;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar 
          barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
          backgroundColor={theme.colors.background} 
        />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (posts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar 
          barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
          backgroundColor={theme.colors.background} 
        />
        {renderHeader()}
        <View style={styles.emptyContainer}>
          <View style={styles.emptyImageContainer}>
            <Ionicons 
              name="camera-outline" 
              size={60} 
              color={theme.colors.textSecondary} 
            />
          </View>
          <Text style={styles.emptyTitle}>No Posts Yet</Text>
          <Text style={styles.emptyDescription}>
            Start following people to see their posts in your feed, or share your first photo!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.background} 
      />
      <SafeAreaView style={styles.safeArea}>
        {renderHeader()}
        
        <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        style={styles.postsContainer}
        contentContainerStyle={styles.postsList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
            progressBackgroundColor={theme.colors.surface}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={
          hasMore ? (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : posts.length > 0 ? (
            <View style={{ 
              paddingVertical: theme.spacing.xl,
              alignItems: 'center' 
            }}>
              <Text style={{ 
                color: theme.colors.textSecondary,
                fontSize: theme.typography.small.fontSize 
              }}>
                You're all caught up!
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <OptimizedPhotoCard 
            post={item} 
            onRefresh={handleRefresh}
            isVisible={true} // Always render for debugging
          />
        )}
      />
      </SafeAreaView>
    </View>
  );
}
