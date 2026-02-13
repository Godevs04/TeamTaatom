import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator, 
  Image, 
  RefreshControl, 
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Platform,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { Ionicons } from '@expo/vector-icons';
import { getPosts } from '../../services/posts';
import { PostType } from '../../types/post';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import { getUserFromStorage } from '../../services/auth';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { imageCacheManager } from '../../utils/imageCacheManager';
import AnimatedHeader from '../../components/AnimatedHeader';
import EmptyState from '../../components/EmptyState';
import { PostSkeleton } from '../../components/LoadingSkeleton';
import { trackScreenView, trackPostView, trackEngagement, trackFeatureUsage } from '../../services/analytics';
import api from '../../services/api';
import { socketService } from '../../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { isWeb, throttle } from '../../utils/webOptimizations';
import { triggerRefreshHaptic } from '../../utils/hapticFeedback';
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';
import { audioManager } from '../../utils/audioManager';
import { ErrorBoundary } from '../../utils/errorBoundary';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
// isWeb is already imported from '../../utils/webOptimizations'
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';
const logger = createLogger('HomeScreen');

// Helper function to normalize IDs from various formats (string, ObjectId, Buffer)
// Buffer objects in React Native appear as objects with numeric keys (e.g., { '0': 104, '1': 235, ... })
const normalizeId = (id: any): string | null => {
  if (!id) return null;
  
  // If it's already a string, validate and return it
  if (typeof id === 'string') {
    // Check if it's a valid ObjectId format (24 hex characters)
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      return id;
    }
    return id; // Return even if not valid format, let caller handle it
  }
  
  // If it's an object with _id property, recurse
  if (id._id) {
    return normalizeId(id._id);
  }
  
  // If it has a buffer property (serialized Buffer from backend)
  // This handles: { buffer: { '0': 104, '1': 235, ... } }
  if (id.buffer && typeof id.buffer === 'object') {
    try {
      const bufferObj = id.buffer;
      const bytes: number[] = [];
      
      // Try to extract bytes from buffer object (can have numeric string keys)
      for (let i = 0; i < 12; i++) {
        const byte = bufferObj[i] ?? bufferObj[String(i)];
        if (byte !== undefined && typeof byte === 'number' && byte >= 0 && byte <= 255) {
          bytes.push(byte);
        }
      }
      
      if (bytes.length === 12) {
        // Convert bytes to hex string (24 characters)
        const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
        if (/^[0-9a-fA-F]{24}$/.test(hex)) {
          return hex;
        }
      }
    } catch (error) {
      if (__DEV__) {
        logger.debug('Error converting buffer to hex', { error, id });
      }
    }
  }
  
  // If the object itself looks like a buffer (has numeric keys directly)
  // This handles: { '0': 104, '1': 235, ... } (direct buffer serialization)
  if (typeof id === 'object' && !Array.isArray(id)) {
    const keys = Object.keys(id);
    // Check if it looks like a buffer (has numeric keys 0-11)
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
      } catch (error) {
        if (__DEV__) {
          logger.debug('Error converting direct buffer to hex', { error, id });
        }
      }
    }
  }
  
  // If it has toString method
  if (id.toString && typeof id.toString === 'function') {
    try {
      const str = id.toString();
      if (typeof str === 'string' && /^[0-9a-fA-F]{24}$/.test(str)) {
        return str;
      }
    } catch (error) {
      if (__DEV__) {
        logger.debug('Error calling toString on ID:', error);
      }
    }
  }
  
  // Last resort: try to convert to string
  try {
    const str = String(id);
    if (/^[0-9a-fA-F]{24}$/.test(str)) {
      return str;
    }
  } catch (error) {
    if (__DEV__) {
      logger.debug('Error converting ID to string:', error);
    }
  }
  
  return null;
};

// Elegant font families for each platform
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) {
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    return 'System';
  }
  return 'Roboto';
};

