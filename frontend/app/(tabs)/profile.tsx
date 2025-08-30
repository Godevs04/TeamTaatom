import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  Image, 
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getUserFromStorage, signOut } from '../../services/auth';
import { getProfile } from '../../services/profile';
import { getUserPosts } from '../../services/posts';
import { UserType } from '../../types/user';
import { PostType } from '../../types/post';
import EditProfile from '../../components/EditProfile';
import RotatingGlobe from '../../components/RotatingGlobe';
import KebabMenu from '../../components/common/KebabMenu';

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
  isFollowing: boolean;
  isOwnProfile: boolean;
}

export default function ProfileScreen() {
  const [user, setUser] = useState<UserType | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true); // new state
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const loadUserData = useCallback(async () => {
    setCheckingUser(true);
    try {
      const userData = await getUserFromStorage();
      console.log('[ProfileScreen] getUserFromStorage:', userData);
      if (!userData) {
        setCheckingUser(false);
        setLoading(false);
        return;
      }
      setUser(userData);
      setCheckingUser(false);
      // Load profile data
      const profile = await getProfile(userData._id);
      setProfileData(profile.profile);
      // Load user posts
      const userPosts = await getUserPosts(userData._id);
      setPosts(userPosts.posts);
    } catch (error: any) {
      console.error('Failed to load profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
      setCheckingUser(false);
    }
  }, [router]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    if (!checkingUser && !user) {
      // Only redirect after confirming user is missing
      router.replace('/(auth)/signin');
    }
  }, [checkingUser, user, router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  }, [loadUserData]);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/(auth)/signin');
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const handleProfileUpdate = (updatedUser: UserType) => {
    setUser(updatedUser);
    setProfileData(prev => prev ? { ...prev, ...updatedUser } : null);
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
            <Text style={[styles.retryButtonText, { color: theme.colors.text }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <NavBar
        title="Profile"
        rightComponent={
          <KebabMenu
            items={[
              {
                label: 'Edit Profile',
                icon: 'person-circle-outline',
                onPress: () => setShowEditProfile(true),
              },
              {
                label: 'Toggle Theme',
                icon: 'moon-outline',
                onPress: toggleTheme,
              },
              {
                label: 'Sign Out',
                icon: 'log-out-outline',
                onPress: handleSignOut,
                destructive: true,
              },
            ]}
          />
        }
      />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Profile Header */}
        <View style={[styles.headerContainer, { backgroundColor: theme.colors.surface }]}> 
          <View style={styles.profileInfo}>
            <Image
              source={profileData.profilePic ? { uri: profileData.profilePic } : require('../../assets/avatars/male_avatar.png')}
              style={styles.avatar}
            />
            <Text style={[styles.name, { color: theme.colors.text }]}> 
              {profileData.fullName}
            </Text>
            <Text style={[styles.email, { color: theme.colors.textSecondary }]}> 
              {profileData.email}
            </Text>
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>{profileData?.postsCount || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>{profileData?.followersCount || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>{profileData?.followingCount || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Following</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>{profileData?.totalLikes || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Likes</Text>
            </View>
          </View>
          {profileData?.locations && profileData.locations.length > 0 && (
            <View style={[styles.mapContainer, { backgroundColor: theme.colors.surface }]}> 
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Posted Locations</Text>
              <View style={{ alignItems: 'center', marginBottom: theme.spacing.md }}>
                <RotatingGlobe locations={profileData.locations} size={40} />
              </View>
              <View style={[styles.mapPlaceholder, { backgroundColor: theme.colors.surfaceSecondary }]}> 
                <Ionicons name="map" size={48} color={theme.colors.primary} /> 
                <Text style={[styles.mapText, { color: theme.colors.textSecondary }]}> 
                  {profileData.locations.length} locations visited 
                </Text> 
              </View> 
            </View>
          )}
        </View>
        {/* End Profile Header */}

        {/* Recent Posts */}
        <View style={[styles.postsContainer, { backgroundColor: theme.colors.surface }]}> 
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Posts</Text>
          {posts.length > 0 ? (
            <View style={styles.postsGrid}>
              {posts.slice(0, 6).map((post) => (
                <TouchableOpacity
                  key={post._id}
                  style={styles.postThumbnail}
                  onPress={() => {
                    // Navigate to post detail or full view
                  }}
                >
                  <Image
                    source={{ uri: post.imageUrl }}
                    style={styles.thumbnailImage}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.noPostsContainer}>
              <Ionicons name="camera-outline" size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.noPostsText, { color: theme.colors.textSecondary }]}>No posts yet</Text>
            </View>
          )}
        </View>
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
  );
}

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    errorText: {
      fontSize: 16,
      marginBottom: 20,
      textAlign: 'center',
    },
    retryButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    headerContainer: {
      padding: 20,
      margin: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    profileInfo: {
      alignItems: 'center',
      marginBottom: 20,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      marginBottom: 12,
    },
    name: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    email: {
      fontSize: 14,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
    },
    statItem: {
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
    },
    mapContainer: {
      margin: 16,
      padding: 20,
      borderRadius: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 16,
    },
    mapPlaceholder: {
      height: 150,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mapText: {
      marginTop: 8,
      fontSize: 14,
    },
    postsContainer: {
      margin: 16,
      padding: 20,
      borderRadius: 12,
    },
    postsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    postThumbnail: {
      width: '30%',
      aspectRatio: 1,
      marginBottom: 8,
      borderRadius: 8,
      overflow: 'hidden',
    },
    thumbnailImage: {
      width: '100%',
      height: '100%',
    },
    noPostsContainer: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    noPostsText: {
      marginTop: 8,
      fontSize: 14,
    },
    settingsContainer: {
      margin: 16,
      padding: 20,
      borderRadius: 12,
      marginBottom: 32,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    settingText: {
      flex: 1,
      marginLeft: 12,
      fontSize: 16,
    },
  });