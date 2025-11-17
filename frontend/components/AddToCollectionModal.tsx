import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { getCollections, addPostToCollection } from '../services/collections';
import type { Collection } from '../services/collections';

interface AddToCollectionModalProps {
  visible: boolean;
  postId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddToCollectionModal({
  visible,
  postId,
  onClose,
  onSuccess,
}: AddToCollectionModalProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const { theme } = useTheme();
  const { showError, showSuccess } = useAlert();

  useEffect(() => {
    if (visible) {
      loadCollections();
    }
  }, [visible]);

  const loadCollections = async () => {
    try {
      setLoading(true);
      const response = await getCollections();
      setCollections(response.collections || []);
    } catch (error: any) {
      showError('Failed to load collections');
      console.error('Error loading collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    try {
      setAdding(collectionId);
      await addPostToCollection(collectionId, postId);
      showSuccess('Post added to collection');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      showError(error.message || 'Failed to add post to collection');
    } finally {
      setAdding(null);
    }
  };

  const renderCollection = ({ item }: { item: Collection }) => (
    <TouchableOpacity
      style={[styles.collectionItem, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}
      onPress={() => handleAddToCollection(item._id)}
      disabled={adding === item._id}
    >
      {item.coverImage ? (
        <Image source={{ uri: item.coverImage }} style={styles.collectionImage} />
      ) : (
        <View style={[styles.collectionImagePlaceholder, { backgroundColor: theme.colors.surfaceSecondary }]}>
          <Ionicons name="albums-outline" size={24} color={theme.colors.textSecondary} />
        </View>
      )}
      <View style={styles.collectionInfo}>
        <Text style={[styles.collectionName, { color: theme.colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.collectionMeta, { color: theme.colors.textSecondary }]}>
          {item.posts?.length || 0} {item.posts?.length === 1 ? 'post' : 'posts'}
        </Text>
      </View>
      {adding === item._id ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add to Collection</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : collections.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="albums-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.text }]}>No collections</Text>
              <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
                Create a collection first
              </Text>
            </View>
          ) : (
            <FlatList
              data={collections}
              renderItem={renderCollection}
              keyExtractor={(item) => item._id}
              style={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
  },
  list: {
    maxHeight: 400,
  },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  collectionImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  collectionImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  collectionMeta: {
    fontSize: 12,
  },
});