export default function HomeScreen() {
  const { handleScroll } = useScrollToHideNav();
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unseenMessageCount, setUnseenMessageCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const { theme, mode } = useTheme();
  const { showError } = useAlert();
  const router = useRouter();
  const params = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);
  const isFetchingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const lastErrorTimeRef = useRef(0);
  const errorCountRef = useRef(0);
  const isFetchingMessagesRef = useRef(false);
  const lastMessageFetchRef = useRef(0);
  
  // Request guards for pull-to-refresh and pagination race safety
  const isRefreshingRef = useRef(false);
  const isPaginatingRef = useRef(false);
  
  // View tracking de-duplication: track last viewed post ID and timestamp
  const lastViewedPostIdRef = useRef<string | null>(null);
  const lastViewTimeRef = useRef<number>(0);
  const VIEW_DEBOUNCE_MS = 2000; // Prevent duplicate view events within 2 seconds
  
  // Track visible index for conditional image rendering
  const [visibleIndex, setVisibleIndex] = useState<number | null>(null);
  // Track currently visible post ID for music playback control
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);

  const fetchPosts = useCallback(async (pageNum: number = 1, shouldAppend: boolean = false) => {
    // Request guards: prevent overlapping refresh and pagination
    if (shouldAppend) {
      // Pagination request
      if (isPaginatingRef.current || isRefreshingRef.current) {
        logger.debug('Pagination blocked: refresh or pagination already in progress');
        return;
      }
      isPaginatingRef.current = true;
    } else {
      // Refresh request
      if (isRefreshingRef.current || isPaginatingRef.current) {
        logger.debug('Refresh blocked: refresh or pagination already in progress');
        return;
      }
      isRefreshingRef.current = true;
    }
    
    // Prevent multiple simultaneous calls
    if (isFetchingRef.current && !shouldAppend) {
      logger.debug('Already fetching posts, skipping...');
      if (shouldAppend) {
        isPaginatingRef.current = false;
      } else {
        isRefreshingRef.current = false;
      }
      return;
    }
    
    isFetchingRef.current = true;
    try {
      logger.debug('Fetching posts for page:', pageNum);
      
      // Web: Fetch more posts per page for better UX
      const postsPerPage = isWeb ? 15 : 10;
      const response = await getPosts(pageNum, postsPerPage);
      
      // Handle empty posts array gracefully (don't show error if API succeeded)
      if (!response.posts || response.posts.length === 0) {
        if (pageNum === 1 && !shouldAppend) {
          // First page with no posts - set empty array, don't show error
          setPosts([]);
          setHasMore(false);
          setPage(1);
          logger.debug('No posts returned (may be filtered or empty database)');
        } else {
          // Pagination with no more posts
          setHasMore(false);
        }
        return;
      }
      
      if (shouldAppend) {
        // Feed de-duplication: merge items by unique _id, never append duplicates
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p._id));
          const newPosts = response.posts.filter(p => !existingIds.has(p._id));
          return [...prev, ...newPosts];
        });
      } else {
        setPosts(response.posts);
      }
      
      setHasMore(response.pagination?.hasNextPage ?? false);
      setPage(pageNum);
      
      // Scroll to specific post if postId is provided in params
      if (params.postId && typeof params.postId === 'string' && response.posts.length > 0) {
        const targetIndex = response.posts.findIndex(p => p._id === params.postId);
        if (targetIndex !== -1) {
          // Use multiple attempts with increasing delays to ensure scroll works
          // This handles cases where FlatList isn't ready immediately
          const attemptScroll = (attempt: number = 0) => {
            if (attempt > 5) {
              logger.warn(`Failed to scroll to post ${params.postId} after 5 attempts`);
              return;
            }
            
            setTimeout(() => {
              if (flatListRef.current) {
                try {
                  flatListRef.current.scrollToIndex({ 
                    index: targetIndex, 
                    animated: true 
                  });
                  logger.debug(`Successfully scrolled to post at index ${targetIndex}`);
                } catch (error) {
                  // If scroll fails, retry with longer delay
                  logger.debug(`Scroll attempt ${attempt + 1} failed, retrying...`, error);
                  attemptScroll(attempt + 1);
                }
              } else {
                // FlatList not ready yet, retry
                attemptScroll(attempt + 1);
              }
            }, 100 * (attempt + 1)); // Increasing delay: 100ms, 200ms, 300ms, etc.
          };
          
          // Start scroll attempts
          attemptScroll();
        } else {
          logger.warn(`Post ${params.postId} not found in loaded posts`);
        }
      }
      
      // Cache posts for offline support
      if (pageNum === 1 && !shouldAppend) {
        try {
          await AsyncStorage.setItem('cachedPosts', JSON.stringify({
            data: response.posts,
            timestamp: Date.now()
          }));
        } catch (error) {
          logger.error('Error caching posts', error);
        }
      }
      
      // Enhanced image preloading with priority strategy
      if (response.posts.length > 0) {
        const preloadCount = isWeb ? 8 : 5;
        // Preload visible posts first (first 3)
        const visiblePosts = response.posts.slice(0, 3);
        visiblePosts.forEach((post) => {
          if (post.imageUrl) {
            imageCacheManager.prefetchImage(post.imageUrl).catch(() => {
              // Silently fail
            });
          }
        });
        
        // Preload upcoming posts in background (next 5-8)
        const upcomingPosts = response.posts.slice(3, preloadCount);
        setTimeout(() => {
          upcomingPosts.forEach((post) => {
            if (post.imageUrl) {
              imageCacheManager.prefetchImage(post.imageUrl).catch(() => {
                // Silently fail
              });
            }
          });
        }, 500); // Delay to not block initial render
      }
    } catch (error: any) {
      const now = Date.now();
      const timeSinceLastError = now - lastErrorTimeRef.current;
      
      // Only log error if it's been more than 2 seconds since last error (prevent spam)
      if (timeSinceLastError > 2000) {
        errorCountRef.current = 0;
        logger.error('Failed to fetch posts', error);
      } else {
        errorCountRef.current++;
        // Only log every 10th error to prevent log spam
        if (errorCountRef.current % 10 === 0) {
          logger.error(`Failed to fetch posts (${errorCountRef.current} attempts)`, error);
        }
      }
      lastErrorTimeRef.current = now;
      
      // Only show error once per failure, not repeatedly
      const isNetworkError = !isOnline || 
        error?.message?.includes('Network') || 
        error?.code === 'ERR_NETWORK' ||
        error?.message === 'Network Error';
      
      // Load cached posts on network error (only for first page, not pagination)
      if (isNetworkError && pageNum === 1 && !shouldAppend) {
        try {
          const cachedData = await AsyncStorage.getItem('cachedPosts');
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
              // Check if cache is not too old (24 hours)
              const cacheAge = Date.now() - (parsed.timestamp || 0);
              if (cacheAge < 24 * 60 * 60 * 1000) {
                logger.debug('Loading cached posts due to network error');
                setPosts(parsed.data);
                setHasMore(false); // Can't paginate with cached data
                setPage(1);
                // Don't show error if we have cached data
                return;
              }
            }
          }
        } catch (cacheError) {
          logger.warn('Failed to load cached posts', cacheError);
        }
      }
      
      // Use setTimeout to prevent error from triggering re-renders that cause loops
      // Only show error if it's been more than 5 seconds since last error shown
      if (timeSinceLastError > 5000 || errorCountRef.current === 1) {
        setTimeout(() => {
          if (isNetworkError) {
            // Only show error if we don't have cached data
            if (pageNum === 1 && !shouldAppend) {
              showError('Connection issue. Showing cached content if available.');
            }
          } else if (error?.response?.status === 429) {
            showError('Too many requests. Please wait a moment and try again.');
          } else if (pageNum === 1 && !shouldAppend) {
            // Only show error on first page load, not on pagination
            showError('Failed to load posts. Pull down to refresh.');
          }
        }, 100);
      }
      // For pagination errors, silently fail - user can retry by scrolling
    } finally {
      isFetchingRef.current = false;
      // Clear request guards
      if (shouldAppend) {
        isPaginatingRef.current = false;
      } else {
        isRefreshingRef.current = false;
      }
    }
  }, [isOnline]);

  const fetchUnseenMessageCount = useCallback(async () => {
    // Prevent duplicate calls within 2 seconds
    const now = Date.now();
    if (isFetchingMessagesRef.current || (now - lastMessageFetchRef.current < 2000)) {
      return;
    }
    
    isFetchingMessagesRef.current = true;
    lastMessageFetchRef.current = now;
    
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');
      let myUserId = '';
      if (userData) {
        try {
          myUserId = JSON.parse(userData)._id;
        } catch {}
      }
      
      if (!token || !myUserId) {
        isFetchingMessagesRef.current = false;
        return;
      }
      
      // Use dynamic API URL detection for web
      const { getApiBaseUrl } = require('../../utils/config');
      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/chat`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch chats: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const chats = data.chats || [];
      
      // Normalize myUserId for comparison
      const normalizedMyUserId = normalizeId(myUserId);
      if (!normalizedMyUserId) {
        logger.warn('Could not normalize myUserId for unread count calculation', { myUserId });
        isFetchingMessagesRef.current = false;
        return;
      }
      
      // Calculate total unseen messages
      let totalUnseen = 0;
      try {
        chats.forEach((chat: any, chatIndex: number) => {
          try {
            if (chat.messages && Array.isArray(chat.messages)) {
              // Handle participants - can be array of user objects or array of IDs
              // Also handle case where participants might be serialized as array-indexed objects
              let participants = chat.participants;
              
              // If participants looks like an array-indexed object (e.g., { '0': {...}, '1': {...} })
              if (participants && typeof participants === 'object' && !Array.isArray(participants)) {
                const keys = Object.keys(participants);
                if (keys.every(k => /^\d+$/.test(k))) {
                  // Convert to array
                  participants = keys.map(k => participants[k]);
                }
              }
              
              if (!Array.isArray(participants) || participants.length === 0) {
                return;
              }
              
              // Find the other user (not me) - handle Buffer objects from backend
              const otherUser = participants.find((p: any) => {
                try {
                  // Handle both populated participants (with _id) and direct IDs
                  const pId = normalizeId(p?._id || p);
                  return pId && pId !== normalizedMyUserId;
                } catch (e) {
                  // Skip this participant if normalization fails
                  return false;
                }
              });
              
              if (otherUser) {
                try {
                  const otherUserId = normalizeId(otherUser._id || otherUser);
                  
                  if (otherUserId) {
                    const unseen = chat.messages.filter((msg: any) => {
                      try {
                        // Normalize sender ID - handle Buffer objects from backend
                        // Sender can be: string, ObjectId, or { _id: ObjectId }
                        const senderId = normalizeId(msg.sender?._id || msg.sender);
                        
                        // Message is unseen if:
                        // 1. It's from the other user (not me)
                        // 2. It hasn't been seen
                        return senderId === otherUserId && !msg.seen;
                      } catch (e) {
                        // Skip this message if normalization fails
                        return false;
                      }
                    }).length;
                    
                    totalUnseen += unseen;
                  }
                } catch (e) {
                  // Skip this chat if otherUserId normalization fails
                }
              }
            }
          } catch (e) {
            // Skip this chat if processing fails
          }
        });
      } catch (e) {
        // If entire loop fails, log but continue
        logger.warn('Error processing chats for unread count', { error: e });
      }
      
      setUnseenMessageCount(totalUnseen);
    } catch (error: any) {
      // Only log if it's not a network error or expected error
      if (error?.message && !error.message.includes('Failed to fetch') && !error.message.includes('Network')) {
        logger.error('fetchUnseenMessageCount', error);
      }
      // Silently fail - don't show error to user for message count
    } finally {
      isFetchingMessagesRef.current = false;
    }
  }, []);

  // Monitor network status using fetch with timeout
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        setIsOnline(true);
      } catch (error) {
        setIsOnline(false);
        logger.warn('Network connection lost');
      }
    };
    
    // Check initially
    checkNetworkStatus();
    
    // Check periodically
    const interval = setInterval(checkNetworkStatus, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Prevent multiple initializations
    if (hasInitializedRef.current) {
      return;
    }
    
    const loadInitialData = async () => {
      if (hasInitializedRef.current) return;
      hasInitializedRef.current = true;
      
      setLoading(true);
      try {
        // Load current user first
        const user = await getUserFromStorage();
        setCurrentUser(user);
        
        // Try to load cached posts first for instant display
        try {
          const cachedData = await AsyncStorage.getItem('cachedPosts');
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
              // Check if cache is not too old (24 hours)
              const cacheAge = Date.now() - (parsed.timestamp || 0);
              if (cacheAge < 24 * 60 * 60 * 1000) {
                logger.debug('Loading cached posts for instant display');
                setPosts(parsed.data);
                setHasMore(false);
                setPage(1);
                setLoading(false); // Show cached data immediately
              }
            }
          }
        } catch (cacheError) {
          logger.debug('No cached posts available or cache error', cacheError);
        }
        
        // Fetch unseen message count (non-blocking)
        fetchUnseenMessageCount().catch(err => {
          logger.debug('Failed to fetch message count (non-critical)', err);
        });
        
        // Try to load fresh posts (will update cache if successful)
        logger.debug('Loading fresh posts...');
        await fetchPosts(1, false);
      } catch (error) {
        logger.error('Error loading initial data', error);
        // If we don't have cached data, show error
        if (posts.length === 0) {
          setTimeout(() => {
            showError('Failed to load content. Please pull down to refresh.');
          }, 100);
        }
        hasInitializedRef.current = false; // Allow retry
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
    
    // Track screen view
    trackScreenView('home');
  }, []); // Empty deps - only run once on mount

  // Navigation lifecycle safety: clear visible index tracking and cancel pending fetches
  useFocusEffect(
    useCallback(() => {
      // Clear visible index when screen loses focus
      return () => {
        setVisibleIndex(null);
        lastViewedPostIdRef.current = null;
        lastViewTimeRef.current = 0;
        // Stop all audio when leaving home page
        logger.debug('[Home] Stopping all audio - leaving home page');
        audioManager.stopAll().catch((error) => {
          logger.error('[Home] Error stopping audio:', error);
        });
      };
    }, [])
  );

  // Refresh unseen count when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchUnseenMessageCount();
      
      // Set up periodic refresh every 10 seconds when screen is focused
      const interval = setInterval(() => {
        fetchUnseenMessageCount();
      }, 10000);
      
      return () => clearInterval(interval);
    }, [fetchUnseenMessageCount])
  );

  // Scroll to specific post when postId parameter is provided and posts are loaded
  useEffect(() => {
    if (!params.postId || typeof params.postId !== 'string' || posts.length === 0 || !flatListRef.current) {
      return;
    }
    
    const targetIndex = posts.findIndex(p => p._id === params.postId);
    if (targetIndex === -1) {
      // Post not found in current posts, might need to load more or it's not in feed
      logger.debug(`Post ${params.postId} not found in current posts`);
      return;
    }
    
    // Use multiple attempts with increasing delays to ensure scroll works
    const attemptScroll = (attempt: number = 0) => {
      if (attempt > 5) {
        logger.warn(`Failed to scroll to post ${params.postId} after 5 attempts`);
        return;
      }
      
      setTimeout(() => {
        if (flatListRef.current) {
          try {
            flatListRef.current.scrollToIndex({ 
              index: targetIndex, 
              animated: true 
            });
            logger.debug(`Successfully scrolled to post at index ${targetIndex}`);
          } catch (error) {
            // If scroll fails, retry with longer delay
            logger.debug(`Scroll attempt ${attempt + 1} failed, retrying...`, error);
            attemptScroll(attempt + 1);
          }
        } else {
          // FlatList not ready yet, retry
          attemptScroll(attempt + 1);
        }
      }, 100 * (attempt + 1)); // Increasing delay: 100ms, 200ms, 300ms, etc.
    };
    
    // Start scroll attempts
    attemptScroll();
  }, [params.postId, posts]);

  // Subscribe to socket events for real-time unread count updates
  useEffect(() => {
    if (!isOnline) return;
    
    const onMessageNew = async (payload: any) => {
      logger.debug('Received message:new event on home page, updating unread count', payload);
      // Refresh count after a short delay to get accurate count
      setTimeout(() => {
        fetchUnseenMessageCount();
      }, 500);
    };
    
    const onMessageSeen = async (payload: any) => {
      logger.debug('Received message seen event, updating unread count', payload);
      // Refresh count after a short delay
      setTimeout(() => {
        fetchUnseenMessageCount();
      }, 500);
    };
    
    socketService.subscribe('message:new', onMessageNew);
    socketService.subscribe('seen', onMessageSeen);
    
    return () => {
      socketService.unsubscribe('message:new', onMessageNew);
      socketService.unsubscribe('seen', onMessageSeen);
    };
  }, [isOnline, fetchUnseenMessageCount]);

  const handleRefresh = useCallback(async () => {
    // Request guard: prevent refresh if already refreshing or paginating
    if (isRefreshingRef.current || isPaginatingRef.current) {
      logger.debug('Refresh blocked: already in progress');
      return;
    }
    
    // Trigger haptic feedback for better UX
    triggerRefreshHaptic();
    
    // Scroll to top immediately for better UX
    if (flatListRef.current && posts.length > 0) {
      try {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      } catch (error) {
        logger.debug('Error scrolling to top:', error);
        // Fallback: try scrolling to index 0
        try {
          flatListRef.current.scrollToIndex({ index: 0, animated: true });
        } catch (indexError) {
          logger.debug('Error scrolling to index 0:', indexError);
        }
      }
    }
    
    setRefreshing(true);
    try {
      await Promise.all([
        fetchPosts(1, false),
        fetchUnseenMessageCount()
      ]);
      
      // Ensure scroll to top after posts are loaded
      if (flatListRef.current) {
        setTimeout(() => {
          try {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
          } catch (error) {
            logger.debug('Error scrolling to top after refresh:', error);
          }
        }, 100);
      }
    } finally {
      setRefreshing(false);
    }
  }, [fetchPosts, fetchUnseenMessageCount, posts.length]);

  // Throttle load more for web performance
  // Request guard: prevent pagination if already paginating or refreshing
  const handleLoadMore = useCallback(
    throttle(async () => {
      if (!loading && hasMore && !isPaginatingRef.current && !isRefreshingRef.current) {
        await fetchPosts(page + 1, true);
      }
    }, 1000),
    [loading, hasMore, page, fetchPosts]
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      ...(isWeb && {
        maxWidth: isTablet ? 800 : 600,
        alignSelf: 'center',
        width: '100%',
      } as any),
    },
    safeArea: {
      flex: 1,
      ...(isWeb && {
        width: '100%',
      } as any),
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
      backgroundColor: theme.colors.background,
    },
    emptyImageContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.xl,
      padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      alignItems: 'center',
      ...theme.shadows.medium,
    },
    emptyImage: {
      width: isTablet ? 160 : 120,
      height: isTablet ? 160 : 120,
      borderRadius: theme.borderRadius.lg,
      opacity: 0.8,
    },
    emptyTitle: {
      fontSize: isTablet ? theme.typography.h1.fontSize : theme.typography.h2.fontSize,
      fontFamily: getFontFamily('700'),
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
      letterSpacing: isIOS ? -0.3 : 0,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    emptyDescription: {
      fontSize: isTablet ? theme.typography.body.fontSize + 2 : theme.typography.body.fontSize,
      fontFamily: getFontFamily('400'),
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: isTablet ? 26 : 22,
      maxWidth: isTablet ? 400 : 280,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    postsContainer: {
      flex: 1,
    },
    postsList: {
      paddingHorizontal: 0,
      // Add padding for tab bar (88px mobile, 70px web) + extra spacing
      paddingBottom: isWeb ? 90 : (isTablet ? 110 : 100),
    },
    loadMoreContainer: {
      padding: isTablet ? theme.spacing.lg : theme.spacing.md,
      alignItems: 'center',
    },
    offlineBanner: {
      backgroundColor: theme.colors.error + '20',
      padding: isTablet ? theme.spacing.md : theme.spacing.sm,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.error,
    },
    offlineText: {
      color: theme.colors.error,
      fontSize: isTablet ? theme.typography.body.fontSize : theme.typography.small.fontSize,
      fontFamily: getFontFamily('600'),
      fontWeight: '600',
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
  });

  const renderHeader = () => (
    <AnimatedHeader 
      unseenMessageCount={unseenMessageCount} 
      onRefresh={handleRefresh}
    />
  );

  // Memoize keyExtractor and renderItem at top level (before conditional returns)
  // MUST be defined before conditional returns to follow Rules of Hooks
  const keyExtractor = useCallback((item: PostType) => item._id, []);
  
  // Track viewable items for conditional image rendering and analytics
  // View tracking de-duplication: prevent duplicate view events within 2 seconds
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      const visibleItem = viewableItems[0];
      const newVisibleIndex = visibleItem.index;
      if (newVisibleIndex !== null && newVisibleIndex !== undefined) {
        setVisibleIndex(newVisibleIndex);
        
        // Track visible post ID for music playback control
        if (visibleItem.item) {
          const postId = visibleItem.item._id;
          setVisiblePostId(postId);
          
          const now = Date.now();
          
          if (
            lastViewedPostIdRef.current !== postId ||
            (now - lastViewTimeRef.current) > VIEW_DEBOUNCE_MS
          ) {
            trackPostView(postId, {
              type: 'photo',
              source: 'home_feed'
            });
            lastViewedPostIdRef.current = postId;
            lastViewTimeRef.current = now;
          }
        }
      }
    } else {
      // No items visible - clear visible post ID to pause music
      setVisiblePostId(null);
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50, // Item is considered visible when 50% is on screen
    minimumViewTime: 200, // Minimum time item must be visible (ms)
  }).current;

  // Conditional image rendering: only render images within 2 indices of visible
  // This drastically reduces memory usage without changing UX
  const renderItem = useCallback(({ item, index }: { item: PostType; index: number }) => {
    const distanceFromVisible = visibleIndex !== null ? Math.abs(index - visibleIndex) : 0;
    const shouldRenderImage = distanceFromVisible <= 2;
    const isCurrentlyVisible = visiblePostId === item._id;
    
    return (
      <OptimizedPhotoCard 
        post={item} 
        onRefresh={handleRefresh}
        isVisible={shouldRenderImage}
        isCurrentlyVisible={isCurrentlyVisible}
        key={item._id}
      />
    );
  }, [visibleIndex, visiblePostId, handleRefresh]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar 
          barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
          backgroundColor={theme.colors.background} 
        />
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (posts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar 
          barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
          backgroundColor={theme.colors.background} 
        />
        {renderHeader()}
        <EmptyState
          icon="camera-outline"
          title="No Content Yet"
          description="No content yet. Explore other users or share your first photo!"
          actionLabel="Explore Users"
          onAction={() => router.push('/search')}
          secondaryActionLabel="Create Post"
          onSecondaryAction={() => router.push('/(tabs)/post')}
        />
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary level="route">
    <View style={styles.container}>
      <StatusBar 
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.background} 
      />
      <SafeAreaView style={styles.safeArea}>
        {renderHeader()}
        
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>
              You're offline. Some features may be limited.
            </Text>
          </View>
        )}
        
        <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={renderItem}
        style={styles.postsContainer}
        contentContainerStyle={styles.postsList}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
            progressBackgroundColor={theme.colors.surface}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={
          hasMore ? (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : posts.length > 0 ? (
            <View style={{ 
              paddingVertical: theme.spacing.xl,
              alignItems: 'center' 
            }}>
              <Text style={{ 
                color: theme.colors.textSecondary,
                fontSize: theme.typography.small.fontSize 
              }}>
                You're all caught up!
              </Text>
            </View>
          ) : null
        }
        // Track viewable items for conditional image rendering and analytics
        // View tracking de-duplication: prevent duplicate view events within 2 seconds
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        // Virtual scrolling optimizations for image feed performance
        // removeClippedSubviews: Unmount off-screen items to free memory (critical for image-heavy feed)
        // initialNumToRender: Only render 6 items initially for faster first paint
        // maxToRenderPerBatch: Render 4 items per batch to prevent scroll jank
        // windowSize: Keep 7 screen heights of items in memory (3.5 above + 3.5 below)
        removeClippedSubviews={true}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={7}
        getItemLayout={undefined} // Let FlatList calculate dynamically (variable height items)
        // Performance optimizations
        maintainVisibleContentPosition={undefined}
        legacyImplementation={false}
      />
      </SafeAreaView>
    </View>
    </ErrorBoundary>
  );
}
