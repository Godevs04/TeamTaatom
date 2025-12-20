import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
  Dimensions,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getArchivedPosts, getHiddenPosts, unarchivePost, unhidePost } from '../../services/posts';
import { PostType } from '../../types/post';
import CustomAlert from '../../components/CustomAlert';
import { createLogger } from '../../utils/logger';
import { theme } from '../../constants/theme';

// Responsive dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Elegant font families
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

const logger = createLogger('ManagePosts');

type TabType = 'archived' | 'hidden';

export default function ManagePostsScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('archived');
  const [archivedPosts, setArchivedPosts] = useState<PostType[]>([]);
  const [hiddenPosts, setHiddenPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [showAlert, setShowAlert] = useState(false);
  const [showConfirmAlert, setShowConfirmAlert] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ postId: string; type: TabType } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    onConfirm: () => {},
  });

  const router = useRouter();
  const { theme } = useTheme();

  const loadPosts = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      if (!append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      const pageSize = 20;
      const [archivedData, hiddenData] = await Promise.all([
        getArchivedPosts(page, pageSize),
        getHiddenPosts(page, pageSize),
      ]);
      
      if (append) {
        setArchivedPosts(prev => [...prev, ...(archivedData.posts || [])]);
        setHiddenPosts(prev => [...prev, ...(hiddenData.posts || [])]);
      } else {
        setArchivedPosts(archivedData.posts || []);
        setHiddenPosts(hiddenData.posts || []);
      }
      
      setHasMore(
        (archivedData.posts?.length || 0) >= pageSize || 
        (hiddenData.posts?.length || 0) >= pageSize
      );
      setCurrentPage(page);
    } catch (error: any) {
      logger.error('Error loading posts', error);
      showAlertMessage('Error', error.message || 'Failed to load posts', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  }, [loadPosts]);

  const showAlertMessage = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    onConfirm?: () => void
  ) => {
    setAlertConfig({
      title,
      message,
      type,
      onConfirm: onConfirm || (() => {}),
    });
    setShowAlert(true);
    
    // Auto-close success messages after 2 seconds
    if (type === 'success') {
      setTimeout(() => {
        setShowAlert(false);
      }, 2000);
    }
  };

  const handleUnarchive = async (postId: string) => {
    try {
      setProcessingIds((prev) => new Set(prev).add(postId));
      await unarchivePost(postId);
      setArchivedPosts((prev) => prev.filter((p) => p._id !== postId));
      showAlertMessage('Success', 'Post restored successfully!', 'success');
    } catch (error: any) {
      showAlertMessage('Error', error.message || 'Failed to restore post', 'error');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const handleUnhide = async (postId: string) => {
    try {
      setProcessingIds((prev) => new Set(prev).add(postId));
      await unhidePost(postId);
      setHiddenPosts((prev) => prev.filter((p) => p._id !== postId));
      showAlertMessage('Success', 'Post restored successfully!', 'success');
    } catch (error: any) {
      showAlertMessage('Error', error.message || 'Failed to restore post', 'error');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const confirmRestore = (postId: string, type: TabType) => {
    setPendingAction({ postId, type });
    setShowConfirmAlert(true);
  };

  const executeRestore = () => {
    if (pendingAction) {
      const { postId, type } = pendingAction;
      setShowConfirmAlert(false);
      if (type === 'archived') {
        handleUnarchive(postId);
      } else {
        handleUnhide(postId);
      }
      setPendingAction(null);
    }
  };

  // Filter posts by search query
  const filteredPosts = (activeTab === 'archived' ? archivedPosts : hiddenPosts).filter(post => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      post.caption?.toLowerCase().includes(query) ||
      post.location?.address?.toLowerCase().includes(query) ||
      post.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  });
  
  const currentPosts = filteredPosts;
  const hasPosts = currentPosts.length > 0;
  
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !searchQuery.trim()) {
      loadPosts(currentPage + 1, true);
    }
  }, [currentPage, hasMore, loadingMore, searchQuery, loadPosts]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar
        title="Manage Posts"
        showBack={true}
        onBack={() => router.back()}
      />

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
          <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search posts..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'archived' && { backgroundColor: theme.colors.primary + '20' },
          ]}
          onPress={() => setActiveTab('archived')}
        >
          <Ionicons
            name="archive-outline"
            size={20}
            color={activeTab === 'archived' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'archived' ? theme.colors.primary : theme.colors.textSecondary,
              },
            ]}
          >
            Archived ({archivedPosts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'hidden' && { backgroundColor: theme.colors.primary + '20' },
          ]}
          onPress={() => setActiveTab('hidden')}
        >
          <Ionicons
            name="eye-off-outline"
            size={20}
            color={activeTab === 'hidden' ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'hidden' ? theme.colors.primary : theme.colors.textSecondary,
              },
            ]}
          >
            Hidden ({hiddenPosts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
        >
          {!hasPosts ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name={searchQuery.trim() ? 'search-outline' : (activeTab === 'archived' ? 'archive-outline' : 'eye-off-outline')}
                size={64}
                color={theme.colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                {searchQuery.trim() 
                  ? 'No posts found' 
                  : `No ${activeTab === 'archived' ? 'archived' : 'hidden'} posts`}
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
                {searchQuery.trim()
                  ? 'Try adjusting your search terms'
                  : (activeTab === 'archived'
                      ? 'Posts you archive will appear here'
                      : 'Posts you hide will appear here')}
              </Text>
            </View>
          ) : (
            <View style={styles.postsContainer}>
              {currentPosts.map((post) => (
                <View
                  key={post._id}
                  style={[styles.postCard, { backgroundColor: theme.colors.surface }]}
                >
                  <View style={styles.postContent}>
                    {post.imageUrl && (
                      <Image
                        source={{ uri: post.imageUrl }}
                        style={styles.postImage}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.postInfo}>
                      <Text
                        style={[styles.postCaption, { color: theme.colors.text }]}
                        numberOfLines={2}
                      >
                        {post.caption || 'No caption'}
                      </Text>
                      <Text style={[styles.postDate, { color: theme.colors.textSecondary }]}>
                        {new Date(post.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.restoreButton,
                      {
                        backgroundColor: theme.colors.primary,
                        opacity: processingIds.has(post._id) ? 0.6 : 1,
                      },
                    ]}
                    onPress={() => confirmRestore(post._id, activeTab)}
                    disabled={processingIds.has(post._id)}
                  >
                    {processingIds.has(post._id) ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="return-up-back" size={18} color="#FFFFFF" />
                        <Text style={styles.restoreButtonText}>Restore</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
              
              {/* Load More Button */}
              {hasMore && !searchQuery.trim() && (
                <TouchableOpacity
                  style={[styles.loadMoreButton, { backgroundColor: theme.colors.primary }]}
                  onPress={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.loadMoreText}>Load More</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Success/Error Alert */}
      <CustomAlert
        visible={showAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={() => {
          setShowAlert(false);
          alertConfig.onConfirm();
        }}
        onClose={() => setShowAlert(false)}
      />

      {/* Confirmation Alert for Restore */}
      <CustomAlert
        visible={showConfirmAlert}
        title="Restore Post"
        message="Are you sure you want to restore this post? It will be visible in your feed again."
        type="warning"
        showCancel={true}
        confirmText="Restore"
        cancelText="Cancel"
        onConfirm={executeRestore}
        onCancel={() => {
          setShowConfirmAlert(false);
          setPendingAction(null);
        }}
        onClose={() => {
          setShowConfirmAlert(false);
          setPendingAction(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isTablet ? 1000 : 800,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    gap: isTablet ? theme.spacing.sm : 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isTablet ? theme.spacing.md : 12,
    paddingHorizontal: isTablet ? theme.spacing.lg : 16,
    borderRadius: theme.borderRadius.md,
    gap: isTablet ? theme.spacing.sm : 8,
  },
  tabText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: isTablet ? 100 : 80,
  },
  emptyText: {
    fontSize: isTablet ? theme.typography.h3.fontSize : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginTop: isTablet ? theme.spacing.lg : 16,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  emptySubtext: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    marginTop: isTablet ? theme.spacing.sm : 8,
    textAlign: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xxl : 40,
    maxWidth: isTablet ? 500 : 300,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  postsContainer: {
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  postCard: {
    borderRadius: theme.borderRadius.md,
    marginBottom: isTablet ? theme.spacing.md : 12,
    overflow: 'hidden',
  },
  postContent: {
    flexDirection: 'row',
    padding: isTablet ? theme.spacing.md : 12,
  },
  postImage: {
    width: isTablet ? 100 : 80,
    height: isTablet ? 100 : 80,
    borderRadius: theme.borderRadius.sm,
    marginRight: isTablet ? theme.spacing.md : 12,
  },
  postInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  postCaption: {
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 15,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  postDate: {
    fontSize: isTablet ? theme.typography.body.fontSize : 13,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isTablet ? theme.spacing.md : 12,
    paddingHorizontal: isTablet ? theme.spacing.lg : 16,
    gap: isTablet ? 8 : 6,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  restoreButtonText: {
    color: '#FFFFFF',
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  loadMoreButton: {
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

