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

  useEffect(() => {
    const fetchList = async () => {
      setLoading(true);
      try {
        const endpoint = type === 'followers'
          ? `/profile/${userId}/followers`
          : `/profile/${userId}/following`;
        const response = await api.get(endpoint);
        setUsers(response.data.users || []);
      } catch (err) {
        Alert.alert('Error', 'Failed to load list');
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [userId, type]);

  const handleToggleFollow = async (targetId: string) => {
    setFollowLoading(targetId);
    try {
      await toggleFollow(targetId);
      setUsers(prev => prev.map(u => u._id === targetId ? { ...u, isFollowing: !u.isFollowing } : u));
    } catch (err) {
      Alert.alert('Error', 'Failed to update follow status');
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
      <TouchableOpacity
        style={[styles(theme).followBtn, item.isFollowing ? styles(theme).following : styles(theme).notFollowing]}
        onPress={() => handleToggleFollow(item._id)}
        disabled={followLoading === item._id}
      >
        <Text style={styles(theme).followBtnText}>
          {item.isFollowing ? 'Unfollow' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </View>
  );

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
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={<Text style={{ color: theme.colors.textSecondary, textAlign: 'center', marginTop: 48 }}>No users found.</Text>}
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
