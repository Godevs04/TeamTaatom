import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Dimensions, StatusBar, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getPostById, toggleLike, getUserPosts } from '../../services/posts';
import { toggleFollow } from '../../services/profile';
import { PostType } from '../../types/post';
import { LinearGradient } from 'expo-linear-gradient';
import { getUserFromStorage } from '../../services/auth';
import CustomAlert from '../../components/CustomAlert';
import PostComments from '../../components/post/PostComments';
import ShareModal from '../../components/ShareModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { realtimePostsService } from '../../services/realtimePosts';
import { savedEvents } from '../../utils/savedEvents';
import { trackScreenView, trackPostView, trackEngagement } from '../../services/analytics';
import { createLogger } from '../../utils/logger';
import SongPlayer from '../../components/SongPlayer';

const logger = createLogger('PostDetail');

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function PostDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme, mode } = useTheme();
  const [post, setPost] = useState<PostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const [showFullCaption, setShowFullCaption] = useState(false);
  
  // Real-time state management
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0); // Track views separately
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [relatedPosts, setRelatedPosts] = useState<PostType[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Comment modal state
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  
  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Custom alert state
  const [showCustomAlert, setShowCustomAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
    onConfirm: () => {},
  });

  const upsertComment = useCallback((incomingComment: any) => {
    if (!incomingComment) return;
    setComments((prev) => {
      const next = [...prev];
      if (incomingComment._id) {
        const existingIndex = next.findIndex((c) => c._id === incomingComment._id);
        if (existingIndex !== -1) {
          next[existingIndex] = incomingComment;
          return next;
        }
      }
      return [...next, incomingComment];
    });
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        
        // Load current user
        const user = await getUserFromStorage();
        setCurrentUser(user);
        
        // Load post data
        const response = await getPostById(id as string);
        setPost(response.post);
        
        // Set initial states - ensure we get the correct like state
        const correctIsLiked = response.post?.isLiked === true;
        const correctLikesCount = response.post?.likesCount || 0;
        
        // Log view count for debugging
        logger.debug('Post loaded with viewsCount:', response.post?.viewsCount);
        
        console.log('Post detail - Initial data loaded:', {
          postId: response.post?._id,
          apiIsLiked: response.post?.isLiked,
          apiLikesCount: response.post?.likesCount,
          processedIsLiked: correctIsLiked,
          processedLikesCount: correctLikesCount
        });
        
        setIsLiked(correctIsLiked);
        setLikesCount(correctLikesCount);
        setIsFollowing(response.post?.user?.isFollowing || false);
        
        // Update views count from response
        const postViewsCount = response.post?.viewsCount || 0;
        setViewsCount(postViewsCount);
        logger.debug('Post loaded with viewsCount:', postViewsCount);
        
        // Track post view (wrap in try-catch to prevent crashes)
        if (response.post?._id) {
          try {
            trackPostView(response.post._id, {
              author_id: response.post.user?._id,
              has_location: !!response.post.location,
            });
          } catch (analyticsError) {
            // Silently fail - don't break the app if analytics fails
            console.warn('Analytics error:', analyticsError);
          }
        }
        
        // Set initial comments
        setComments(response.post?.comments || []);
        
        // Load related posts
        if (response.post?.user?._id) {
          await loadRelatedPosts(response.post.user._id);
        }
        
        // Load saved state from AsyncStorage
        await loadSavedState(response.post?._id);
        
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadInitialData();
      // Track screen view (wrap in try-catch to prevent crashes)
      try {
        trackScreenView('post_detail', { post_id: id });
      } catch (analyticsError) {
        // Silently fail - don't break the app if analytics fails
        console.warn('Analytics error:', analyticsError);
      }
    }
  }, [id]);

  const loadRelatedPosts = async (userId: string) => {
    try {
      setLoadingRelated(true);
      const response = await getUserPosts(userId, 1, 4);
      // Filter out the current post
      const filteredPosts = response.posts.filter(p => p._id !== id);
      setRelatedPosts(filteredPosts.slice(0, 3));
    } catch (error) {
      console.error('Error loading related posts:', error);
    } finally {
      setLoadingRelated(false);
    }
  };

  const loadSavedState = async (postId: string) => {
    try {
      const stored = await AsyncStorage.getItem('savedPosts');
      const arr = stored ? JSON.parse(stored) : [];
      setIsBookmarked(Array.isArray(arr) && arr.includes(postId));
    } catch (error) {
      console.error('Error loading saved state:', error);
    }
  };

  // Initialize real-time posts service
  React.useEffect(() => {
    console.log('Post detail - Initializing real-time service...');
    realtimePostsService.initialize().then(() => {
      console.log('Post detail - Real-time service initialized');
    }).catch((error) => {
      console.error('Post detail - Failed to initialize real-time service:', error);
    });
  }, []);

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
    if (!post) return;

    if (process.env.NODE_ENV === 'development') {
      console.log('Post detail - Setting up WebSocket listeners for post:', post._id);
    }

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
          console.log('Post detail - WebSocket like update received:', data);
        }
        
        // Only update if the WebSocket data is more recent than our current state
        const currentTimestamp = Date.now();
        const eventTimestamp = new Date(data.timestamp).getTime();
        const timeDiff = currentTimestamp - eventTimestamp;
        
        // If the event is older than 5 seconds, it's likely stale data
        if (timeDiff > 5000) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Post detail - Ignoring stale WebSocket event (older than 5s):', timeDiff + 'ms');
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
        // Use functional update to avoid dependency issues
        upsertComment(data.comment);
      }
    });

    const unsubscribeSaves = realtimePostsService.subscribeToSaves((data) => {
      if (data.postId === post._id) {
        setIsBookmarked(data.isSaved);
      }
    });

    return () => {
      unsubscribeLikes();
      unsubscribeComments();
      unsubscribeSaves();
    };
  }, [post?._id, upsertComment]);

  // Listen for post action events from home page
  React.useEffect(() => {
    const unsubscribe = savedEvents.addPostActionListener((postId, action, data) => {
      if (postId === post?._id) {
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
            setIsBookmarked(data.isBookmarked);
            break;
          case 'comment':
            upsertComment(data.comment);
            break;
        }
      }
    });

    return unsubscribe;
  }, [post?._id, upsertComment]);

  // Custom alert helper function
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
  };

  // Real-time functionality functions
  const handleLike = async () => {
    if (!currentUser) {
      showCustomAlertMessage('Error', 'You must be signed in to like posts.', 'error');
      return;
    }

    try {
      // Mark as updating to prevent WebSocket listener from processing
      isUpdatingRef.current = true;
      lastUpdateTimeRef.current = Date.now();
      
      setActionLoading('like');
      const response = await toggleLike(post!._id);
      
      // Ensure we're setting the correct boolean value
      const newIsLiked = response.isLiked === true;
      const newLikesCount = response.likesCount || 0;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Post detail - Like toggle response:', {
          postId: post!._id,
          response: response,
          processedIsLiked: newIsLiked,
          processedLikesCount: newLikesCount,
          currentState: { isLiked, likesCount }
        });
      }
      
      setIsLikedWithRef(newIsLiked);
      setLikesCountWithRef(newLikesCount);
      
      // Track engagement
      trackEngagement(newIsLiked ? 'like' : 'unlike', 'post', post!._id, {
        likes_count: newLikesCount,
      });
      
      // Emit event to notify home page
      savedEvents.emitPostAction(post!._id, newIsLiked ? 'like' : 'unlike', {
        likesCount: newLikesCount,
        isLiked: newIsLiked
      });

      // Emit WebSocket event for real-time updates (but ignore our own event)
      await realtimePostsService.emitLike(post!._id, newIsLiked, newLikesCount);
      
      // Reset flag after a delay to allow WebSocket event to be ignored
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 500);
      
    } catch (error) {
      console.error('Error toggling like:', error);
      showCustomAlertMessage('Error', 'Failed to update like status.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFollow = async () => {
    if (!currentUser) {
      showCustomAlertMessage('Error', 'You must be signed in to follow users.', 'error');
      return;
    }

    if (currentUser._id === post?.user._id) {
      showCustomAlertMessage('Info', 'You cannot follow yourself.', 'info');
      return;
    }

    try {
      setActionLoading('follow');
      const response = await toggleFollow(post!.user._id);
      setIsFollowing(response.isFollowing);
      showCustomAlertMessage(
        'Success', 
        response.isFollowing 
          ? `You're now following ${post!.user.fullName}` 
          : `You've unfollowed ${post!.user.fullName}`,
        'success'
      );
    } catch (error: any) {
      // Don't log conflict errors (follow request already pending) as they are expected
      if (!error.isConflict && error.response?.status !== 409) {
        console.error('Error toggling follow:', error);
      }
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update follow status.';
      
      // Check if it's a follow request already pending message or conflict error
      if (errorMessage.includes('Follow request already pending') || errorMessage.includes('Request already sent') || error.isConflict) {
        showCustomAlertMessage('Follow Request Pending', errorMessage, 'warning');
      } else {
        showCustomAlertMessage('Error', errorMessage, 'error');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleBookmark = async () => {
    if (!currentUser) {
      showCustomAlertMessage('Error', 'You must be signed in to save posts.', 'error');
      return;
    }

    try {
      setActionLoading('bookmark');
      
      // Toggle bookmark state
      const newBookmarkState = !isBookmarked;
      setIsBookmarked(newBookmarkState);
      
      // Persist to AsyncStorage for Saved tab
      const key = 'savedPosts';
      const stored = await AsyncStorage.getItem(key);
      const arr = stored ? JSON.parse(stored) : [];
      let next: string[] = Array.isArray(arr) ? arr : [];
      if (newBookmarkState) {
        if (!next.includes(post!._id)) next.push(post!._id);
      } else {
        next = next.filter(id => id !== post!._id);
      }
      await AsyncStorage.setItem(key, JSON.stringify(next));
      
      // Emit events to notify other components
      savedEvents.emitChanged();
      savedEvents.emitPostAction(post!._id, newBookmarkState ? 'save' : 'unsave', {
        isBookmarked: newBookmarkState
      });
      
      console.log(newBookmarkState ? 'Post saved' : 'Post unsaved', post!._id);
      
    } catch (error) {
      console.error('Error bookmarking post:', error);
      showCustomAlertMessage('Error', 'Failed to save post.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleShare = () => {
    // Open ShareModal instead of native share
    setShowShareModal(true);
  };

  const handleComment = async () => {
    if (!currentUser) {
      showCustomAlertMessage('Error', 'You must be signed in to comment.', 'error');
      return;
    }
    
    // Refresh comments before opening modal
    try {
      const response = await getPostById(id as string);
      setComments(response.post?.comments || []);
    } catch (error) {
      console.error('Error refreshing comments:', error);
    }
    
    setShowCommentModal(true);
  };

  const handleCommentAdded = (newComment: any) => {
    upsertComment(newComment);

    // Emit event to notify home page
    savedEvents.emitPostAction(post!._id, 'comment', {
      comment: newComment,
      commentsCount: comments.length + 1
    });
    
    // Don't auto-close modal here - let PostComments handle it
  };

  const handleRelatedPostPress = (relatedPost: PostType) => {
    router.push(`/post/${relatedPost._id}`);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading post...</Text>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.colors.background }]}>
        <Ionicons name="alert-circle-outline" size={64} color={theme.colors.textSecondary} />
        <Text style={[styles.errorText, { color: theme.colors.text }]}>
          {error || 'Post not found'}
        </Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar 
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.background} 
      />
      
      {/* Enhanced Header with Gradient */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={styles.backButtonHeader}
          onPress={() => router.back()}
        >
          <View style={[styles.backButtonContainer, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
          </View>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Post</Text>
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={handleShare}
        >
          <Ionicons name="share-outline" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Enhanced Image Container */}
        <View style={styles.imageContainer}>
          {post.images && post.images.length > 1 ? (
            <View>
              <FlatList
                ref={flatListRef}
                data={post.images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                  setCurrentImageIndex(index);
                }}
                renderItem={({ item, index }) => (
                  <View style={{ width: screenWidth, height: screenHeight * 0.6 }}>
                    <Image
                      source={{ uri: item }}
                      style={styles.postImage}
                      resizeMode="cover"
                    />
                  </View>
                )}
                keyExtractor={(item, index) => index.toString()}
              />
              
              {/* Image counter */}
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {currentImageIndex + 1} / {post.images.length}
                </Text>
              </View>
              
              {/* Image dots indicator */}
              <View style={styles.dotsContainer}>
                {post.images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: index === currentImageIndex 
                          ? theme.colors.primary 
                          : 'rgba(255,255,255,0.5)'
                      }
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : (
            <Image
              source={{ uri: post.imageUrl }}
              style={styles.postImage}
              resizeMode="cover"
            />
          )}
          
          {/* Image Overlay Gradient */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)']}
            style={styles.imageOverlay}
          />

          {/* Song Player Overlay */}
          {post.song?.songId && (
            <View style={styles.songPlayerContainer} pointerEvents="box-none">
              <SongPlayer post={post} isVisible={true} autoPlay={true} />
            </View>
          )}
          
          {/* Floating Action Buttons */}
          <View style={styles.floatingActions}>
            <TouchableOpacity 
              style={[styles.floatingButton, { backgroundColor: theme.colors.surface }]}
              onPress={handleLike}
              disabled={actionLoading === 'like'}
            >
              {actionLoading === 'like' ? (
                <ActivityIndicator size="small" color={theme.colors.text} />
              ) : (
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={20} 
                  color={isLiked ? "#ff3040" : theme.colors.text} 
                />
              )}
            </TouchableOpacity>
            {currentUser && currentUser._id !== post?.user._id && (
              <TouchableOpacity 
                style={[styles.floatingButton, { backgroundColor: theme.colors.surface }]}
                onPress={handleBookmark}
                disabled={actionLoading === 'bookmark'}
              >
                {actionLoading === 'bookmark' ? (
                  <ActivityIndicator size="small" color={theme.colors.text} />
                ) : (
                  <Ionicons 
                    name={isBookmarked ? "bookmark" : "bookmark-outline"} 
                    size={20} 
                    color={theme.colors.text} 
                  />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Enhanced Post Details */}
        <View style={styles.detailsContainer}>
          {/* User Info with Enhanced Design */}
          <View style={styles.userSection}>
            <View style={styles.profileContainer}>
              <Image
                source={{ uri: post.user.profilePic || 'https://via.placeholder.com/40' }}
                style={styles.profilePic}
              />
              <View style={[styles.onlineIndicator, { backgroundColor: '#4CAF50' }]} />
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.username, { color: theme.colors.text }]}>
                {post.user.fullName}
              </Text>
              <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
                {new Date(post.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </View>
            {currentUser && currentUser._id !== post.user._id && (
              <TouchableOpacity 
                style={[
                  styles.followButton, 
                  { 
                    backgroundColor: isFollowing ? theme.colors.surface : theme.colors.primary,
                    borderColor: theme.colors.border,
                    borderWidth: isFollowing ? 1 : 0
                  }
                ]}
                onPress={handleFollow}
                disabled={actionLoading === 'follow'}
              >
                {actionLoading === 'follow' ? (
                  <ActivityIndicator size="small" color={theme.colors.text} />
                ) : (
                  <Text style={[
                    styles.followButtonText, 
                    { color: isFollowing ? theme.colors.text : 'white' }
                  ]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Enhanced Caption */}
          {post.caption && (
            <View style={styles.captionContainer}>
              <Text 
                style={[styles.caption, { color: theme.colors.text }]}
                numberOfLines={showFullCaption ? undefined : 3}
              >
                {post.caption}
              </Text>
              {post.caption.length > 100 && (
                <TouchableOpacity onPress={() => setShowFullCaption(!showFullCaption)}>
                  <Text style={[styles.readMoreText, { color: theme.colors.primary }]}>
                    {showFullCaption ? 'Show less' : 'Read more'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Enhanced Location */}
          {post.location && post.location.address && (
            <TouchableOpacity style={styles.locationContainer}>
              <View style={[styles.locationIcon, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="location" size={14} color="white" />
              </View>
              <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
                {post.location.address}
              </Text>
            </TouchableOpacity>
          )}

          {/* Enhanced Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#ff3040' }]}>
                <Ionicons name="heart" size={16} color="white" />
              </View>
              <Text style={[styles.statText, { color: theme.colors.text }]}>
                {likesCount} likes
              </Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="chatbubble" size={16} color="white" />
              </View>
              <Text style={[styles.statText, { color: theme.colors.text }]}>
                {post.commentsCount || 0} comments
              </Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="eye" size={16} color="white" />
              </View>
              <Text style={[styles.statText, { color: theme.colors.text }]}>
                {viewsCount || post?.viewsCount || 0} views
              </Text>
            </View>
          </View>
        </View>

        {/* Creative Bottom Content */}
        <View style={styles.creativeSection}>
          {/* Related Posts Section */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>More from {post.user.fullName}</Text>
            <TouchableOpacity>
              <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relatedPostsContainer}>
            {loadingRelated ? (
              <View style={styles.relatedPostCard}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : relatedPosts.length > 0 ? (
              relatedPosts.map((relatedPost) => (
                <TouchableOpacity 
                  key={relatedPost._id} 
                  style={styles.relatedPostCard}
                  onPress={() => handleRelatedPostPress(relatedPost)}
                >
                  <Image
                    source={{ uri: relatedPost.imageUrl }}
                    style={styles.relatedPostImage}
                    resizeMode="cover"
                  />
                  <Text style={[styles.relatedPostText, { color: theme.colors.textSecondary }]}>
                    {new Date(relatedPost.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.relatedPostCard}>
                <Text style={[styles.relatedPostText, { color: theme.colors.textSecondary }]}>
                  No more posts
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Engagement Suggestions */}
          <View style={styles.engagementSection}>
            <Text style={[styles.engagementTitle, { color: theme.colors.text }]}>Engage with this post</Text>
            <View style={styles.engagementButtons}>
              <TouchableOpacity 
                style={[
                  styles.engagementButton, 
                  { 
                    backgroundColor: isLiked ? '#ff3040' : theme.colors.primary,
                    borderColor: isLiked ? '#ff3040' : theme.colors.primary
                  }
                ]}
                onPress={handleLike}
                disabled={actionLoading === 'like'}
              >
                {actionLoading === 'like' ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="heart" size={16} color="white" />
                )}
                <Text style={styles.engagementButtonText}>
                  {isLiked ? 'Liked' : 'Like'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.engagementButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={handleComment}
                disabled={actionLoading === 'comment'}
              >
                {actionLoading === 'comment' ? (
                  <ActivityIndicator size="small" color={theme.colors.text} />
                ) : (
                  <Ionicons name="chatbubble-outline" size={16} color={theme.colors.text} />
                )}
                <Text style={[styles.engagementButtonText, { color: theme.colors.text }]}>Comment</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.engagementButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={16} color={theme.colors.text} />
                <Text style={[styles.engagementButtonText, { color: theme.colors.text }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Fun Facts Section */}
          <View style={styles.funFactsSection}>
            <Text style={[styles.funFactsTitle, { color: theme.colors.text }]}>Did you know?</Text>
            <View style={[styles.funFactCard, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="bulb-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.funFactText, { color: theme.colors.text }]}>
                This photo was taken at {post.location?.address || 'a beautiful location'} and has been viewed by people from around the world!
              </Text>
            </View>
          </View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </View>
      </ScrollView>

      {/* Comment Modal */}
      {post && (
        <PostComments
          visible={showCommentModal}
          postId={post._id}
          comments={comments}
          onClose={() => setShowCommentModal(false)}
          onCommentAdded={handleCommentAdded}
          commentsDisabled={post.commentsDisabled || false}
        />
      )}

      {/* Share Modal */}
      {post && (
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          post={post}
        />
      )}

      {/* Custom Alert */}
      <CustomAlert
        visible={showCustomAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm || (() => {})}
        onClose={() => setShowCustomAlert(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButtonHeader: {
    padding: 4,
  },
  backButtonContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  shareButton: {
    padding: 8,
    borderRadius: 20,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
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
    zIndex: 1,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  songPlayerContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  floatingActions: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'column',
    gap: 12,
  },
  floatingButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  detailsContainer: {
    padding: 20,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileContainer: {
    position: 'relative',
    marginRight: 12,
  },
  profilePic: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#fff',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  timestamp: {
    fontSize: 13,
    opacity: 0.7,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  captionContainer: {
    marginBottom: 20,
  },
  caption: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  readMoreText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  locationIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
  },
  creativeSection: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  relatedPostsContainer: {
    marginBottom: 30,
  },
  relatedPostCard: {
    marginRight: 16,
    alignItems: 'center',
  },
  relatedPostImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginBottom: 8,
  },
  relatedPostText: {
    fontSize: 12,
    fontWeight: '500',
  },
  engagementSection: {
    marginBottom: 30,
  },
  engagementTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  engagementButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    gap: 8,
  },
  engagementButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  funFactsSection: {
    marginBottom: 30,
  },
  funFactsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  funFactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  funFactText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  bottomSpacing: {
    height: 40,
  },
  imageCounter: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  imageCounterText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
