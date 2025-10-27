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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getArchivedPosts, getHiddenPosts, unarchivePost, unhidePost } from '../../services/posts';
import { PostType } from '../../types/post';
import CustomAlert from '../../components/CustomAlert';

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
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    onConfirm: () => {},
  });

  const router = useRouter();
  const { theme } = useTheme();

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const [archivedData, hiddenData] = await Promise.all([
        getArchivedPosts(1, 50),
        getHiddenPosts(1, 50),
      ]);
      setArchivedPosts(archivedData.posts || []);
      setHiddenPosts(hiddenData.posts || []);
    } catch (error: any) {
      console.error('Error loading posts:', error);
      showAlertMessage('Error', error.message || 'Failed to load posts', 'error');
    } finally {
      setLoading(false);
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

  const currentPosts = activeTab === 'archived' ? archivedPosts : hiddenPosts;
  const hasPosts = currentPosts.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar
        title="Manage Posts"
        showBack={true}
        onBack={() => router.back()}
      />

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
                name={activeTab === 'archived' ? 'archive-outline' : 'eye-off-outline'}
                size={64}
                color={theme.colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No {activeTab === 'archived' ? 'archived' : 'hidden'} posts
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
                {activeTab === 'archived'
                  ? 'Posts you archive will appear here'
                  : 'Posts you hide will appear here'}
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
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  postsContainer: {
    padding: 16,
  },
  postCard: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  postContent: {
    flexDirection: 'row',
    padding: 12,
  },
  postImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  postInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  postCaption: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  postDate: {
    fontSize: 13,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  restoreButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

