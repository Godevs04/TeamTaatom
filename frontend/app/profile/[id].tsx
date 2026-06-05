import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, ScrollView, Dimensions, Pressable, Animated, useColorScheme, Platform, Alert, Image } from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { toggleFollow, getTravelMapData, toggleBlockUser, getBlockStatus, requestRouteAccess } from '../../services/profile';
import AlertService from '../../services/alertService';
import { createReport } from '../../services/report';
import ReportReasonModal, { ReportReasonType } from '../../components/ReportReasonModal';
import WorldMap from '../../components/WorldMap';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import CustomAlert from '../../components/CustomAlert';
import BioDisplay from '../../components/BioDisplay';
import RotatingGlobe from '../../components/RotatingGlobe';
import Constants from 'expo-constants';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import {
  CloudSkyBackground,
  CloudMetricRow,
  CloudTripScoreHero,
  CloudActionGroup,
  CloudListRow,
  CloudGlassSurface,
} from '../../components/cloud';
import PremiumGlassCard from '../../components/ui/PremiumGlassCard';
import logger from '../../utils/logger';
import { getUserShorts } from '../../services/posts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FastImage from '../../components/ui/FastImage';
import { FILTER_PREVIEW_OVERLAY, ImageFilterType } from '../../components/ImageEditModal';
import ShortsCard from '../../components/shorts/ShortsCard';
import { formatViewCount } from '../../utils/numberFormat';


const { width } = Dimensions.get('window');
// Calculate column width taking into account card margins (0 each side), card content padding (0 each side), and grid gaps (2 between items)
const columnWidth = Math.floor((width - 4) / 3);

const TRIP_GAP_DAYS = 7;

const sortByCreatedDesc = <T extends { createdAt?: string; created_at?: string; _id?: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
    const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return String(b._id || '').localeCompare(String(a._id || ''));
  });

function countTripsFromLocations(locations: Array<{ date?: string }>): number {
  if (!locations?.length) return 0;
  const sorted = [...locations].filter((l) => l.date).sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  if (sorted.length === 0) return 0;
  let trips = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date!).getTime();
    const curr = new Date(sorted[i].date!).getTime();
    if ((curr - prev) / (24 * 60 * 60 * 1000) > TRIP_GAP_DAYS) trips += 1;
  }
  return trips;
}

