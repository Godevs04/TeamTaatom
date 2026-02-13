import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, TouchableOpacity, FlatList, Modal, ScrollView, Dimensions, Pressable, Animated, useColorScheme, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { toggleFollow, getTravelMapData, toggleBlockUser, getBlockStatus } from '../../services/profile';
import { createReport } from '../../services/report';
import ReportReasonModal, { ReportReasonType } from '../../components/ReportReasonModal';
import WorldMap from '../../components/WorldMap';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import CustomAlert from '../../components/CustomAlert';
import BioDisplay from '../../components/BioDisplay';
import RotatingGlobe from '../../components/RotatingGlobe';
import Constants from 'expo-constants';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import logger from '../../utils/logger';
import { getUserShorts } from '../../services/posts';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const TRIP_GAP_DAYS = 7;

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
type FollowState = 'FOLLOWING' | 'REQUESTED' | 'FOLLOW';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const { theme, mode } = useTheme();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWorldMap, setShowWorldMap] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followRequestSent, setFollowRequestSent] = useState(false);
  const [followState, setFollowState] = useState<FollowState>('FOLLOW');
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

  // Helper function to derive followState from boolean flags
  const deriveFollowState = useCallback((isFollowing: boolean, followRequestSent: boolean): FollowState => {
    if (isFollowing === true) {
      return 'FOLLOWING';
    }
    if (followRequestSent === true) {
      return 'REQUESTED';
    }
    return 'FOLLOW';
  }, []);

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

    // Compute and set derived followState
    const derivedState = deriveFollowState(apiIsFollowing, apiFollowRequestSent);
    setFollowState(derivedState);

    // Update followers count in profile if provided
    // Note: Only update followersCount (target user's follower count)
    // Do NOT update followingCount - the API returns the current user's following count,
    // but the profile displays the target user's following count (who the target user follows)
    if (response.followersCount !== undefined) {
      setProfile((prevProfile: any) => {
        if (!prevProfile) return prevProfile;
        const updated: any = { ...prevProfile };
        if (typeof response.followersCount === 'number') {
          updated.followersCount = response.followersCount;
        }
        return updated;
      });
    }
  }, [deriveFollowState]);
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
    setLoading(true);
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
            setProfile(parsed.data);
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
      
      setProfile(userProfile);
      
      // Fetch verified locations count (for all users, regardless of privacy)
      // This runs in parallel with posts/shorts fetching for better performance
      getTravelMapData(id as string)
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
          userProfile.posts = postsResult.value;
        } else {
          userProfile.posts = [];
        }
        
        // Handle shorts result
        if (shortsResult.status === 'fulfilled') {
          const fetchedShorts = shortsResult.value.shorts || [];
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
        setProfile(userProfile); // Update profile with posts (includes fetched posts)
      } else {
        // User cannot view posts, set empty arrays
        userProfile.posts = [];
        setUserShorts([]);
        setProfile(userProfile);
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
        // Compute and set derived followState
        const derivedState = deriveFollowState(storedIsFollowing, storedFollowRequestSent);
        setFollowState(derivedState);
        // Don't clear the ref here - let it expire naturally after the timeout
      } else if (!isFollowActionInProgress.current) {
        // No stored response and not in the middle of an action - use fresh API response
        // CRITICAL: Use isFollowing directly from API response - backend calculates this correctly
        const apiIsFollowing = Boolean(userProfile.isFollowing);
        const apiFollowRequestSent = Boolean(userProfile.followRequestSent);
        setIsFollowing(apiIsFollowing);
        setFollowRequestSent(apiFollowRequestSent);
        // Compute and set derived followState
        const derivedState = deriveFollowState(apiIsFollowing, apiFollowRequestSent);
        setFollowState(derivedState);
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
  }, [id, deriveFollowState]);

  useEffect(() => {
    setProfile(null);
    setLoading(true);
    setIsFollowing(false);
    setFollowRequestSent(false);
    setFollowState('FOLLOW');
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
    
    try {
      // ✅ EVERYTHING ASYNC MUST BE INSIDE TRY
      // Use the service function for consistency
      const response = await toggleFollow(profile._id);
      
      // Apply follow state from API response (source of truth)
      applyFollowState({
        isFollowing: Boolean(response.isFollowing),
        followRequestSent: Boolean(response.followRequestSent ?? false),
        followersCount: response.followersCount,
        followingCount: response.followingCount
      });
      
      // No success alert - silent update for better UX
      
      // Refresh profile data to get updated counts and ensure consistency
      // Use a small delay to ensure the backend has processed the follow/unfollow
      // --->
      // No fetchProfile() call - update state optimistically to avoid loading screen
      // The API response already contains the updated counts, so we don't need to reload
      // setTimeout(() => {
      //   fetchProfile();
      // }, 500);
      
      // CRITICAL: Keep the ref for a longer period to prevent cached profile fetches from overriding
      // Cached responses (304) can return stale isFollowing state, so we need to protect against that
      // Clear the ref after enough time has passed for cache to be invalidated
      setTimeout(() => {
        lastFollowApiResponse.current = null;
      }, 5000); // 5 seconds to prevent cache override
      
    } catch (e: any) {
      // Clear ref on error
      lastFollowApiResponse.current = null;
      
      // Don't log conflict errors (follow request already pending) as they are expected
      if (!e.isConflict && e.response?.status !== 409) {
        logger.error('Error following/unfollowing user:', e);
      }
      
      const errorMessage = e.response?.data?.message || e.message || 'Failed to update follow status';
      
      // ❌ DO NOT RETURN FROM CATCH - all cleanup happens in finally
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

  if (loading || !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.colors.background }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.colors.background }]}
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
                style={[styles.backButton, { backgroundColor: profileTheme.cardBg + '80', shadowColor: theme.colors.shadow }]}
              >
                <Ionicons name="arrow-back" size={20} color={profileTheme.textPrimary} />
              </Pressable>
              <View style={styles.topActionsRight}>
                {currentUser && currentUser._id !== profile._id && (
                  <>
                    <Pressable
                      onPress={() => setShowReportModal(true)}
                      style={[styles.backButton, { backgroundColor: profileTheme.cardBg + '80', shadowColor: theme.colors.shadow }]}
                    >
                      <Ionicons name="flag-outline" size={20} color={profileTheme.textPrimary} />
                    </Pressable>
                    <Pressable
                      onPress={() => setShowProfileMenu(true)}
                      style={[styles.backButton, { backgroundColor: profileTheme.cardBg + '80', shadowColor: theme.colors.shadow }]}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color={profileTheme.textPrimary} />
                    </Pressable>
                  </>
                )}
              </View>
            </View>

            {/* Profile Card */}
            <View style={[styles.profileCard, { backgroundColor: profileTheme.cardBg + '95', shadowColor: theme.colors.shadow }]}>
              {/* Avatar with Ring */}
              <View style={styles.avatarContainer}>
                <View style={[styles.avatarRing, { borderColor: profileTheme.accent + '40' }]}>
                  <Image
                    source={profile.profilePic ? { uri: profile.profilePic } : require('../../assets/avatars/male_avatar.png')}
                    style={[styles.avatar, { borderColor: profileTheme.cardBg, shadowColor: theme.colors.shadow }]}
                  />
                </View>
              </View>

              {/* Username */}
              {profile.username && (
                <Text style={[styles.username, { color: profileTheme.textPrimary }]}>{profile.username}</Text>
              )}
              
              {/* Full Name */}
              <Text style={[styles.profileName, { color: profileTheme.textPrimary }]}>{profile.fullName}</Text>
              
              {/* Bio */}
              {profile.bio && (
                <View style={styles.bioContainer}>
                  <BioDisplay bio={profile.bio || ''} />
                </View>
              )}

              {/* Action Buttons */}
              {currentUser && currentUser._id !== profile._id && (
                <View style={styles.actionButtonsContainer}>
                  <Pressable
                    style={[
                      styles.actionButton,
                      { shadowColor: theme.colors.shadow },
                      followState === 'FOLLOWING'
                        ? [styles.followingButton, { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.accent }]
                        : [styles.followButton, { backgroundColor: profileTheme.accent }]
                    ]}
                    onPress={handleFollow}
                    disabled={followLoading || followState === 'REQUESTED'}
                  >
                    {followLoading ? (
                      <ActivityIndicator size="small" color={followState === 'FOLLOWING' ? profileTheme.accent : '#FFFFFF'} />
                    ) : (
                      <Text style={[
                        styles.actionButtonText,
                        { color: followState === 'FOLLOWING' ? profileTheme.accent : '#FFFFFF' }
                      ]}>
                        {followState === 'FOLLOWING' ? 'Following' : followState === 'REQUESTED' ? 'Request Sent' : 'Follow'}
                      </Text>
                    )}
                  </Pressable>
                  
                  {followState === 'FOLLOWING' && (
                    <Pressable
                      style={[styles.actionButton, styles.messageButton, { backgroundColor: profileTheme.accent }]}
                      onPress={() => router.push(`/chat?userId=${profile._id}`)}
                    >
                      <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>Message</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          </View>
        </ExpoLinearGradient>

        {/* Stats Row - Uniform Pill-like Cards */}
        <View style={styles.statsContainer}>
          <StatCard 
            iconName="trophy"
            value={profile.followersCount !== undefined ? profile.followersCount : (Array.isArray(profile.followers) ? profile.followers.length : 0)}
            label="Followers"
            onPress={() => router.push({ pathname: '/followers', params: { userId: profile._id, type: 'followers' } })}
          />
          <StatCard 
            iconName="people"
            value={profile.followingCount !== undefined ? profile.followingCount : (Array.isArray(profile.following) ? profile.following.length : 0)}
            label="Following"
            onPress={() => router.push({ pathname: '/followers', params: { userId: profile._id, type: 'following' } })}
          />
          <StatCard 
            iconName="location"
            value={(currentUser && (currentUser._id === profile._id || isFollowing)) && Array.isArray(profile.locations) ? profile.locations.length : '-'}
            label="Locations"
          />
        </View>

        {/* TripScore Section - Compact */}
        {profile.tripScore && profile.canViewLocations && (
          <Pressable 
            style={[styles.sectionCard, { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.cardBorder, shadowColor: theme.colors.shadow }]}
            onPress={() => router.push(`/tripscore/continents?userId=${id}`)}
          >
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: profileTheme.accent + '20' }]}>
                <Ionicons name="trophy" size={22} color={profileTheme.accent} />
              </View>
              <Text style={[styles.sectionTitle, { color: profileTheme.textPrimary }]}>TripScore</Text>
            </View>
            <View style={styles.tripScoreContent}>
              <View style={[styles.tripScoreCard, { backgroundColor: profileTheme.accent + '10', borderColor: profileTheme.accent + '25', borderWidth: 1 }]}>
                <Text style={[styles.tripScoreNumber, { color: profileTheme.accent }]}>
                  {profile.tripScore.totalScore || 0}
                </Text>
                <Text style={[styles.tripScoreLabel, { color: profileTheme.textSecondary }]}>
                  Total TripScore
                </Text>
              </View>
            </View>
          </Pressable>
        )}

        {/* Location Card - unified: base, verified summary, trips summary, globe */}
        <Pressable 
          style={[styles.locationCard, { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.cardBorder, shadowColor: theme.colors.shadow }]}
          onPress={() => {
            if (verifiedLocationsCount !== null && verifiedLocationsCount > 0) {
              const name = profile?.fullName || profile?.username || 'User';
              router.push(`/map/all-locations?userId=${id}&userName=${encodeURIComponent(name)}`);
            } else if (profile.canViewLocations && profile.locations && profile.locations.length > 0) {
              setShowWorldMap(true);
            }
          }}
        >
          <View style={styles.locationCardHeader}>
            <View style={[styles.locationIconContainer, { backgroundColor: profileTheme.accent + '20' }]}>
              <Ionicons name="globe" size={24} color={profileTheme.accent} />
            </View>
            <View style={styles.locationTextContainer}>
              <Text style={[styles.locationTitle, { color: profileTheme.textPrimary }]}>
                {isOwnProfile ? 'My Location' : 'Their Location'}
              </Text>
              <Text style={[styles.locationSubtitle, { color: profileTheme.textSecondary }]}>
                {isOwnProfile ? 'Your verified travel' : 'Their verified travel'}
              </Text>
            </View>
            {(verifiedLocationsCount !== null && verifiedLocationsCount > 0) || (profile.canViewLocations && profile.locations && profile.locations.length > 0) ? (
              <Ionicons name="chevron-forward" size={20} color={profileTheme.textSecondary} />
            ) : null}
          </View>
          <View style={styles.locationCardBody}>
            <Text style={[styles.locationSubtitle, { color: profileTheme.textSecondary, marginBottom: 8 }]}>
              {verifiedLocationsCount !== null && verifiedLocationsCount > 0
                ? `${verifiedLocationsCount} verified location${verifiedLocationsCount !== 1 ? 's' : ''} · ${tripsCount} trip${tripsCount !== 1 ? 's' : ''}`
                : 'No verified travel summary yet'}
            </Text>
            {countriesCount > 0 ? (
              <Text style={[styles.locationSubtitle, { color: profileTheme.textSecondary, marginBottom: 12 }]}>
                {countriesCount} countr{countriesCount !== 1 ? 'ies' : 'y'} visited
              </Text>
            ) : null}
          </View>
          <View style={styles.locationGlobeContainer}>
            {globeLocations.length > 0 ? (
              <RotatingGlobe
                locations={globeLocations}
                size={140}
                onPress={() => {
                  if (verifiedLocationsCount !== null && verifiedLocationsCount > 0) {
                    const name = profile?.fullName || profile?.username || 'User';
                    router.push(`/map/all-locations?userId=${id}&userName=${encodeURIComponent(name)}`);
                  }
                }}
              />
            ) : !profile.canViewLocations ? (
              <View style={[styles.emptyGlobeContainer, { backgroundColor: profileTheme.accent + '10' }]}>
                <Ionicons name="lock-closed-outline" size={32} color={profileTheme.textSecondary} />
                <Text style={[styles.locationSubtitle, { color: profileTheme.textSecondary, marginTop: 8, textAlign: 'center' }]}>
                  Follow to view locations
                </Text>
              </View>
            ) : (
              <View style={[styles.emptyGlobeContainer, { backgroundColor: profileTheme.accent + '10' }]}>
                <Ionicons name="globe-outline" size={64} color={profileTheme.accent} />
              </View>
            )}
          </View>
        </Pressable>

        {/* Posts/Shorts Section */}
        {profile.canViewPosts && (
          <View style={[styles.postsContainer, { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.cardBorder, shadowColor: theme.colors.shadow }]}>
            {/* Tabs */}
            <View style={styles.postsTabsSection}>
              <Pressable
                style={[
                  styles.pillTab,
                  activeTab === 'posts' && [styles.pillTabActive, { backgroundColor: profileTheme.accent }]
                ]}
                onPress={() => setActiveTab('posts')}
              >
                <Text style={[
                  styles.pillTabText,
                  { color: activeTab === 'posts' ? '#FFFFFF' : profileTheme.textSecondary }
                ]}>
                  Posts
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.pillTab,
                  activeTab === 'shorts' && [styles.pillTabActive, { backgroundColor: profileTheme.accent }]
                ]}
                onPress={() => setActiveTab('shorts')}
              >
                <Text style={[
                  styles.pillTabText,
                  { color: activeTab === 'shorts' ? '#FFFFFF' : profileTheme.textSecondary }
                ]}>
                  Shorts
                </Text>
              </Pressable>
            </View>

            {/* Posts Tab */}
            {activeTab === 'posts' && (
              profile.posts && profile.posts.length > 0 ? (
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
                        { backgroundColor: profileTheme.cardBg, shadowColor: theme.colors.shadow },
                        (index + 1) % 3 === 0 && styles.postThumbnailLastInRow
                      ]}
                      onPress={() => router.push(`/user-posts/${profile._id}?postId=${item._id}`)}
                    >
                      <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
                    </Pressable>
                    ))
                  )}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: profileTheme.accent + '15' }]}>
                    <Ionicons name="camera-outline" size={56} color={profileTheme.accent} />
                  </View>
                  <Text style={[styles.emptyText, { color: profileTheme.textPrimary }]}>No posts yet</Text>
                  <Text style={[styles.emptySubtext, { color: profileTheme.textSecondary }]}>
                    This user hasn't shared any posts yet
                  </Text>
                </View>
              )
            )}

            {/* Shorts Tab */}
            {activeTab === 'shorts' && (
              loadingShorts ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="large" color={profileTheme.accent} />
                </View>
              ) : userShorts.length > 0 ? (
                <View style={styles.postsGrid}>
                  {userShorts.map((s: any, index: number) => {
                    // Get thumbnail URL - check multiple fields for compatibility (same as own profile)
                    const uri = (s as any).imageUrl || (s as any).thumbnailUrl || (s as any).mediaUrl || '';
                    
                    // Validate URI - check if it's a valid URL format
                    const isValidUri = uri && typeof uri === 'string' && uri.trim() !== '' && 
                                      (uri.startsWith('http://') || uri.startsWith('https://'));
                    
                    if (!isValidUri) {
                      return (
                        <Pressable 
                          key={s._id} 
                          style={[
                            styles.postThumbnail,
                            { backgroundColor: profileTheme.cardBg, shadowColor: theme.colors.shadow },
                            (index + 1) % 3 === 0 && styles.postThumbnailLastInRow
                          ]}
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
                        style={[
                          styles.postThumbnail,
                          { backgroundColor: profileTheme.cardBg, shadowColor: theme.colors.shadow },
                          (index + 1) % 3 === 0 && styles.postThumbnailLastInRow
                        ]}
                        onPress={() => router.push(`/(tabs)/shorts?shortId=${s._id}&userId=${id}`)}
                      >
                        <Image 
                          source={{ uri }} 
                          style={styles.postImage} 
                          resizeMode="cover"
                          onError={(error) => {
                            // Check if this is a 403 Forbidden error (expired signed URL)
                            const errorMessage = error?.nativeEvent?.error?.message || '';
                            const is403 = errorMessage.includes('403') || 
                                         errorMessage.includes('Forbidden') ||
                                         errorMessage.includes('forbidden');
                            
                            // Don't log 403 errors - they're expected for expired signed URLs
                            // Only log non-403 errors to reduce noise in logs
                            if (!is403) {
                              logger.warn('Short thumbnail failed to load:', {
                                shortId: s._id,
                                uri: uri?.substring(0, 100),
                                imageUrl: (s as any).imageUrl?.substring(0, 50),
                                thumbnailUrl: (s as any).thumbnailUrl?.substring(0, 50),
                                mediaUrl: (s as any).mediaUrl?.substring(0, 50),
                                error: errorMessage || 'Unknown error'
                              });
                            } else if (__DEV__) {
                              // Only log 403 errors in development for debugging
                              logger.debug('Short thumbnail URL expired (403):', {
                                shortId: s._id,
                                uri: uri?.substring(0, 100)
                              });
                            }
                          }}
                        />
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
                    This user hasn't shared any shorts yet
                  </Text>
                </View>
              )
            )}
          </View>
        )}

        {!profile.canViewPosts && (
          <View style={[styles.sectionCard, { backgroundColor: profileTheme.cardBg, borderColor: profileTheme.cardBorder, shadowColor: theme.colors.shadow }]}>
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
          </View>
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },

  // Profile Card
  profileCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  username: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.1,
    opacity: 0.7,
  },
  bioContainer: {
    marginBottom: 16,
    paddingHorizontal: 8,
    width: '100%',
  },
  
  // Stats Container - Uniform pill-like cards
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    gap: 12,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
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
    fontWeight: '700',
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
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
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Section Cards
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
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.2,
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
  
  // Location Card
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

  // Posts Container
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
    marginBottom: 24,
  },
  postsTabsSection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  pillTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  pillTabActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  pillTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  postsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
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
  postThumbnailLastInRow: {
    marginRight: 0,
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
    lineHeight: 22,
    fontWeight: '400',
  },
});
