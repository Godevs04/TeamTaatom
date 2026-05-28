import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Share,
  Animated,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import LoadingGlobe from '../components/LoadingGlobe';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { PostType } from '../types/post';
import { toggleLike, deletePost, archivePost, unarchivePost, hidePost, unhidePost, toggleComments, updatePost, deleteComment } from '../services/posts';
import { toggleFollow } from '../services/profile';
import { getUserFromStorage, getCurrentUser } from '../services/auth';
import { useRouter } from 'expo-router';
import CustomAlert from './CustomAlert';
import PostComments from './post/PostComments';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { savedEvents } from '../utils/savedEvents';
import { audioManager } from '../utils/audioManager';
import { realtimePostsService } from '../services/realtimePosts';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { trackEngagement, trackPostView, trackFeatureUsage } from '../services/analytics';
import { triggerLikeHaptic, triggerCommentHaptic } from '../utils/hapticFeedback';
import ShareModal from './ShareModal';
import AddToCollectionModal from './AddToCollectionModal';
import PostHeader from './post/PostHeader';
import PostImage from './post/PostImage';
import PostActions from './post/PostActions';
import PostLikesCount from './post/PostLikesCount';
import PostCaption from './post/PostCaption';
import { createLogger } from '../utils/logger';
import { sanitizeErrorForDisplay } from '../utils/errorSanitizer';
import { shouldBlockDownload } from '../utils/networkUtils';
import { useSettings } from '../context/SettingsContext';
import { createReport } from '../services/report';
import ReportReasonModal, { ReportReasonType } from './ReportReasonModal';
import { enqueuePendingLike, clearPendingLike, setLocalLikedId } from '../utils/likePersistence';
import CloudGlassSurface from './cloud/CloudGlassSurface';

const LIKED_POSTS_STORAGE_KEY = 'taatom_posts_liked_ids';
const PENDING_LIKES_STORAGE_KEY = 'taatom_pending_post_likes';
const SAVED_POSTS_STORAGE_KEY = 'savedPosts';

// Module-level cache of saved post ids. The bookmark icon was reading
// AsyncStorage on every card mount, so saved posts briefly rendered as
// unsaved (outline → fill flicker) every time a card scrolled back into
// view in the virtualized list. This cache is loaded once on the first
// card mount and kept in sync via writes from handleSave + the
// savedEvents bus, so subsequent mounts read it synchronously and the
// initial render is already correct.
const savedPostsCache: { ids: Set<string> | null; loading: Promise<void> | null } = {
  ids: null,
  loading: null,
};

const ensureSavedPostsCache = (): Promise<void> => {
  if (savedPostsCache.ids) return Promise.resolve();
  if (savedPostsCache.loading) return savedPostsCache.loading;
  savedPostsCache.loading = (async () => {
    try {
      const stored = await AsyncStorage.getItem(SAVED_POSTS_STORAGE_KEY);
      const arr = stored ? JSON.parse(stored) : [];
      savedPostsCache.ids = new Set(Array.isArray(arr) ? arr.filter((x: any) => typeof x === 'string') : []);
    } catch {
      savedPostsCache.ids = new Set();
    } finally {
      savedPostsCache.loading = null;
    }
  })();
  return savedPostsCache.loading;
};

const isSavedSync = (postId: string): boolean => savedPostsCache.ids?.has(postId) ?? false;
const setSavedInCache = (postId: string, saved: boolean) => {
  if (!savedPostsCache.ids) return;
  if (saved) savedPostsCache.ids.add(postId);
  else savedPostsCache.ids.delete(postId);
};

