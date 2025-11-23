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
import { useMemo } from 'react';
import { trackScreenView, trackEngagement, trackFeatureUsage } from '../../services/analytics';

const logger = createLogger('ProfileScreen');

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
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  const { showError, showSuccess, showConfirm } = useAlert();

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await getUnreadCount();
      setUnreadCount(response.unreadCount);
    } catch (error) {
      logger.error('Failed to load unread count', error);
    }
  }, []);

  const loadUserData = useCallback(async () => {
    setCheckingUser(true);
    try {
      const userData = await getUserFromStorage();
      logger.debug('getUserFromStorage:', userData);
      if (!userData) {
        setCheckingUser(false);
        setLoading(false);
        return;
      }
      setUser(userData);
      setCheckingUser(false);
      const profile = await getProfile(userData._id);
      setProfileData(profile.profile);
      const userPosts = await getUserPosts(userData._id);
      setPosts(userPosts.posts);
      try {
        const shortsResp = await getUserShorts(userData._id, 1, 100);
        setUserShorts(shortsResp.shorts || []);
      } catch {}
      try {
        const stored = await AsyncStorage.getItem('savedShorts');
        if (stored) setSavedIds(JSON.parse(stored));
      } catch {}
      await loadUnreadCount();
    } catch (error: any) {
      logger.error('Failed to load profile', error);
      showError('Failed to load profile data');
    } finally {
      setLoading(false);
      setCheckingUser(false);
    }
  }, [router]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);
  
  // Track profile screen view with analytics
  useEffect(() => {
    if (user && profileData) {
      trackScreenView('profile', {
        userId: user._id,
        hasPosts: posts.length > 0,
        hasShorts: userShorts.length > 0,
        postsCount: profileData.postsCount || 0
      });
    }
  }, [user?._id, profileData?.postsCount, posts.length, userShorts.length]);

  useEffect(() => {
    const unsubscribe = savedEvents.addListener(async () => {
      try {
        const savedShorts = await AsyncStorage.getItem('savedShorts');
        const savedPosts = await AsyncStorage.getItem('savedPosts');
        const shortsArr = savedShorts ? JSON.parse(savedShorts) : [];
        const postsArr = savedPosts ? JSON.parse(savedPosts) : [];
        setSavedIds([...(Array.isArray(postsArr)?postsArr:[]), ...(Array.isArray(shortsArr)?shortsArr:[])]);
      } catch (error) {
        logger.error('Error loading saved items in listener', error);
      }
    });
    return () => { 
      unsubscribe(); 
    };
  }, []);

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

  useEffect(() => {
    const resolveSaved = async () => {
      if (activeTab !== 'saved') return;
      if (!savedIds || savedIds.length === 0) {
        setSavedItems([]);
        return;
      }
      try {
        const uniqueIds = Array.from(new Set(savedIds));
        const batchSize = 10; // Increased batch size for better performance
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
        
        const items: PostType[] = [];
        allResults.forEach(batchResults => {
          batchResults.forEach(r => {
            if (r.status === 'fulfilled') {
              const val: any = (r as any).value;
              const item = val.post || val;
              if (item) items.push(item);
            }
          });
        });
        
        setSavedItems(items);
      } catch (e) {
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
    triggerRefreshHaptic();
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
            <Text style={[styles.retryButtonText, { color: '#FFFFFF' }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ErrorBoundary level="route">
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      {/* Enhanced Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft} />
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.notificationButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => router.push('/notifications')}
            >
              <Ionicons
                name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
                size={22}
                color={theme.colors.text}
              />
              {unreadCount > 0 && (
                <View style={[styles.notificationBadge, { backgroundColor: theme.colors.error }]}>
                  <Text style={styles.badgeText}>
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
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
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
        {/* Profile Header - Screenshot Style */}
        <ExpoLinearGradient
          colors={['#E3F2FD', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.profileHeaderGradient}
        >
          <View style={styles.profileHeader}>
            {/* Profile Picture */}
            <View style={styles.profilePictureWrapper}>
              <View style={styles.profilePictureContainer}>
                <Image
                  source={profileData.profilePic ? { uri: profileData.profilePic } : require('../../assets/avatars/male_avatar.png')}
                  style={styles.profilePicture}
                />
              </View>
            </View>

            {/* Name */}
            <Text style={styles.profileName}>{profileData.fullName}</Text>
            
            {/* Member Since */}
            {profileData.createdAt && (
              <Text style={styles.memberSince}>
                Member since {new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
            )}

            {/* Stats Cards with Icons */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="flame" size={20} color="#FF6B35" />
                </View>
                <Text style={styles.statValue}>{profileData?.postsCount || 0}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <TouchableOpacity 
                style={styles.statCard}
                onPress={() => router.push({ pathname: '/followers', params: { userId: profileData._id, type: 'followers' } })}
                activeOpacity={0.7}
              >
                <View style={[styles.statIconContainer, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="trophy" size={20} color="#FF6B35" />
                </View>
                <Text style={styles.statValue}>{profileData?.followersCount || 0}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.statCard}
                onPress={() => router.push({ pathname: '/followers', params: { userId: profileData._id, type: 'following' } })}
                activeOpacity={0.7}
              >
                <View style={[styles.statIconContainer, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                </View>
                <Text style={styles.statValue}>{profileData?.followingCount || 0}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ExpoLinearGradient>

        {/* TripScore Section */}
        {profileData?.tripScore && profileData.locations && profileData.locations.length > 0 && (
          <TouchableOpacity 
            style={styles.sectionCard}
            onPress={() => router.push(`/tripscore/continents?userId=${user?._id}`)}
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
                  {profileData.tripScore?.totalScore || 0}
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
            <Text style={styles.sectionTitle}>
              {profileData?.locations && profileData.locations.length > 0 ? 'Posted Locations' : 'My Location'}
            </Text>
          </View>
          <View style={styles.globeContainer}>
            <RotatingGlobe 
              locations={profileData?.locations || []} 
              size={120} 
            />
          </View>
        </View>

        {/* Collections Section */}
        <TouchableOpacity 
          style={styles.sectionCard}
          onPress={() => router.push('/collections')}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="albums" size={22} color="#4CAF50" />
            </View>
            <View style={styles.sectionTextContainer}>
              <Text style={styles.sectionTitle}>Collections</Text>
              <Text style={styles.sectionDescription}>
                Organize your posts into collections
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999999" />
          </View>
        </TouchableOpacity>

        {/* Activity Feed Section */}
        <TouchableOpacity 
          style={styles.sectionCard}
          onPress={() => router.push('/activity')}
          activeOpacity={0.7}
        >
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="pulse" size={22} color="#FF6B35" />
            </View>
            <View style={styles.sectionTextContainer}>
              <Text style={styles.sectionTitle}>Activity Feed</Text>
              <Text style={styles.sectionDescription}>
                See what your friends are up to
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999999" />
          </View>
        </TouchableOpacity>

        {/* Posts/Shorts/Saved Tabs */}
        <View style={styles.postsContainer}> 
          <View style={styles.tabsRow}>
            {(['posts','shorts','saved'] as const).map(tab => (
              <TouchableOpacity 
                key={tab} 
                style={[
                  styles.tabButton, 
                  activeTab===tab && styles.activeTabButton
                ]} 
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons 
                    name={tab==='posts' ? 'images-outline' : tab==='shorts' ? 'videocam-outline' : 'bookmark-outline'} 
                    size={18} 
                    color={activeTab===tab ? '#FFFFFF' : '#666666'} 
                  />
                  <Text style={[
                    styles.tabText, 
                    { color: activeTab===tab ? '#FFFFFF' : '#666666' }
                  ]}>
                    {tab === 'posts' ? 'Posts' : tab === 'shorts' ? 'Shorts' : 'Saved'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.contentArea}>
            {activeTab === 'posts' && (
              posts.length > 0 ? (
                <View style={styles.postsGrid}>
                  {posts.map((post) => (
                    <TouchableOpacity 
                      key={post._id} 
                      style={styles.postThumbnail}
                      onLongPress={() => handleDeletePost(post._id, false)}
                      onPress={() => router.push(`/post/${post._id}`)}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: post.imageUrl }} style={styles.thumbnailImage} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Ionicons name="camera-outline" size={48} color="#CCCCCC" />
                  </View>
                  <Text style={styles.emptyText}>No posts yet</Text>
                  <Text style={styles.emptySubtext}>Start sharing your adventures!</Text>
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
                        <TouchableOpacity 
                          key={s._id} 
                          style={styles.postThumbnail}
                          onLongPress={() => handleDeletePost(s._id, true)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.placeholderThumbnail}>
                            <Ionicons name="videocam-outline" size={32} color={theme.colors.textSecondary} />
                          </View>
                        </TouchableOpacity>
                      );
                    }
                    return (
                      <TouchableOpacity 
                        key={s._id} 
                        style={styles.postThumbnail}
                        onLongPress={() => handleDeletePost(s._id, true)}
                        onPress={() => router.push(`/post/${s._id}`)}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri }} style={styles.thumbnailImage} />
                        <View style={styles.playIconOverlay}>
                          <Ionicons name="play" size={24} color="#FFFFFF" />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Ionicons name="videocam-outline" size={48} color="#CCCCCC" />
                  </View>
                  <Text style={styles.emptyText}>No shorts yet</Text>
                  <Text style={styles.emptySubtext}>Create your first short video!</Text>
                </View>
              )
            )}
            {activeTab === 'saved' && (
              savedItems.length > 0 ? (
                <View style={styles.postsGrid}>
                  {savedItems.map((item) => (
                    <TouchableOpacity 
                      key={item._id} 
                      style={styles.postThumbnail}
                      onPress={() => router.push(`/post/${item._id}`)}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: (item as any).imageUrl || (item as any).thumbnailUrl || (item as any).mediaUrl }} style={styles.thumbnailImage} />
                      <View style={styles.bookmarkOverlay}>
                        <Ionicons name="bookmark" size={16} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Ionicons name="bookmark-outline" size={48} color="#CCCCCC" />
                  </View>
                  <Text style={styles.emptyText}>No saved items</Text>
                  <Text style={styles.emptySubtext}>Save posts you love to view later</Text>
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
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
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
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
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
    color: '#FFFFFF',
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Profile Header - Screenshot Style
  profileHeaderGradient: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
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
    marginBottom: 8,
    textAlign: 'center',
  },
  memberSince: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  
  // Stats Row - Screenshot Style
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    gap: 8,
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
    backgroundColor: '#FFF3E0',
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
  sectionTextContainer: {
    flex: 1,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
    lineHeight: 18,
  },
  globeContainer: {
    alignItems: 'center',
    paddingVertical: 20,
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
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 12,
    padding: 4,
    backgroundColor: '#F5F5F5',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: '#0A84FF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
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
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  playIconOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
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
    fontSize: 18,
    fontWeight: '700',
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
