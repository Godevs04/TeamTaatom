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

  const renderItem = ({ item }: { item: UserType & { isFollowing?: boolean } }) => (
    <View style={styles(theme).row}>
      <TouchableOpacity style={styles(theme).avatarWrap} onPress={() => router.push(`/profile/${item._id}`)}>
        <Image source={item.profilePic ? { uri: item.profilePic } : require('../assets/avatars/male_avatar.png')} style={styles(theme).avatar} />
      </TouchableOpacity>
      <TouchableOpacity style={styles(theme).nameWrap} onPress={() => router.push(`/profile/${item._id}`)}>
        <Text style={styles(theme).name}>{item.fullName}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles(theme).chatBtn} onPress={() => router.push(`/chat?userId=${item._id}`)}>
        <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.colors.primary} />
      </TouchableOpacity>
      {item._id !== userId && (
        <TouchableOpacity
          style={[styles(theme).followBtn, item.isFollowing ? styles(theme).following : styles(theme).notFollowing]}
          onPress={() => handleToggleFollow(item._id)}
          disabled={followLoading === item._id}
        >
          <Text style={styles(theme).followBtnText}>
            {item.isFollowing ? 'Unfollow' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return <ActivityIndicator style={{ marginVertical: 16 }} color={theme.colors.primary} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.surface }}>
        <View style={styles(theme).header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack?.()) {
                router.back();
              } else {
                router.replace('/profile');
              }
            }}
            style={styles(theme).backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles(theme).headerTitle}>{type === 'followers' ? 'Followers' : 'Following'}</Text>
          <View style={{ width: 34 }} />
        </View>
      </SafeAreaView>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item, index) => `${item._id}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.textSecondary, textAlign: 'center', marginTop: 48 }}>No users found.</Text>}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}
    </View>
  );
}

const styles = (theme: any) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    minHeight: 48,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarWrap: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.background,
  },
  nameWrap: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '600',
  },
  chatBtn: {
    marginHorizontal: 8,
  },
  followBtn: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  following: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  notFollowing: {
    backgroundColor: theme.colors.primary,
  },
});
