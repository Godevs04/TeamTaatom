import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { UserType } from '../types/user';
import { toggleFollow } from '../services/profile';
import api from '../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';

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
        ? `/profile/${userId}/followers?page=${pageToFetch}&limit=${limit}`
        : `/profile/${userId}/following?page=${pageToFetch}&limit=${limit}`;
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
    } catch (err) {
      Alert.alert('Error', 'Failed to load list');
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
    try {
      await toggleFollow(targetId);
      setUsers(prev => prev.map(u => u._id === targetId ? { ...u, isFollowing: !u.isFollowing } : u));
    } catch (err: any) {
      // Don't log conflict errors (follow request already pending) as they are expected
      if (!err.isConflict && err.response?.status !== 409) {
        console.error('Error following/unfollowing user:', err);
      }
      
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update follow status';
      
      // Check if it's a follow request already pending message or conflict error
      if (errorMessage.includes('Follow request already pending') || errorMessage.includes('Request already sent') || err.isConflict) {
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
  },
  safeArea: {
    backgroundColor: theme.colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: 0.3,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flex: 1,
  },
  cardContainer: {
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 14,
    ...theme.shadows.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  followingBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  followingLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
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
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    ...theme.shadows.small,
  },
  followButtonFollowing: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  followButtonLoading: {
    opacity: 0.7,
  },
  followButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
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
    paddingHorizontal: 48,
    paddingTop: 100,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  emptyMessage: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.2,
  },
});
