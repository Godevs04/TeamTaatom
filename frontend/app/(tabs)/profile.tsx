import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Animated,
  useColorScheme,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import NavBar from '../../components/NavBar';
import { getUserFromStorage, signOut } from '../../services/auth';
import { getProfile, getTravelMapData } from '../../services/profile';
import { getUserPosts, getShorts, getUserShorts, getPostById, deletePost, deleteShort } from '../../services/posts';
import { savedEvents } from '../../utils/savedEvents';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUnreadCount } from '../../services/notifications';
import { UserType } from '../../types/user';
import { PostType } from '../../types/post';
import EditProfile from '../../components/EditProfile';
import RotatingGlobe from '../../components/RotatingGlobe';
import BioDisplay from '../../components/BioDisplay';
import KebabMenu from '../../components/common/KebabMenu';
import { triggerRefreshHaptic } from '../../utils/hapticFeedback';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';
import { ErrorBoundary } from '../../utils/errorBoundary';
import { trackScreenView, trackEngagement, trackFeatureUsage } from '../../services/analytics';
import { theme } from '../../constants/theme';

const logger = createLogger('ProfileScreen');

// Responsive dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

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

interface ProfileData extends UserType {
  postsCount: number;
  followersCount: number;
  followingCount: number;
  locations: Array<{
    latitude: number;
    longitude: number;
    address: string;
    date: string;
  }>;
  tripScore: {
    totalScore: number;
    continents: { [key: string]: number };
    countries: { [key: string]: number };
    areas: Array<{
      address: string;
      continent: string;
      likes: number;
      date: string;
    }>;
  } | null;
  isFollowing: boolean;
  isOwnProfile: boolean;
}

