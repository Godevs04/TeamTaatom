import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image, FlatList, ActivityIndicator } from 'react-native';
import GradientText from '../ui/GradientText';
import { GlassModal } from '../ui/GlassModal';
import { useTheme } from '../../context/ThemeContext';
import { getPostLikers } from '../../services/posts';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface PostLikesCountProps {
  likesCount: number;
  postId?: string;
  onPress?: () => void;
  commentsCount?: number;
  sharesCount?: number;
  onCommentsPress?: () => void;
  onSharesPress?: () => void;
}

export default function PostLikesCount({
  likesCount,
  postId,
  onPress,
  commentsCount,
  sharesCount,
  onCommentsPress,
  onSharesPress,
}: PostLikesCountProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [likers, setLikers] = useState<any[]>([]);

  if (likesCount <= 0 && (!commentsCount || commentsCount <= 0) && (!sharesCount || sharesCount <= 0)) return null;

  const handlePress = async () => {
    if (onPress) {
      onPress();
      return;
    }

    if (postId) {
      setShowModal(true);
      setLoading(true);
      try {
        const response = await getPostLikers(postId, 1, 100);
        const likersList = response?.likers || (response as any)?.data?.likers || [];
        setLikers(likersList);
      } catch (error) {
        console.warn('Failed to load likers:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <View style={styles.likesContainer}>
      {likesCount > 0 && (
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={!onPress && !postId}
        >
          <GradientText
            text={`${likesCount} ${likesCount === 1 ? 'like' : 'likes'}`}
            style={styles.likesText}
          />
        </TouchableOpacity>
      )}

      {likesCount > 0 && ((commentsCount && commentsCount > 0) || (sharesCount && sharesCount > 0)) && (
        <Text style={[styles.separator, { color: theme.colors.textSecondary }]}> • </Text>
      )}

      {commentsCount !== undefined && commentsCount > 0 && (
        <TouchableOpacity
          onPress={onCommentsPress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={!onCommentsPress}
        >
          <GradientText
            text={`${commentsCount} ${commentsCount === 1 ? 'comment' : 'comments'}`}
            style={styles.likesText}
          />
        </TouchableOpacity>
      )}

      {((likesCount > 0 || (commentsCount && commentsCount > 0)) && (sharesCount && sharesCount > 0)) && (
        <Text style={[styles.separator, { color: theme.colors.textSecondary }]}> • </Text>
      )}

      {sharesCount !== undefined && sharesCount > 0 && (
        <TouchableOpacity
          onPress={onSharesPress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={!onSharesPress}
        >
          <GradientText
            text={`${sharesCount} ${sharesCount === 1 ? 'share' : 'shares'}`}
            style={styles.likesText}
          />
        </TouchableOpacity>
      )}

      <GlassModal visible={showModal} onClose={() => setShowModal(false)} style={styles.modalContentStyle}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Likes</Text>
          <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : likers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No likes yet</Text>
          </View>
        ) : (
          <FlatList
            data={likers}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.userRow}
                onPress={() => {
                  setShowModal(false);
                  router.push(`/profile/${item._id}`);
                }}
              >
                {item.profilePic ? (
                  <Image source={{ uri: item.profilePic }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.border }]}>
                    <Ionicons name="person" size={20} color={theme.colors.textSecondary} />
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={[styles.fullName, { color: theme.colors.text }]}>{item.fullName}</Text>
                  {item.username && (
                    <Text style={[styles.username, { color: theme.colors.textSecondary }]}>@{item.username}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            nestedScrollEnabled={true}
          />
        )}
      </GlassModal>
    </View>
  );
}

const styles = StyleSheet.create({
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
    flexWrap: 'wrap',
  },
  likesText: {
    fontSize: 14,
    fontWeight: '600',
  },
  separator: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  modalContentStyle: {
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
  },
  list: {
    maxHeight: 500,
  },
  listContent: {
    paddingBottom: 24,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    marginLeft: 12,
  },
  fullName: {
    fontSize: 15,
    fontWeight: '600',
  },
  username: {
    fontSize: 13,
    marginTop: 2,
  },
});
