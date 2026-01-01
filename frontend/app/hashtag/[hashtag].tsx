import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getHashtagPosts, getHashtagDetails, Hashtag } from '../../services/hashtags';
import { PostType } from '../../types/post';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import EmptyState from '../../components/EmptyState';
import ErrorMessage from '../../components/ErrorMessage';
import NavBar from '../../components/NavBar';

export default function HashtagDetailScreen() {
  const { hashtag } = useLocalSearchParams<{ hashtag: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const [hashtagData, setHashtagData] = useState<Hashtag | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const hashtagName = hashtag?.replace(/^#/, '') || '';

  const loadHashtagData = async () => {
    try {
      const data = await getHashtagDetails(hashtagName);
      setHashtagData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load hashtag');
    }
  };

  const loadPosts = async (pageNum: number = 1, append: boolean = false) => {
    try {
      const response = await getHashtagPosts(hashtagName, pageNum);
      
      if (append) {
        setPosts(prev => [...prev, ...response.posts]);
      } else {
        setPosts(response.posts);
      }
      
      setPage(response.pagination.currentPage);
      setHasNextPage(response.pagination.hasNextPage);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadHashtagData(), loadPosts(1, false)]);
    setLoading(false);
  };

  useEffect(() => {
    if (hashtagName) {
      loadData();
    }
  }, [hashtagName]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (!loadingMore && hasNextPage) {
      setLoadingMore(true);
      await loadPosts(page + 1, true);
      setLoadingMore(false);
    }
  };

  const renderPost = ({ item }: { item: PostType }) => (
    <OptimizedPhotoCard post={item} />
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar 
          title={`#${hashtagName}`}
          showBack={true}
          onBack={() => router.back()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error && posts.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar 
          title={`#${hashtagName}`}
          showBack={true}
          onBack={() => router.back()}
        />
        <ErrorMessage
          message={error}
          onRetry={loadData}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with NavBar */}
      <NavBar 
        title={`#${hashtagName}`}
        showBack={true}
        onBack={() => router.back()}
      />
      
      {/* Hashtag Info Section - Simplified */}
          {hashtagData && (
        <View style={[styles.infoSection, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View style={[styles.hashtagIconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
            <Ionicons name="pricetag" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.postCount, { color: theme.colors.textSecondary }]}>
              {hashtagData.postCount} {hashtagData.postCount === 1 ? 'post' : 'posts'}
            </Text>
          </View>
        </View>
      )}

      {/* Posts List */}
      {posts.length === 0 ? (
        <EmptyState
          icon="image-outline"
          title="No posts yet"
          description={`No posts found for #${hashtagName}`}
        />
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : null
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  hashtagIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  postCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 20,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

