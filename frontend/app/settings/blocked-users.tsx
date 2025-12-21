import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { getBlockedUsers, unblockUser, BlockedUser } from '../../services/userManagement';
import { useAlert } from '../../context/AlertContext';
import { createLogger } from '../../utils/logger';
import { theme } from '../../constants/theme';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';

const getFontFamily = (weight: '400' | '500' | '600' | '700' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  return 'System';
};

const logger = createLogger('BlockedUsers');

export default function BlockedUsersScreen() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockingIds, setUnblockingIds] = useState<Set<string>>(new Set());
  
  const loadingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const router = useRouter();
  const { theme } = useTheme();
  const { showError, showSuccess, showConfirm } = useAlert();

  const loadBlockedUsers = useCallback(async () => {
    // Prevent multiple simultaneous loads
    if (loadingRef.current) {
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      const data = await getBlockedUsers();
      setBlockedUsers(Array.isArray(data.blockedUsers) ? data.blockedUsers : []);
      hasLoadedRef.current = true;
    } catch (error: any) {
      logger.error('Error loading blocked users', error);
      // Only show error on first load failure
      if (!hasLoadedRef.current) {
        showError(error.message || 'Failed to load blocked users');
      }
      setBlockedUsers([]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      loadBlockedUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await getBlockedUsers();
      setBlockedUsers(data.blockedUsers || []);
    } catch (error: any) {
      logger.error('Error refreshing blocked users', error);
      showError(error.message || 'Failed to refresh blocked users');
    } finally {
      setRefreshing(false);
    }
  }, [showError]);

  const handleUnblock = useCallback((userId: string, username: string) => {
    showConfirm(
      `Are you sure you want to unblock @${username}? They will be able to see your posts and send you messages again.`,
      async () => {
        setUnblockingIds(prev => new Set(prev).add(userId));
        try {
          await unblockUser(userId);
          setBlockedUsers(prev => prev.filter(user => user._id !== userId));
          showSuccess(`@${username} has been unblocked`);
        } catch (error: any) {
          showError(error.message || 'Failed to unblock user');
        } finally {
          setUnblockingIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
          });
        }
      },
      'Unblock User',
      'Unblock',
      'Cancel'
    );
  }, [showConfirm, showError, showSuccess]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar
        title="Blocked Users"
        showBack={true}
        onBack={() => router.back()}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
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
          {blockedUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="ban-outline" size={64} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No blocked users
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
                Users you block will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.usersContainer}>
              {blockedUsers.map((user) => (
                <View
                  key={user._id}
                  style={[styles.userCard, { backgroundColor: theme.colors.surface }]}
                >
                  <View style={styles.userContent}>
                    {user.profilePic ? (
                      <Image
                        source={{ uri: user.profilePic }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary + '20' }]}>
                        <Ionicons name="person" size={24} color={theme.colors.primary} />
                      </View>
                    )}
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: theme.colors.text }]}>
                        {user.fullName || 'Unknown User'}
                      </Text>
                      <Text style={[styles.userUsername, { color: theme.colors.textSecondary }]}>
                        @{user.username}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.unblockButton,
                      {
                        backgroundColor: theme.colors.primary,
                        opacity: unblockingIds.has(user._id) ? 0.6 : 1,
                      },
                    ]}
                    onPress={() => handleUnblock(user._id, user.username)}
                    disabled={unblockingIds.has(user._id)}
                  >
                    {unblockingIds.has(user._id) ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.unblockButtonText}>Unblock</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: isTablet ? 100 : 80,
  },
  emptyText: {
    fontSize: isTablet ? theme.typography.h3.fontSize : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginTop: isTablet ? theme.spacing.lg : 16,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  emptySubtext: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    marginTop: isTablet ? theme.spacing.sm : 8,
    textAlign: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xxl : 40,
    maxWidth: isTablet ? 500 : 300,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  usersContainer: {
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isTablet ? theme.spacing.lg : theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: isTablet ? theme.spacing.md : 12,
  },
  userContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: isTablet ? 50 : 40,
    height: isTablet ? 50 : 40,
    borderRadius: isTablet ? 25 : 20,
    marginRight: isTablet ? theme.spacing.md : 12,
  },
  avatarPlaceholder: {
    width: isTablet ? 50 : 40,
    height: isTablet ? 50 : 40,
    borderRadius: isTablet ? 25 : 20,
    marginRight: isTablet ? theme.spacing.md : 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  userUsername: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  unblockButton: {
    paddingHorizontal: isTablet ? theme.spacing.lg : 16,
    paddingVertical: isTablet ? theme.spacing.sm : 8,
    borderRadius: theme.borderRadius.sm,
  },
  unblockButtonText: {
    color: '#FFFFFF',
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});