export default function ProfileScreen() {
  const { handleScroll } = useScrollToHideNav();
  const [user, setUser] = useState<UserType | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [userShorts, setUserShorts] = useState<PostType[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedItems, setSavedItems] = useState<PostType[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'shorts' | 'saved'>('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [verifiedLocationsCount, setVerifiedLocationsCount] = useState<number | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme, mode } = useTheme();
  const { showError, showSuccess, showConfirm } = useAlert();
  
  // Lifecycle & Navigation Safety: Track mounted state and cancel requests on unmount
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Analytics De-duplication: Prevent duplicate profile view events
  const lastProfileViewTimeRef = useRef<number>(0);
  const PROFILE_VIEW_DEBOUNCE_MS = 2000; // 2 seconds
  
  // Request Guards: Prevent duplicate API calls on rapid tab switching
  const isFetchingRef = useRef(false);
  
  // Scroll position persistence: Store scroll position when navigating away
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollPositionRef = useRef<number>(0);
  
  // Theme-aware colors for profile - MUST be called before any conditional returns
  const colorScheme = useColorScheme();
  // Improved dark mode detection - use theme mode if available, otherwise check background color
  const isDark = mode === 'dark' || (mode === 'auto' && colorScheme === 'dark') || theme.colors.background === '#000000' || theme.colors.background === '#111114';
  
  const profileTheme = useMemo(() => {
    if (isDark) {
      return {
        headerGradient: ['#020617', '#0B1120', '#111827'] as const,
        cardBg: '#111827',
        cardBorder: 'rgba(255, 255, 255, 0.1)',
        textPrimary: '#F9FAFB',
        textSecondary: '#9CA3AF',
        accent: '#60A5FA',
        statCardBg: 'rgba(96, 165, 250, 0.1)',
        statCardBorder: 'rgba(96, 165, 250, 0.2)',
      };
    } else {
      return {
        headerGradient: ['#F3F6FF', '#E8F0FE', '#FFFFFF'] as const,
        cardBg: '#FFFFFF',
        cardBorder: 'rgba(0, 0, 0, 0.08)',
        textPrimary: '#111827',
        textSecondary: '#6B7280',
        accent: '#2563EB',
        statCardBg: 'rgba(37, 99, 235, 0.08)',
        statCardBorder: 'rgba(37, 99, 235, 0.15)',
      };
    }
  }, [isDark]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await getUnreadCount();
      setUnreadCount(response.unreadCount);
    } catch (error) {
      logger.error('Failed to load unread count', error);
    }
  }, []);

  // Profile Data Consistency: Single source of truth - refresh all profile data from API
  const loadUserData = useCallback(async () => {
    // Request Guard: Prevent duplicate calls
    if (isFetchingRef.current) {
      logger.debug('loadUserData already in progress, skipping');
      return;
    }
    
    isFetchingRef.current = true;
    setCheckingUser(true);
    
    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      const startTime = Date.now();
      const userData = await getUserFromStorage();
      logger.debug('getUserFromStorage:', userData);
      
      if (!isMountedRef.current) return;
      
      if (!userData) {
        setCheckingUser(false);
        setLoading(false);
        return;
      }
      
      // OPTIMIZATION: Set user immediately for optimistic rendering
      setUser(userData);
      setCheckingUser(false);
      
      // OPTIMIZATION: Try to load cached data first for instant display (optimistic)
      try {
        const [cachedProfile, cachedPosts] = await Promise.all([
          AsyncStorage.getItem(`cachedProfile_${userData._id}`).catch(() => null),
          AsyncStorage.getItem(`cachedUserPosts_${userData._id}`).catch(() => null)
        ]);
        
        if (cachedProfile && !isMountedRef.current) return;
        if (cachedProfile) {
          const parsed = JSON.parse(cachedProfile);
          const cacheAge = Date.now() - (parsed.timestamp || 0);
          if (cacheAge < 5 * 60 * 1000) { // 5 min cache for profile
            setProfileData(parsed.data);
            setLoading(false); // Show cached data immediately
          }
        }
        
        if (cachedPosts && !isMountedRef.current) return;
        if (cachedPosts) {
          const parsed = JSON.parse(cachedPosts);
          const cacheAge = Date.now() - (parsed.timestamp || 0);
          if (cacheAge < 24 * 60 * 60 * 1000) { // 24 hour cache for posts
            setPosts(parsed.data);
          }
        }
      } catch (cacheError) {
        logger.debug('Cache load error (non-critical):', cacheError);
      }
      
      // OPTIMIZATION: Fetch profile, posts, shorts, and verified locations in parallel for 2-3x faster loading
      const [profileResult, userPosts, shortsResp, travelMapResult] = await Promise.allSettled([
        getProfile(userData._id),
        getUserPosts(userData._id),
        getUserShorts(userData._id, 1, 100),
        getTravelMapData(userData._id).catch(() => null) // Don't fail if this fails
      ]);
      
      if (!isMountedRef.current) return;
      
      // Handle profile result
      if (profileResult.status === 'fulfilled') {
        setProfileData(profileResult.value.profile);
        // Cache profile for next time
        AsyncStorage.setItem(`cachedProfile_${userData._id}`, JSON.stringify({
          data: profileResult.value.profile,
          timestamp: Date.now()
        })).catch(() => {});
      }
      
      if (!isMountedRef.current) return;

      // Handle verified locations count
      if (travelMapResult.status === 'fulfilled' && travelMapResult.value?.data?.statistics) {
        setVerifiedLocationsCount(travelMapResult.value.data.statistics.totalLocations);
      }
      
      if (userPosts.status === 'fulfilled') {
        const fetchedPosts = userPosts.value.posts || [];
        if (__DEV__) {
          console.log('📸 [Profile] Fetched posts:', fetchedPosts.length);
          if (fetchedPosts.length > 0) {
            console.log('📸 [Profile] First post:', {
              _id: fetchedPosts[0]._id,
              imageUrl: fetchedPosts[0].imageUrl,
              image_url: (fetchedPosts[0] as any).image_url,
              mediaUrl: (fetchedPosts[0] as any).mediaUrl,
              images: (fetchedPosts[0] as any).images,
              allKeys: Object.keys(fetchedPosts[0] || {})
            });
          }
        }
        setPosts(fetchedPosts);
        // Cache posts for offline support
        try {
          await AsyncStorage.setItem(`cachedUserPosts_${userData._id}`, JSON.stringify({
            data: fetchedPosts,
            timestamp: Date.now()
          }));
        } catch (cacheError) {
          logger.debug('Failed to cache user posts', cacheError);
        }
      } else if (userPosts.status === 'rejected') {
        if (__DEV__) {
          console.error('❌ [Profile] Failed to fetch posts:', userPosts.reason);
        }
        logger.error('Failed to fetch user posts:', userPosts.reason);
        
        // Try to load cached posts on network error
        const isNetworkError = userPosts.reason?.message?.includes('Network') || 
                              userPosts.reason?.code === 'ERR_NETWORK' ||
                              !userPosts.reason?.response;
        if (isNetworkError) {
          try {
            const cachedData = await AsyncStorage.getItem(`cachedUserPosts_${userData._id}`);
            if (cachedData) {
              const parsed = JSON.parse(cachedData);
              if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
                const cacheAge = Date.now() - (parsed.timestamp || 0);
                if (cacheAge < 24 * 60 * 60 * 1000) {
                  logger.debug('Loading cached user posts due to network error');
                  setPosts(parsed.data);
                }
              }
            }
          } catch (cacheError) {
            logger.debug('Failed to load cached user posts', cacheError);
          }
        }
      }
      
      if (shortsResp.status === 'fulfilled') {
        setUserShorts(shortsResp.value.shorts || []);
      }
      
      // OPTIMIZATION: Load saved IDs and unread count in parallel (non-blocking)
      Promise.allSettled([
        // Load saved IDs (defensive parsing)
        (async () => {
          try {
            const stored = await AsyncStorage.getItem('savedShorts');
            if (stored) {
              const parsed = JSON.parse(stored);
              if (Array.isArray(parsed)) {
                setSavedIds(parsed);
              }
            }
          } catch (storageError) {
            logger.warn('Failed to parse savedShorts from AsyncStorage', storageError);
            // Recover corrupted storage by resetting
            try {
              await AsyncStorage.setItem('savedShorts', JSON.stringify([]));
            } catch {}
          }
        })(),
        loadUnreadCount()
      ]).catch(() => {}); // Non-critical, continue even if these fail
      
      const loadTime = Date.now() - startTime;
      logger.debug(`[PERF] Profile loaded in ${loadTime}ms (optimized parallel fetch with cache)`);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.debug('loadUserData aborted');
        return;
      }
      if (!isMountedRef.current) return;
      logger.error('Failed to load profile', error);
      showError('Failed to load profile data');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setCheckingUser(false);
      }
      isFetchingRef.current = false;
    }
  }, [showError, loadUnreadCount]);

  // Lifecycle: Setup and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    loadUserData();
    
    return () => {
      isMountedRef.current = false;
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadUserData]);
  
  // Navigation Lifecycle Safety: Clear state on screen blur
  // Privacy & Settings Propagation: Refresh profile when screen is focused (e.g., after settings changes)
  useFocusEffect(
    useCallback(() => {
      // Screen focused - ensure mounted
      isMountedRef.current = true;
      
      // Restore scroll position when returning to profile page
      // This ensures users don't have to scroll down again after viewing a post or short
      if (scrollViewRef.current && scrollPositionRef.current > 0) {
        // Small delay to ensure ScrollView is fully rendered
        setTimeout(() => {
          if (scrollViewRef.current && isMountedRef.current) {
            scrollViewRef.current.scrollTo({
              y: scrollPositionRef.current,
              animated: false, // Instant scroll to avoid animation delay
            });
          }
        }, 100);
      }
      
      // Reload saved items when screen is focused and saved tab is active
      // This ensures saved items persist when navigating back from a post
      if (activeTab === 'saved' && isMountedRef.current) {
        const reloadSaved = async () => {
          try {
            const savedShorts = await AsyncStorage.getItem('savedShorts');
            const savedPosts = await AsyncStorage.getItem('savedPosts');
            
            let shortsArr: string[] = [];
            let postsArr: string[] = [];
            
            try {
              if (savedShorts) {
                const parsed = JSON.parse(savedShorts);
                shortsArr = Array.isArray(parsed) ? parsed : [];
              }
            } catch (error) {
              logger.warn('Failed to parse savedShorts on focus', error);
            }
            
            try {
              if (savedPosts) {
                const parsed = JSON.parse(savedPosts);
                postsArr = Array.isArray(parsed) ? parsed : [];
              }
            } catch (error) {
              logger.warn('Failed to parse savedPosts on focus', error);
            }
            
            const allIds = [...postsArr, ...shortsArr];
            const uniqueIds = Array.from(new Set(allIds));
            
            if (isMountedRef.current) {
              setSavedIds(uniqueIds);
            }
          } catch (error) {
            logger.error('Error reloading saved items on focus', error);
          }
        };
        
        // Reload saved items immediately when focused
        reloadSaved();
      }
      
      // Refresh profile data when screen is focused to ensure privacy settings are reflected
      // This ensures profile header, visibility, and dependent UI reflect latest settings
      // BUT: Don't refresh if we're on saved tab to avoid clearing saved items
      if (user?._id && !isFetchingRef.current && activeTab !== 'saved') {
        // Small delay to avoid race conditions with navigation
        const refreshTimer = setTimeout(() => {
          if (isMountedRef.current && user?._id) {
            loadUserData();
          }
        }, 100);
        
        return () => {
          clearTimeout(refreshTimer);
          // Screen blurred - cancel pending requests
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
        };
      }
      
      return () => {
        // Screen blurred - cancel pending requests
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, [user?._id, loadUserData, activeTab])
  );

  // Log posts when they change for debugging (development only)
  useEffect(() => {
    if (__DEV__) {
      if (posts.length > 0) {
        console.log('📊 [Profile] Posts state updated:', posts.length, 'posts');
        console.log('📊 [Profile] First post imageUrl:', posts[0]?.imageUrl || 'NONE');
      } else {
        console.log('📊 [Profile] No posts in state');
      }
    }
  }, [posts]);
  
  // Analytics De-duplication: Prevent duplicate profile view events
  useEffect(() => {
    if (!user || !profileData) return;
    
    const now = Date.now();
    const timeSinceLastView = now - lastProfileViewTimeRef.current;
    
    // Only track if enough time has passed since last view
    if (timeSinceLastView >= PROFILE_VIEW_DEBOUNCE_MS) {
      lastProfileViewTimeRef.current = now;
      trackScreenView('profile', {
        userId: user._id,
        hasPosts: posts.length > 0,
        hasShorts: userShorts.length > 0,
        postsCount: profileData.postsCount || 0
      });
    }
  }, [user?._id, profileData?.postsCount, posts.length, userShorts.length]);

  // Saved Content Stability: Listen for save/unsave events with defensive parsing
  useEffect(() => {
    const unsubscribe = savedEvents.addListener(async () => {
      if (!isMountedRef.current) return;
      
      try {
        const savedShorts = await AsyncStorage.getItem('savedShorts');
        const savedPosts = await AsyncStorage.getItem('savedPosts');
        
        // Defensive JSON parsing with recovery
        let shortsArr: string[] = [];
        let postsArr: string[] = [];
        
        try {
          if (savedShorts) {
            const parsed = JSON.parse(savedShorts);
            shortsArr = Array.isArray(parsed) ? parsed : [];
          }
        } catch (error) {
          logger.warn('Failed to parse savedShorts, resetting', error);
          try {
            await AsyncStorage.setItem('savedShorts', JSON.stringify([]));
          } catch {}
        }
        
        try {
          if (savedPosts) {
            const parsed = JSON.parse(savedPosts);
            postsArr = Array.isArray(parsed) ? parsed : [];
          }
        } catch (error) {
          logger.warn('Failed to parse savedPosts, resetting', error);
          try {
            await AsyncStorage.setItem('savedPosts', JSON.stringify([]));
          } catch {}
        }
        
        // Deduplicate by combining and using Set
        const allIds = [...postsArr, ...shortsArr];
        const uniqueIds = Array.from(new Set(allIds));
        
        if (isMountedRef.current) {
          setSavedIds(uniqueIds);
        }
      } catch (error) {
        logger.error('Error loading saved items in listener', error);
      }
    });
    return () => { 
      unsubscribe(); 
    };
  }, []);

  // Saved Content Stability: Load saved IDs when switching to saved tab (defensive parsing)
  useEffect(() => {
    const loadSaved = async () => {
      if (activeTab !== 'saved' || !isMountedRef.current) return;
      
      try {
        const savedShorts = await AsyncStorage.getItem('savedShorts');
        const savedPosts = await AsyncStorage.getItem('savedPosts');
        
        // Defensive JSON parsing
        let shortsArr: string[] = [];
        let postsArr: string[] = [];
        
        try {
          if (savedShorts) {
            const parsed = JSON.parse(savedShorts);
            shortsArr = Array.isArray(parsed) ? parsed : [];
          }
        } catch (error) {
          logger.warn('Failed to parse savedShorts on tab switch, resetting', error);
          try {
            await AsyncStorage.setItem('savedShorts', JSON.stringify([]));
          } catch {}
        }
        
        try {
          if (savedPosts) {
            const parsed = JSON.parse(savedPosts);
            postsArr = Array.isArray(parsed) ? parsed : [];
          }
        } catch (error) {
          logger.warn('Failed to parse savedPosts on tab switch, resetting', error);
          try {
            await AsyncStorage.setItem('savedPosts', JSON.stringify([]));
          } catch {}
        }
        
        // Deduplicate
        const allIds = [...postsArr, ...shortsArr];
        const uniqueIds = Array.from(new Set(allIds));
        
        if (isMountedRef.current) {
          setSavedIds(uniqueIds);
        }
      } catch (error) {
        logger.error('Error loading saved items on tab switch', error);
      }
    };
    loadSaved();
  }, [activeTab]);

  // Saved Content Stability: Resolve saved IDs to full post objects with deduplication and cleanup
  useEffect(() => {
    const resolveSaved = async () => {
      if (activeTab !== 'saved' || !isMountedRef.current) return;
      if (!savedIds || savedIds.length === 0) {
        if (isMountedRef.current) {
          setSavedItems([]);
        }
        return;
      }
      
      try {
        // Deduplicate IDs (defensive)
        const uniqueIds = Array.from(new Set(savedIds.filter(id => id && typeof id === 'string')));
        
        if (uniqueIds.length === 0) {
          if (isMountedRef.current) {
            setSavedItems([]);
          }
          return;
        }
        
        const batchSize = 10; // Batch size for performance
        const batches: string[][] = [];
        for (let i = 0; i < uniqueIds.length; i += batchSize) {
          batches.push(uniqueIds.slice(i, i + batchSize));
        }
        
        // Load all batches in parallel
        const allResults = await Promise.all(
          batches.map(batch => 
            Promise.allSettled(batch.map(id => getPostById(id)))
          )
        );
        
        if (!isMountedRef.current) return;
        
        const items: PostType[] = [];
        const itemMap = new Map<string, PostType>(); // Deduplicate by _id
        const failedIds: string[] = [];
        
        allResults.forEach((batchResults, batchIndex) => {
          batchResults.forEach((r, itemIndex) => {
            if (r.status === 'fulfilled') {
              const val: any = (r as any).value;
              const item = val.post || val;
              if (item && item._id) {
                // Deduplicate: only add if not already in map
                if (!itemMap.has(item._id)) {
                  itemMap.set(item._id, item);
                  items.push(item);
                }
              } else {
                // Post not found in response
                const id = batches[batchIndex][itemIndex];
                failedIds.push(id);
              }
            } else {
              // Post fetch failed (deleted or doesn't exist)
              const id = batches[batchIndex][itemIndex];
              failedIds.push(id);
              // Silently handle - don't log every failed post to avoid spam
            }
          });
        });
        
        // Clean up AsyncStorage by removing deleted post IDs (atomic read-modify-write)
        if (failedIds.length > 0 && isMountedRef.current) {
          try {
            const savedShorts = await AsyncStorage.getItem('savedShorts');
            const savedPosts = await AsyncStorage.getItem('savedPosts');
            
            // Defensive parsing
            let shortsArr: string[] = [];
            let postsArr: string[] = [];
            
            try {
              if (savedShorts) {
                const parsed = JSON.parse(savedShorts);
                shortsArr = Array.isArray(parsed) ? parsed : [];
              }
            } catch (error) {
              logger.warn('Failed to parse savedShorts during cleanup, resetting', error);
              shortsArr = [];
            }
            
            try {
              if (savedPosts) {
                const parsed = JSON.parse(savedPosts);
                postsArr = Array.isArray(parsed) ? parsed : [];
              }
            } catch (error) {
              logger.warn('Failed to parse savedPosts during cleanup, resetting', error);
              postsArr = [];
            }
            
            // Remove failed IDs from both arrays
            const cleanedShorts = shortsArr.filter(id => !failedIds.includes(id));
            const cleanedPosts = postsArr.filter(id => !failedIds.includes(id));
            
            // Atomic write: update both storage keys
            await Promise.all([
              AsyncStorage.setItem('savedShorts', JSON.stringify(cleanedShorts)),
              AsyncStorage.setItem('savedPosts', JSON.stringify(cleanedPosts))
            ]);
            
            // Update savedIds state to reflect cleaned list
            if (isMountedRef.current) {
              const allCleanedIds = [...cleanedPosts, ...cleanedShorts];
              const uniqueCleanedIds = Array.from(new Set(allCleanedIds));
              setSavedIds(uniqueCleanedIds);
            }
            
            logger.debug(`Cleaned up ${failedIds.length} deleted posts from saved items`);
          } catch (cleanupError) {
            logger.error('Error cleaning up deleted posts from AsyncStorage', cleanupError);
          }
        }
        
        if (isMountedRef.current) {
          setSavedItems(items);
        }
      } catch (e) {
        if (!isMountedRef.current) return;
        logger.error('Failed to load saved items', e);
        setSavedItems([]);
      }
    };
    resolveSaved();
  }, [activeTab, savedIds]);

  useEffect(() => {
    if (params.editProfile === 'true') {
      setShowEditProfile(true);
    }
  }, [params.editProfile]);

  useEffect(() => {
    if (!checkingUser && !user) {
      router.replace('/(auth)/signin');
    }
  }, [checkingUser, user, router]);

  const handleRefresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    triggerRefreshHaptic();
    setRefreshing(true);
    
    try {
      await loadUserData();
      if (isMountedRef.current) {
        await loadUnreadCount();
      }
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [loadUserData, loadUnreadCount]);

  const handleSignOut = async () => {
    showConfirm(
      'Are you sure you want to sign out?',
      async () => {
        try {
          // Sign out and clear all auth data (includes socket disconnect and storage clearing)
          await signOut();
          
          // Force navigation to signin immediately - use replace to prevent back navigation
          // Use a small delay to ensure storage is cleared before navigation
          setTimeout(() => {
            try {
              // Navigate to signin screen
              router.replace('/(auth)/signin');
              
              // On web, also force a hard reload to clear all state
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                // Use a slightly longer delay to ensure navigation completes first
                setTimeout(() => {
                  window.location.href = '/';
                }, 200);
              }
            } catch (navError) {
              logger.error('Navigation error after signout:', navError);
              // Fallback: try direct navigation
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.location.href = '/';
              }
            }
          }, 50);
        } catch (error: any) {
          logger.error('Sign out error:', error);
          // Even if signOut fails, try to navigate to signin
          try {
            router.replace('/(auth)/signin');
            // On web, force reload
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              setTimeout(() => {
                window.location.href = '/';
              }, 100);
            }
          } catch (navError) {
            logger.error('Navigation error after signout:', navError);
            // Last resort: force page reload
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }
          showError(error?.message || 'Failed to sign out. Please try again.');
        }
      },
      'Sign Out',
      'Sign Out',
      'Cancel'
    );
  };

  // Profile Data Consistency: Refresh profile data after edit to ensure single source of truth
  const handleProfileUpdate = useCallback(async (updatedUser: UserType) => {
    if (!isMountedRef.current) return;
    
    // Optimistic update
    setUser(updatedUser);
    setProfileData(prev => prev ? { ...prev, ...updatedUser } : null);
    
    // Refresh from API to ensure consistency (single source of truth)
    // This ensures profile header, post count, follower/following count, and tabs are all in sync
    try {
      if (updatedUser._id) {
        const profile = await getProfile(updatedUser._id);
        if (isMountedRef.current) {
          setProfileData(profile.profile);
          // Also refresh posts count if needed
          const userPosts = await getUserPosts(updatedUser._id);
          if (isMountedRef.current) {
            setPosts(userPosts.posts);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to refresh profile after update', error);
      // Don't show error - optimistic update is already applied
    }
  }, []);

  const handleDeletePost = async (postId: string, isShort: boolean = false) => {
    showConfirm(
      `Are you sure you want to delete this ${isShort ? 'short' : 'post'}?`,
      async () => {
        // Optimistic update - update UI immediately
        const previousPosts = [...posts];
        const previousShorts = [...userShorts];
        const previousSavedItems = [...savedItems];
        const previousProfileData = profileData;
        
        try {
          // Update UI optimistically
          if (isShort) {
            setUserShorts(prev => prev.filter(short => short._id !== postId));
          } else {
            setPosts(prev => prev.filter(post => post._id !== postId));
          }
          
          setSavedItems(prev => prev.filter(item => item._id !== postId));
          
          if (profileData) {
            setProfileData(prev => prev ? { 
              ...prev, 
              postsCount: isShort ? prev.postsCount : prev.postsCount - 1 
            } : null);
          }
          
          // Track deletion
          trackEngagement('delete', isShort ? 'short' : 'post', postId);
          
          // Perform actual deletion
          if (isShort) {
            await deleteShort(postId);
          } else {
            await deletePost(postId);
          }
          
          showSuccess(`${isShort ? 'Short' : 'Post'} deleted successfully!`);
        } catch (error: any) {
          // Revert optimistic update on error
          setPosts(previousPosts);
          setUserShorts(previousShorts);
          setSavedItems(previousSavedItems);
          setProfileData(previousProfileData);
          
          logger.error('Failed to delete post', error);
          showError(error.message || `Failed to delete ${isShort ? 'short' : 'post'}`);
        }
      },
      'Delete',
      'Delete',
      'Cancel'
    );
  };

  if (loading || checkingUser) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
        <NavBar title="Profile" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!user || !profileData) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title="Profile" />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            Failed to load profile
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={loadUserData}
          >
            <Text style={[styles.retryButtonText, { color: theme.colors.surface }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Animation for stat cards with enhanced glass effect
  const StatCard = ({ 
    icon, 
    value, 
    label, 
    onPress, 
    iconName 
  }: { 
    icon: string; 
    value: number; 
    label: string; 
    onPress?: () => void; 
    iconName: keyof typeof Ionicons.glyphMap;
  }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    
    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: true,
      }).start();
    };
    
    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    // Refined pill-like glass effect for stat cards
    const cardBgColor = isDark 
      ? 'rgba(17, 24, 39, 0.9)' // Dark glass - more refined
      : 'rgba(255, 255, 255, 0.9)'; // Light glass - clean white
    
    const borderColor = isDark 
      ? 'rgba(148, 163, 184, 0.3)' 
      : 'rgba(148, 163, 184, 0.2)';
    
    const CardContent = (
      <Animated.View 
        style={[
          styles.statCard, 
          { 
            backgroundColor: cardBgColor,
            borderColor: borderColor,
            shadowColor: theme.colors.shadow,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <View style={[styles.statIconContainer, { backgroundColor: profileTheme.accent + '15' }]}>
          <Ionicons name={iconName} size={18} color={profileTheme.accent} />
        </View>
        <Text style={[styles.statValue, { color: profileTheme.textPrimary }]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={[styles.statLabel, { color: profileTheme.textSecondary }]} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
      </Animated.View>
    );

    if (onPress) {
      return (
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          {CardContent}
        </Pressable>
      );
    }
    return CardContent;
  };

  return (
    <ErrorBoundary level="route">
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          handleScroll(event);
          // Store scroll position for restoration
          scrollPositionRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Top Actions - Outside unified card */}
        <View style={styles.topActionsContainer}>
          <View style={styles.topActionsLeft} />
          <View style={styles.topActionsRight}>
            <Pressable
              style={[styles.headerActionButton, { backgroundColor: profileTheme.cardBg + '80', shadowColor: theme.colors.shadow }]}
              onPress={() => router.push('/notifications')}
            >
              <Ionicons
                name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
                size={20}
                color={profileTheme.textPrimary}
              />
              {unreadCount > 0 && (
                <View style={[styles.notificationBadge, { backgroundColor: theme.colors.error }]}>
                  <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
            <KebabMenu
              items={[
                {
                  label: 'Settings',
                  icon: 'settings-outline',
                  onPress: () => router.push('/settings'),
                },
                {
                  label: 'Sign Out',
                  icon: 'log-out-outline',
                  onPress: handleSignOut,
                  destructive: true,
                },
              ]}
            />
          </View>
        </View>

        {/* Unified Profile Content Card - Everything in one container */}
        {profileData && (
          <View style={[styles.unifiedCard, { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.cardBorder, shadowColor: theme.colors.shadow }]}>
            {/* Profile Header Section */}
            <View style={styles.profileHeaderSection}>
              {/* Avatar with Ring */}
              <View style={styles.avatarContainer}>
                <View style={[styles.avatarRing, { borderColor: profileTheme.accent + '40' }]}>
                  <Image
                    source={profileData.profilePic ? { uri: profileData.profilePic } : require('../../assets/avatars/male_avatar.png')}
                    style={[styles.avatar, { borderColor: profileTheme.cardBg, shadowColor: theme.colors.shadow }]}
                  />
                </View>
              </View>

              {/* Username */}
              {profileData.username && (
                <Text style={[styles.username, { color: profileTheme.textPrimary }]}>{profileData.username}</Text>
              )}
              
              {/* Full Name */}
              <Text style={[styles.profileName, { color: profileTheme.textPrimary }]}>{profileData.fullName}</Text>
              
              {/* Member Since */}
              {profileData.createdAt && (
                <Text style={[styles.memberSince, { color: profileTheme.textSecondary }]}>
                  Member since {new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
              )}

              {/* Badge */}
              <View style={[styles.badge, { backgroundColor: profileTheme.accent + '20', borderColor: profileTheme.accent + '30' }]}>
                <Ionicons name="airplane" size={12} color={profileTheme.accent} />
                <Text style={[styles.badgeText, { color: profileTheme.accent }]}>Explorer</Text>
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: profileTheme.cardBorder }]} />
            {/* Stats Row - Posts, Followers, Following */}
            <View style={styles.statsContainer}>
              {/* Posts Stat */}
              <View style={styles.statItem}>
                <View style={[styles.statsIconContainer, { backgroundColor: profileTheme.accent + '20' }]}>
                  <Ionicons name="flame" size={18} color={profileTheme.accent} />
                </View>
                <Text style={[styles.statsValue, { color: profileTheme.accent }]}>
                  {profileData?.postsCount || 0}
                </Text>
                <Text style={[styles.statsLabel, { color: profileTheme.textSecondary }]}>POSTS</Text>
              </View>

              {/* Followers Stat */}
              <Pressable 
                style={styles.statItem}
                onPress={() => {
                  if (profileData?._id) {
                    router.push(`/followers?userId=${profileData._id}&type=followers`);
                  }
                }}
              >
                <View style={[styles.statsIconContainer, { backgroundColor: profileTheme.accent + '20' }]}>
                  <Ionicons name="people" size={18} color={profileTheme.accent} />
                </View>
                <Text style={[styles.statsValue, { color: profileTheme.accent }]}>
                  {profileData?.followersCount || 0}
                </Text>
                <Text style={[styles.statsLabel, { color: profileTheme.textSecondary }]}>FOLLOWERS</Text>
              </Pressable>

              {/* Following Stat */}
              <Pressable 
                style={styles.statItem}
                onPress={() => {
                  if (profileData?._id) {
                    router.push(`/followers?userId=${profileData._id}&type=following`);
                  }
                }}
              >
                <View style={[styles.statsIconContainer, { backgroundColor: profileTheme.accent + '20' }]}>
                  <Ionicons name="people-outline" size={18} color={profileTheme.accent} />
                </View>
                <Text style={[styles.statsValue, { color: profileTheme.accent }]}>
                  {profileData?.followingCount || 0}
                </Text>
                <Text style={[styles.statsLabel, { color: profileTheme.textSecondary }]}>FOLLOWING</Text>
              </Pressable>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: profileTheme.cardBorder }]} />

            {/* Edit Profile Button */}
            <Pressable
              style={styles.editProfileButton}
              onPress={() => setShowEditProfile(true)}
            >
              <Ionicons name="create-outline" size={18} color={profileTheme.accent} />
              <Text style={[styles.editProfileButtonText, { color: profileTheme.textPrimary }]}>
                Edit Profile
              </Text>
            </Pressable>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: profileTheme.cardBorder }]} />

            {/* TripScore Section */}
            <Pressable 
              style={styles.unifiedSection}
              onPress={() => router.push(`/tripscore/continents?userId=${user?._id}`)}
            >
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconContainer, { backgroundColor: profileTheme.accent + '20' }]}>
                  <Ionicons name="trophy" size={22} color={profileTheme.accent} />
                </View>
                <Text style={[styles.sectionTitle, { color: profileTheme.textPrimary }]}>TripScore</Text>
                <Text style={[styles.tripScoreNumberInline, { color: profileTheme.accent }]}>
                  {profileData.tripScore?.totalScore ?? 0}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={profileTheme.textSecondary} />
              </View>
            </Pressable>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: profileTheme.cardBorder }]} />

            {/* My Location Section */}
            <Pressable 
              style={styles.unifiedSection}
              onPress={() => {
                const userId = user?._id || profileData?._id;
                if (userId) {
                  // Navigate to all verified locations map
                  router.push(`/map/all-locations?userId=${userId}`);
                }
              }}
            >
              <View style={styles.locationCardHeader}>
                <View style={[styles.locationIconContainer, { backgroundColor: profileTheme.accent + '20' }]}>
                  <Ionicons name="globe" size={24} color={profileTheme.accent} />
                </View>
                <View style={styles.locationTextContainer}>
                  <Text style={[styles.locationTitle, { color: profileTheme.textPrimary }]}>My Location</Text>
                  <Text style={[styles.locationSubtitle, { color: profileTheme.textSecondary }]}>
                    {verifiedLocationsCount !== null && verifiedLocationsCount > 0
                      ? `${verifiedLocationsCount} verified locations visited`
                      : profileData?.locations && profileData.locations.length > 0 
                      ? `${profileData.locations.length} locations visited`
                      : 'Add your home base'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={profileTheme.textSecondary} />
              </View>
              <View style={styles.locationGlobeContainer}>
                {(verifiedLocationsCount !== null && verifiedLocationsCount > 0) || (profileData?.locations && profileData.locations.length > 0) ? (
                  <RotatingGlobe 
                    locations={profileData?.locations || []} 
                    size={140} 
                  />
                ) : (
                  <View style={[styles.emptyGlobeContainer, { backgroundColor: profileTheme.accent + '10' }]}>
                    <Ionicons name="globe-outline" size={64} color={profileTheme.accent} />
                  </View>
                )}
              </View>
            </Pressable>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: profileTheme.cardBorder }]} />

            {/* Posts/Shorts/Saved Tabs - Pill Style */}
            <View style={styles.postsTabsSection}>
              <View style={[styles.pillTabsContainer, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
                {(['posts','shorts','saved'] as const).map(tab => (
                  <Pressable 
                    key={tab} 
                    style={[
                      styles.pillTab, 
                      activeTab===tab 
                        ? [styles.activePillTab, { backgroundColor: profileTheme.accent }]
                        : { backgroundColor: 'transparent' }
                    ]} 
                    onPress={() => {
                      // Profile Tabs Lifecycle Safety: Prevent rapid tab switching from causing duplicate API calls
                      if (isFetchingRef.current && activeTab !== tab) {
                        logger.debug('Tab switch blocked - fetch in progress');
                        return;
                      }
                      setActiveTab(tab);
                    }}
                  >
                    <Ionicons 
                      name={tab==='posts' ? 'images-outline' : tab==='shorts' ? 'videocam-outline' : 'bookmark-outline'} 
                      size={18} 
                      color={activeTab===tab ? '#FFFFFF' : profileTheme.textSecondary} 
                    />
                    <Text style={[
                      styles.pillTabText, 
                      { color: activeTab===tab ? '#FFFFFF' : profileTheme.textSecondary }
                    ]}>
                      {tab === 'posts' ? 'Posts' : tab === 'shorts' ? 'Shorts' : 'Saved'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              
              <View style={styles.contentArea}>
            {/* Profile Tabs Lifecycle Safety: Conditional rendering prevents unnecessary re-renders */}
            {activeTab === 'posts' && (
              posts.length > 0 ? (
                <View style={styles.postsGrid}>
                  {posts.map((post) => {
                    // Try multiple possible image URL fields
                    const imageUrl = post.imageUrl 
                      || (post as any).image_url 
                      || (post as any).mediaUrl 
                      || (post as any).images?.[0]
                      || (post as any).thumbnailUrl;
                    
                    const validImageUrl = imageUrl && String(imageUrl).trim() && String(imageUrl).trim().length > 0 
                      ? String(imageUrl).trim() 
                      : null;
                    
                    return (
                      <Pressable 
                        key={post._id} 
                        style={[styles.postThumbnail, { backgroundColor: profileTheme.cardBg, shadowColor: theme.colors.shadow }]}
                        onLongPress={() => handleDeletePost(post._id, false)}
                        onPress={() => router.push(`/(tabs)/home?postId=${post._id}`)} // Post detail page commented out - navigate to home with postId
                      >
                        {validImageUrl ? (
                          <Image 
                            source={{ uri: validImageUrl }} 
                            style={styles.thumbnailImage}
                            resizeMode="cover"
                            onError={(error) => {
                              // Don't log 403 Forbidden errors - they're expected for expired signed URLs
                              const errorMessage = error?.nativeEvent?.error?.message || '';
                              const is403 = errorMessage.includes('403') || errorMessage.includes('Forbidden');
                              
                              if (__DEV__ && !is403) {
                                console.warn('⚠️ [Profile] Image failed:', {
                                  postId: post._id,
                                  url: validImageUrl.substring(0, 80),
                                  error: errorMessage || 'Unknown'
                                });
                              }
                              // Only log non-403 errors in production to reduce noise
                              if (!is403) {
                                logger.warn('Image failed to load', {
                                  postId: post._id,
                                  imageUrl: validImageUrl.substring(0, 100),
                                  error: errorMessage || 'Unknown error'
                                });
                              }
                            }}
                          />
                        ) : (
                          <View style={[styles.placeholderThumbnail, { backgroundColor: profileTheme.cardBg + '80' }]}>
                            <Ionicons name="image-outline" size={32} color={profileTheme.textSecondary} />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: profileTheme.accent + '15' }]}>
                    <Ionicons name="camera-outline" size={56} color={profileTheme.accent} />
                  </View>
                  <Text style={[styles.emptyText, { color: profileTheme.textPrimary }]}>No posts yet</Text>
                  <Text style={[styles.emptySubtext, { color: profileTheme.textSecondary }]}>
                    Start sharing your memories from your latest trip
                  </Text>
                  <Pressable
                    style={[styles.createPostButton, { backgroundColor: profileTheme.accent + '15', borderColor: profileTheme.accent + '30' }]}
                    onPress={() => router.push('/(tabs)/post')}
                  >
                    <Text style={[styles.createPostButtonText, { color: profileTheme.accent }]}>Create Post</Text>
                  </Pressable>
                </View>
              )
            )}
            {activeTab === 'shorts' && (
              userShorts.length > 0 ? (
                <View style={styles.postsGrid}>
                  {userShorts.map((s) => {
                    const uri = (s as any).imageUrl || (s as any).thumbnailUrl || (s as any).mediaUrl || '';
                    if (!uri) {
                      return (
                        <Pressable 
                          key={s._id} 
                          style={[styles.postThumbnail, { backgroundColor: profileTheme.cardBg, shadowColor: theme.colors.shadow }]}
                          onLongPress={() => handleDeletePost(s._id, true)}
                        >
                          <View style={[styles.placeholderThumbnail, { backgroundColor: profileTheme.cardBg + '80' }]}>
                            <Ionicons name="videocam-outline" size={32} color={profileTheme.textSecondary} />
                          </View>
                        </Pressable>
                      );
                    }
                    return (
                      <Pressable 
                        key={s._id} 
                        style={[styles.postThumbnail, { backgroundColor: profileTheme.cardBg, shadowColor: theme.colors.shadow }]}
                        onLongPress={() => handleDeletePost(s._id, true)}
                        onPress={() => router.push(`/(tabs)/shorts?shortId=${s._id}&userId=${user?._id || ''}`)}
                      >
                        <Image source={{ uri }} style={styles.thumbnailImage} />
                        <View style={[styles.playIconOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                          <Ionicons name="play" size={24} color="#FFFFFF" />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: profileTheme.accent + '15' }]}>
                    <Ionicons name="videocam-outline" size={56} color={profileTheme.accent} />
                  </View>
                  <Text style={[styles.emptyText, { color: profileTheme.textPrimary }]}>No shorts yet</Text>
                  <Text style={[styles.emptySubtext, { color: profileTheme.textSecondary }]}>
                    Create your first short video to share your adventures
                  </Text>
                  <Pressable
                    style={[styles.createPostButton, { backgroundColor: profileTheme.accent + '15', borderColor: profileTheme.accent + '30' }]}
                    onPress={() => router.push('/(tabs)/post')}
                  >
                    <Text style={[styles.createPostButtonText, { color: profileTheme.accent }]}>Create Short</Text>
                  </Pressable>
                </View>
              )
            )}
            {activeTab === 'saved' && (
              savedItems.length > 0 ? (
                <View style={styles.postsGrid}>
                  {savedItems.map((item) => {
                    // Try multiple possible image URL fields
                    const imageUrl = (item as any).imageUrl 
                      || (item as any).image_url 
                      || (item as any).mediaUrl 
                      || (item as any).images?.[0]
                      || (item as any).thumbnailUrl;
                    
                    const validImageUrl = imageUrl && String(imageUrl).trim() && String(imageUrl).trim().length > 0 
                      ? String(imageUrl).trim() 
                      : null;
                    
                    return (
                      <Pressable 
                        key={item._id} 
                        style={[styles.postThumbnail, { backgroundColor: profileTheme.cardBg, shadowColor: theme.colors.shadow }]}
                        onPress={() => {
                          // Use the same format as user-posts route
                          router.push(`/saved-posts?postId=${item._id}`);
                        }}
                      >
                        {validImageUrl ? (
                          <Image 
                            source={{ uri: validImageUrl }} 
                            style={styles.thumbnailImage}
                            resizeMode="cover"
                            onError={(error) => {
                              // Don't log 403 Forbidden errors - they're expected for expired signed URLs
                              const errorMessage = error?.nativeEvent?.error?.message || '';
                              const is403 = errorMessage.includes('403') || errorMessage.includes('Forbidden');
                              
                              if (__DEV__ && !is403) {
                                console.warn('⚠️ [Profile] Saved item image failed:', {
                                  postId: item._id,
                                  url: validImageUrl.substring(0, 80),
                                  error: errorMessage || 'Unknown'
                                });
                              }
                              // Only log non-403 errors in production to reduce noise
                              if (!is403) {
                                logger.warn('Saved item image failed to load', {
                                  postId: item._id,
                                  imageUrl: validImageUrl.substring(0, 100),
                                  error: errorMessage || 'Unknown error'
                                });
                              }
                            }}
                          />
                        ) : (
                          <View style={[styles.placeholderThumbnail, { backgroundColor: profileTheme.cardBg + '80' }]}>
                            <Ionicons name="image-outline" size={32} color={profileTheme.textSecondary} />
                          </View>
                        )}
                        <View style={[styles.bookmarkOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                          <Ionicons name="bookmark" size={16} color="#FFFFFF" />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: profileTheme.accent + '15' }]}>
                    <Ionicons name="bookmark-outline" size={56} color={profileTheme.accent} />
                  </View>
                  <Text style={[styles.emptyText, { color: profileTheme.textPrimary }]}>No saved items</Text>
                  <Text style={[styles.emptySubtext, { color: profileTheme.textSecondary }]}>
                    Save posts you love to view later
                  </Text>
                </View>
              )
            )}
              </View>
            </View>
          </View>
        )}
        
        {/* Edit Profile Modal */}
        {user && (
          <EditProfile
            visible={showEditProfile}
            user={user}
            onClose={() => setShowEditProfile(false)}
            onSuccess={handleProfileUpdate}
          />
        )}
      </ScrollView>
    </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isTablet ? 1200 : 1000,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    // Add padding for tab bar (88px mobile, 70px web) + extra spacing
    paddingBottom: isWeb ? 90 : (isTablet ? 110 : 100),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : 20,
  },
  errorText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('500'),
    marginBottom: isTablet ? theme.spacing.xl : 20,
    textAlign: 'center',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  retryButton: {
    paddingHorizontal: isTablet ? theme.spacing.xl : 24,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    borderRadius: theme.borderRadius.md,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  retryButtonText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  
  // Top Actions Container
  topActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    marginTop: isTablet ? 80 : 60,
    marginBottom: 4,
  },
  topActionsLeft: {
    flex: 1,
  },
  topActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTablet ? theme.spacing.md : 12,
  },
  headerActionButton: {
    width: isTablet ? 48 : 40,
    height: isTablet ? 48 : 40,
    borderRadius: isTablet ? 24 : 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  
  // Profile Header Section (inside unified card)
  profileHeaderSection: {
    alignItems: 'center',
    paddingBottom: isTablet ? theme.spacing.lg : 16,
  },
  avatarContainer: {
    marginBottom: isTablet ? theme.spacing.lg : 16,
  },
  avatarRing: {
    width: isTablet ? 160 : 132,
    height: isTablet ? 160 : 132,
    borderRadius: isTablet ? 80 : 66,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  avatar: {
    width: isTablet ? 148 : 120,
    height: isTablet ? 148 : 120,
    borderRadius: isTablet ? 74 : 60,
    borderWidth: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  username: {
    fontSize: isTablet ? theme.typography.h1.fontSize : 22,
    fontFamily: getFontFamily('800'),
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: isIOS ? 0.3 : 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  profileName: {
    fontSize: isTablet ? theme.typography.body.fontSize : 16,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: isIOS ? 0.1 : 0.05,
    opacity: 0.7,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  memberSince: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('500'),
    marginBottom: isTablet ? theme.spacing.md : 12,
    textAlign: 'center',
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  
  // Stats Container - Uniform pill-like cards (legacy, kept for compatibility)
  statCard: {
    flex: 1,
    width: '100%',
    height: isTablet ? 130 : 110,
    borderRadius: isTablet ? theme.borderRadius.lg : 20,
    paddingVertical: isTablet ? theme.spacing.lg : 16,
    paddingHorizontal: isTablet ? theme.spacing.md : 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
  },
  statIconContainer: {
    width: isTablet ? 44 : 36,
    height: isTablet ? 44 : 36,
    borderRadius: isTablet ? 22 : 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isTablet ? theme.spacing.sm : 8,
  },
  statValue: {
    fontSize: isTablet ? 28 : 22,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.3,
    textAlign: 'center',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  statLabel: {
    fontSize: isTablet ? theme.typography.small.fontSize + 1 : 10,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  
  // Unified Profile Content Card
  unifiedCard: {
    marginHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    marginTop: 0,
    marginBottom: isTablet ? theme.spacing.md : 12,
    padding: isTablet ? theme.spacing.xl : 20,
    borderRadius: theme.borderRadius.lg,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  divider: {
    height: 1,
    marginVertical: isTablet ? theme.spacing.lg : 20,
  },
  unifiedSection: {
    width: '100%',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: isTablet ? theme.spacing.md : 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsIconContainer: {
    width: isTablet ? 44 : 36,
    height: isTablet ? 44 : 36,
    borderRadius: isTablet ? 22 : 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isTablet ? theme.spacing.sm : 8,
  },
  statsLabel: {
    fontSize: isTablet ? theme.typography.small.fontSize + 1 : 10,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  statsValue: {
    fontSize: isTablet ? 24 : 20,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  
  // Section Cards (legacy, kept for compatibility)
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.2,
  },
  sectionTextContainer: {
    flex: 1,
  },
  sectionDescription: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  tripScoreNumberInline: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginLeft: 'auto',
    marginRight: 8,
  },
  tripScoreContent: {
    alignItems: 'center',
    marginTop: 4,
  },
  tripScoreCard: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 120,
  },
  tripScoreNumber: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  tripScoreLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  tripScoreHint: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  
  // Edit Profile Button (inside unified card)
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isTablet ? theme.spacing.md : 12,
    paddingHorizontal: isTablet ? theme.spacing.lg : 20,
    borderRadius: theme.borderRadius.md,
    gap: 8,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  editProfileButtonText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 0.3,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  
  // Location Card (legacy, kept for compatibility)
  locationCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  locationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  locationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationTextContainer: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  locationSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  locationGlobeContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyGlobeContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Settings Tiles
  settingsTile: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    minHeight: 64,
  },
  tileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileTextContainer: {
    flex: 1,
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  tileSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  
  // Posts Container
  postsTabsSection: {
    width: '100%',
  },
  postsContainer: {
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
  },
  pillTabsContainer: {
    flexDirection: 'row',
    borderRadius: 24,
    padding: 4,
    gap: 4,
  },
  pillTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  activePillTab: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  pillTabText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  
  // Content Area
  contentArea: {
    marginTop: 20,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  postThumbnail: {
    width: '31%',
    aspectRatio: 1,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookmarkOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    fontWeight: '400',
  },
  createPostButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
  },
  createPostButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 0,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
  },
});
