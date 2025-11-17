import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
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
      console.error('Error loading collection:', error);
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
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          icon="albums-outline"
          title="Collection Not Found"
          description="This collection doesn't exist or you don't have access to it"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {collection.name}
        </Text>
        {isOwner && (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push(`/collections/${id}/edit`)}>
              <Ionicons name="create-outline" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Collection Info */}
      <View style={[styles.collectionInfo, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        {collection.coverImage && (
          <Image source={{ uri: collection.coverImage }} style={styles.coverImage} />
        )}
        <View style={styles.collectionDetails}>
          <Text style={[styles.collectionName, { color: theme.colors.text }]}>
            {collection.name}
          </Text>
          {collection.description && (
            <Text style={[styles.collectionDescription, { color: theme.colors.textSecondary }]}>
              {collection.description}
            </Text>
          )}
          <View style={styles.collectionMeta}>
            <Ionicons name="image-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
              {collection.posts?.length || 0} {collection.posts?.length === 1 ? 'post' : 'posts'}
            </Text>
            {!collection.isPublic && (
              <>
                <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}> • </Text>
                <Ionicons name="lock-closed-outline" size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}> Private</Text>
              </>
            )}
          </View>
        </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  collectionInfo: {
    padding: 16,
    borderBottomWidth: 1,
  },
  coverImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  collectionDetails: {
    gap: 8,
  },
  collectionName: {
    fontSize: 20,
    fontWeight: '700',
  },
  collectionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  collectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  list: {
    paddingBottom: 16,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    gap: 6,
  },
  removeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

