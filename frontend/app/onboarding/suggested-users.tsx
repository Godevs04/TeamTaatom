import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import { UserSkeleton } from '../../components/LoadingSkeleton';
import { trackScreenView, trackEngagement, trackFeatureUsage, trackDropOff } from '../../services/analytics';

interface SuggestedUser {
  _id: string;
  username: string;
  fullName: string;
  profilePicture?: string;
  bio?: string;
  followersCount?: number;
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
      const response = await api.get('/profile/suggested-users?limit=6');
      setSuggestedUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching suggested users:', error);
      // Continue with empty list
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
      await api.post(`/profile/${userId}/follow`);
      
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
                      {user.username}
                    </Text>
                    <Text style={[styles.fullName, { color: theme.colors.textSecondary }]}>
                      {user.fullName}
                    </Text>
                    {user.followersCount !== undefined && (
                      <Text style={[styles.followers, { color: theme.colors.textSecondary }]}>
                        {user.followersCount} followers
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
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  loadingContainer: {
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
  },
  usersList: {
    gap: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  fullName: {
    fontSize: 14,
    marginBottom: 2,
  },
  followers: {
    fontSize: 12,
  },
  followButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: 24,
    gap: 12,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  continueButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 16,
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

