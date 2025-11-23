import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  ScrollView,
  Platform,
  Dimensions
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
import EmptyState from '../../components/EmptyState';
import { PostSkeleton } from '../../components/LoadingSkeleton';
import { trackScreenView, trackPostView, trackEngagement, trackFeatureUsage } from '../../services/analytics';
import api from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { isWeb, throttle } from '../../utils/webOptimizations';
import { triggerRefreshHaptic } from '../../utils/hapticFeedback';
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const logger = createLogger('HomeScreen');

export default function HomeScreen() {
  const { handleScroll } = useScrollToHideNav();
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unseenMessageCount, setUnseenMessageCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const { theme, mode } = useTheme();
  const { showError } = useAlert();
  const router = useRouter();
  const isFetchingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const lastErrorTimeRef = useRef(0);
  const errorCountRef = useRef(0);
  const isFetchingMessagesRef = useRef(false);
  const lastMessageFetchRef = useRef(0);

  const fetchPosts = useCallback(async (pageNum: number = 1, shouldAppend: boolean = false) => {
    // Prevent multiple simultaneous calls
    if (isFetchingRef.current && !shouldAppend) {
      logger.debug('Already fetching posts, skipping...');
      return;
    }
    
    isFetchingRef.current = true;
    try {
      logger.debug('Fetching posts for page:', pageNum);
      
      // Web: Fetch more posts per page for better UX
      const postsPerPage = isWeb ? 15 : 10;
      const response = await getPosts(pageNum, postsPerPage);
      
      if (shouldAppend) {
        setPosts(prev => [...prev, ...response.posts]);
      } else {
        setPosts(response.posts);
      }
      
      setHasMore(response.pagination.hasNextPage);
      setPage(pageNum);
      
      // Cache posts for offline support
      if (pageNum === 1 && !shouldAppend) {
        try {
          await AsyncStorage.setItem('cachedPosts', JSON.stringify({
            data: response.posts,
            timestamp: Date.now()
          }));
        } catch (error) {
          logger.error('Error caching posts', error);
        }
      }
      
      // Enhanced image preloading with priority strategy
      if (response.posts.length > 0) {
        const preloadCount = isWeb ? 8 : 5;
        // Preload visible posts first (first 3)
        const visiblePosts = response.posts.slice(0, 3);
        visiblePosts.forEach((post) => {
          if (post.imageUrl) {
            imageCacheManager.prefetchImage(post.imageUrl).catch(() => {
              // Silently fail
            });
          }
        });
        
        // Preload upcoming posts in background (next 5-8)
        const upcomingPosts = response.posts.slice(3, preloadCount);
        setTimeout(() => {
          upcomingPosts.forEach((post) => {
            if (post.imageUrl) {
              imageCacheManager.prefetchImage(post.imageUrl).catch(() => {
                // Silently fail
              });
            }
          });
        }, 500); // Delay to not block initial render
      }
    } catch (error: any) {
      const now = Date.now();
      const timeSinceLastError = now - lastErrorTimeRef.current;
      
      // Only log error if it's been more than 2 seconds since last error (prevent spam)
      if (timeSinceLastError > 2000) {
        errorCountRef.current = 0;
        logger.error('Failed to fetch posts', error);
      } else {
        errorCountRef.current++;
        // Only log every 10th error to prevent log spam
        if (errorCountRef.current % 10 === 0) {
          logger.error(`Failed to fetch posts (${errorCountRef.current} attempts)`, error);
        }
      }
      lastErrorTimeRef.current = now;
      
      // Only show error once per failure, not repeatedly
      const isNetworkError = !isOnline || 
        error?.message?.includes('Network') || 
        error?.code === 'ERR_NETWORK' ||
        error?.message === 'Network Error';
      
      // Use setTimeout to prevent error from triggering re-renders that cause loops
      // Only show error if it's been more than 5 seconds since last error shown
      if (timeSinceLastError > 5000 || errorCountRef.current === 1) {
        setTimeout(() => {
          if (isNetworkError) {
            showError('Connection issue. Please check your internet and try again.');
          } else if (error?.response?.status === 429) {
            showError('Too many requests. Please wait a moment and try again.');
          } else if (pageNum === 1 && !shouldAppend) {
            // Only show error on first page load, not on pagination
            showError('Failed to load posts. Pull down to refresh.');
          }
        }, 100);
      }
      // For pagination errors, silently fail - user can retry by scrolling
    } finally {
      isFetchingRef.current = false;
    }
  }, [isOnline]);

  const fetchUnseenMessageCount = useCallback(async () => {
    // Prevent duplicate calls within 2 seconds
    const now = Date.now();
    if (isFetchingMessagesRef.current || (now - lastMessageFetchRef.current < 2000)) {
      return;
    }
    
    isFetchingMessagesRef.current = true;
    lastMessageFetchRef.current = now;
    
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');
      let myUserId = '';
      if (userData) {
        try {
          myUserId = JSON.parse(userData)._id;
        } catch {}
      }
      
      if (!token || !myUserId) {
        isFetchingMessagesRef.current = false;
        return;
      }
      
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
      logger.error('fetchUnseenMessageCount', error);
      // Silently fail - don't show error to user for message count
    } finally {
      isFetchingMessagesRef.current = false;
    }
  }, []);

  // Monitor network status using fetch with timeout
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        setIsOnline(true);
      } catch (error) {
        setIsOnline(false);
        logger.warn('Network connection lost');
      }
    };
    
    // Check initially
    checkNetworkStatus();
    
    // Check periodically
    const interval = setInterval(checkNetworkStatus, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Prevent multiple initializations
    if (hasInitializedRef.current) {
      return;
    }
    
    const loadInitialData = async () => {
      if (hasInitializedRef.current) return;
      hasInitializedRef.current = true;
      
      setLoading(true);
      try {
        // Load current user first
        const user = await getUserFromStorage();
        setCurrentUser(user);
        
        // Fetch unseen message count
        await fetchUnseenMessageCount();
        
        // Try to load posts without blocking on connectivity test
        logger.debug('Loading posts...');
        await fetchPosts(1, false);
      } catch (error) {
        logger.error('Error loading initial data', error);
        // Use setTimeout to prevent error from causing re-renders
        setTimeout(() => {
          showError('Failed to load content. Please pull down to refresh.');
        }, 100);
        hasInitializedRef.current = false; // Allow retry
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
    
    // Track screen view
    trackScreenView('home');
  }, []); // Empty deps - only run once on mount

  // Refresh unseen count when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchUnseenMessageCount();
    }, [fetchUnseenMessageCount])
  );

  const handleRefresh = useCallback(async () => {
    // Trigger haptic feedback for better UX
    triggerRefreshHaptic();
    setRefreshing(true);
    await Promise.all([
      fetchPosts(1, false),
      fetchUnseenMessageCount()
    ]);
    setRefreshing(false);
  }, [fetchPosts, fetchUnseenMessageCount]);

  // Throttle load more for web performance
  const handleLoadMore = useCallback(
    throttle(async () => {
      if (!loading && hasMore) {
        await fetchPosts(page + 1, true);
      }
    }, 1000),
    [loading, hasMore, page, fetchPosts]
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      ...(isWeb && {
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
      }),
    },
    safeArea: {
      flex: 1,
      ...(isWeb && {
        width: '100%',
      }),
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
    offlineBanner: {
      backgroundColor: theme.colors.error + '20',
      padding: theme.spacing.sm,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.error,
    },
    offlineText: {
      color: theme.colors.error,
      fontSize: theme.typography.small.fontSize,
      fontWeight: '600',
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
        <EmptyState
          icon="camera-outline"
          title="No Posts Yet"
          description="Start following people to see their posts in your feed, or share your first photo!"
          actionLabel="Create Your First Post"
          onAction={() => router.push('/(tabs)/post')}
          secondaryActionLabel="Explore Feed"
          onSecondaryAction={() => fetchPosts(1, false)}
        />
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
        
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>
              You're offline. Some features may be limited.
            </Text>
          </View>
        )}
        
        <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        style={styles.postsContainer}
        contentContainerStyle={styles.postsList}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
            isVisible={true}
            key={item._id}
          />
        )}
        // Virtual scrolling optimizations (both web and mobile)
        removeClippedSubviews={true}
        maxToRenderPerBatch={isWeb ? 5 : 3}
        updateCellsBatchingPeriod={50}
        initialNumToRender={isWeb ? 3 : 2}
        windowSize={isWeb ? 5 : 3}
        getItemLayout={undefined} // Let FlatList calculate dynamically
        // Performance optimizations
        maintainVisibleContentPosition={undefined}
        legacyImplementation={false}
      />
      </SafeAreaView>
    </View>
  );
}