// Helper function to normalize IDs from various formats (string, ObjectId, Buffer)
const normalizeId = (id: any): string | null => {
  if (!id) return null;
  if (typeof id === 'string') {
    return id;
  }
  if (id._id) {
    return normalizeId(id._id);
  }
  if (id.buffer && typeof id.buffer === 'object') {
    try {
      const bufferObj = id.buffer;
      const bytes: number[] = [];
      for (let i = 0; i < 12; i++) {
        const byte = bufferObj[i] ?? bufferObj[String(i)];
        if (byte !== undefined && typeof byte === 'number' && byte >= 0 && byte <= 255) {
          bytes.push(byte);
        }
      }
      if (bytes.length === 12) {
        const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
        if (/^[0-9a-fA-F]{24}$/.test(hex)) {
          return hex;
        }
      }
    } catch {}
  }
  if (typeof id === 'object' && !Array.isArray(id)) {
    const keys = Object.keys(id);
    if (keys.length >= 12 && keys.every(k => /^\d+$/.test(k) && parseInt(k) < 12)) {
      try {
        const bytes: number[] = [];
        for (let i = 0; i < 12; i++) {
          const byte = id[i] ?? id[String(i)];
          if (byte !== undefined && typeof byte === 'number' && byte >= 0 && byte <= 255) {
            bytes.push(byte);
          }
        }
        if (bytes.length === 12) {
          const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
          if (/^[0-9a-fA-F]{24}$/.test(hex)) {
            return hex;
          }
        }
      } catch {}
    }
  }
  if (id.toString && typeof id.toString === 'function') {
    try {
      const str = id.toString();
      if (typeof str === 'string' && /^[0-9a-fA-F]{24}$/.test(str)) {
        return str;
      }
    } catch {}
  }
  try {
    const str = String(id);
    if (/^[0-9a-fA-F]{24}$/.test(str)) {
      return str;
    }
  } catch {}
  return null;
};

interface PhotoCardProps {
  post: PostType;
  onRefresh?: () => void;
  onPress?: () => void;
  isVisible?: boolean; // For lazy loading
  isCurrentlyVisible?: boolean; // Whether this post is currently visible in viewport (for music playback)
  showBookmark?: boolean; // Show/hide bookmark button
}

