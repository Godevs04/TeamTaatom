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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getHashtagPosts, getHashtagDetails, Hashtag } from '../../services/hashtags';
import { PostType } from '../../types/post';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import EmptyState from '../../components/EmptyState';
import ErrorMessage from '../../components/ErrorMessage';

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
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            #{hashtagName}
          </Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error && posts.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            #{hashtagName}
          </Text>
          <View style={styles.placeholder} />
        </View>
        <ErrorMessage
          message={error}
          onRetry={loadData}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            #{hashtagName}
          </Text>
          {hashtagData && (
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
              {hashtagData.postCount} {hashtagData.postCount === 1 ? 'post' : 'posts'}
            </Text>
          )}
        </View>
        <View style={styles.placeholder} />
      </View>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

