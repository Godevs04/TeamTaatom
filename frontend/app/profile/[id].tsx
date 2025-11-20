import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, TouchableOpacity, FlatList, SafeAreaView, Modal, ScrollView, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import WorldMap from '../../components/WorldMap';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import CustomAlert from '../../components/CustomAlert';
import BioDisplay from '../../components/BioDisplay';
import RotatingGlobe from '../../components/RotatingGlobe';
import Constants from 'expo-constants';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWorldMap, setShowWorldMap] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followRequestSent, setFollowRequestSent] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
  });
  // Remove selectedPost and modal logic

  // Use expoConfig for SDK 49+, fallback to manifest for older
  const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY || 
                               Constants.manifest?.extra?.GOOGLE_MAPS_API_KEY || 
                               "AIzaSyBV-jFFSI6o--8SiXjzPYon8WH4slor9Co"; // Fallback key
  
  // Debug logging
  console.log('Profile - API Key check:', {
    expoConfig: Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY,
    manifest: Constants.manifest?.extra?.GOOGLE_MAPS_API_KEY,
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
    setLoading(true);
    try {
      const res = await api.get(`/api/v1/profile/${id}`);
      let userProfile = res.data.profile;
      
      // If posts are not included, fetch them
      if (!Array.isArray(userProfile.posts)) {
        const postsRes = await api.get(`/api/v1/posts/user/${id}`);
        userProfile.posts = postsRes.data.posts || [];
      }
      setProfile(userProfile);
      setIsFollowing(userProfile.followers?.some((u: any) => u._id === currentUser?._id));
    } catch (e) {
      console.error('Error fetching profile:', e);
      showError('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [id, currentUser]);

  useEffect(() => {
    setProfile(null);
    setLoading(true);
    setIsFollowing(false);
    setShowWorldMap(false);
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const userData = await api.get('/auth/me');
        setCurrentUser(userData.data.user);
      } catch {}
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (currentUser) fetchProfile();
    }, [fetchProfile, currentUser])
  );

  const handleFollow = async () => {
    if (!profile) return;
    
    // Optimistic update - update UI immediately
    const previousFollowing = isFollowing;
    const previousRequestSent = followRequestSent;
    const newFollowing = !isFollowing;
    
    setIsFollowing(newFollowing);
    if (!newFollowing) {
      setFollowRequestSent(false);
    }
    
    setFollowLoading(true);
    try {
      const res = await api.post(`/profile/${profile._id}/follow`);
      setIsFollowing(res.data.isFollowing);
      setFollowRequestSent(res.data.followRequestSent || false);
      await fetchProfile(); // Re-fetch profile and posts after follow/unfollow
      
      // Show success message
      if (res.data.isFollowing) {
        showSuccess('You are now following this user!');
      } else if (res.data.followRequestSent) {
        showSuccess('Follow request sent!');
      } else {
        showSuccess('You have unfollowed this user.');
      }
    } catch (e: any) {
      // Revert optimistic update on error
      setIsFollowing(previousFollowing);
      setFollowRequestSent(previousRequestSent);
      
      // Don't log conflict errors (follow request already pending) as they are expected
      if (!e.isConflict && e.response?.status !== 409) {
        console.error('Error following/unfollowing user:', e);
      }
      
      const errorMessage = e.response?.data?.message || e.message || 'Failed to update follow status';
      
      // Check if it's a follow request already pending message or conflict error
      if (errorMessage.includes('Follow request already pending') || errorMessage.includes('Request already sent') || e.isConflict) {
        setFollowRequestSent(true);
        showWarning('Follow Request Pending', errorMessage);
      } else {
        showError(errorMessage);
      }
    } finally {
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
    <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header - Gradient Style with Back Button */}
        <ExpoLinearGradient
          colors={['#E3F2FD', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.profileHeaderGradient}
        >
          {/* Back Button - Positioned at Top */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileHeader}>
            {/* Profile Picture */}
            <View style={styles.profilePictureWrapper}>
              <View style={styles.profilePictureContainer}>
                <Image
                  source={profile.profilePic ? { uri: profile.profilePic } : require('../../assets/avatars/male_avatar.png')}
                  style={styles.profilePicture}
                />
              </View>
            </View>

            {/* Name */}
            <Text style={styles.profileName}>{profile.fullName}</Text>
            
            {/* Bio */}
            {profile.bio && (
              <View style={styles.bioContainer}>
                <BioDisplay bio={profile.bio || ''} />
              </View>
            )}

            {/* Stats Cards with Icons */}
            <View style={styles.statsRow}>
              <TouchableOpacity 
                style={styles.statCard}
                onPress={() => router.push({ pathname: '/followers', params: { userId: profile._id, type: 'followers' } })}
                activeOpacity={0.7}
              >
                <View style={[styles.statIconContainer, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="trophy" size={20} color="#FF6B35" />
                </View>
                <Text style={styles.statValue}>
                  {typeof profile.followers === 'number' ? profile.followers : Array.isArray(profile.followers) ? profile.followers.length : 0}
                </Text>
                <Text style={styles.statLabel}>Followers</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.statCard}
                onPress={() => router.push({ pathname: '/followers', params: { userId: profile._id, type: 'following' } })}
                activeOpacity={0.7}
              >
                <View style={[styles.statIconContainer, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                </View>
                <Text style={styles.statValue}>
                  {typeof profile.following === 'number' ? profile.following : Array.isArray(profile.following) ? profile.following.length : 0}
                </Text>
                <Text style={styles.statLabel}>Following</Text>
              </TouchableOpacity>
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="location" size={20} color="#0A84FF" />
                </View>
                <Text style={styles.statValue}>
                  {(currentUser && (currentUser._id === profile._id || isFollowing)) && Array.isArray(profile.locations) ? profile.locations.length : '-'}
                </Text>
                <Text style={styles.statLabel}>Locations</Text>
              </View>
            </View>

            {/* Action Buttons */}
            {currentUser && currentUser._id !== profile._id && (
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    isFollowing ? styles.followingButton : styles.followButton
                  ]}
                  onPress={handleFollow}
                  disabled={followLoading}
                >
                  {followLoading ? (
                    <ActivityIndicator size="small" color={isFollowing ? '#0A84FF' : '#FFFFFF'} />
                  ) : (
                    <Text style={[
                      styles.actionButtonText,
                      { color: isFollowing ? '#0A84FF' : '#FFFFFF' }
                    ]}>
                      {isFollowing ? 'Following' : followRequestSent ? 'Request Sent' : 'Follow'}
                    </Text>
                  )}
                </TouchableOpacity>
                
                {isFollowing && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.messageButton]}
                    onPress={() => router.push(`/chat?userId=${profile._id}`)}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.actionButtonText}>Message</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </ExpoLinearGradient>

        {/* TripScore Section */}
        {profile.tripScore && profile.locations && profile.locations.length > 0 && profile.canViewLocations && (
          <TouchableOpacity 
            style={styles.sectionCard}
            onPress={() => router.push(`/tripscore/continents?userId=${id}`)}
            activeOpacity={0.8}
          >
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="trophy" size={22} color="#FF6B35" />
              </View>
              <Text style={styles.sectionTitle}>TripScore</Text>
            </View>
            <View style={styles.tripScoreContent}>
              <View style={styles.tripScoreCard}>
                <Text style={styles.tripScoreNumber}>
                  {profile.tripScore.totalScore}
                </Text>
                <Text style={styles.tripScoreLabel}>
                  Total TripScore
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Locations Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="globe" size={22} color="#0A84FF" />
            </View>
            <Text style={styles.sectionTitle}>Posted Locations</Text>
          </View>
          {profile.canViewLocations && profile.locations && profile.locations.length > 0 ? (
            <TouchableOpacity 
              onPress={() => setShowWorldMap(true)} 
              style={styles.globeContainer}
              activeOpacity={0.8}
            >
              <RotatingGlobe 
                locations={profile.locations || []} 
                size={120} 
              />
              <Text style={styles.locationsCount}>
                {profile.locations.length} locations visited
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyLocationsContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="globe-outline" size={48} color="#CCCCCC" />
              </View>
              <Text style={styles.emptyText}>
                {profile.canViewLocations 
                  ? 'No locations yet'
                  : profile.profileVisibility === 'followers' 
                  ? 'Follow to view posted locations'
                  : profile.profileVisibility === 'private'
                  ? 'Follow request pending to view locations'
                  : 'Follow to view posted locations'
                }
              </Text>
            </View>
          )}
        </View>

        {/* Recent Posts Section */}
        {profile.canViewPosts && (
          <View style={styles.postsContainer}>
            <Text style={styles.postsSectionTitle}>Recent Posts</Text>
            {profile.posts && profile.posts.length > 0 ? (
              <View style={styles.postsGrid}>
                {(profile.posts || []).slice(0, 6).map((item: any) => (
                  <TouchableOpacity
                    key={item._id}
                    style={styles.postThumbnail}
                    onPress={() => router.push(`/user-posts/${profile._id}?postId=${item._id}`)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="camera-outline" size={48} color="#CCCCCC" />
                </View>
                <Text style={styles.emptyText}>No posts yet</Text>
                <Text style={styles.emptySubtext}>This user hasn't shared any posts yet</Text>
              </View>
            )}
          </View>
        )}

        {!profile.canViewPosts && (
          <View style={styles.sectionCard}>
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="lock-closed-outline" size={48} color="#CCCCCC" />
              </View>
              <Text style={styles.emptyText}>
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
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    backgroundColor: '#FFFFFF',
  },
  
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    width: '100%',
  },
  backButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },

  // Profile Header - Gradient Style
  profileHeaderGradient: {
    paddingTop: 0,
    paddingBottom: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 380,
  },
  profileHeader: {
    width: '100%',
    alignItems: 'center',
  },
  profilePictureWrapper: {
    marginBottom: 20,
  },
  profilePictureContainer: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  bioContainer: {
    marginBottom: 24,
    paddingHorizontal: 20,
    width: '100%',
  },
  
  // Stats Row - Screenshot Style
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
    textTransform: 'capitalize',
  },

  // Action Buttons
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
    paddingHorizontal: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxWidth: 200,
  },
  followButton: {
    backgroundColor: '#0A84FF',
  },
  followingButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0A84FF',
  },
  messageButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Section Cards - Unified Style
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  globeContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  locationsCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyLocationsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  tripScoreContent: {
    alignItems: 'center',
  },
  tripScoreCard: {
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
  },
  tripScoreNumber: {
    fontSize: 42,
    fontWeight: '800',
    color: '#0A84FF',
    marginBottom: 8,
  },
  tripScoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Posts Container
  postsContainer: {
    margin: 16,
    marginTop: 8,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 24,
  },
  postsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  postThumbnail: {
    width: (width - 32 - 24) / 3,
    aspectRatio: 1,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});