function PhotoCard({
  post,
  onRefresh,
  onPress,
  isVisible = true,
  isCurrentlyVisible = false,
  showBookmark = true,
}: PhotoCardProps) {
  const isWeb = Platform.OS === 'web';
  const logger = createLogger('OptimizedPhotoCard');
  const { theme, isDark } = useTheme();
  const { settings } = useSettings();
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [isZooming, setIsZooming] = useState(false);
  
  const [comments, setComments] = useState(post.comments || []);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Handle case where user might be undefined (from fallback user object)
  const postUser = post.user || {
    _id: 'unknown',
    fullName: 'Unknown User',
    profilePic: ''
  };
  // Initialize from the module-level cache so re-mounts (FlashList recycle,
  // back-navigation, etc.) render the bookmark in the correct state on the
  // first paint. The async loader below seeds the cache the first time
  // the app starts.
  const [isSaved, setIsSaved] = useState<boolean>(() => isSavedSync(post._id));
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showCustomAlert, setShowCustomAlert] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddToCollectionModal, setShowAddToCollectionModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption || '');
  const [isMenuLoading, setIsMenuLoading] = useState(false);
  const [commentsDisabled, setCommentsDisabled] = useState((post as any).commentsDisabled || false);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const likeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const likeTargetRef = useRef<boolean | null>(null);
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
      if (user) {
        if (Array.isArray(user.followingIds)) {
          user.followingIds = user.followingIds.map(f => normalizeId(f)).filter(Boolean);
        } else if (Array.isArray(user.following)) {
          user.followingIds = user.following.map(f => normalizeId(f)).filter(Boolean);
        }
      }
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  // Refresh currentUser when the menu modal opens to ensure we display the up-to-date follow status
  React.useEffect(() => {
    if (showMenu) {
      const refreshUser = async () => {
        try {
          // 1. Get from AsyncStorage instantly (handles offline / local changes)
          const cachedUser = await getUserFromStorage();
          if (cachedUser) {
            if (Array.isArray(cachedUser.followingIds)) {
              cachedUser.followingIds = cachedUser.followingIds.map(f => normalizeId(f)).filter(Boolean);
            } else if (Array.isArray(cachedUser.following)) {
              cachedUser.followingIds = cachedUser.following.map(f => normalizeId(f)).filter(Boolean);
            }
            setCurrentUser(cachedUser);
          }
          // 2. Fetch fresh user data from server to guarantee absolute latest state
          const freshUser = await getCurrentUser();
          if (freshUser && freshUser !== 'network-error') {
            if (Array.isArray(freshUser.followingIds)) {
              freshUser.followingIds = freshUser.followingIds.map(f => normalizeId(f)).filter(Boolean);
            } else if (Array.isArray(freshUser.following)) {
              freshUser.followingIds = freshUser.following.map(f => normalizeId(f)).filter(Boolean);
            }
            setCurrentUser(freshUser);
          }
        } catch (error) {
          logger.debug('Failed to refresh current user for menu:', error);
        }
      };
      refreshUser();
    }
  }, [showMenu]);

  // Seed the module-level saved-posts cache the first time any card
  // mounts. Subsequent card mounts read it synchronously via the
  // useState initializer above — no flicker. Once loaded, sync local
  // state from the cache in case it changed since this card last mounted.
  React.useEffect(() => {
    let cancelled = false;
    ensureSavedPostsCache().then(() => {
      if (cancelled) return;
      const next = isSavedSync(post._id);
      setIsSaved(prev => (prev === next ? prev : next));
    });
    return () => { cancelled = true; };
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
        
        logger.debug('WebSocket like update received:', data);
        
        // Only update if the WebSocket data is more recent than our current state
        const currentTimestamp = Date.now();
        const eventTimestamp = new Date(data.timestamp).getTime();
        const timeDiff = currentTimestamp - eventTimestamp;
        
        // If the event is older than 5 seconds, it's likely stale data
        if (timeDiff > 5000) {
          logger.debug('Ignoring stale WebSocket event (older than 5s):', timeDiff + 'ms');
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
      if (data.postId === post._id && data.comment) {
        upsertComment(data.comment);
      }
    });

    const unsubscribeSaves = realtimePostsService.subscribeToSaves((data) => {
      if (data.postId === post._id) {
        setIsSaved(data.isSaved);
        setSavedInCache(post._id, data.isSaved);
      }
    });

    return () => {
      unsubscribeLikes();
      unsubscribeComments();
      unsubscribeSaves();
    };
  }, [post._id, upsertComment]);

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
            setSavedInCache(post._id, !!data.isBookmarked);
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

  // expo-image handles caching, retries, dedup, and progressive display natively.
  // We just pass the URL straight through and track error state for the fallback UI.
  const [imageError, setImageError] = useState(false);
  const imageUri = post.imageUrl || null;
  const imageLoading = false; // expo-image manages its own loading state

  // Synchronize component state when post prop fields change (fixing recycling/stale value leaks)
  React.useEffect(() => {
    setIsLiked(post.isLiked || false);
    setLikesCount(post.likesCount || 0);
    setComments(post.comments || []);
    setIsSaved(isSavedSync(post._id));
    setCommentsDisabled(post.commentsDisabled || false);
    setEditCaption(post.caption || '');
    setImageError(!post.imageUrl);
  }, [
    post._id,
    post.isLiked,
    post.likesCount,
    post.comments,
    post.caption,
    post.commentsDisabled,
    post.imageUrl
  ]);

  const handleLike = () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be signed in to like posts.');
      return;
    }

    const newLiked = !isLiked;
    const newCount = newLiked ? likesCount + 1 : Math.max(0, likesCount - 1);
    likeTargetRef.current = newLiked;

    triggerLikeHaptic(newLiked);
    setIsLikedWithRef(newLiked);
    setLikesCountWithRef(newCount);

    if (likeDebounceRef.current) {
      clearTimeout(likeDebounceRef.current);
    }

    likeDebounceRef.current = setTimeout(async () => {
      const targetLiked = likeTargetRef.current;
      if (targetLiked === null) return;

      const previousLiked = stateRef.current.isLiked;
      const previousCount = stateRef.current.likesCount;
      const actionKey = `like-${post._id}`;
      setActionLoading(prev => new Set(prev).add(actionKey));

      try {
        try {
          await setLocalLikedId(LIKED_POSTS_STORAGE_KEY, post._id, targetLiked);
          await enqueuePendingLike(PENDING_LIKES_STORAGE_KEY, post._id, targetLiked);
        } catch (e) {
          logger.debug('Failed to persist optimistic like intent', e);
        }

        isUpdatingRef.current = true;
        lastUpdateTimeRef.current = Date.now();

        const response = await toggleLike(post._id);

        try {
          await setLocalLikedId(LIKED_POSTS_STORAGE_KEY, post._id, response.isLiked);
          await clearPendingLike(PENDING_LIKES_STORAGE_KEY, post._id);
        } catch (e) {
          logger.debug('Failed to persist liked posts', e);
        }

        setIsLikedWithRef(response.isLiked);
        setLikesCountWithRef(response.likesCount);
        likeTargetRef.current = response.isLiked;

        trackEngagement(response.isLiked ? 'like' : 'unlike', 'post', post._id, {
          likes_count: response.likesCount,
        });

        savedEvents.emitPostAction(post._id, response.isLiked ? 'like' : 'unlike', {
          likesCount: response.likesCount,
          isLiked: response.isLiked,
        });

        await realtimePostsService.emitLike(post._id, response.isLiked, response.likesCount);

        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 500);
      } catch (error) {
        setIsLikedWithRef(previousLiked);
        setLikesCountWithRef(previousCount);
        likeTargetRef.current = previousLiked;
        logger.error('Error toggling like', error);
        Alert.alert('Error', 'Failed to update like status.');
      } finally {
        setActionLoading(prev => {
          const next = new Set(prev);
          next.delete(actionKey);
          return next;
        });
      }
    }, 280);
  };

  const handleShareClick = () => {
    setShowShareModal(true);
  };

  const handleShare = async () => {
    try {
      const blocked = await shouldBlockDownload(settings?.account?.wifiOnlyDownloads ?? false);
      if (blocked) {
        showCustomAlertMessage('Wi-Fi Required', 'Wi-Fi only downloads is enabled. Please connect to Wi-Fi to share content.', 'error');
        return;
      }

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
              logger.warn('Failed to clean up temporary file', cleanupError);
            }
            return;
          }
        } catch (expoError) {
          logger.warn('Expo sharing failed, trying fallback', expoError);
        }
      }

      // Fallback to React Native Share API
      const shareContent = {
        title: `Post by ${postUser.fullName || 'Unknown User'}`,
        message: post.caption ? `${post.caption}\n\n${post.imageUrl}` : post.imageUrl,
        url: post.imageUrl,
      };

      const result = await Share.share(shareContent);
      
      if (result.action === Share.sharedAction) {
        showCustomAlertMessage('Success', 'Post shared successfully!', 'success');
      } else if (result.action === Share.dismissedAction) {
        // User dismissed the share dialog
        logger.debug('Share dialog dismissed');
      }
    } catch (error) {
      logger.error('Error sharing post', error);
      showCustomAlertMessage('Error', 'Failed to share post. Please try again.', 'error');
    }
  };

  const handleSave = () => {
    // Store previous state for revert
    const previousSaveState = isSaved;
    const newSaveState = !isSaved;

    // Toggle local + module cache immediately and synchronously
    setIsSaved(newSaveState);
    setSavedInCache(post._id, newSaveState);

    // Fire the AsyncStorage and event emission logic in the background
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SAVED_POSTS_STORAGE_KEY);
        const arr = stored ? JSON.parse(stored) : [];
        let next: string[] = Array.isArray(arr) ? arr : [];
        if (newSaveState) {
          if (!next.includes(post._id)) next.push(post._id);
        } else {
          next = next.filter(id => id !== post._id);
        }
        await AsyncStorage.setItem(SAVED_POSTS_STORAGE_KEY, JSON.stringify(next));
        logger.debug(newSaveState ? 'Post saved' : 'Post unsaved', { postId: post._id });

        // Emit events to notify other pages
        savedEvents.emitChanged();
        savedEvents.emitPostAction(post._id, newSaveState ? 'save' : 'unsave', {
          isBookmarked: newSaveState
        });
      } catch (error) {
        logger.error('Error saving post in background', error);
        // Revert on error
        setIsSaved(previousSaveState);
        setSavedInCache(post._id, previousSaveState);
        
        // Re-emit reverted state
        savedEvents.emitChanged();
        savedEvents.emitPostAction(post._id, previousSaveState ? 'save' : 'unsave', {
          isBookmarked: previousSaveState
        });
        
        showCustomAlertMessage('Error', 'Failed to save post', 'error');
      }
    })();
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

  const handleCommentAdded = (newComment: any) => {
    triggerCommentHaptic();
    upsertComment(newComment);
  };

  const handleCommentDeleted = async (commentId: string) => {
    const originalComments = [...comments];
    
    // Optimistic UI Update: immediately filter out the deleted comment
    setComments(prev => prev.filter(c => c._id !== commentId));
    
    try {
      await deleteComment(post._id, commentId);
      logger.debug('Comment deleted successfully:', commentId);
    } catch (error) {
      logger.error('Failed to delete comment, rolling back:', error);
      // Revert local state to the original list of comments
      setComments(originalComments);
      Alert.alert('Error', 'Failed to delete comment. Please try again.');
    }
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

    if (normalizeId(currentUser._id) !== normalizeId(postUser._id)) {
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
              await audioManager.stopAll();

              // Clear AsyncStorage cache (all feed-mode variants) to prevent deleted post
              // from reappearing after pull-to-refresh / app restart. TAATOM-044 keys the
              // home feed cache by feed mode — we must strip the post from every variant.
              try {
                const cacheKeys = ['cachedPosts_recents', 'cachedPosts_friends', 'cachedPosts_popular', 'cachedPosts'];
                await Promise.all(cacheKeys.map(async (key) => {
                  const cached = await AsyncStorage.getItem(key);
                  if (!cached) return;
                  try {
                    const parsed = JSON.parse(cached);
                    if (parsed?.data && Array.isArray(parsed.data)) {
                      parsed.data = parsed.data.filter((p: any) => p._id !== post._id);
                      await AsyncStorage.setItem(key, JSON.stringify(parsed));
                    }
                  } catch {
                    /* ignore malformed cache entry */
                  }
                }));
              } catch (cacheError) {
                logger.warn('Failed to update cached posts after deletion', cacheError);
              }

              showCustomAlertMessage('Success', 'Post deleted successfully!', 'success');
              if (onRefresh) onRefresh();
            } catch (error: any) {
              logger.error('Error deleting post', error);
              showCustomAlertMessage('Error', sanitizeErrorForDisplay(error, 'PhotoCard.deletePost') || 'Failed to delete post.', 'error');
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
      logger.error('Error archiving post', error);
      setIsMenuLoading(false);
      setShowMenu(false);
      showCustomAlertMessage('Error', sanitizeErrorForDisplay(error, 'PhotoCard.archivePost') || 'Failed to archive post.', 'error');
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
      logger.error('Error hiding post', error);
      setIsMenuLoading(false);
      setShowMenu(false);
      showCustomAlertMessage('Error', sanitizeErrorForDisplay(error, 'PhotoCard.hidePost') || 'Failed to hide post.', 'error');
    }
  };

  const handleUnarchivePost = async () => {
    try {
      setIsMenuLoading(true);
      setShowCustomAlert(false);
      await unarchivePost(post._id);
      setShowMenu(false);
      setIsMenuLoading(false);
      if (onRefresh) onRefresh();
      setTimeout(() => {
        showCustomAlertMessage('Success', 'Post restored from archive!', 'success');
      }, 300);
    } catch (error: any) {
      logger.error('Error unarchiving post', error);
      setIsMenuLoading(false);
      setShowMenu(false);
      showCustomAlertMessage('Error', sanitizeErrorForDisplay(error, 'PhotoCard.unarchivePost') || 'Failed to unarchive post.', 'error');
    }
  };

  const handleUnhidePost = async () => {
    try {
      setIsMenuLoading(true);
      setShowCustomAlert(false);
      await unhidePost(post._id);
      setShowMenu(false);
      setIsMenuLoading(false);
      if (onRefresh) onRefresh();
      setTimeout(() => {
        showCustomAlertMessage('Success', 'Post is visible again!', 'success');
      }, 300);
    } catch (error: any) {
      logger.error('Error unhiding post', error);
      setIsMenuLoading(false);
      setShowMenu(false);
      showCustomAlertMessage('Error', sanitizeErrorForDisplay(error, 'PhotoCard.unhidePost') || 'Failed to unhide post.', 'error');
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
      logger.error('Error toggling comments', error);
      showCustomAlertMessage('Error', sanitizeErrorForDisplay(error, 'PhotoCard.toggleComments') || 'Failed to toggle comments.', 'error');
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
      logger.error('Error updating post', error);
      showCustomAlertMessage('Error', sanitizeErrorForDisplay(error, 'PhotoCard.updatePost') || 'Failed to update post.', 'error');
    } finally {
      setIsMenuLoading(false);
      setShowEditModal(false);
      setShowMenu(false);
    }
  };

  const handlePress = useCallback(() => {
    try {
      if (onPress) {
        onPress();
      } else {
        const postId = post._id;
        if (postId) {
          // Expo Router's router.push() doesn't return a Promise
          // It's a synchronous navigation method, so we just call it directly
          router.push(`/post/${postId}`);
        } else {
          logger.warn('Cannot navigate: post._id is missing', { post });
        }
      }
    } catch (error) {
      logger.error('Error in handlePress:', error);
      // If navigation fails, log it but don't crash the app
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Navigation error details:', errorMessage);
    }
  }, [onPress, post._id, router]);

  // expo-image retries network failures internally; we only need a manual reset
  // hook for the user-facing "Retry" button on the error fallback UI.
  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const handleImageRetry = useCallback(() => {
    // Toggling the error flag remounts the ExpoImage and lets it try again.
    setImageError(false);
  }, []);

  return (
    <View style={[styles.container, { shadowOpacity: isDark ? 0.04 : 0.08 }, isZooming && { zIndex: 999, overflow: 'visible' }]}>
      <CloudGlassSurface
        blur={false}
        style={[
          styles.glassCard,
          isDark
            ? {
                backgroundColor: 'rgba(25, 25, 25, 0.72)',
                borderWidth: 0,
                borderTopWidth: 1,
                borderLeftWidth: 1,
                borderTopColor: 'rgba(255, 255, 255, 0.12)',
                borderLeftColor: 'rgba(255, 255, 255, 0.12)',
                borderBottomWidth: 0,
                borderRightWidth: 0,
              }
            : {
                backgroundColor: '#FFFFFF',
                borderWidth: 1.5,
                borderTopWidth: 1.5,
                borderLeftWidth: 1.5,
                borderBottomWidth: 1.5,
                borderRightWidth: 1.5,
                borderColor: theme.colors.border,
                borderTopColor: theme.colors.border,
                borderLeftColor: theme.colors.border,
                borderBottomColor: theme.colors.border,
                borderRightColor: theme.colors.border,
              },
          isZooming && { zIndex: 999, overflow: 'visible' }
        ]}
        contentStyle={[styles.glassCardInner, isZooming && { zIndex: 999, overflow: 'visible' }]}
        borderRadius={20}
      >
      {/* Header - Must be above image to receive touches */}
      <View pointerEvents="box-none">
        <PostHeader
          post={post}
          onMenuPress={() => setShowMenu(true)}
          showReportButton={!!currentUser && normalizeId(postUser._id) !== normalizeId(currentUser._id)}
          onReportPress={() => setShowReportModal(true)}
        />
      </View>

      {/* Image - Always mounted to prevent reload flicker on scroll */}
      <PostImage
        post={post}
        onPress={handlePress}
        imageUri={imageUri}
        imageLoading={imageLoading}
        imageError={imageError}
        onImageError={handleImageError}
        onRetry={handleImageRetry}
        pulseAnim={pulseAnim}
        isCurrentlyVisible={isCurrentlyVisible}
        onDoubleTap={handleLike}
        onZoomStateChange={setIsZooming}
      />

      {/* Actions - Must be above image to receive touches */}
      <View pointerEvents="box-none">
        <PostActions
          isLiked={isLiked}
          isSaved={isSaved}
          onLike={handleLike}
          onComment={handleOpenComments}
          onShare={handleShareClick}
          onSave={handleSave}
          showBookmark={showBookmark} // Allow users to save their own posts
          isLoading={actionLoading.size > 0}
        />
      </View>

      {/* Likes Count */}
      <PostLikesCount likesCount={likesCount} />

      {/* Caption */}
      <PostCaption post={post} />
      </CloudGlassSurface>

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
                <LoadingGlobe size="small" color={theme.colors.primary} />
              </View>
            )}
            {currentUser && normalizeId(currentUser._id) === normalizeId(postUser._id) ? (
              // Own post options
              <>
                {/* Archive ↔ Unarchive — flips based on the post's current state.
                    The post still renders (e.g. shown via Manage Posts → tap to
                    open detail) so the menu must support reverting from here. */}
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => {
                    setShowMenu(false);
                    if (post.isArchived) {
                      showCustomAlertMessage(
                        'Unarchive Post',
                        'Restore this post to your profile?',
                        'warning',
                        handleUnarchivePost
                      );
                    } else {
                      showCustomAlertMessage(
                        'Archive Post',
                        'Are you sure you want to archive this post? It will be hidden from your profile but can be restored later.',
                        'warning',
                        handleArchivePost
                      );
                    }
                  }}
                  disabled={isMenuLoading}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="archive-outline" size={22} color={theme.colors.text} />
                  </View>
                  <Text style={[styles.menuText, { color: theme.colors.text }]}>{post.isArchived ? 'Unarchive' : 'Archive'}</Text>
                </TouchableOpacity>
                {/* Hide ↔ Unhide — same pattern. */}
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
                  onPress={() => {
                    setShowMenu(false);
                    if (post.isHidden) {
                      showCustomAlertMessage(
                        'Unhide Post',
                        'Make this post visible again?',
                        'warning',
                        handleUnhidePost
                      );
                    } else {
                      showCustomAlertMessage(
                        'Hide Post',
                        'Are you sure you want to hide this post? It will be hidden from your feed.',
                        'warning',
                        handleHidePost
                      );
                    }
                  }}
                  disabled={isMenuLoading}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name={post.isHidden ? 'eye-outline' : 'eye-off-outline'} size={22} color={theme.colors.text} />
                  </View>
                  <Text style={[styles.menuText, { color: theme.colors.text }]}>{post.isHidden ? 'Unhide' : 'Hide'}</Text>
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
                    setShowReportModal(true);
                  }}
                  disabled={isMenuLoading}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="flag-outline" size={22} color={theme.colors.text} />
                  </View>
                  <Text style={[styles.menuText, { color: theme.colors.text }]}>Report</Text>
                </TouchableOpacity>
                {(() => {
                  const followingList = Array.isArray((currentUser as any)?.followingIds)
                    ? (currentUser as any).followingIds
                    : (Array.isArray((currentUser as any)?.following) ? (currentUser as any).following : []);
                  const postUserIdNormalized = normalizeId(postUser._id);
                  const isFollowingPostUser = followingList.some((f: any) => {
                    const id = normalizeId(f);
                    return id === postUserIdNormalized;
                  });
                  if (isFollowingPostUser) {
                    return (
                      <TouchableOpacity
                        style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
                        onPress={() => {
                          setShowMenu(false);
                          showCustomAlertMessage(
                            'Unfollow User',
                            `Are you sure you want to unfollow ${postUser.fullName || 'Unknown User'}? You won't see their posts in your feed anymore.`,
                            'warning',
                            async () => {
                              try {
                                setIsMenuLoading(true);
                                await toggleFollow(postUser._id);
                                const updatedFollowing = followingList
                                  .map((id: any) => normalizeId(id))
                                  .filter((id: string | null) => id !== postUserIdNormalized);
                                const updatedUser = { 
                                  ...currentUser, 
                                  followingIds: updatedFollowing,
                                  following: updatedFollowing.length
                                };
                                setCurrentUser(updatedUser);
                                await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
                              } catch (err: any) {
                                showCustomAlertMessage('Error', sanitizeErrorForDisplay(err, 'OptimizedPhotoCard.unfollow') || 'Failed to unfollow user', 'error');
                              } finally {
                                setIsMenuLoading(false);
                              }
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
                    );
                  } else {
                    return (
                      <TouchableOpacity
                        style={[styles.menuItem, { borderBottomColor: theme.colors.border }]}
                        onPress={async () => {
                          setShowMenu(false);
                          try {
                            setIsMenuLoading(true);
                            await toggleFollow(postUser._id);
                            const updatedFollowing = [...followingList.map((id: any) => normalizeId(id)), postUserIdNormalized].filter(Boolean);
                            const updatedUser = { 
                              ...currentUser, 
                              followingIds: updatedFollowing,
                              following: updatedFollowing.length
                            };
                            setCurrentUser(updatedUser);
                            await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
                            showCustomAlertMessage('Success', `Following ${postUser.fullName || 'User'}!`, 'success');
                          } catch (err: any) {
                            showCustomAlertMessage('Error', sanitizeErrorForDisplay(err, 'OptimizedPhotoCard.follow') || 'Failed to follow user', 'error');
                          } finally {
                            setIsMenuLoading(false);
                          }
                        }}
                        disabled={isMenuLoading}
                      >
                        <View style={styles.menuIconContainer}>
                          <Ionicons name="person-add-outline" size={22} color={theme.colors.text} />
                        </View>
                        <Text style={[styles.menuText, { color: theme.colors.text }]}>Follow</Text>
                      </TouchableOpacity>
                    );
                  }
                })()}
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomWidth: 0 }]}
                  onPress={() => {
                    setShowMenu(false);
                    setShowAddToCollectionModal(true);
                  }}
                  disabled={isMenuLoading}
                >
                  <View style={styles.menuIconContainer}>
                    <Ionicons name="albums-outline" size={22} color={theme.colors.text} />
                  </View>
                  <Text style={[styles.menuText, { color: theme.colors.text }]}>Add to Collection</Text>
                </TouchableOpacity>
              </>
            )}
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

      {/* Edit Modal - Fixed alignment and responsiveness */}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.editModalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Overlay background - close modal on press */}
          <TouchableOpacity 
            style={styles.editModalOverlayTouchable}
            activeOpacity={1}
            onPress={() => {
              if (!isMenuLoading) {
                setShowEditModal(false);
                setEditCaption(post.caption || '');
              }
            }}
          >
            {/* Modal container - prevent close on press */}
            <TouchableOpacity 
              style={styles.editModalContainerTouchable}
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
                      <LoadingGlobe size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.editModalButtonTextSave}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Comment Modal */}
      <PostComments
        visible={showCommentModal}
        postId={post._id}
        comments={comments}
        onClose={() => setShowCommentModal(false)}
        onCommentAdded={handleCommentAdded}
        onCommentDeleted={handleCommentDeleted}
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
      <ReportReasonModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Report Post"
        onSelect={async (reason: ReportReasonType) => {
          try {
            await createReport({
              type: reason,
              reportedUserId: postUser._id,
              postId: post._id,
              reason,
            });
            showCustomAlertMessage('Success', 'Post reported successfully! Thank you for helping keep our community safe.', 'success');
          } catch (err: any) {
            showCustomAlertMessage('Error', sanitizeErrorForDisplay(err, 'OptimizedPhotoCard.report') || 'Failed to submit report', 'error');
          }
        }}
      />
      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        post={post}
      />

      {/* Add to Collection Modal */}
      <AddToCollectionModal
        visible={showAddToCollectionModal}
        postId={post._id}
        onClose={() => setShowAddToCollectionModal(false)}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
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
    prevProps.isCurrentlyVisible === nextProps.isCurrentlyVisible
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    marginBottom: 20,
    marginHorizontal: 16,
    // Premium soft shadow for Airbnb/Notion vibe
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
  },
  glassCard: {
    overflow: 'hidden',
    borderWidth: 0,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    borderLeftColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  glassCardInner: {
    overflow: 'hidden',
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
  },
  editModalOverlayTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalContainerTouchable: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  editModalContainer: {
    width: '100%',
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
