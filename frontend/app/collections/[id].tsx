import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { getCollection, deleteCollection, removePostFromCollection, Collection } from '../../services/collections';
import { getUserFromStorage } from '../../services/auth';
import EmptyState from '../../components/EmptyState';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { PostType } from '../../types/post';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import { theme } from '../../constants/theme';
import logger from '../../utils/logger';

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

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { theme } = useTheme();
  const { showError, showSuccess } = useAlert();
  const router = useRouter();

  const loadCollection = async () => {
    try {
      setLoading(true);
      const user = await getUserFromStorage();
      if (!user) {
        router.push('/(auth)/signin');
        return;
      }
      setCurrentUser(user);

      const response = await getCollection(id);
      setCollection(response.collection);
    } catch (error: any) {
      showError('Failed to load collection');
      logger.error('Error loading collection:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadCollection();
    }
  }, [id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCollection();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Collection',
      'Are you sure you want to delete this collection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCollection(id);
              showSuccess('Collection deleted');
              router.back();
            } catch (error: any) {
              showError('Failed to delete collection');
            }
          },
        },
      ]
    );
  };

  const handleRemovePost = (postId: string) => {
    Alert.alert(
      'Remove Post',
      'Remove this post from the collection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removePostFromCollection(id, postId);
              showSuccess('Post removed');
              loadCollection();
            } catch (error: any) {
              showError('Failed to remove post');
            }
          },
        },
      ]
    );
  };

  const isOwner = currentUser && collection && currentUser._id === collection.user._id;

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!collection) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <EmptyState
          icon="albums-outline"
          title="Collection Not Found"
          description="This collection doesn't exist or you don't have access to it"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity 
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={isTablet ? 28 : 24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {collection.name}
        </Text>
        {isOwner && (
          <View style={styles.headerActions}>
            <TouchableOpacity 
              onPress={() => router.push(`/collections/create?id=${id}`)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              style={styles.headerActions}
            >
              <Ionicons name="create-outline" size={isTablet ? 28 : 24} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              style={styles.headerActions}
            >
              <Ionicons name="trash-outline" size={isTablet ? 28 : 24} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Posts List */}
      {collection.posts && collection.posts.length > 0 ? (
        <FlatList
          data={collection.posts}
          renderItem={({ item }) => (
            <View>
              <OptimizedPhotoCard
                post={item as PostType}
                onRefresh={loadCollection}
                onPress={() => router.push(`/post/${item._id}`)}
              />
              {isOwner && (
                <TouchableOpacity
                  style={[styles.removeButton, { backgroundColor: theme.colors.error }]}
                  onPress={() => handleRemovePost(item._id)}
                >
                  <Ionicons name="close" size={16} color="white" />
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <EmptyState
          icon="image-outline"
          title="No Posts"
          description="This collection is empty"
        />
      )}
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    paddingTop: isAndroid ? (isTablet ? theme.spacing.xl + 8 : 20 + 8) : (isTablet ? theme.spacing.md : 12),
    paddingBottom: isTablet ? theme.spacing.lg : 16,
    borderBottomWidth: 1,
    minHeight: isAndroid ? (isTablet ? 72 : 64) : (isTablet ? 64 : 56),
  },
  backButton: {
    // Minimum touch target: 44x44 for iOS, 48x48 for Android
    minWidth: isAndroid ? 48 : 44,
    minHeight: isAndroid ? 48 : 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.sm : (isAndroid ? 10 : 8),
    marginLeft: isTablet ? -theme.spacing.sm : -8,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  headerTitle: {
    flex: 1,
    fontSize: isTablet ? 22 : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginHorizontal: isTablet ? theme.spacing.md : 12,
    letterSpacing: isIOS ? 0.3 : 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  headerActions: {
    flexDirection: 'row',
    gap: isTablet ? theme.spacing.lg : 16,
  },
  list: {
    paddingBottom: isTablet ? theme.spacing.lg : 16,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isTablet ? theme.spacing.sm : 8,
    paddingHorizontal: isTablet ? theme.spacing.lg : 16,
    marginHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    marginBottom: isTablet ? theme.spacing.sm : 8,
    borderRadius: theme.borderRadius.sm,
    gap: isTablet ? 8 : 6,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  removeButtonText: {
    color: 'white',
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});

