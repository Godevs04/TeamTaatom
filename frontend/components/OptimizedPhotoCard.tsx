import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  Share,
  Linking,
  Animated,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { PostType } from '../types/post';
import { toggleLike, addComment, deletePost, archivePost, hidePost, toggleComments, updatePost } from '../services/posts';
import { getUserFromStorage } from '../services/auth';
import CommentBox from './CommentBox';
import RotatingGlobe from './RotatingGlobe';
import WorldMap from './WorldMap';
import { loadImageWithFallback } from '../utils/imageLoader';
import { useRouter } from 'expo-router';
import CustomAlert from './CustomAlert';
import CommentModal from './CommentModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { savedEvents } from '../utils/savedEvents';
import { realtimePostsService } from '../services/realtimePosts';
import { geocodeAddress } from '../utils/locationUtils';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

interface PhotoCardProps {
  post: PostType;
  onRefresh?: () => void;
  onPress?: () => void;
  isVisible?: boolean; // For lazy loading
}

export default function PhotoCard({
  post,
  onRefresh,
  onPress,
  isVisible = true,
}: PhotoCardProps) {
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
  const [isGeocoding, setIsGeocoding] = useState(false);
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

  // Initialize real-time posts service
  React.useEffect(() => {
    realtimePostsService.initialize();
  }, []);

  // Listen for WebSocket real-time updates
  React.useEffect(() => {
    const unsubscribeLikes = realtimePostsService.subscribeToLikes((data) => {
      if (data.postId === post._id) {
        console.log('Home page - WebSocket like update received:', data);
        
        // Only update if the WebSocket data is more recent than our current state
        // This prevents stale WebSocket events from overriding correct initial data
        const currentTimestamp = Date.now();
        const eventTimestamp = new Date(data.timestamp).getTime();
        const timeDiff = currentTimestamp - eventTimestamp;
        
        // If the event is older than 5 seconds, it's likely stale data
        if (timeDiff > 5000) {
          console.log('Home page - Ignoring stale WebSocket event (older than 5s):', timeDiff + 'ms');
          return;
        }
        
        console.log('Home page - Applying WebSocket update:', { 
          timeDiff: timeDiff + 'ms',
          from: { isLiked, likesCount }, 
          to: { isLiked: data.isLiked, likesCount: data.likesCount }
        });
        
        setIsLiked(data.isLiked);
        setLikesCount(data.likesCount);
      }
    });

    const unsubscribeComments = realtimePostsService.subscribeToComments((data) => {
      if (data.postId === post._id) {
        // Update comments count if needed
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
            
            setIsLiked(eventIsLiked);
            setLikesCount(eventLikesCount);
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
  const [retryCount, setRetryCount] = useState(0);

  React.useEffect(() => {
    if (!post.imageUrl) {
      setImageLoading(false);
      setImageError(true);
      return;
    }

    console.log('PhotoCard: Loading image for post', post._id, 'URL:', post.imageUrl);
    setImageLoading(true);
    setImageError(false);
    setImageUri(null);

    // Progressive loading strategy
    const loadImage = async () => {
      try {
        console.log('PhotoCard: Loading image with fallback for post', post._id);
        
        // Use progressive loading with multiple strategies
        const optimizedUrl = await loadImageWithFallback(post.imageUrl, {
          timeout: 8000,
          retries: 2,
          retryDelay: 1000
        });
        
        console.log('PhotoCard: Image loaded successfully for post', post._id);
        setImageUri(optimizedUrl);
        setImageLoading(false);
        setImageError(false);
        setRetryCount(0);
        
      } catch (error) {
        console.error('PhotoCard: All image loading strategies failed for post', post._id, error);
        setImageError(true);
        setImageLoading(false);
      }
    };

    loadImage();
  }, [post.imageUrl, post._id, retryCount]);

  const handleLike = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be signed in to like posts.');
      return;
    }

    try {
      const response = await toggleLike(post._id);
      setIsLiked(response.isLiked);
      setLikesCount(response.likesCount);
      
      // Emit event to notify other pages
      savedEvents.emitPostAction(post._id, response.isLiked ? 'like' : 'unlike', {
        likesCount: response.likesCount,
        isLiked: response.isLiked
      });

      // Emit WebSocket event for real-time updates
      await realtimePostsService.emitLike(post._id, response.isLiked, response.likesCount);
      
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like status.');
    }
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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => router.push(`/profile/${post.user._id}`)}
        >
          <Image
            source={{
              uri: post.user.profilePic || 'https://via.placeholder.com/40',
            }}
            style={styles.profilePic}
          />
          <View style={styles.userDetails}>
            <Text style={[styles.username, { color: theme.colors.text }]}>
              {post.user.fullName}
            </Text>
            {post.location && post.location.address && (
              <TouchableOpacity
                style={styles.locationContainer}
                onPress={async () => {
                  if (isGeocoding) return; // Prevent multiple clicks during geocoding
                  
                  setIsGeocoding(true);
                  
                  try {
                    // Debug: Log post location data
                    console.log('Post location data:', {
                      hasLocation: !!post.location,
                      hasAddress: !!post.location?.address,
                      hasCoordinates: !!post.location?.coordinates,
                      address: post.location?.address,
                      coordinates: post.location?.coordinates,
                    });

                    // Navigate to map with post location coordinates
                    if (post.location?.address) {
                      console.log('Processing location:', post.location.address);
                      
                      let finalCoordinates = null;
                      
                      // Always use API for geocoding - no cached coordinates
                      console.log('🌍 Always using API for geocoding:', post.location.address);
                      finalCoordinates = await geocodeAddress(post.location.address);
                      
                      if (finalCoordinates) {
                        console.log('Navigating to location with coordinates:', finalCoordinates);
                        router.push({
                          pathname: '/map/current-location',
                          params: {
                            latitude: finalCoordinates.latitude.toString(),
                            longitude: finalCoordinates.longitude.toString(),
                            address: post.location.address,
                          }
                        });
                      } else {
                        console.log('Failed to get coordinates, falling back to current location');
                        router.push('/map/current-location');
                      }
                    } else {
                      console.log('No address found, falling back to current location');
                      router.push('/map/current-location');
                    }
                  } finally {
                    setIsGeocoding(false);
                  }
                }}
              >
                <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} />
                <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
                  {post.location.address}
                </Text>
                {isGeocoding && (
                  <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setShowMenu(true)}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Image */}
      <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
        <View style={styles.imageContainer}>
          {imageLoading && (
            <View style={styles.imageLoader}>
              <ActivityIndicator color={theme.colors.primary} size="large" />
            </View>
          )}
          
          {imageUri && !imageError ? (
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                resizeMode="cover"
                onLoadStart={() => {
                  console.log('PhotoCard: Image load started for post', post._id);
                  setImageLoading(true);
                }}
                onLoad={() => {
                  console.log('PhotoCard: Image loaded successfully for post', post._id);
                  setImageLoading(false);
                  setImageError(false);
                  setRetryCount(0); // Reset retry count on success
                }}
                onError={(error) => {
                  console.log('PhotoCard: Image load error for post', post._id, error);
                  if (retryCount < 2) {
                    console.log('PhotoCard: Retrying image load for post', post._id);
                    setTimeout(() => {
                      setRetryCount(prev => prev + 1);
                      setImageLoading(true);
                    }, 1000); // Wait 1 second before retry
                  } else {
                    setImageError(true);
                    setImageLoading(false);
                  }
                }}
              />
              
              {/* Multiple Images Indicator */}
              {post.images && post.images.length > 1 && (
                <View style={styles.multipleImagesIndicator}>
                  <Animated.View 
                    style={[
                      styles.imageCountBadge, 
                      { 
                        backgroundColor: theme.colors.background,
                        transform: [{ scale: pulseAnim }]
                      }
                    ]}
                  >
                    <Ionicons name="images" size={16} color={theme.colors.primary} />
                    <Text style={[styles.imageCountText, { color: theme.colors.primary }]}>
                      {post.images.length}
                    </Text>
                  </Animated.View>
                  
                  {/* Subtle animation dots */}
                  <View style={styles.imageDots}>
                    {post.images.slice(0, 3).map((_, index) => (
                      <View 
                        key={index}
                        style={[
                          styles.dot, 
                          { 
                            backgroundColor: theme.colors.primary,
                            opacity: index === 0 ? 1 : 0.4
                          }
                        ]} 
                      />
                    ))}
                    {post.images.length > 3 && (
                      <Text style={[styles.moreDots, { color: theme.colors.primary }]}>
                        +{post.images.length - 3}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          ) : imageError ? (
            <View style={[styles.image, styles.imageError]}>
              <Ionicons name="image-outline" size={50} color={theme.colors.textSecondary} />
              <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>
                Failed to load image
              </Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={async () => {
                  console.log('PhotoCard: Manual retry for post', post._id);
                  setImageError(false);
                  setImageLoading(true);
                  setRetryCount(0);
                  
                  try {
                    const optimizedUrl = await loadImageWithFallback(post.imageUrl);
                    setImageUri(optimizedUrl);
                    setImageLoading(false);
                  } catch (error) {
                    setImageError(true);
                    setImageLoading(false);
                  }
                }}
              >
                <Ionicons name="refresh" size={20} color={theme.colors.primary} />
                <Text style={[styles.retryText, { color: theme.colors.primary }]}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={24}
              color={isLiked ? '#ff3040' : theme.colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleOpenComments}
          >
            <Ionicons name="chatbubble-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShare}
          >
            <Ionicons name="paper-plane-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleSave}
        >
          <Ionicons 
            name={isSaved ? 'bookmark' : 'bookmark-outline'} 
            size={24} 
            color={theme.colors.text} 
          />
        </TouchableOpacity>
      </View>

      {/* Likes Count */}
      {likesCount > 0 && (
        <View style={styles.likesContainer}>
          <Text style={[styles.likesText, { color: theme.colors.text }]}>
            {likesCount} {likesCount === 1 ? 'like' : 'likes'}
          </Text>
        </View>
      )}

      {/* Caption */}
      {post.caption && (
        <View style={styles.captionContainer}>
          <Text style={[styles.caption, { color: theme.colors.text }]}>
            <Text style={[styles.username, { color: theme.colors.text }]}>
              {post.user.fullName}
            </Text>{' '}
            {post.caption}
          </Text>
          
          {/* Multiple images hint */}
          {post.images && post.images.length > 1 && (
            <View style={styles.multipleImagesHint}>
              <Ionicons name="swap-horizontal" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.hintText, { color: theme.colors.textSecondary }]}>
                Swipe to see {post.images.length} photos
              </Text>
            </View>
          )}
        </View>
      )}


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
    </View>
  );
}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userDetails: {
    flex: 1,
  },
  profilePic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  locationText: {
    fontSize: 11,
    marginLeft: 4,
    opacity: 0.7,
  },
  menuButton: {
    padding: 8,
    borderRadius: 20,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderRadius: 0,
    overflow: 'hidden',
  },
  imageLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  imageWrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  multipleImagesIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 4,
  },
  imageCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  imageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  moreDots: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  imageError: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.6,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    gap: 6,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    padding: 4,
  },
  likesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  likesText: {
    fontSize: 14,
    fontWeight: '600',
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  multipleImagesHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  hintText: {
    fontSize: 11,
    fontStyle: 'italic',
    opacity: 0.7,
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
