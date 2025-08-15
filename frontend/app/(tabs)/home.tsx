import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator, 
  Image, 
  RefreshControl, 
  Alert,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ScrollView
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { getPosts } from '../../services/posts';
import { PostType } from '../../types/post';
import PhotoCard from '../../components/PhotoCard';
import { getUserFromStorage } from '../../services/auth';

export default function HomeScreen() {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { theme, mode } = useTheme();

  const fetchPosts = useCallback(async (pageNum: number = 1, shouldAppend: boolean = false) => {
    try {
      const response = await getPosts(pageNum, 20);
      
      if (shouldAppend) {
        setPosts(prev => [...prev, ...response.posts]);
      } else {
        setPosts(response.posts);
      }
      
      setHasMore(response.pagination.hasNextPage);
      setPage(pageNum);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load posts');
      console.error('Failed to fetch posts:', error);
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        // Load current user
        const user = await getUserFromStorage();
        setCurrentUser(user);
        
        // Load posts
        await fetchPosts(1, false);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [fetchPosts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts(1, false);
    setRefreshing(false);
  }, [fetchPosts]);

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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.colors.border,
    },
    logo: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: -0.5,
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
    },
    loadMoreContainer: {
      padding: theme.spacing.md,
      alignItems: 'center',
    },
  });

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.logo}>Taatom</Text>
    </View>
  );

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
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.background} 
      />
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
        renderItem={({ item }) => (
          <PhotoCard 
            post={item} 
            onRefresh={handleRefresh}
          />
        )}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.sm }} />
        )}
      />
    </SafeAreaView>
  );
}
