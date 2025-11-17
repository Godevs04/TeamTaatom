import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  Share,
  Animated,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { PostType } from '../types/post';
import { toggleLike, addComment, deletePost, archivePost, hidePost, toggleComments, updatePost } from '../services/posts';
import { getUserFromStorage } from '../services/auth';
import { loadImageWithFallback } from '../utils/imageLoader';
import { useRouter } from 'expo-router';
import CustomAlert from './CustomAlert';
import CommentModal from './CommentModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { savedEvents } from '../utils/savedEvents';
import { realtimePostsService } from '../services/realtimePosts';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { trackEngagement, trackPostView, trackFeatureUsage } from '../services/analytics';
import ShareModal from './ShareModal';
import PostHeader from './post/PostHeader';
import PostImage from './post/PostImage';
import PostActions from './post/PostActions';
import PostLikesCount from './post/PostLikesCount';
import PostCaption from './post/PostCaption';

interface PhotoCardProps {
  post: PostType;
  onRefresh?: () => void;
  onPress?: () => void;
  isVisible?: boolean; // For lazy loading
}

function PhotoCard({
  post,
  onRefresh,
  onPress,
  isVisible = true,
}: PhotoCardProps) {
  const isWeb = Platform.OS === 'web';
  const { theme } = useTheme();
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.comments || []);
  const [showMenu, setShowMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showWorldMap, setShowWorldMap] = useState(false);
  const [isSaved, setIsSaved] = useState(false); // Add save state
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showCustomAlert, setShowCustomAlert] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption || '');
  const [isMenuLoading, setIsMenuLoading] = useState(false);
  const [commentsDisabled, setCommentsDisabled] = useState((post as any).commentsDisabled || false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    onConfirm: () => {},
  });

  // Animation for multiple images indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const loadUser = async () => {
      const user = await getUserFromStorage();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  // Load saved state on mount
  React.useEffect(() => {
    const loadSavedState = async () => {
      try {
        const stored = await AsyncStorage.getItem('savedPosts');
        const arr = stored ? JSON.parse(stored) : [];
        setIsSaved(Array.isArray(arr) && arr.includes(post._id));
      } catch {}
    };
    loadSavedState();
  }, [post._id]);

  // Note: realtimePostsService.initialize() is now called automatically when subscribing
  // No need to call it explicitly here

  // Listen for WebSocket real-time updates
  // Use refs to track current state and prevent unnecessary updates
  const isUpdatingRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);
  const stateRef = useRef({ isLiked, likesCount });
  
  // Sync ref with state changes (without causing re-renders)
  React.useEffect(() => {
    stateRef.current = { isLiked, likesCount };
  }, [isLiked, likesCount]);
  
  // Wrapper functions that update state (ref is synced via separate useEffect)
  const setIsLikedWithRef = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setIsLiked(value);
  }, []);
  
  const setLikesCountWithRef = useCallback((value: number | ((prev: number) => number)) => {
    setLikesCount(value);
  }, []);
  
  React.useEffect(() => {
    const unsubscribeLikes = realtimePostsService.subscribeToLikes((data) => {
      if (data.postId === post._id) {
        // Prevent processing if we're already updating (avoid loops)
        if (isUpdatingRef.current) {
          return;
        }
        
        // Prevent processing duplicate events within 100ms
        const now = Date.now();
        if (now - lastUpdateTimeRef.current < 100) {
          return;
        }
        
        // Check if state already matches BEFORE calling setState
        const current = stateRef.current;
        if (current.isLiked === data.isLiked && current.likesCount === data.likesCount) {
          return; // State already matches, no update needed
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Home page - WebSocket like update received:', data);
        }
        
        // Only update if the WebSocket data is more recent than our current state
        const currentTimestamp = Date.now();
        const eventTimestamp = new Date(data.timestamp).getTime();
        const timeDiff = currentTimestamp - eventTimestamp;
        
        // If the event is older than 5 seconds, it's likely stale data
        if (timeDiff > 5000) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Home page - Ignoring stale WebSocket event (older than 5s):', timeDiff + 'ms');
          }
          return;
        }
        
        // Mark as updating and update state
        isUpdatingRef.current = true;
        lastUpdateTimeRef.current = now;
        setIsLikedWithRef(data.isLiked);
        setLikesCountWithRef(data.likesCount);
        
        // Reset flag after a short delay
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 200);
      }
    });

    const unsubscribeComments = realtimePostsService.subscribeToComments((data) => {
      if (data.postId === post._id) {
        // Update comments count if needed - use functional update
        setComments(prev => [...prev, data.comment]);
      }
    });

    const unsubscribeSaves = realtimePostsService.subscribeToSaves((data) => {
      if (data.postId === post._id) {
        setIsSaved(data.isSaved);
      }
    });

    return () => {
      unsubscribeLikes();
      unsubscribeComments();
      unsubscribeSaves();
    };
  }, [post._id]);

  // Listen for post action events from other pages (legacy fallback)
  React.useEffect(() => {
    const unsubscribe = savedEvents.addPostActionListener((postId, action, data) => {
      if (postId === post._id) {
        switch (action) {
          case 'like':
          case 'unlike':
            // Ensure we're setting the correct boolean value
            const eventIsLiked = data.isLiked === true;
            const eventLikesCount = data.likesCount || 0;
            
            setIsLikedWithRef(eventIsLiked);
            setLikesCountWithRef(eventLikesCount);
            break;
          case 'save':
          case 'unsave':
            setIsSaved(data.isBookmarked);
            break;
          case 'comment':
            // Update comments count if needed
            break;
        }
      }
    });

    return unsubscribe;
  }, [post._id, isLiked, likesCount]);

  // Animation for multiple images indicator
  React.useEffect(() => {
    if (post.images && post.images.length > 1) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      
      return () => pulseAnimation.stop();
    }
  }, [post.images, pulseAnim]);

  // Robust image loading with multiple strategies
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  React.useEffect(() => {
    if (!post.imageUrl) {
      setImageLoading(false);
      setImageError(true);
      return;
    }

    setImageLoading(true);
    setImageError(false);
    setImageUri(null);

    // Progressive loading strategy
    const loadImage = async () => {
      try {
        // Use progressive loading with multiple strategies
        // Web: Faster timeout, fewer retries for better UX
        const timeout = isWeb ? 5000 : 8000;
        const retries = isWeb ? 1 : 2;
        
        const optimizedUrl = await loadImageWithFallback(post.imageUrl, {
          timeout,
          retries,
          retryDelay: 1000
        });
        
        setImageUri(optimizedUrl);
        setImageLoading(false);
        setImageError(false);
        
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('PhotoCard: Image loading failed for post', post._id, error);
        }
        setImageError(true);
        setImageLoading(false);
      }
    };

    loadImage();
  }, [post.imageUrl, post._id, isWeb]);

  const handleLike = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be signed in to like posts.');
      return;
    }

    try {
      // Mark as updating to prevent WebSocket listener from processing
      isUpdatingRef.current = true;
      lastUpdateTimeRef.current = Date.now();
      
      const response = await toggleLike(post._id);
      setIsLikedWithRef(response.isLiked);
      setLikesCountWithRef(response.likesCount);
      
      // Track engagement
      trackEngagement(response.isLiked ? 'like' : 'unlike', 'post', post._id, {
        likes_count: response.likesCount,
      });
      
      // Emit event to notify other pages
      savedEvents.emitPostAction(post._id, response.isLiked ? 'like' : 'unlike', {
        likesCount: response.likesCount,
        isLiked: response.isLiked
      });

      // Emit WebSocket event for real-time updates (but ignore our own event)
      await realtimePostsService.emitLike(post._id, response.isLiked, response.likesCount);
      
      // Reset flag after a delay to allow WebSocket event to be ignored
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 500);
      
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like status.');
    }
  };

  const handleShareClick = () => {
    setShowShareModal(true);
  };

  const handleShare = async () => {
    try {
      // Show loading alert
      showCustomAlertMessage('Sharing', 'Preparing post for sharing...', 'info');

      // Try expo-sharing first
      if (await Sharing.isAvailableAsync()) {
        try {
          // Download the image to local storage
          const filename = `post_${post._id}_${Date.now()}.jpg`;
          const localUri = `${FileSystem.cacheDirectory}${filename}`;
          
          const downloadResult = await FileSystem.downloadAsync(post.imageUrl, localUri);
          
          if (downloadResult.status === 200) {
            // Share the local file
            await Sharing.shareAsync(downloadResult.uri, {
              mimeType: 'image/jpeg',
              dialogTitle: 'Share this post',
            });
            
            showCustomAlertMessage('Success', 'Post shared successfully!', 'success');
            
            // Clean up the temporary file
            try {
              await FileSystem.deleteAsync(downloadResult.uri);
            } catch (cleanupError) {
              console.warn('Failed to clean up temporary file:', cleanupError);
            }
            return;
          }
        } catch (expoError) {
          console.warn('Expo sharing failed, trying fallback:', expoError);
        }
      }

      // Fallback to React Native Share API
      const shareContent = {
        title: `Post by ${post.user.fullName}`,
        message: post.caption ? `${post.caption}\n\n${post.imageUrl}` : post.imageUrl,
        url: post.imageUrl,
      };

      const result = await Share.share(shareContent);
      
      if (result.action === Share.sharedAction) {
        showCustomAlertMessage('Success', 'Post shared successfully!', 'success');
      } else if (result.action === Share.dismissedAction) {
        // User dismissed the share dialog
        console.log('Share dialog dismissed');
      }
    } catch (error) {
      console.error('Error sharing post:', error);
      showCustomAlertMessage('Error', 'Failed to share post. Please try again.', 'error');
    }
  };

  const handleSave = async () => {
    try {
      // Toggle save state
      const newSaveState = !isSaved;
      setIsSaved(newSaveState);
      
      // Persist to AsyncStorage for Saved tab
      const key = 'savedPosts';
      const stored = await AsyncStorage.getItem(key);
      const arr = stored ? JSON.parse(stored) : [];
      let next: string[] = Array.isArray(arr) ? arr : [];
      if (newSaveState) {
        if (!next.includes(post._id)) next.push(post._id);
      } else {
        next = next.filter(id => id !== post._id);
      }
      await AsyncStorage.setItem(key, JSON.stringify(next));
      console.log(newSaveState ? 'Post saved' : 'Post unsaved', post._id);
      
      // Emit events to notify other pages
      savedEvents.emitChanged();
      savedEvents.emitPostAction(post._id, newSaveState ? 'save' : 'unsave', {
        isBookmarked: newSaveState
      });
    } catch (error) {
      console.error('Error saving post:', error);
      showCustomAlertMessage('Error', 'Failed to save post', 'error');
    }
  };

  const showCustomAlertMessage = (
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
    setShowCustomAlert(true);
    
    // Auto-close success messages after 2 seconds
    if (type === 'success') {
      setTimeout(() => {
        setShowCustomAlert(false);
      }, 2000);
    }
  };

  const handleComment = async (text: string) => {
    if (!currentUser) {
      showCustomAlertMessage('Error', 'You must be signed in to comment.', 'error');
      return;
    }

    try {
      const response = await addComment(post._id, text);
      setComments(prev => [...prev, response.comment]);
      
      // Emit event to notify other pages
      savedEvents.emitPostAction(post._id, 'comment', {
        comment: response.comment,
        commentsCount: comments.length + 1
      });
      
      showCustomAlertMessage('Success', 'Comment added successfully!', 'success');
    } catch (error) {
      console.error('Error adding comment:', error);
      showCustomAlertMessage('Error', 'Failed to add comment.', 'error');
    }
  };

  const handleCommentAdded = (newComment: any) => {
    setComments(prev => [...prev, newComment]);
  };

  const handleOpenComments = () => {
    if (!currentUser) {
      showCustomAlertMessage('Error', 'You must be signed in to view comments.', 'error');
      return;
    }
    setShowCommentModal(true);
  };

  const handleDeletePost = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be signed in to delete posts.');
      return;
    }

    if (currentUser._id !== post.user._id) {
      Alert.alert('Error', 'You can only delete your own posts.');
      return;
    }

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
              setIsMenuLoading(true);
              await deletePost(post._id);
              showCustomAlertMessage('Success', 'Post deleted successfully!', 'success');
              if (onRefresh) onRefresh();
            } catch (error: any) {
              console.error('Error deleting post:', error);
              showCustomAlertMessage('Error', error.message || 'Failed to delete post.', 'error');
            } finally {
              setIsMenuLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleArchivePost = async () => {
    try {
      setIsMenuLoading(true);
      setShowCustomAlert(false);
      await archivePost(post._id);
      setShowMenu(false);
      setIsMenuLoading(false);
      if (onRefresh) {
        onRefresh();
      }
      setTimeout(() => {
        showCustomAlertMessage('Success', 'Post archived successfully!', 'success');
      }, 300);
    } catch (error: any) {
      console.error('Error archiving post:', error);
      setIsMenuLoading(false);
      setShowMenu(false);
      showCustomAlertMessage('Error', error.message || 'Failed to archive post.', 'error');
    }
  };

  const handleHidePost = async () => {
    try {
      setIsMenuLoading(true);
      setShowCustomAlert(false);
      await hidePost(post._id);
      setShowMenu(false);
      setIsMenuLoading(false);
      if (onRefresh) {
        onRefresh();
      }
      setTimeout(() => {
        showCustomAlertMessage('Success', 'Post hidden successfully!', 'success');
      }, 300);
    } catch (error: any) {
      console.error('Error hiding post:', error);
      setIsMenuLoading(false);
      setShowMenu(false);
      showCustomAlertMessage('Error', error.message || 'Failed to hide post.', 'error');
    }
  };

  const handleToggleComments = async () => {
    try {
      setIsMenuLoading(true);
      const response = await toggleComments(post._id);
      setCommentsDisabled(response.commentsDisabled);
      showCustomAlertMessage(
        'Success', 
        response.commentsDisabled ? 'Comments turned off successfully!' : 'Comments enabled successfully!',
        'success'
      );
    } catch (error: any) {
      console.error('Error toggling comments:', error);
      showCustomAlertMessage('Error', error.message || 'Failed to toggle comments.', 'error');
    } finally {
      setIsMenuLoading(false);
      setShowMenu(false);
    }
  };

  const handleEditPost = async () => {
    if (!editCaption.trim()) {
      showCustomAlertMessage('Error', 'Caption cannot be empty.', 'error');
      return;
    }
    try {
      setIsMenuLoading(true);
      await updatePost(post._id, editCaption);
      showCustomAlertMessage('Success', 'Post updated successfully!', 'success');
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error('Error updating post:', error);
      showCustomAlertMessage('Error', error.message || 'Failed to update post.', 'error');
    } finally {
      setIsMenuLoading(false);
      setShowEditModal(false);
      setShowMenu(false);
    }
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/post/${post._id}`);
    }
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const handleImageRetry = async () => {
    setImageError(false);
    setImageLoading(true);
    
    try {
      const optimizedUrl = await loadImageWithFallback(post.imageUrl);
      setImageUri(optimizedUrl);
      setImageLoading(false);
    } catch (error) {
      setImageError(true);
      setImageLoading(false);
    }
  };

  // Don't render if not visible (for lazy loading)
  if (!isVisible) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.placeholder}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <PostHeader post={post} onMenuPress={() => setShowMenu(true)} />

      {/* Image */}
      <PostImage
        post={post}
        onPress={handlePress}
        imageUri={imageUri}
        imageLoading={imageLoading}
        imageError={imageError}
        onImageError={handleImageError}
        onRetry={handleImageRetry}
        pulseAnim={pulseAnim}
      />

      {/* Actions */}
      <PostActions
        isLiked={isLiked}
        isSaved={isSaved}
        onLike={handleLike}
        onComment={handleOpenComments}
        onShare={handleShareClick}
        onSave={handleSave}
      />

      {/* Likes Count */}
      <PostLikesCount likesCount={likesCount} />

      {/* Caption */}
      <PostCaption post={post} />


      {/* Comments Modal */}
      <Modal
        visible={showComments}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <TouchableOpacity onPress={() => setShowComments(false)}>
            <Text style={{ color: theme.colors.text }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* World Map Modal */}
      <Modal
        visible={showWorldMap}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <TouchableOpacity onPress={() => setShowWorldMap(false)}>
            <Text style={{ color: theme.colors.text }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Elegant Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => !isMenuLoading && setShowMenu(false)}
      >
        <TouchableOpacity 
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => !isMenuLoading && setShowMenu(false)}
        >
          <View style={[styles.menuContainer, { backgroundColor: theme.colors.surface }]}>
            {isMenuLoading && (
              <View style={styles.menuLoadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            )}
            {currentUser && currentUser._id === post.user._id ? (
              // Own post options
              <>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => {
                    setShowMenu(false);
                    showCustomAlertMessage(
                      'Archive Post',
                      'Are you sure you want to archive this post? It will be hidden from your profile but can be restored later.',
                      'warning',
                      handleArchivePost
                    );
                  }}
                  disabled={isMenuLoading}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="archive-outline" size={22} color={theme.colors.text} />
                  </View>
                  <Text style={[styles.menuText, { color: theme.colors.text }]}>Archive</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => {
                    setShowMenu(false);
                    showCustomAlertMessage(
                      'Hide Post',
                      'Are you sure you want to hide this post? It will be hidden from your feed.',
                      'warning',
                      handleHidePost
                    );
                  }}
                  disabled={isMenuLoading}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="eye-off-outline" size={22} color={theme.colors.text} />
                  </View>
                  <Text style={[styles.menuText, { color: theme.colors.text }]}>Hide</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => {
                    setShowMenu(false);
                    handleShare();
                  }}
                  disabled={isMenuLoading}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="share-outline" size={22} color={theme.colors.text} />
                  </View>
                  <Text style={[styles.menuText, { color: theme.colors.text }]}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => {
                    setShowMenu(false);
                    showCustomAlertMessage(
                      commentsDisabled ? 'Turn On Comments' : 'Turn Off Comments',
                      commentsDisabled 
                        ? 'Are you sure you want to enable comments for this post?'
                        : 'Are you sure you want to turn off comments for this post? Users won\'t be able to comment.',
                      'warning',
                      handleToggleComments
                    );
                  }}
                  disabled={isMenuLoading}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons 
                      name={commentsDisabled ? "chatbubbles" : "chatbubbles-outline"} 
                      size={22} 
                      color={theme.colors.text} 
                    />
                  </View>
                  <Text style={[styles.menuText, { color: theme.colors.text }]}>
                    {commentsDisabled ? 'Turn On Comments' : 'Turn Off Comments'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => {
                    setShowMenu(false);
                    setShowEditModal(true);
                  }}
                  disabled={isMenuLoading}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="create-outline" size={22} color={theme.colors.text} />
                  </View>
                  <Text style={[styles.menuText, { color: theme.colors.text }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemDestructive]}
                  onPress={() => {
                    setShowMenu(false);
                    showCustomAlertMessage(
                      'Delete Post',
                      'Are you sure you want to delete this post? This action cannot be undone.',
                      'error',
                      handleDeletePost
                    );
                  }}
                  disabled={isMenuLoading}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="trash-outline" size={22} color="#FF453A" />
                  </View>
                  <Text style={[styles.menuText, styles.menuTextDestructive]}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Other user's post options
              <>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => {
                    setShowMenu(false);
                    showCustomAlertMessage(
                      'Report Post',
                      'Are you sure you want to report this post? It will be reviewed by our moderation team.',
                      'warning',
                      () => {
                        showCustomAlertMessage('Success', 'Post reported successfully! Thank you for helping keep our community safe.', 'success');
                      }
                    );
                  }}
                  disabled={isMenuLoading}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="flag-outline" size={22} color={theme.colors.text} />
                  </View>
                  <Text style={[styles.menuText, { color: theme.colors.text }]}>Report</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => {
                    setShowMenu(false);
                    showCustomAlertMessage(
                      'Unfollow User',
                      `Are you sure you want to unfollow ${post.user.fullName}? You won't see their posts in your feed anymore.`,
                      'warning',
                      () => {
                        showCustomAlertMessage('Success', `You've unfollowed ${post.user.fullName}`, 'success');
                      }
                    );
                  }}
                  disabled={isMenuLoading}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="person-remove-outline" size={22} color={theme.colors.text} />
                  </View>
                  <Text style={[styles.menuText, { color: theme.colors.text }]}>Unfollow</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem]}
                  onPress={() => {
                    setShowMenu(false);
                    handleShare();
                  }}
                  disabled={isMenuLoading}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="share-outline" size={22} color={theme.colors.text} />
                  </View>
                  <Text style={[styles.menuText, { color: theme.colors.text }]}>Share</Text>
                </TouchableOpacity>
              </>
            )}
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuCancelItem}
              onPress={() => !isMenuLoading && setShowMenu(false)}
              disabled={isMenuLoading}
            >
              <Text style={[styles.menuCancelText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isMenuLoading) {
            setShowEditModal(false);
            setEditCaption(post.caption || '');
          }
        }}
      >
        <TouchableOpacity 
          style={styles.editModalOverlay}
          activeOpacity={1}
          onPress={() => {
            if (!isMenuLoading) {
              setShowEditModal(false);
              setEditCaption(post.caption || '');
            }
          }}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.editModalContainer, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.editModalTitle, { color: theme.colors.text }]}>Edit Post</Text>
              <TextInput
                style={[styles.editInput, { 
                  color: theme.colors.text, 
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border 
                }]}
                value={editCaption}
                onChangeText={setEditCaption}
                placeholder="Enter caption..."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                maxLength={1000}
                autoFocus
              />
              <View style={styles.editModalActions}>
                <TouchableOpacity
                  style={[styles.editModalButton, styles.editModalButtonCancel, { marginRight: 6, borderColor: theme.colors.border }]}
                  onPress={() => {
                    setShowEditModal(false);
                    setEditCaption(post.caption || '');
                  }}
                >
                  <Text style={[styles.editModalButtonText, { color: theme.colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editModalButton, styles.editModalButtonSave, { backgroundColor: theme.colors.primary, marginLeft: 6 }]}
                  onPress={handleEditPost}
                  disabled={isMenuLoading || !editCaption.trim()}
                >
                  {isMenuLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.editModalButtonTextSave}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Comment Modal */}
      <CommentModal
        visible={showCommentModal}
        postId={post._id}
        comments={comments}
        onClose={() => setShowCommentModal(false)}
        onCommentAdded={handleCommentAdded}
        commentsDisabled={commentsDisabled}
      />

      {/* Custom Alert */}
      <CustomAlert
        visible={showCustomAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm}
        onClose={() => setShowCustomAlert(false)}
      />

      {/* Share Modal */}
      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        post={post}
      />
    </View>
  );
}

// Memoize component for better performance, especially on web
export default memo(PhotoCard, (prevProps, nextProps) => {
  // Only re-render if post data actually changed
  return (
    prevProps.post._id === nextProps.post._id &&
    prevProps.post.isLiked === nextProps.post.isLiked &&
    prevProps.post.likesCount === nextProps.post.likesCount &&
    prevProps.post.commentsCount === nextProps.post.commentsCount &&
    prevProps.isVisible === nextProps.isVisible
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    marginBottom: 24,
  },
  placeholder: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  menuContainer: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingBottom: 20,
    maxHeight: '80%',
    ...StyleSheet.absoluteFillObject,
    top: 'auto',
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  menuLoadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  menuItemDestructive: {
    borderBottomWidth: 0,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuText: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 0.2,
    flex: 1,
  },
  menuTextDestructive: {
    color: '#FF453A',
  },
  menuDivider: {
    height: 8,
    backgroundColor: 'transparent',
  },
  menuCancelItem: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: 'transparent',
  },
  menuCancelText: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 16,
  },
  editModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  editInput: {
    minHeight: 120,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  editModalActions: {
    flexDirection: 'row',
  },
  editModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  editModalButtonSave: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  editModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  editModalButtonTextSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