// Follow state enum
type FollowState = 'FOLLOWING' | 'REQUESTED' | 'FOLLOW' | null;

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const { theme, mode } = useTheme();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const hasProfileRef = useRef(false);
  const updateProfileState = useCallback((val: any) => {
    if (typeof val === 'function') {
      setProfile((prev: any) => {
        const next = val(prev);
        hasProfileRef.current = !!next;
        return next;
      });
    } else {
      hasProfileRef.current = !!val;
      setProfile(val);
    }
  }, []);
  const [enlargedPhotoSource, setEnlargedPhotoSource] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWorldMap, setShowWorldMap] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followRequestSent, setFollowRequestSent] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userShorts, setUserShorts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'shorts'>('posts');
  const [loadingShorts, setLoadingShorts] = useState(false);

  const [verifiedLocationsCount, setVerifiedLocationsCount] = useState<number | null>(null);
  const [verifiedLocations, setVerifiedLocations] = useState<Array<{ latitude: number; longitude: number; address: string; date?: string }>>([]);
  // Ref to track if we're in the middle of a follow/unfollow action
  const isFollowActionInProgress = useRef(false);
  // Ref to store the last API response for follow state - this is the source of truth
  const lastFollowApiResponse = useRef<{ isFollowing: boolean; followRequestSent: boolean } | null>(null);

  // Derived followState to prevent out-of-sync bugs and blank renders on unfollow
  const followState = useMemo(() => {
    if (loading || !profile) return null;
    if (isFollowing) return 'FOLLOWING';
    if (followRequestSent) return 'REQUESTED';
    return 'FOLLOW';
  }, [isFollowing, followRequestSent, loading, profile]);

  // Centralized helper function to apply follow state from API response
  const applyFollowState = useCallback((response: {
    isFollowing: boolean;
    followRequestSent: boolean;
    followersCount?: number;
    followingCount?: number;
  }) => {
    const apiIsFollowing = Boolean(response.isFollowing);
    const apiFollowRequestSent = Boolean(response.followRequestSent);

    // Store API response in ref - this is the definitive source of truth
    lastFollowApiResponse.current = {
      isFollowing: apiIsFollowing,
      followRequestSent: apiFollowRequestSent
    };

    // Update boolean flags from API response (source of truth)
    setIsFollowing(apiIsFollowing);
    setFollowRequestSent(apiFollowRequestSent);

    // Update followers count in profile if provided
    // Note: Only update followersCount (target user's follower count)
    // Do NOT update followingCount - the API returns the current user's following count,
    // but the profile displays the target user's following count (who the target user follows)
    if (response.followersCount !== undefined) {
      updateProfileState((prevProfile: any) => {
        if (!prevProfile) return prevProfile;
        const updated: any = { ...prevProfile };
        if (typeof response.followersCount === 'number') {
          updated.followersCount = response.followersCount;
        }
        return updated;
      });
    }
  }, []);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
  });

  // Theme-aware colors for profile - MUST be called before any conditional returns
  const colorScheme = useColorScheme();
  // Improved dark mode detection - use theme mode if available, otherwise check background color
  const isDark =
    mode === 'dark' ||
    (mode === 'auto' && colorScheme === 'dark') ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#000000' ||
    theme.colors.background === '#111114';
  
  const profileTheme = useMemo(() => {
    if (isDark) {
      return {
        headerGradient: ['#000000', '#000000', '#000000'] as const,
        cardBg: '#121212',
        cardBorder: 'rgba(255, 255, 255, 0.1)',
        textPrimary: '#F9FAFB',
        textSecondary: '#9CA3AF',
        accent: '#60A5FA',
        statCardBg: 'rgba(96, 165, 250, 0.1)',
        statCardBorder: 'rgba(96, 165, 250, 0.2)',
        gapBorderColor: '#000000',
      };
    } else {
      return {
        headerGradient: ['#F5F7FA', '#F5F7FA'] as const,
        cardBg: '#FFFFFF',
        cardBorder: 'rgba(255, 255, 255, 0.90)',
        textPrimary: '#000000',
        textSecondary: '#667085',
        accent: '#000000',
        statCardBg: 'rgba(255, 255, 255, 0.55)',
        statCardBorder: 'rgba(255, 255, 255, 0.90)',
        gapBorderColor: '#F5F7FA',
      };
    }
  }, [isDark]);

  // Animation for stat cards with enhanced glass effect
  const StatCard = ({ 
    iconName,
    value, 
    label, 
    onPress 
  }: { 
    iconName: keyof typeof Ionicons.glyphMap;
    value: number | string; 
    label: string; 
    onPress?: () => void;
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
  // Remove selectedPost and modal logic

  // Use expoConfig for SDK 49+, fallback to manifest for older
  // PRODUCTION-GRADE: No hardcoded fallback - must come from environment variable
  const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY || 
                               (Constants.manifest as any)?.extra?.GOOGLE_MAPS_API_KEY || 
                               process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 
                               '';
  
  // Debug logging
  logger.debug('Profile - API Key check:', {
    expoConfig: Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY,
    manifest: (Constants.manifest as any)?.extra?.GOOGLE_MAPS_API_KEY,
    final: GOOGLE_MAPS_API_KEY
  });
  const showAlert = (message: string, title?: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setAlertConfig({ title: title || '', message, type });
    setAlertVisible(true);
  };

  const showError = (message: string, title?: string) => {
    showAlert(message, title || 'Error', 'error');
  };

  const showSuccess = (message: string, title?: string) => {
    showAlert(message, title || 'Success', 'success');
  };

  const showWarning = (message: string, title?: string) => {
    showAlert(message, title || 'Warning', 'warning');
  };

  const fetchProfile = useCallback(async () => {
    const startTime = Date.now();
    if (!hasProfileRef.current) {
      setLoading(true);
    }
    try {
      // Add cache-busting parameter if we have a stored follow response
      // This ensures we get fresh data instead of cached stale data (304 responses)
      const cacheBuster = lastFollowApiResponse.current ? `?t=${Date.now()}` : '';
      
      // OPTIMIZATION: Try to load cached profile first for instant display (optimistic)
      try {
        const cachedProfile = await AsyncStorage.getItem(`cachedUserProfile_${id}`).catch(() => null);
        if (cachedProfile) {
          const parsed = JSON.parse(cachedProfile);
          const cacheAge = Date.now() - (parsed.timestamp || 0);
          if (cacheAge < 5 * 60 * 1000 && parsed.data) { // 5 min cache
            updateProfileState(parsed.data);
            // Pre-set follow state from cache to avoid flicker
            const cachedIsFollowing = Boolean(parsed.data.isFollowing);
            const cachedFollowRequestSent = Boolean(parsed.data.followRequestSent);
            setIsFollowing(cachedIsFollowing);
            setFollowRequestSent(cachedFollowRequestSent);
            setLoading(false); // Show cached data immediately
          }
        }
      } catch (cacheError) {
        logger.debug('Cache load error (non-critical):', cacheError);
      }
      
      // OPTIMIZATION: Fetch profile, posts, and shorts in parallel if canViewPosts is true
      // First get profile to check canViewPosts
      const res = await api.get(`/api/v1/profile/${id}${cacheBuster}`);
      let userProfile = res.data.profile;
      
      // Cache profile for next time
      AsyncStorage.setItem(`cachedUserProfile_${id}`, JSON.stringify({
        data: userProfile,
        timestamp: Date.now()
      })).catch(() => {});
      
      updateProfileState(userProfile);
      
      // Fetch verified locations count only if viewer is allowed to see locations
      if (userProfile.canViewLocations) getTravelMapData(id as string)
        .then((res) => {
          const locs = Array.isArray(res?.locations) ? res.locations : [];
          const total = res?.statistics?.totalLocations ?? locs.length;
          setVerifiedLocationsCount(total);
          setVerifiedLocations(locs.map((l: unknown) => {
            const item = l as { latitude: number; longitude: number; address?: string; date?: string };
            return { latitude: item.latitude, longitude: item.longitude, address: item.address ?? '', date: item.date };
          }));
        })
        .catch((err) => {
          logger.debug('Error fetching verified locations (non-critical):', err);
          // Don't set error state, just log it - this is optional data
        });
      
      // OPTIMIZATION: Fetch posts and shorts in parallel if user can view posts
      if (userProfile.canViewPosts) {
        setLoadingShorts(true);
        
        // Fetch posts with pagination and shorts in parallel
        const [postsResult, shortsResult] = await Promise.allSettled([
          // Fetch all posts with pagination
          (async () => {
            let allPosts: any[] = [];
            let page = 1;
            let hasMore = true;
            const limit = 100;
            
            while (hasMore) {
              try {
                const postsRes = await api.get(`/api/v1/posts/user/${id}?page=${page}&limit=${limit}`);
                const posts = postsRes.data.posts || [];
                allPosts = [...allPosts, ...posts];
                hasMore = posts.length === limit;
                page++;
              } catch (err) {
                logger.error('Error fetching posts page:', err);
                hasMore = false;
              }
            }
            return allPosts;
          })(),
          // Fetch shorts in parallel
          getUserShorts(id as string, 1, 100)
        ]);
        
        // Handle posts result
        if (postsResult.status === 'fulfilled') {
          userProfile.posts = sortByCreatedDesc(postsResult.value);
        } else {
          userProfile.posts = [];
        }
        
        // Handle shorts result
        if (shortsResult.status === 'fulfilled') {
          const fetchedShorts = sortByCreatedDesc(shortsResult.value.shorts || []);
          setUserShorts(fetchedShorts);
          
          // Log for debugging
          if (__DEV__ && fetchedShorts.length > 0) {
            logger.debug('Fetched shorts for other user profile:', {
              count: fetchedShorts.length,
              firstShort: {
                _id: fetchedShorts[0]._id,
                imageUrl: (fetchedShorts[0] as any).imageUrl?.substring(0, 50),
                thumbnailUrl: (fetchedShorts[0] as any).thumbnailUrl?.substring(0, 50),
                mediaUrl: (fetchedShorts[0] as any).mediaUrl?.substring(0, 50),
              }
            });
          }
        } else {
          logger.error('Error fetching shorts:', shortsResult.reason);
          setUserShorts([]);
        }
        
        setLoadingShorts(false);
        updateProfileState(userProfile); // Update profile with posts (includes fetched posts)
      } else {
        // User cannot view posts, set empty arrays
        userProfile.posts = [];
        setUserShorts([]);
        updateProfileState(userProfile);
      }
      
      // CRITICAL: If we have a stored API response from a follow action, ALWAYS use it
      // This prevents cached/stale profile data (including 304 responses) from overriding the correct follow state
      // The stored response is the definitive source of truth after a follow/unfollow action
      if (lastFollowApiResponse.current) {
        // We have a stored response from a follow action - this takes priority over profile fetch
        // DO NOT override with cached profile data
        const storedIsFollowing = lastFollowApiResponse.current.isFollowing;
        const storedFollowRequestSent = lastFollowApiResponse.current.followRequestSent;
        setIsFollowing(storedIsFollowing);
        setFollowRequestSent(storedFollowRequestSent);
        // Don't clear the ref here - let it expire naturally after the timeout
      } else if (!isFollowActionInProgress.current) {
        // No stored response and not in the middle of an action - use fresh API response
        // CRITICAL: Use isFollowing directly from API response - backend calculates this correctly
        const apiIsFollowing = Boolean(userProfile.isFollowing);
        const apiFollowRequestSent = Boolean(userProfile.followRequestSent);
        setIsFollowing(apiIsFollowing);
        setFollowRequestSent(apiFollowRequestSent);
      }
      // If in the middle of an action but no stored response yet, preserve current state
      
      const loadTime = Date.now() - startTime;
      logger.debug(`[PERF] User profile loaded in ${loadTime}ms (optimized parallel fetch with cache)`);
    } catch (e: any) {
      logger.error('Error fetching profile:', e);
      const msg = e?.response?.data?.message || e?.message || '';
      if (e?.response?.status === 403 || msg?.toLowerCase().includes('cannot view')) {
        showError('You cannot view this profile');
        router.back();
      } else {
        showError('Failed to load user profile');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    updateProfileState(null);
    setLoading(true);
    setIsFollowing(false);
    setFollowRequestSent(false);
    setShowWorldMap(false);
    setVerifiedLocationsCount(null);
    setVerifiedLocations([]);
    setShowProfileMenu(false);
    // Clear the stored API response when profile ID changes
    lastFollowApiResponse.current = null;
    // Fetch profile when ID changes
    if (id) {
      fetchProfile();
    }
  }, [id, fetchProfile]);

  // Fetch block status when viewing another user's profile
  useEffect(() => {
    if (currentUser && profile && currentUser._id !== profile._id) {
      getBlockStatus(profile._id).then((r) => setIsBlocked(r.isBlocked)).catch(() => {});
    } else {
      setIsBlocked(false);
    }
  }, [currentUser?._id, profile?._id]);

  useEffect(() => {
    (async () => {
      try {
        const userData = await api.get('/api/v1/auth/me');
        setCurrentUser(userData.data.user);
      } catch (error) {
        logger.error('Error fetching current user:', error);
        // Don't block profile loading if current user fetch fails
        // Profile can still be loaded without current user
      }
    })();
  }, []);

  const isOwnProfile = Boolean(currentUser && id && currentUser._id === id);
  const tripsCount = useMemo(() => countTripsFromLocations(verifiedLocations), [verifiedLocations]);
  const countriesCount = profile?.tripScore?.countries ? Object.keys(profile.tripScore.countries).length : 0;
  const globeLocations = useMemo(() => {
    if (verifiedLocations.length > 0) return verifiedLocations.map((l) => ({ latitude: l.latitude, longitude: l.longitude, address: l.address }));
    if (profile?.canViewLocations && profile?.locations?.length) return profile.locations;
    return [];
  }, [verifiedLocations, profile?.canViewLocations, profile?.locations]);

  useFocusEffect(
    useCallback(() => {
      // Only clear stored API response if we're not in the middle of a follow action
      // This prevents clearing the correct state right after a follow/unfollow
      if (!isFollowActionInProgress.current) {
        lastFollowApiResponse.current = null;
      }
      isFollowActionInProgress.current = false;
      // Always fetch profile, don't wait for currentUser
      // The profile fetch doesn't require currentUser to work
      fetchProfile();
    }, [fetchProfile])
  );

  const handleFollow = async () => {
    // ✅ ALL GUARDS FIRST — NO STATE CHANGES ABOVE THIS
    if (!profile?._id) return;
    if (isFollowActionInProgress.current === true) return;

    // ✅ ENTER CRITICAL SECTION (after all guards pass)
    isFollowActionInProgress.current = true;
    setFollowLoading(true);

    // Save previous state for rollback on error
    const prevIsFollowing = isFollowing;
    const prevFollowRequestSent = followRequestSent;
    const prevFollowersCount = profile?.followersCount ?? 0;

    // ✅ OPTIMISTIC UPDATE: Change UI immediately before API call
    // Toggle: if currently following OR follow request sent → unfollow/cancel request
    if (prevIsFollowing || prevFollowRequestSent) {
      // Optimistic unfollow / cancel request
      setIsFollowing(false);
      setFollowRequestSent(false);
      if (prevIsFollowing) {
        updateProfileState((prev: any) => prev ? { ...prev, followersCount: Math.max(0, (prev.followersCount || 0) - 1) } : prev);
      }
    } else {
      // Optimistic follow based on visibility
      const isPrivate = profile.profileVisibility === 'private';
      if (isPrivate) {
        setIsFollowing(false);
        setFollowRequestSent(true);
        // Do NOT increment followersCount optimistically since it is only a pending request
      } else {
        setIsFollowing(true);
        setFollowRequestSent(false);
        updateProfileState((prev: any) => prev ? { ...prev, followersCount: (prev.followersCount || 0) + 1 } : prev);
      }
    }
    setFollowLoading(false); // Hide spinner immediately — optimistic update is shown

    try {
      // ✅ EVERYTHING ASYNC MUST BE INSIDE TRY
      // Use the service function for consistency
      const response = await toggleFollow(profile._id);

      // Apply follow state from API response (source of truth)
      // This confirms or corrects the optimistic update
      applyFollowState({
        isFollowing: Boolean(response.isFollowing),
        followRequestSent: Boolean(response.followRequestSent ?? false),
        followersCount: response.followersCount,
        followingCount: response.followingCount
      });

      // CRITICAL: Keep the ref for a longer period to prevent cached profile fetches from overriding
      // Cached responses (304) can return stale isFollowing state, so we need to protect against that
      setTimeout(() => {
        lastFollowApiResponse.current = null;
      }, 5000); // 5 seconds to prevent cache override

    } catch (e: any) {
      // ❌ ROLLBACK optimistic update on error
      lastFollowApiResponse.current = null;
      setIsFollowing(prevIsFollowing);
      setFollowRequestSent(prevFollowRequestSent);
      updateProfileState((prev: any) => prev ? { ...prev, followersCount: prevFollowersCount } : prev);

      // Don't log conflict errors (follow request already pending) as they are expected
      if (!e.isConflict && e.response?.status !== 409) {
        logger.error('Error following/unfollowing user:', e);
      }

      const errorMessage = e.response?.data?.message || e.message || 'Failed to update follow status';

      // Check if it's a follow request already pending message or conflict error
      if (e?.isConflict || e?.response?.status === 409 || errorMessage.includes('Follow request already pending') || errorMessage.includes('Request already sent')) {
        // For conflict errors, set followRequestSent to true
        applyFollowState({
          isFollowing: false,
          followRequestSent: true
        });
        showWarning('Follow Request Pending', errorMessage);
      } else {
        showError(errorMessage || 'Something went wrong');
      }
    } finally {
      // ✅ ALWAYS EXECUTES - ensures cleanup happens even if errors occur
      isFollowActionInProgress.current = false;
      setFollowLoading(false);
    }
  };

  const [routeAccessLoading, setRouteAccessLoading] = useState(false);

  const handleRequestRouteAccess = async () => {
    if (!profile?._id) return;
    try {
      setRouteAccessLoading(true);
      const res = await requestRouteAccess(profile._id);
      
      updateProfileState((prev: any) => prev ? {
        ...prev,
        routeAccessStatus: res.status
      } : prev);
      
      if (res.status === 'approved') {
        AlertService.showSuccess('Access Granted', 'You have been granted access to view journey routes.');
      } else {
        AlertService.showSuccess('Request Sent', 'Your request to view journey routes has been sent.');
      }
    } catch (err: any) {
      showError(err.message || 'Failed to request route access');
    } finally {
      setRouteAccessLoading(false);
    }
  };

  if (loading || !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <LoadingGlobe size={36} />
      </SafeAreaView>
    );
  }

  const locationCount =
    currentUser && (currentUser._id === profile._id || isFollowing) && Array.isArray(profile.locations)
      ? profile.locations.length
      : '-';

  const postsCount = profile?.postsCount !== undefined 
    ? profile.postsCount 
    : (Array.isArray(profile?.posts) ? profile.posts.length : 0);

  const followersCount = profile?.followersCount !== undefined 
    ? profile.followersCount 
    : (Array.isArray(profile?.followers) ? profile.followers.length : 0);

  const followingCount = profile?.followingCount !== undefined 
    ? profile.followingCount 
    : (Array.isArray(profile?.following) ? profile.following.length : 0);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F5F7FA' }]}>
      <CloudSkyBackground heightRatio={0.42} />
      <ExpoLinearGradient
        colors={isDark ? ['transparent', '#000000', '#000000'] : ['transparent', '#F5F7FA', '#F5F7FA']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        locations={[0, 0.35, 1]}
        pointerEvents="none"
      />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Modern Hero Header */}
        <ExpoLinearGradient
          colors={profileTheme.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.heroHeader}
        >
          <View style={styles.heroHeaderContent}>
            {/* Top Actions with Back Button */}
            <View style={styles.topActions}>
              <Pressable
                onPress={() => router.back()}
                style={[styles.backButton, { backgroundColor: profileTheme.cardBg + '80' }]}
              >
                <Ionicons name="arrow-back" size={20} color={profileTheme.textPrimary} />
              </Pressable>
              <View style={styles.topActionsRight}>
                {currentUser && currentUser._id !== profile._id && (
                  <>
                    <Pressable
                      onPress={() => setShowReportModal(true)}
                      style={[styles.backButton, { backgroundColor: profileTheme.cardBg + '80' }]}
                    >
                      <Ionicons name="flag-outline" size={20} color={profileTheme.textPrimary} />
                    </Pressable>
                    <Pressable
                      onPress={() => setShowProfileMenu(true)}
                      style={[styles.backButton, { backgroundColor: profileTheme.cardBg + '80' }]}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color={profileTheme.textPrimary} />
                    </Pressable>
                  </>
                )}
              </View>
            </View>

            {/* Profile Card */}
            <PremiumGlassCard
              style={styles.profileCard}
              contentStyle={styles.profileCardInner}
              strong={false}
              subtle={false}
              blur={true}
            >
              {/* Top Row (Avatar & Telemetry Stats) */}
              <View style={styles.topRow}>
                <Pressable
                  onLongPress={() => {
                    const avatarSource = profile.profilePic
                      ? { uri: profile.profilePic }
                      : require('../../assets/avatars/male_avatar.png');
                    setEnlargedPhotoSource(avatarSource);
                  }}
                  onPressOut={() => setEnlargedPhotoSource(null)}
                  delayLongPress={200}
                  style={styles.avatarGradientWrapper}
                >
                  <ExpoLinearGradient
                    colors={['#1C73B4', '#50C878']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: 37, padding: 2, alignItems: 'center', justifyContent: 'center' }]}
                  >
                    <View style={[
                      styles.avatarContainer,
                      {
                        backgroundColor: isDark ? '#080F19' : '#F0F5FA',
                      }
                    ]}>
                      <FastImage
                        source={profile.profilePic ? { uri: profile.profilePic } : require('../../assets/avatars/male_avatar.png')}
                        style={styles.avatarImage}
                        contentFit="cover"
                      />
                    </View>
                  </ExpoLinearGradient>
                </Pressable>

                {/* Right Column (Telemetry Stats) */}
                <View style={styles.statsContainer}>
                  {/* Stat Block 1 */}
                  <View style={styles.statBlock}>
                    <Text style={[styles.cardStatValue, { color: profileTheme.textPrimary }]}>{postsCount}</Text>
                    <Text style={[styles.cardStatLabel, { color: profileTheme.textSecondary }]}>Posts</Text>
                  </View>

                  {/* Separator */}
                  <View style={styles.separator} />

                  {/* Stat Block 2 */}
                  <Pressable 
                    style={styles.statBlock} 
                    onPress={() => router.push({ pathname: '/followers', params: { userId: profile._id, type: 'followers' } })}
                  >
                    <Text style={[styles.cardStatValue, { color: profileTheme.textPrimary }]}>{followersCount}</Text>
                    <Text style={[styles.cardStatLabel, { color: profileTheme.textSecondary }]}>Followers</Text>
                  </Pressable>

                  {/* Separator */}
                  <View style={styles.separator} />

                  {/* Stat Block 3 */}
                  <Pressable 
                    style={styles.statBlock} 
                    onPress={() => router.push({ pathname: '/followers', params: { userId: profile._id, type: 'following' } })}
                  >
                    <Text style={[styles.cardStatValue, { color: profileTheme.textPrimary }]}>{followingCount}</Text>
                    <Text style={[styles.cardStatLabel, { color: profileTheme.textSecondary }]}>Following</Text>
                  </Pressable>
                </View>
              </View>

              {/* Identity & Typography Block */}
              <View style={styles.identityBlock}>
                {isDark ? (
                  <>
                    {profile.username ? (
                      <Text style={[styles.username, { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginTop: 0 }]}>
                        @{profile.username}
                      </Text>
                    ) : null}
                    <Text style={[styles.profileName, { color: '#38BDF8', fontSize: 15, fontWeight: '700', marginTop: 2 }]}>
                      {profile.fullName}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.profileName, { color: '#1C73B4', fontSize: 15, fontWeight: '700', marginTop: 0 }]}>
                      {profile.fullName}
                    </Text>
                    {profile.username ? (
                      <Text style={[styles.username, { color: profileTheme.textSecondary, fontSize: 15, fontWeight: '600', marginTop: 2 }]}>
                        @{profile.username}
                      </Text>
                    ) : null}
                  </>
                )}
                {profile.bio ? (
                  <View style={styles.bioContainer}>
                    <BioDisplay bio={profile.bio || ''} fontSize={15} leftAlign={true} />
                  </View>
                ) : null}
              </View>

              {/* Action Buttons — hidden until follow state is resolved to avoid flicker */}
              {currentUser && currentUser._id !== profile._id && followState !== null && (
                <View style={styles.actionButtonsContainer}>
                  <Pressable
                    style={[
                      styles.actionButton,
                      followState === 'FOLLOWING'
                        ? [styles.followingButton, { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.accent }]
                        : [styles.followButton, { overflow: 'hidden' }]
                    ]}
                    onPress={handleFollow}
                    disabled={followLoading}
                  >
                    {followState !== 'FOLLOWING' && (
                      <ExpoLinearGradient
                        colors={['#1C73B4', '#50C878']}
                        style={StyleSheet.absoluteFillObject}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      />
                    )}
                    {followLoading ? (
                      <LoadingGlobe size="small" color={followState === 'FOLLOWING' ? profileTheme.accent : '#FFFFFF'} />
                    ) : (
                      <Text style={[
                        styles.actionButtonText,
                        { color: followState === 'FOLLOWING' ? profileTheme.accent : '#FFFFFF', zIndex: 1 }
                      ]}>
                        {followState === 'FOLLOWING' ? 'Following' : followState === 'REQUESTED' ? 'Request Sent' : 'Follow'}
                      </Text>
                    )}
                  </Pressable>
                  
                  {followState === 'FOLLOWING' && (
                    <Pressable
                      style={[styles.actionButton, styles.messageButton, { overflow: 'hidden' }]}
                      onPress={() => router.push(`/chat?userId=${profile._id}`)}
                    >
                      <ExpoLinearGradient
                        colors={['#50C878', '#1C73B4']}
                        style={StyleSheet.absoluteFillObject}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      />
                      <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" style={{ marginRight: 6, zIndex: 1 }} />
                      <Text style={[styles.actionButtonText, { color: '#FFFFFF', zIndex: 1 }]}>Message</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Trip Score Telemetry Strip (Bottom Anchor) */}
              {profile.tripScore && profile.canViewLocations ? (
                <Pressable 
                  style={styles.tripScoreStrip}
                  onPress={() => router.push(`/tripscore/continents?userId=${id}`)}
                >
                  <Text style={[styles.cardTripScoreLabel, { color: profileTheme.textSecondary }]}>
                    TRIP SCORE
                  </Text>
                  <Text style={[styles.cardTripScoreValue, { color: profileTheme.textPrimary }]}>
                    {profile.tripScore.totalScore || 0}
                  </Text>
                </Pressable>
              ) : null}
            </PremiumGlassCard>
          </View>
        </ExpoLinearGradient>

        {(profile.canViewPosts || isOwnProfile) ? (
          <CloudActionGroup style={{ marginBottom: 12 }}>
            {(() => {
              const routeVisibility = profile.routeVisibility || 'everyone';
              
              if (isOwnProfile) {
                return (
                  <CloudListRow
                    icon="map-outline"
                    title="Journeys"
                    subtitle="View completed journeys and history"
                    onPress={() => router.push(`/journeys?userId=${id}&userName=${encodeURIComponent(profile?.fullName || profile?.username || '')}`)}
                    showDivider={false}
                    iconTint={profileTheme.accent}
                  />
                );
              }

              if (routeVisibility === 'private') {
                return null;
              }

              if (routeVisibility === 'approved_only') {
                const status = profile.routeAccessStatus || 'none';
                if (status === 'approved') {
                  return (
                    <CloudListRow
                      icon="map-outline"
                      title="Journeys"
                      subtitle="View completed journeys and history"
                      onPress={() => router.push(`/journeys?userId=${id}&userName=${encodeURIComponent(profile?.fullName || profile?.username || '')}`)}
                      showDivider={false}
                      iconTint={profileTheme.accent}
                    />
                  );
                } else if (status === 'pending') {
                  return (
                    <CloudListRow
                      icon="git-pull-request-outline"
                      title="Journey Access Pending"
                      subtitle="Your request to view journeys is pending approval"
                      onPress={() => AlertService.showInfo('Request Pending', 'Your request to view journey routes is pending approval.')}
                      showDivider={false}
                      iconTint="#EAB308"
                    />
                  );
                } else {
                  return (
                    <CloudListRow
                      icon={routeAccessLoading ? 'sync-outline' : 'lock-closed-outline'}
                      title="Request Journey Access"
                      subtitle="Request permission to view journey routes"
                      onPress={handleRequestRouteAccess}
                      showDivider={false}
                      iconTint={profileTheme.accent}
                    />
                  );
                }
              }

              // Default routeVisibility === 'everyone'
              if (profile.canViewPosts) {
                return (
                  <CloudListRow
                    icon="map-outline"
                    title="Journeys"
                    subtitle="View completed journeys and history"
                    onPress={() => router.push(`/journeys?userId=${id}&userName=${encodeURIComponent(profile?.fullName || profile?.username || '')}`)}
                    showDivider={false}
                    iconTint={profileTheme.accent}
                  />
                );
              }

              return null;
            })()}
            {isOwnProfile && (
              <CloudListRow
                icon="globe-outline"
                title="My Location"
                subtitle={
                  verifiedLocationsCount !== null && verifiedLocationsCount > 0
                    ? `${verifiedLocationsCount} verified location${verifiedLocationsCount !== 1 ? 's' : ''} · ${tripsCount} trip${tripsCount !== 1 ? 's' : ''}`
                    : verifiedLocationsCount === null && profile.canViewLocations
                      ? 'Loading journeys summary…'
                      : 'No verified journeys summary yet'
                }
                onPress={() => {
                  const name = profile?.fullName || profile?.username || 'User';
                  router.push(`/map/all-locations?userId=${id}&userName=${encodeURIComponent(name)}`);
                }}
                showDivider={profile.canViewPosts}
                iconTint={profileTheme.accent}
              />
            )}
          </CloudActionGroup>
        ) : null}

        {(profile.canViewPosts || isOwnProfile) ? (
          <View style={{ marginHorizontal: 16, marginBottom: 12, alignItems: 'center', paddingVertical: 16 }}>
            <RotatingGlobe
              locations={globeLocations}
              size={140}
              onPress={() => {
                const name = profile?.fullName || profile?.username || 'User';
                router.push(`/map/all-locations?userId=${id}&userName=${encodeURIComponent(name)}`);
              }}
            />
          </View>
        ) : null}

        {/* Posts/Shorts Section */}
        {profile.canViewPosts && (
          <CloudGlassSurface
            style={styles.postsContainer}
            contentStyle={styles.postsContainerInner}
            blur={false}
            borderRadius={20}
          >
            {/* Tabs */}
            <View style={styles.postsTabsSection}>
              <Pressable
                style={[
                  styles.pillTab,
                  activeTab === 'posts' && styles.pillTabActive
                ]}
                onPress={() => setActiveTab('posts')}
              >
                {activeTab === 'posts' && (
                  <ExpoLinearGradient
                    colors={['#1C73B4', '#50C878']}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                )}
                <Text style={[
                  styles.pillTabText,
                  { color: activeTab === 'posts' ? '#FFFFFF' : profileTheme.textSecondary, zIndex: 1 }
                ]}>
                  Posts
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.pillTab,
                  activeTab === 'shorts' && styles.pillTabActive
                ]}
                onPress={() => setActiveTab('shorts')}
              >
                {activeTab === 'shorts' && (
                  <ExpoLinearGradient
                    colors={['#1C73B4', '#50C878']}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                )}
                <Text style={[
                  styles.pillTabText,
                  { color: activeTab === 'shorts' ? '#FFFFFF' : profileTheme.textSecondary, zIndex: 1 }
                ]}>
                  Shorts
                </Text>
              </Pressable>
            </View>

            {/* Tab Content Container */}
            {/* Posts Tab */}
            <View style={activeTab !== 'posts' ? { height: 0, overflow: 'hidden' } : {}}>
              {profile.posts && profile.posts.length > 0 ? (
                <View style={styles.postsGrid}>
                  {((profile.posts || [])
                    .sort((a: any, b: any) => {
                      // Sort by createdAt date (newest first)
                      const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
                      const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
                      return dateB - dateA;
                    })
                    .map((item: any, index: number) => (
                    <Pressable
                      key={item._id}
                      style={[
                        styles.postThumbnail,
                        { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.gapBorderColor, aspectRatio: 1 },
                      ]}
                      onPress={() => router.push({
                        pathname: `/user-posts/${profile._id}`,
                        params: {
                          postId: item._id,
                          postData: JSON.stringify(item),
                          index: String(index),
                        },
                      })}
                    >
                      <FastImage source={{ uri: item.imageUrl }} style={styles.postImage as any} contentFit="cover" />
                      {item.filter && FILTER_PREVIEW_OVERLAY[item.filter as ImageFilterType] && (
                        <View
                          pointerEvents="none"
                          style={[
                            StyleSheet.absoluteFillObject,
                            { backgroundColor: FILTER_PREVIEW_OVERLAY[item.filter as ImageFilterType]! },
                          ]}
                        />
                      )}
                      {/* View count overlay */}
                      <View style={styles.viewCountOverlay}>
                        <Ionicons name="eye-outline" size={11} color="#FFFFFF" />
                        <Text style={styles.viewCountText}>
                          {formatViewCount((item as any).viewsCount)}
                        </Text>
                      </View>
                    </Pressable>
                    ))
                  )}
                </View>
              ) : null}
            </View>

            {/* Shorts Tab */}
            <View style={activeTab !== 'shorts' ? { height: 0, overflow: 'hidden' } : {}}>
            {
              loadingShorts ? (
                <View style={styles.emptyState}>
                  <LoadingGlobe size={32} />
                </View>
              ) : userShorts.length > 0 ? (
                <View style={styles.postsGrid}>
                  {userShorts.map((s: any, index: number) => {
                    return (
                      <ShortsCard
                        key={s._id}
                        item={s}
                        isThumbnail={true}
                        onPress={() => router.push(`/user-shorts/${id}?shortId=${s._id}&index=${index}`)}
                        profileTheme={profileTheme}
                      />
                    );
                  })}
                </View>
              ) : null
              }
            </View>
          </CloudGlassSurface>
        )}

        {!profile.canViewPosts && (
          <PremiumGlassCard style={{ marginHorizontal: 16 }} contentStyle={{ padding: 20 }} subtle>
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: profileTheme.accent + '15' }]}>
                <Ionicons name="lock-closed-outline" size={56} color={profileTheme.accent} />
              </View>
              <Text style={[styles.emptyText, { color: profileTheme.textPrimary }]}>
                {profile.profileVisibility === 'followers' 
                  ? 'Follow to view posts'
                  : profile.profileVisibility === 'private'
                  ? 'Follow request pending to view posts'
                  : 'Follow to view posts'
                }
              </Text>
            </View>
          </PremiumGlassCard>
        )}
      </ScrollView>
      
      {/* World Map Modal */}
      {((currentUser && currentUser._id === profile._id) || isFollowing) && GOOGLE_MAPS_API_KEY ? (
        <>
          <WorldMap
            visible={showWorldMap}
            userId={id as string}
            onClose={() => setShowWorldMap(false)}
          />
        </>
      ) : showWorldMap ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 18 }}>Unable to load map. GOOGLE_MAPS_API_KEY is missing.</Text>
          <TouchableOpacity onPress={() => setShowWorldMap(false)} style={{ marginTop: 16 }}>
            <Text style={{ color: theme.colors.primary }}>Close</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Profile menu - Report & Block (Apple Guideline 1.2) */}
      <Modal
        visible={showProfileMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileMenu(false)}
      >
        <Pressable style={styles.profileMenuOverlay} onPress={() => setShowProfileMenu(false)}>
          <View style={[styles.profileMenuContainer, { backgroundColor: theme.colors.surface }]} onStartShouldSetResponder={() => true}>
            <TouchableOpacity
              style={[styles.profileMenuItem, { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}
              onPress={() => {
                setShowProfileMenu(false);
                setShowReportModal(true);
              }}
            >
              <Ionicons name="flag-outline" size={22} color={theme.colors.text} />
              <Text style={[styles.profileMenuItemText, { color: theme.colors.text }]}>Report User</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileMenuItem}
              onPress={async () => {
                setShowProfileMenu(false);
                Alert.alert(
                  isBlocked ? 'Unblock User' : 'Block User',
                  isBlocked
                    ? `Unblock ${profile?.fullName || 'this user'}? You will be able to message and interact again.`
                    : `Block ${profile?.fullName || 'this user'}? You won't be able to message or interact with them.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: isBlocked ? 'Unblock' : 'Block',
                      style: isBlocked ? 'default' : 'destructive',
                      onPress: async () => {
                        try {
                          const result = await toggleBlockUser(profile!._id);
                          setIsBlocked(result.isBlocked);
                          showSuccess(result.isBlocked ? 'User blocked.' : 'User unblocked.');
                          if (result.isBlocked) router.back();
                        } catch (e: any) {
                          showError(e?.message || 'Failed to update block status');
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Ionicons name={isBlocked ? 'person-add-outline' : 'person-remove-outline'} size={22} color={theme.colors.text} />
              <Text style={[styles.profileMenuItemText, { color: theme.colors.text }]}>{isBlocked ? 'Unblock User' : 'Block User'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <ReportReasonModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Report User"
        onSelect={async (reason: ReportReasonType) => {
          try {
            await createReport({
              type: reason,
              reportedUserId: profile!._id,
              reason: reason,
            });
            showSuccess('User reported. Thank you for helping keep our community safe.');
          } catch (e: any) {
            showError(e?.message || 'Failed to submit report');
          }
        }}
      />
      
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertVisible(false)}
      />
      
      {enlargedPhotoSource && (
        <View 
          style={[StyleSheet.absoluteFillObject, { 
            backgroundColor: 'rgba(0, 0, 0, 0.85)', 
            justifyContent: 'center', 
            alignItems: 'center', 
            zIndex: 999999 
          }]} 
          pointerEvents="none"
        >
          <View style={{
            width: 280,
            height: 280,
            borderRadius: 24,
            borderWidth: 2,
            borderColor: 'rgba(255, 255, 255, 0.2)',
            overflow: 'hidden',
            backgroundColor: '#000000',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.5,
            shadowRadius: 24,
            elevation: 12,
          }}>
            <Image
              source={enlargedPhotoSource}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  
  // Hero Header
  heroHeader: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  heroHeaderContent: {
    width: '100%',
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  topActionsRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  profileMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  profileMenuContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  profileMenuItemText: {
    fontSize: 16,
  },
  backButton: {
    // Minimum touch target: 44x44 for iOS, 48x48 for Android
    minWidth: Platform.OS === 'android' ? 48 : 44,
    minHeight: Platform.OS === 'android' ? 48 : 44,
    width: Platform.OS === 'android' ? 48 : 44,
    height: Platform.OS === 'android' ? 48 : 44,
    borderRadius: Platform.OS === 'android' ? 24 : 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },

  // Profile Card
  profileCard: {
    marginTop: 0,
    borderRadius: 24,
  },
  profileCardInner: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    position: 'relative',
  },
  postsContainerInner: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 0,
  },
  avatarGradientWrapper: {
    width: 74,
    height: 74,
    borderRadius: 37,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  statsContainer: {
    flex: 1,
    marginLeft: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  cardStatValue: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  cardStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  separator: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(28, 115, 180, 0.12)',
  },
  identityBlock: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginTop: 12,
    width: '100%',
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.9,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  bioContainer: {
    width: '100%',
    marginTop: 8,
  },
  tripScoreStrip: {
    marginTop: 16,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    borderTopWidth: 1,
    borderColor: 'rgba(28, 115, 180, 0.15)',
  },
  cardTripScoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  cardTripScoreValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statCard: {
    flex: 1,
    width: '100%',
    height: 110,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
  },

  // Action Buttons
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    maxWidth: 180,
  },
  followButton: {
  },
  followingButton: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  messageButton: {
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Section Cards
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
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
    fontWeight: '600',
    flex: 1,
    letterSpacing: 0.2,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
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
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  tripScoreLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  
  // Location Card
  locationCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  locationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  locationCardBody: {
    marginBottom: 4,
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
    fontWeight: '600',
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

  // Posts Container
  postsContainer: {
    marginHorizontal: 0,
    marginTop: -16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  postsTabsSection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  pillTab: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    alignItems: 'center',
    minWidth: 100,
  },
  pillTabActive: {
  },
  pillTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  postsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
    justifyContent: 'flex-start',
  },
  postThumbnail: {
    width: '33.33%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  viewCountOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 20,
  },
  viewCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  postImage: {
    width: '100%',
    height: '100%',
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'flex-start',
    paddingVertical: 40,
    paddingHorizontal: 20,
    minHeight: 200,
    width: '100%',
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
    fontWeight: '600',
    textAlign: 'left',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'left',
    lineHeight: 22,
    fontWeight: '400',
  },
});
