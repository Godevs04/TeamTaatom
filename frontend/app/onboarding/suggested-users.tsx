import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Platform, Dimensions } from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSuggestedUsers, completeProfileOnboarding } from '../../services/profile';
import { getCurrentUser, markProfileOnboardingCompletedLocally } from '../../services/auth';
import { UserSkeleton } from '../../components/LoadingSkeleton';
import { trackScreenView, trackEngagement, trackFeatureUsage, trackDropOff } from '../../services/analytics';
import { theme } from '../../constants/theme';
import logger from '../../utils/logger';
import { useAlert } from '../../context/AlertContext';
import FollowButton, { FollowState } from '../../components/ui/FollowButton';

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
  profileVisibility?: 'public' | 'followers' | 'private';
  followRequestSent?: boolean;
  isFollowing?: boolean;
}

export default function SuggestedUsersOnboarding() {
  const router = useRouter();
  const { theme } = useTheme();
  const { showError } = useAlert();
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [followStates, setFollowStates] = useState<Record<string, FollowState>>({});
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
        profileVisibility: user.profileVisibility || user.settings?.privacy?.profileVisibility || 'public',
        followRequestSent: !!user.followRequestSent,
        isFollowing: !!user.isFollowing,
      }));
      setSuggestedUsers(users);
      const initial: Record<string, FollowState> = {};
      for (const user of users) {
        initial[user._id] = user.isFollowing
          ? 'FOLLOWING'
          : user.followRequestSent
            ? 'REQUESTED'
            : 'NOT_FOLLOWING';
      }
      setFollowStates(initial);
    } catch (error: any) {
      logger.error('Error fetching suggested users:', error);
      // Continue with empty list - user can still complete onboarding
      setSuggestedUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      const version = await completeProfileOnboarding();
      await markProfileOnboardingCompletedLocally(version);
      await getCurrentUser().catch(() => null);
      await AsyncStorage.setItem('onboarding_completed', 'true');

      trackFeatureUsage('onboarding_completed', {
        users_followed: Object.values(followStates).filter((s) => s === 'FOLLOWING' || s === 'REQUESTED').length,
        skipped: false,
      });

      router.replace('/(tabs)/home');
    } catch (e: unknown) {
      logger.error('Error completing profile onboarding:', e);
      const message =
        e instanceof Error
          ? e.message
          : 'Could not complete onboarding. Please check your connection and try again.';
      showError(message);
    } finally {
      setIsCompleting(false);
    }
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
              const visibility = user.profileVisibility || 'public';
              const isPrivate = visibility === 'private' || visibility === 'followers';
              return (
                <View
                  key={user._id}
                  style={[styles.userCard, { backgroundColor: theme.colors.card }]}
                >
                  {user.profilePicture ? (
                    <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="person" size={28} color={theme.colors.textSecondary} />
                    </View>
                  )}
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
                  <FollowButton
                    userId={user._id}
                    initialState={followStates[user._id] || 'NOT_FOLLOWING'}
                    isPrivate={isPrivate}
                    size="small"
                    onToggle={(state) => {
                      setFollowStates((prev) => ({ ...prev, [user._id]: state }));
                      trackEngagement(
                        state === 'NOT_FOLLOWING' ? 'unfollow' : 'follow',
                        'user',
                        user._id,
                        { context: 'onboarding', followState: state }
                      );
                    }}
                  />
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
            colors={['#50C878', '#1C73B4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {isCompleting ? (
              <LoadingGlobe color="#FFFFFF" />
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
    fontSize: isTablet ? theme.typography.h1.fontSize + 10 : 26,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
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
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...(isWeb && {
      cursor: 'pointer',
      ['transition']: 'all 0.2s ease',
    } as any),
  },
  followButtonAndroid: {
    overflow: 'hidden',
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
    fontSize: 15,
    fontWeight: '600',
  },
});

