import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, TouchableOpacity, FlatList, SafeAreaView, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import WorldMap from '../../components/WorldMap';
import OptimizedPhotoCard from '../../components/OptimizedPhotoCard';
import CustomAlert from '../../components/CustomAlert';
import BioDisplay from '../../components/BioDisplay';
import Constants from 'expo-constants';

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
      const res = await api.get(`/profile/${id}`);
      let userProfile = res.data.profile;
      
      // If posts are not included, fetch them
      if (!Array.isArray(userProfile.posts)) {
        const postsRes = await api.get(`/posts/user/${id}`);
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        ListHeaderComponent={
          <View style={styles.profileContainer}>
            {/* Header with Back Button */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Profile Picture */}
            <View style={styles.profilePictureContainer}>
              <Image
                source={profile.profilePic ? { uri: profile.profilePic } : require('../../assets/avatars/male_avatar.png')}
                style={styles.profilePicture}
              />
              <View style={styles.profilePictureBorder} />
            </View>

            {/* User Info */}
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: theme.colors.text }]}>{profile.fullName}</Text>
              {profile.email && (
                <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>{profile.email}</Text>
              )}
              <BioDisplay bio={profile.bio || ''} />
            </View>

            {/* Stats Cards */}
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                  {typeof profile.followers === 'number' ? profile.followers : Array.isArray(profile.followers) ? profile.followers.length : 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Followers</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                  {typeof profile.following === 'number' ? profile.following : Array.isArray(profile.following) ? profile.following.length : 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Following</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                  {(currentUser && (currentUser._id === profile._id || isFollowing)) && Array.isArray(profile.locations) ? profile.locations.length : '-'}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Locations</Text>
              </View>
            </View>

            {/* Action Buttons */}
            {currentUser && currentUser._id !== profile._id && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.followButton,
                    { 
                      backgroundColor: isFollowing ? theme.colors.surface : followRequestSent ? '#FF9800' : theme.colors.primary,
                      borderColor: isFollowing ? theme.colors.primary : 'transparent'
                    }
                  ]}
                  onPress={handleFollow}
                  disabled={followLoading}
                >
                  <Text style={[
                    styles.actionButtonText,
                    { color: isFollowing ? theme.colors.primary : '#fff' }
                  ]}>
                    {isFollowing ? 'Following' : followRequestSent ? 'Request Sent' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                
                {isFollowing && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.messageButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => router.push(`/chat?userId=${profile._id}`)}
                  >
                    <Text style={[styles.actionButtonText, { color: '#fff' }]}>Message</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* TripScore Section - Only show if user has posted locations */}
            {profile.tripScore && profile.locations && profile.locations.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>TripScore</Text>
                <TouchableOpacity 
                  style={styles.tripScoreContainer}
                  onPress={() => router.push(`/tripscore/continents?userId=${id}`)}
                >
                  <View style={styles.tripScoreCard}>
                    <Text style={[styles.tripScoreNumber, { color: theme.colors.primary }]}>
                      {profile.tripScore.totalScore}
                    </Text>
                    <Text style={[styles.tripScoreLabel, { color: theme.colors.textSecondary }]}>
                      Total TripScore
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Posted Locations Section */}
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Posted Locations</Text>
              {profile.canViewLocations && profile.locations && profile.locations.length > 0 ? (
                <View style={styles.locationsContainer}>
                  <TouchableOpacity onPress={() => setShowWorldMap(true)} style={styles.globeContainer}>
                    <View style={styles.globeIconContainer}>
                      <Ionicons name="earth" size={60} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.locationsCount, { color: theme.colors.textSecondary }]}>
                      {profile.locations.length} locations visited
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyLocationsContainer}>
                  <View style={styles.emptyGlobeContainer}>
                    <Ionicons name="earth" size={50} color={theme.colors.textSecondary} />
                  </View>
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
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
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Posts</Text>
              </View>
            )}
          </View>
        }
        data={profile.canViewPosts ? (profile.posts || []).slice(0, 6) : []}
        keyExtractor={item => item._id}
        numColumns={3}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.postThumbnail}
            onPress={() => router.push(`/user-posts/${profile._id}?postId=${item._id}`)}
          >
            <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyPostsContainer}>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {profile.canViewPosts 
                ? 'No posts yet.' 
                : profile.profileVisibility === 'followers' 
                ? 'Follow to view posts'
                : profile.profileVisibility === 'private'
                ? 'Follow request pending to view posts'
                : 'Follow to view posts'
              }
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Profile Picture Styles
  profilePictureContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profilePictureBorder: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 64,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // User Info Styles
  userInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },

  // Stats Styles
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },

  // Action Buttons Styles
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  followButton: {
    borderWidth: 2,
  },
  messageButton: {
    // Additional styles for message button if needed
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Section Styles
  sectionContainer: {
    width: '100%',
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },

  // Locations Styles
  locationsContainer: {
    alignItems: 'center',
  },
  globeContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  globeIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  locationsCount: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyLocationsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyGlobeContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  // Posts Styles
  postThumbnail: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  emptyPostsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },

  // TripScore Styles
  tripScoreContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  tripScoreCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tripScoreNumber: {
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 8,
  },
  tripScoreLabel: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },
});
