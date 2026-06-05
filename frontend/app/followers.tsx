import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Alert, Platform, Dimensions } from 'react-native';
import LoadingGlobe from '../components/LoadingGlobe';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { UserType } from '../types/user';
import { toggleFollow } from '../services/profile';
import api from '../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import NavBar from '../components/NavBar';
import { theme } from '../constants/theme';
import { parseError } from '../utils/errorCodes';
import logger from '../utils/logger';
import FollowButton from '../components/ui/FollowButton';

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
  const type = (params.type as 'followers' | 'following') || 'followers';
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 20;

  // Validate params and redirect if missing
  useEffect(() => {
    if (!userId) {
      logger.warn('Followers page: userId missing, redirecting to profile');
      router.replace('/(tabs)/profile');
      return;
    }
  }, [userId, router]);

  useEffect(() => {
    if (!userId) return;
    
    setUsers([]);
    setPage(1);
    setHasNextPage(true);
    setLoading(true);
    fetchList(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, type]);

  const fetchList = async (pageToFetch = 1, replace = false) => {
    if (!userId) {
      logger.warn('fetchList: userId is missing');
      setLoading(false);
      return;
    }
    
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


  const renderItem = ({ item }: { item: UserType & { isFollowing?: boolean; followRequestSent?: boolean } }) => {
    const isFollowing = item.isFollowing ?? false;
    const isRequested = !isFollowing && (item.followRequestSent ?? false);

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
            {isRequested && (
              <Text style={styles(theme).followingLabel}>Request Sent</Text>
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
              <FollowButton 
                userId={item._id} 
                initialIsFollowing={isFollowing} 
                onToggle={(newFollowState) => {
                  setUsers(prev => prev.map(u => 
                    u._id === item._id 
                      ? { ...u, isFollowing: newFollowState === 'FOLLOWING', followRequestSent: newFollowState === 'REQUESTED' } 
                      : u
                  ));
                }}
              />
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
        <LoadingGlobe size="small" color={theme.colors.primary} />
      </View>
    );
  };

  const renderEmptyState = () => null;

  return (
    <View style={styles(theme).container}>
      <NavBar
        title={type === 'followers' ? 'Followers' : 'Following'}
        showBack={true}
        onBack={() => {
          if (router.canGoBack?.()) {
            router.back();
          } else {
            router.replace('/profile');
          }
        }}
      />

      {/* Content */}
      {loading ? (
        <View style={styles(theme).loadingContainer}>
          <LoadingGlobe size="large" color={theme.colors.primary} />
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
    fontSize: isTablet ? 22 : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
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
    fontSize: isTablet ? theme.typography.body.fontSize + 3 : 16,
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
    fontSize: isTablet ? theme.typography.h1.fontSize : 20,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
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
