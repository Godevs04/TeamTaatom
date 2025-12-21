import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSuggestedUsers, toggleFollow as toggleFollowService } from '../../services/profile';
import { UserSkeleton } from '../../components/LoadingSkeleton';
import { trackScreenView, trackEngagement, trackFeatureUsage, trackDropOff } from '../../services/analytics';
import { theme } from '../../constants/theme';

// Responsive dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Elegant font families
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

interface SuggestedUser {
  _id: string;
  username?: string;
  fullName?: string;
  profilePic?: string;
  profilePicture?: string;
  bio?: string;
  followersCount?: number;
  postsCount?: number;
}

export default function SuggestedUsersOnboarding() {
  const router = useRouter();
  const { theme } = useTheme();
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    fetchSuggestedUsers();
  }, []);

  const fetchSuggestedUsers = async () => {
    try {
      setIsLoading(true);
      const response = await getSuggestedUsers(6);
      // Response structure: { users: [...], pagination: {...} }
      const users = (response.users || []).map((user: any) => ({
        _id: user._id,
        username: user.username || '',
        fullName: user.fullName || '',
        profilePic: user.profilePic,
        profilePicture: user.profilePic || user.profilePicture,
        bio: user.bio,
        followersCount: user.followersCount || 0,
        postsCount: user.postsCount || 0,
      }));
      setSuggestedUsers(users);
    } catch (error: any) {
      console.error('Error fetching suggested users:', error);
      // Continue with empty list - user can still complete onboarding
      setSuggestedUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFollow = async (userId: string) => {
    const isFollowing = following.has(userId);
    const newFollowing = new Set(following);
    
    // Optimistic update
    if (isFollowing) {
      newFollowing.delete(userId);
    } else {
      newFollowing.add(userId);
    }
    setFollowing(newFollowing);

    try {
      await toggleFollowService(userId);
      
      // Track engagement
      trackEngagement(isFollowing ? 'unfollow' : 'follow', 'user', userId, {
        context: 'onboarding',
      });
    } catch (error) {
      // Revert on error
      setFollowing(following);
      console.error('Error toggling follow:', error);
    }
  };

  const handleContinue = async () => {
    setIsCompleting(true);
    await AsyncStorage.setItem('onboarding_completed', 'true');
    
    // Track onboarding completion
    trackFeatureUsage('onboarding_completed', {
      users_followed: following.size,
      skipped: false,
    });
    
    router.replace('/(tabs)/home');
  };

  const handleSkip = () => {
    trackDropOff('onboarding_suggested_users', { step: 'suggested_users', action: 'skip' });
    handleContinue();
  };
  
  React.useEffect(() => {
    trackScreenView('onboarding_suggested_users');
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Follow People You Know
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Discover amazing content from travelers around the world
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            {[1, 2, 3].map(i => (
              <UserSkeleton key={i} />
            ))}
          </View>
        ) : suggestedUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No suggestions available
            </Text>
          </View>
        ) : (
          <View style={styles.usersList}>
            {suggestedUsers.map(user => {
              const isFollowingUser = following.has(user._id);
              return (
                <View
                  key={user._id}
                  style={[styles.userCard, { backgroundColor: theme.colors.card }]}
                >
                  <Image
                    source={{
                      uri: user.profilePicture || 'https://via.placeholder.com/60',
                    }}
                    style={styles.avatar}
                  />
                  <View style={styles.userInfo}>
                    <Text style={[styles.username, { color: theme.colors.text }]}>
                      {user.username || 'User'}
                    </Text>
                    {user.fullName && (
                      <Text style={[styles.fullName, { color: theme.colors.textSecondary }]}>
                        {user.fullName}
                      </Text>
                    )}
                    {user.followersCount !== undefined && user.followersCount > 0 && (
                      <Text style={[styles.followers, { color: theme.colors.textSecondary }]}>
                        {user.followersCount} {user.followersCount === 1 ? 'follower' : 'followers'}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => toggleFollow(user._id)}
                    style={[
                      styles.followButton,
                      {
                        backgroundColor: isFollowingUser
                          ? theme.colors.border
                          : theme.colors.primary,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.followButtonText,
                        { color: isFollowingUser ? theme.colors.text : '#FFFFFF' },
                      ]}
                    >
                      {isFollowingUser ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipButton}
        >
          <Text style={[styles.skipText, { color: theme.colors.textSecondary }]}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleContinue}
          disabled={isCompleting}
          style={styles.continueButton}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primary + 'DD']}
            style={styles.gradient}
          >
            {isCompleting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.continueButtonText}>Complete Setup</Text>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isTablet ? 1000 : 800,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  scrollContent: {
    padding: isTablet ? theme.spacing.xxl : 24,
    ...(isWeb && {
      minHeight: '100vh',
    } as any),
  },
  header: {
    marginBottom: isTablet ? theme.spacing.xl : 24,
  },
  title: {
    fontSize: isTablet ? theme.typography.h1.fontSize + 10 : 28,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginBottom: isTablet ? theme.spacing.sm : 8,
    letterSpacing: isIOS ? -0.5 : 0,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  subtitle: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  loadingContainer: {
    gap: isTablet ? theme.spacing.md : 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isTablet ? theme.spacing.xxl : 48,
  },
  emptyText: {
    marginTop: isTablet ? theme.spacing.lg : 16,
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  usersList: {
    gap: isTablet ? theme.spacing.md : 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.lg : theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: isTablet ? theme.spacing.sm : 8,
  },
  avatar: {
    width: isTablet ? 80 : 60,
    height: isTablet ? 80 : 60,
    borderRadius: isTablet ? 40 : 30,
    marginRight: isTablet ? theme.spacing.md : 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  fullName: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    marginBottom: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  followers: {
    fontSize: isTablet ? theme.typography.small.fontSize + 1 : 12,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  followButton: {
    paddingVertical: isTablet ? theme.spacing.sm : 8,
    paddingHorizontal: isTablet ? 24 : 20,
    borderRadius: isTablet ? 24 : 20,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  followButtonText: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  footer: {
    padding: isTablet ? theme.spacing.xl : 24,
    gap: isTablet ? theme.spacing.md : 12,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: isTablet ? theme.spacing.md : 12,
    ...(isWeb && {
      cursor: 'pointer',
    } as any),
  },
  skipText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  continueButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: isTablet ? theme.spacing.lg : 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

