import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import NavBar from '../../components/NavBar';
import { getUserFromStorage, signOut } from '../../services/auth';
import { getProfile } from '../../services/profile';
import { getUserPosts, getShorts, getUserShorts, getPostById } from '../../services/posts';
import { savedEvents } from '../../utils/savedEvents';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUnreadCount } from '../../services/notifications';
import { UserType } from '../../types/user';
import { PostType } from '../../types/post';
import EditProfile from '../../components/EditProfile';
import RotatingGlobe from '../../components/RotatingGlobe';
import BioDisplay from '../../components/BioDisplay';
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
  const [checkingUser, setCheckingUser] = useState(true); // new state
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  const { showError, showSuccess, showConfirm } = useAlert();

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await getUnreadCount();
      setUnreadCount(response.unreadCount);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  }, []);

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
      // Load user shorts (filter by owner)
      try {
        const shortsResp = await getUserShorts(userData._id, 1, 100);
        setUserShorts(shortsResp.shorts || []);
      } catch {}
      // Load saved ids from AsyncStorage (set by Shorts page)
      try {
        const stored = await AsyncStorage.getItem('savedShorts');
        if (stored) setSavedIds(JSON.parse(stored));
      } catch {}
      // Load unread count
      await loadUnreadCount();
    } catch (error: any) {
      console.error('Failed to load profile:', error);
      showError('Failed to load profile data');
    } finally {
      setLoading(false);
      setCheckingUser(false);
    }
  }, [router]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Listen to saved changes to refresh instantly
  useEffect(() => {
    const unsubscribe = savedEvents.addListener(async () => {
      try {
        const savedShorts = await AsyncStorage.getItem('savedShorts');
        const savedPosts = await AsyncStorage.getItem('savedPosts');
        const shortsArr = savedShorts ? JSON.parse(savedShorts) : [];
        const postsArr = savedPosts ? JSON.parse(savedPosts) : [];
        setSavedIds([...(Array.isArray(postsArr)?postsArr:[]), ...(Array.isArray(shortsArr)?shortsArr:[])]);
      } catch {}
    });
    return () => { unsubscribe(); };
  }, []);

  // Refresh saved IDs when switching to Saved tab
  useEffect(() => {
    const loadSaved = async () => {
      if (activeTab !== 'saved') return;
      try {
        const savedShorts = await AsyncStorage.getItem('savedShorts');
        const savedPosts = await AsyncStorage.getItem('savedPosts');
        const shortsArr = savedShorts ? JSON.parse(savedShorts) : [];
        const postsArr = savedPosts ? JSON.parse(savedPosts) : [];
        setSavedIds([...(Array.isArray(postsArr)?postsArr:[]), ...(Array.isArray(shortsArr)?shortsArr:[])]);
      } catch {}
    };
    loadSaved();
  }, [activeTab]);

  // Resolve saved IDs to full post/short objects (from any user)
  useEffect(() => {
    const resolveSaved = async () => {
      if (activeTab !== 'saved') return;
      if (!savedIds || savedIds.length === 0) {
        setSavedItems([]);
        return;
      }
      try {
        const uniqueIds = Array.from(new Set(savedIds));
        // Batch resolve in small chunks to avoid 429
        const chunkSize = 5;
        const chunks: string[][] = [];
        for (let i = 0; i < uniqueIds.length; i += chunkSize) {
          chunks.push(uniqueIds.slice(i, i + chunkSize));
        }
        const items: PostType[] = [];
        for (const chunk of chunks) {
          const results = await Promise.allSettled(chunk.map(id => getPostById(id)));
          results.forEach(r => {
            if (r.status === 'fulfilled') {
              const val: any = (r as any).value;
              const item = val.post || val;
              if (item) items.push(item);
            }
          });
          // brief delay between chunks
          await new Promise(res => setTimeout(res, 250));
        }
        setSavedItems(items);
      } catch (e) {
        console.error('Failed to load saved items:', e);
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
      // Only redirect after confirming user is missing
      router.replace('/(auth)/signin');
    }
  }, [checkingUser, user, router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserData();
    await loadUnreadCount();
    setRefreshing(false);
  }, [loadUserData, loadUnreadCount]);

  const handleSignOut = async () => {
    showConfirm(
      'Are you sure you want to sign out?',
      async () => {
        try {
          await signOut();
          router.replace('/(auth)/signin');
        } catch (error) {
          showError('Failed to sign out');
        }
      },
      'Sign Out',
      'Sign Out',
      'Cancel'
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
      {/* Header with Notification Button and Kebab Menu */}
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft} />
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => router.push('/notifications')}
            >
              <Ionicons
                name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
                size={24}
                color={theme.colors.text}
              />
              {unreadCount > 0 && (
                <View style={[styles.notificationBadge, { backgroundColor: theme.colors.error }]}>
                  <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
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
      </View>
      
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
            {profileData.email && (
              <Text style={[styles.email, { color: theme.colors.textSecondary }]}> 
                {profileData.email}
              </Text>
            )}
            <BioDisplay bio={profileData.bio || ''} />
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>{profileData?.postsCount || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Posts</Text>
            </View>
            <TouchableOpacity style={styles.statItem} onPress={() => router.push({ pathname: '/followers', params: { userId: profileData._id, type: 'followers' } })}>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>{profileData?.followersCount || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={() => router.push({ pathname: '/followers', params: { userId: profileData._id, type: 'following' } })}>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>{profileData?.followingCount || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Following</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.text }]}>{profileData?.totalLikes || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Likes</Text>
            </View>
          </View>
          <View style={[styles.mapContainer, { backgroundColor: theme.colors.surface }]}> 
            <Text style={[styles.sectionTitleTight, { color: theme.colors.text }]}>
              {profileData?.locations && profileData.locations.length > 0 ? 'Posted Locations' : 'My Location'}
            </Text>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <RotatingGlobe 
                locations={profileData?.locations || []} 
                size={110} 
              />
            </View>
          </View>

          {/* TripScore Section */}
          {profileData?.tripScore && (
            <TouchableOpacity 
              style={[styles.tripScoreContainerTight, { backgroundColor: theme.colors.surface }]}
              onPress={() => router.push(`/tripscore/continents?userId=${user?._id}`)}
            >
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>TripScore</Text>
              <View style={styles.tripScoreContent}>
                <View style={styles.tripScoreMain}>
                  <Text style={[styles.tripScoreNumber, { color: theme.colors.primary }]}>
                    {profileData.tripScore.totalScore}
                  </Text>
                  <Text style={[styles.tripScoreLabel, { color: theme.colors.textSecondary }]}>
                    Total TripScore
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>
        {/* End Profile Header */}

        {/* Posts/Shorts/Saved Tabs */}
        <View style={[styles.postsContainer, { backgroundColor: theme.colors.surface }]}> 
          <View style={[styles.tabsRow, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            {(['posts','shorts','saved'] as const).map(tab => (
              <TouchableOpacity 
                key={tab} 
                style={[
                  styles.tabButton, 
                  {
                    borderColor: activeTab===tab ? theme.colors.primary : theme.colors.border,
                    backgroundColor: activeTab===tab ? theme.colors.primary + '20' : 'transparent'
                  },
                ]} 
                onPress={() => setActiveTab(tab)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons 
                    name={tab==='posts' ? 'images-outline' : tab==='shorts' ? 'videocam-outline' : 'bookmark-outline'} 
                    size={14} 
                    color={activeTab===tab ? theme.colors.primary : theme.colors.textSecondary} 
                  />
                  <Text style={[styles.tabText, { color: activeTab===tab ? theme.colors.primary : theme.colors.textSecondary }]}>
                    {tab === 'posts' ? 'Posts' : tab === 'shorts' ? 'Shorts' : 'Saved'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ marginTop: 12 }}>
            {activeTab === 'posts' && (
              posts.length > 0 ? (
                <View style={styles.postsGrid}>
                  {posts.map((post) => (
                    <View key={post._id} style={styles.postThumbnail}>
                      <Image source={{ uri: post.imageUrl }} style={styles.thumbnailImage} />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.noPostsContainer}>
                  <Ionicons name="camera-outline" size={48} color={theme.colors.textSecondary} />
                  <Text style={[styles.noPostsText, { color: theme.colors.textSecondary }]}>No posts yet</Text>
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
                        <View key={s._id} style={styles.postThumbnail} />
                      );
                    }
                    return (
                      <View key={s._id} style={styles.postThumbnail}>
                        <Image source={{ uri }} style={styles.thumbnailImage} />
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.noPostsContainer}>
                  <Ionicons name="videocam-outline" size={48} color={theme.colors.textSecondary} />
                  <Text style={[styles.noPostsText, { color: theme.colors.textSecondary }]}>No shorts yet</Text>
                </View>
              )
            )}
            {activeTab === 'saved' && (
              savedItems.length > 0 ? (
                <View style={styles.postsGrid}>
                  {savedItems.map((item) => (
                    <View key={item._id} style={styles.postThumbnail}>
                      <Image source={{ uri: (item as any).imageUrl || (item as any).thumbnailUrl || (item as any).mediaUrl }} style={styles.thumbnailImage} />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.noPostsContainer}>
                  <Ionicons name="bookmark-outline" size={48} color={theme.colors.textSecondary} />
                  <Text style={[styles.noPostsText, { color: theme.colors.textSecondary }]}>No saved items</Text>
                </View>
              )
            )}
          </View>
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
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  notificationButton: {
    padding: 10,
    borderRadius: 22,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
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
      marginHorizontal: 12,
      marginTop: 12,
      marginBottom: 8,
      padding: 16,
      borderRadius: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 16,
      textAlign: 'center',
    },
    sectionTitleTight: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 5,
      textAlign: 'left',
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
    tabsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
      borderRadius: 12,
      padding: 6,
      borderWidth: 1,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
    },
    tabButtonActive: {
      backgroundColor: 'transparent',
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
    },
    postThumbnail: {
      width: '31%',
      aspectRatio: 1,
      marginBottom: 10,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: 'rgba(0,0,0,0.05)'
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
    // TripScore Styles
    tripScoreContainerTight: {
      marginHorizontal: 12,
      marginTop: 8,
      marginBottom: 12,
      padding: 16,
      borderRadius: 12,
    },
    tripScoreContent: {
      alignItems: 'center',
    },
    tripScoreMain: {
      alignItems: 'center',
    },
    tripScoreNumber: {
      fontSize: 48,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    tripScoreLabel: {
      fontSize: 16,
      fontWeight: '500',
    },
  });