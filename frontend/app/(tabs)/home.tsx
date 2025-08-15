import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Image, RefreshControl, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { getPosts } from '../../services/posts';
import { PostType } from '../../types/post';
import PhotoCard from '../../components/PhotoCard';

export default function HomeScreen() {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { theme } = useTheme();

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
    const loadInitialPosts = async () => {
      setLoading(true);
      await fetchPosts(1, false);
      setLoading(false);
    };

    loadInitialPosts();
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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg }}>
        <View style={{ alignItems: 'center', marginBottom: theme.spacing.xl, width: '100%' }}>
          <View style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.xl,
            padding: theme.spacing.md,
            shadowColor: theme.colors.shadow,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 8,
            marginBottom: theme.spacing.lg,
            alignItems: 'center',
            width: 260,
            alignSelf: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <Image
              source={require('../../assets/images/home_post.png')}
              style={{ width: 180, height: 180, borderRadius: 32, opacity: 0.92 }}
              resizeMode="cover"
            />
            <View style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 0,
              borderBottomLeftRadius: 32,
              borderBottomRightRadius: 32,
              backgroundColor: theme.colors.background + 'E6', // more subtle fade overlay
              zIndex: 2,
            }} />
          </View>
          <Text style={{ color: theme.colors.text, fontSize: theme.typography.h2.fontSize, fontWeight: '800', marginBottom: theme.spacing.sm, textAlign: 'center', letterSpacing: 0.2 }}>
            No Posts Yet
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize + 1, textAlign: 'center', marginBottom: theme.spacing.lg, lineHeight: 22, maxWidth: 280, alignSelf: 'center' }}>
            Share your first photo from the <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Post</Text> tab and inspire the community!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item._id}
      contentContainerStyle={{ backgroundColor: theme.colors.background, padding: theme.spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[theme.colors.primary]}
          tintColor={theme.colors.primary}
        />
      }
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.1}
      ListFooterComponent={
        hasMore ? (
          <View style={{ padding: theme.spacing.md, alignItems: 'center' }}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <PhotoCard 
          post={item} 
          onRefresh={() => handleRefresh()}
        />
      )}
    />
  );
}

// styles removed, now handled inline with theme context
