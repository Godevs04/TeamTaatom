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
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const loadUserData = useCallback(async () => {
    try {
      const userData = await getUserFromStorage();
      if (!userData) {
        router.replace('/(auth)/signin');
        return;
      }
      setUser(userData);

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
    }
  }, [router]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

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

  if (loading) {
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
          <TouchableOpacity onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>
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
              source={{
                uri: profileData.profilePic || 'https://via.placeholder.com/80'
              }}
              style={styles.avatar}
            />
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {profileData.fullName}
            </Text>
            <Text style={[styles.email, { color: theme.colors.textSecondary }]}>
              {profileData.email}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                {profileData.postsCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Posts
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                {profileData.followersCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Followers
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                {profileData.followingCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Following
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                {profileData.totalLikes}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Likes
              </Text>
            </View>
          </View>
        </View>

        {/* Location Map Placeholder */}
        {profileData.locations.length > 0 && (
          <View style={[styles.mapContainer, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Posted Locations
            </Text>
            <View style={[styles.mapPlaceholder, { backgroundColor: theme.colors.surfaceSecondary }]}>
              <Ionicons name="map" size={48} color={theme.colors.primary} />
              <Text style={[styles.mapText, { color: theme.colors.textSecondary }]}>
                {profileData.locations.length} locations visited
              </Text>
            </View>
          </View>
        )}

        {/* Recent Posts */}
        <View style={[styles.postsContainer, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Recent Posts
          </Text>
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
              <Text style={[styles.noPostsText, { color: theme.colors.textSecondary }]}>
                No posts yet
              </Text>
            </View>
          )}
        </View>

        {/* Settings */}
        <View style={[styles.settingsContainer, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Settings
          </Text>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={toggleTheme}
          >
            <Ionicons 
              name="moon-outline" 
              size={24} 
              color={theme.colors.text} 
            />
            <Text style={[styles.settingText, { color: theme.colors.text }]}>
              Toggle Theme
            </Text>
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={theme.colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>
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