import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Alert, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { UserType } from '../types/user';
import { toggleFollow } from '../services/profile';
import api from '../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { parseError } from '../utils/errorCodes';

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

export default function FollowersFollowingList() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.userId as string;
  const type = params.type as 'followers' | 'following';
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 20;

  useEffect(() => {
    setUsers([]);
    setPage(1);
    setHasNextPage(true);
    setLoading(true);
    fetchList(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, type]);

  const fetchList = async (pageToFetch = 1, replace = false) => {
    if (!hasNextPage && !replace) return;
    if (pageToFetch > 1) setLoadingMore(true);
    try {
      const endpoint = type === 'followers'
        ? `/api/v1/profile/${userId}/followers?page=${pageToFetch}&limit=${limit}`
        : `/api/v1/profile/${userId}/following?page=${pageToFetch}&limit=${limit}`;
      const response = await api.get(endpoint);
      const newUsers = response.data.users || [];
      
      // Remove duplicates based on _id
      const uniqueNewUsers = newUsers.filter((user: UserType, index: number, self: UserType[]) => 
        index === self.findIndex((u: UserType) => u._id === user._id)
      );
      
      if (replace) {
        setUsers(uniqueNewUsers);
      } else {
        setUsers(prev => {
          // Combine existing users with new users and remove duplicates
          const combined = [...prev, ...uniqueNewUsers];
          return combined.filter((user: UserType, index: number, self: UserType[]) => 
            index === self.findIndex((u: UserType) => u._id === user._id)
          );
        });
      }
      
      setHasNextPage(response.data.pagination?.hasNextPage ?? false);
      setPage(pageToFetch);
    } catch (err: any) {
      const parsedError = parseError(err);
      Alert.alert('Error', parsedError.userMessage || 'Failed to load list');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasNextPage && !loading) {
      fetchList(page + 1);
    }
  };

  const handleToggleFollow = async (targetId: string) => {
    // Prevent self-following
    if (targetId === userId) {
      Alert.alert('Error', 'You cannot follow yourself');
      return;
    }
    
    setFollowLoading(targetId);
    
    // Store previous state for rollback on error
    const previousState = users.find(u => u._id === targetId);
    const previousFollowing = previousState?.isFollowing ?? false;
    
    // Optimistic update
    setUsers(prev => prev.map(u => 
      u._id === targetId 
        ? { ...u, isFollowing: !u.isFollowing } 
        : u
    ));
    
    try {
      // Call API and use the response
      const response = await toggleFollow(targetId);
      
      // Extract values from response
      const isFollowingValue = Boolean(response.isFollowing);
      const followRequestSentValue = Boolean(response.followRequestSent);
      
      // Update state with actual API response (source of truth)
      setUsers(prev => prev.map(u => {
        if (u._id === targetId) {
          return {
            ...u,
            isFollowing: isFollowingValue,
            // Update followersCount if provided (for the profile owner)
            ...(response.followersCount !== undefined && { followersCount: response.followersCount })
          };
        }
        return u;
      }));
      
      // Show success message based on response
      if (isFollowingValue) {
        Alert.alert('Success', 'You are now following this user!');
      } else if (followRequestSentValue) {
        Alert.alert('Success', 'Follow request sent!');
      } else {
        Alert.alert('Success', 'You have unfollowed this user.');
      }
      
      // Refresh the list to ensure consistency
      // Only refresh if we're viewing someone's followers/following (not our own)
      if (userId && userId !== targetId) {
        setTimeout(() => {
          fetchList(page, true);
        }, 300);
      }
    } catch (err: any) {
      // Revert optimistic update on error
      setUsers(prev => prev.map(u => 
        u._id === targetId 
          ? { ...u, isFollowing: previousFollowing } 
          : u
      ));
      
      // Don't log conflict errors (follow request already pending) as they are expected
      if (!err.isConflict && err.response?.status !== 409) {
        console.error('Error following/unfollowing user:', err);
      }
      
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update follow status';
      
      // Check if it's a follow request already pending message or conflict error
      if (errorMessage.includes('Follow request already pending') || errorMessage.includes('Request already sent') || err.isConflict) {
        // Update state to show request sent
        setUsers(prev => prev.map(u => 
          u._id === targetId 
            ? { ...u, isFollowing: false } // Not following yet, but request sent
            : u
        ));
        Alert.alert('Follow Request Pending', errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setFollowLoading(null);
    }
  };

  const renderItem = ({ item }: { item: UserType & { isFollowing?: boolean } }) => {
    const isFollowing = item.isFollowing ?? false;
    const isLoading = followLoading === item._id;
    
    return (
      <View style={styles(theme).cardContainer}>
        <TouchableOpacity 
          style={styles(theme).card}
          onPress={() => router.push(`/profile/${item._id}`)}
          activeOpacity={0.7}
        >
          {/* Avatar Container */}
          <View style={styles(theme).avatarContainer}>
            <Image 
              source={item.profilePic ? { uri: item.profilePic } : require('../assets/avatars/male_avatar.png')} 
              style={styles(theme).avatar} 
            />
            {isFollowing && (
              <View style={styles(theme).followingBadge}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
              </View>
            )}
          </View>
          
          {/* User Info */}
          <View style={styles(theme).userInfo}>
            <Text style={styles(theme).name} numberOfLines={1}>
              {item.fullName}
            </Text>
            {isFollowing && (
              <Text style={styles(theme).followingLabel}>Following</Text>
            )}
          </View>
          
          {/* Action Buttons */}
          <View style={styles(theme).actionButtons}>
            <TouchableOpacity
              style={[styles(theme).iconButton, { marginRight: 8 }]}
              onPress={() => router.push(`/chat?userId=${item._id}`)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons 
                name="chatbubble-ellipses-outline" 
                size={22} 
                color={theme.colors.primary} 
              />
            </TouchableOpacity>
            
            {item._id !== userId && (
              <TouchableOpacity
                style={[
                  styles(theme).followButton,
                  isFollowing && styles(theme).followButtonFollowing,
                  isLoading && styles(theme).followButtonLoading
                ]}
                onPress={() => handleToggleFollow(item._id)}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator 
                    size="small" 
                    color={isFollowing ? theme.colors.primary : '#FFFFFF'} 
                  />
                ) : (
                  <Text style={[
                    styles(theme).followButtonText,
                    isFollowing && styles(theme).followButtonTextFollowing
                  ]}>
                    {isFollowing ? 'Unfollow' : 'Follow'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles(theme).footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles(theme).emptyContainer}>
      <View style={styles(theme).emptyIconContainer}>
        <Ionicons 
          name={type === 'followers' ? 'people-outline' : 'person-add-outline'} 
          size={64} 
          color={theme.colors.textSecondary} 
        />
      </View>
      <Text style={styles(theme).emptyTitle}>
        No {type === 'followers' ? 'Followers' : 'Following'} Yet
      </Text>
      <Text style={styles(theme).emptyMessage}>
        {type === 'followers' 
          ? 'When someone follows you, they\'ll appear here.' 
          : 'Start following people to see them here.'}
      </Text>
    </View>
  );

  return (
    <View style={styles(theme).container}>
      <SafeAreaView edges={['top']} style={styles(theme).safeArea}>
        {/* Header */}
        <View style={styles(theme).header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack?.()) {
                router.back();
              } else {
                router.replace('/profile');
              }
            }}
            style={styles(theme).backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles(theme).headerTitle}>
            {type === 'followers' ? 'Followers' : 'Following'}
          </Text>
          <View style={styles(theme).headerSpacer} />
        </View>
      </SafeAreaView>

      {/* Content */}
      {loading ? (
        <View style={styles(theme).loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item, index) => `${item._id}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={[
            styles(theme).listContent,
            users.length === 0 && styles(theme).listContentEmpty
          ]}
          ListEmptyComponent={renderEmptyState}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    ...(isWeb && {
      maxWidth: isTablet ? 1000 : 800,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  safeArea: {
    backgroundColor: theme.colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  backButton: {
    // Minimum touch target: 44x44 for iOS, 48x48 for Android
    minWidth: isAndroid ? 48 : (isTablet ? 48 : 44),
    minHeight: isAndroid ? 48 : (isTablet ? 48 : 44),
    width: isTablet ? 48 : (isAndroid ? 48 : 44),
    height: isTablet ? 48 : (isAndroid ? 48 : 44),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: isTablet ? 24 : (isAndroid ? 24 : 22),
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: isTablet ? 24 : 20,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: isIOS ? 0.3 : 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  headerSpacer: {
    width: isTablet ? 48 : 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  listContent: {
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
    paddingBottom: isTablet ? 40 : 32,
  },
  listContentEmpty: {
    flex: 1,
  },
  cardContainer: {
    marginBottom: isTablet ? theme.spacing.md : 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: isTablet ? theme.borderRadius.lg : 16,
    padding: isTablet ? theme.spacing.lg : 14,
    ...theme.shadows.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: isTablet ? theme.spacing.md : 14,
  },
  avatar: {
    width: isTablet ? 70 : 56,
    height: isTablet ? 70 : 56,
    borderRadius: isTablet ? 35 : 28,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  followingBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: theme.colors.surface,
    borderRadius: isTablet ? 14 : 12,
    width: isTablet ? 28 : 24,
    height: isTablet ? 28 : 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  userInfo: {
    flex: 1,
    marginRight: isTablet ? theme.spacing.md : 12,
  },
  name: {
    fontSize: isTablet ? theme.typography.body.fontSize + 3 : 17,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
    letterSpacing: 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  followingLabel: {
    fontSize: isTablet ? theme.typography.body.fontSize : 13,
    fontFamily: getFontFamily('500'),
    color: theme.colors.textSecondary,
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  followButton: {
    borderRadius: isTablet ? 24 : 20,
    paddingHorizontal: isTablet ? 24 : 20,
    paddingVertical: isTablet ? 12 : 10,
    minWidth: isTablet ? 110 : 90,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    ...theme.shadows.small,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  followButtonFollowing: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  followButtonLoading: {
    opacity: 0.7,
    ...(isWeb && {
      cursor: 'not-allowed',
    } as any),
  },
  followButtonText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  followButtonTextFollowing: {
    color: theme.colors.primary,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xxl : 48,
    paddingTop: isTablet ? 120 : 100,
  },
  emptyIconContainer: {
    width: isTablet ? 160 : 120,
    height: isTablet ? 160 : 120,
    borderRadius: isTablet ? 80 : 60,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: isTablet ? theme.spacing.xl : 24,
  },
  emptyTitle: {
    fontSize: isTablet ? theme.typography.h1.fontSize : 22,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: isTablet ? theme.spacing.md : 12,
    textAlign: 'center',
    letterSpacing: isIOS ? 0.3 : 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  emptyMessage: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('400'),
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: isTablet ? 26 : 24,
    letterSpacing: 0.2,
    maxWidth: isTablet ? 500 : 300,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});
