import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { PostType } from '../types/post';
import { toggleLike, addComment } from '../services/posts';
import { getUserFromStorage } from '../services/auth';
import CommentBox from './CommentBox';
import RotatingGlobe from './RotatingGlobe';
import WorldMap from './WorldMap';

interface PhotoCardProps {
  post: PostType;
  onRefresh?: () => void;
  onPress?: () => void;
}

export default function PhotoCard({
  post,
  onRefresh,
  onPress,
}: PhotoCardProps) {
  const { theme } = useTheme();
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [showMenu, setShowMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showWorldMap, setShowWorldMap] = useState(false);

  React.useEffect(() => {
    const loadUser = async () => {
      const user = await getUserFromStorage();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  const handleLike = async () => {
    try {
      const response = await toggleLike(post._id);
      setIsLiked(response.isLiked);
      setLikesCount(response.likesCount);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update like');
      console.error('Like error:', error);
    }
  };

  const handleComment = async (text: string) => {
    try {
      const response = await addComment(post._id, text);
      setComments(prev => [...prev, response.comment]);
      if (onRefresh) onRefresh();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to add comment');
      console.error('Comment error:', error);
    }
  };

  const handleDeletePost = async () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Implement delete post API call
              Alert.alert('Success', 'Post deleted successfully');
              if (onRefresh) onRefresh();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete post');
            }
          }
        }
      ]
    );
    setShowMenu(false);
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      marginBottom: theme.spacing.md,
      overflow: 'hidden',
      ...theme.shadows.medium,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: theme.spacing.sm,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    headerText: {
      flex: 1,
    },
    username: {
      fontSize: theme.typography.body.fontSize,
      fontWeight: '600',
      color: theme.colors.text,
    },
    location: {
      fontSize: theme.typography.small.fontSize,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    image: {
      width: '100%',
      height: 400,
      resizeMode: 'cover',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    actionButton: {
      marginRight: theme.spacing.lg,
      padding: theme.spacing.xs,
    },
    likesText: {
      fontSize: theme.typography.body.fontSize,
      fontWeight: '600',
      color: theme.colors.text,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.xs,
    },
    caption: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    captionText: {
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.text,
      lineHeight: 20,
    },
    commentsPreview: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
    },
    commentsText: {
      fontSize: theme.typography.small.fontSize,
      color: theme.colors.textSecondary,
    },
    menuModal: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    menuContainer: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius.lg,
      borderTopRightRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    menuItemText: {
      fontSize: theme.typography.body.fontSize,
      marginLeft: theme.spacing.sm,
      color: theme.colors.text,
    },
    deleteText: {
      color: '#FF3040',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={post.user?.profilePic ? { uri: post.user.profilePic } : require('../assets/avatars/male_avatar.png')}
          style={styles.avatar}
        />
        <View style={styles.headerText}>
          <Text style={styles.username}>{post.user?.fullName || 'Unknown User'}</Text>
          {post.location?.address && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                onPress={() => setShowWorldMap(true)}
              >
                <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} />
                <Text style={[styles.location, { marginLeft: 2, flex: 1 }]}> 
                  {post.location.address}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <TouchableOpacity 
          style={{ padding: theme.spacing.xs }}
          onPress={() => setShowMenu(true)}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onPress} activeOpacity={0.95}>
        <Image source={{ uri: post.imageUrl }} style={styles.image} />
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={26}
            color={isLiked ? '#FF3040' : theme.colors.text}
          />
        </TouchableOpacity>
      </View>

      {likesCount > 0 && (
        <Text style={styles.likesText}>
          {likesCount.toLocaleString()} {likesCount === 1 ? 'like' : 'likes'}
        </Text>
      )}

      {post.caption && (
        <View style={styles.caption}>
          <Text style={styles.captionText}>
            <Text style={styles.username}>{post.user?.fullName || 'Unknown User'}</Text>
            {' '}{post.caption}
          </Text>
        </View>
      )}

      <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }}>
        <Text style={{ 
          fontSize: theme.typography.small.fontSize - 1, 
          color: theme.colors.textSecondary,
          textTransform: 'uppercase'
        }}>
          {new Date(post.createdAt).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          }).toUpperCase()}
        </Text>
      </View>

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuModal}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            {currentUser && currentUser._id === post.user?._id && (
              <TouchableOpacity style={styles.menuItem} onPress={handleDeletePost}>
                <Ionicons name="trash-outline" size={20} color="#FF3040" />
                <Text style={[styles.menuItemText, styles.deleteText]}>Delete Post</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
              <Ionicons name="close-outline" size={20} color={theme.colors.text} />
              <Text style={styles.menuItemText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* World Map Modal */}
      {post.location?.coordinates.latitude !== 0 && post.location?.coordinates.longitude !== 0 && (
        <WorldMap
          visible={showWorldMap}
          locations={[{
            latitude: post.location.coordinates.latitude,
            longitude: post.location.coordinates.longitude,
            address: post.location.address,
            date: post.createdAt,
          }]}
          onClose={() => setShowWorldMap(false)}
        />
      )}
    </View>
  );
};
