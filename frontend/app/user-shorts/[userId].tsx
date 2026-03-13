import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import type { PostType } from '../../types/post';
import logger from '../../utils/logger';
import { ErrorBoundary } from '../../utils/errorBoundary';
import Shorts from '../(tabs)/shorts';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';

export default function UserShortsScreen() {
  const { userId, shortId } = useLocalSearchParams();
  const { theme } = useTheme();
  const router = useRouter();
  const [shorts, setShorts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const hasInitializedRef = useRef(false);

  const fetchUserShorts = useCallback(async () => {
    if (!userId || typeof userId !== 'string') return;
    try {
      setLoading(true);

      // Fetch user profile (for header title)
      const userResponse = await api.get(`/profile/${userId}`);
      setUser(userResponse.data.profile);

      // Fetch user's shorts
      const shortsResponse = await api.get(`/shorts/user/${userId}`);
      setShorts(shortsResponse.data.shorts || shortsResponse.data.posts || []);
    } catch (error) {
      logger.error('Error fetching user shorts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    fetchUserShorts();
  }, [fetchUserShorts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUserShorts();
  }, [fetchUserShorts]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      ...(isWeb && {
        maxWidth: isTablet ? 600 : 500,
        alignSelf: 'center',
        width: '100%',
      } as any),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      padding: theme.spacing.xs,
      marginRight: theme.spacing.sm,
    },
    headerTitle: {
      fontSize: theme.typography.h3.fontSize,
      fontWeight: '700',
      color: theme.colors.text,
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      marginTop: theme.spacing.md,
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    emptyIcon: {
      marginBottom: theme.spacing.md,
    },
    emptyTitle: {
      fontSize: theme.typography.h3.fontSize,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });

  if (loading) {
    return (
      <ErrorBoundary level="route">
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {user?.fullName ? `${user.fullName}'s Shorts` : 'Shorts'}
            </Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading shorts...</Text>
          </View>
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  if (!shorts.length) {
    return (
      <ErrorBoundary level="route">
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {user?.fullName ? `${user.fullName}'s Shorts` : 'Shorts'}
            </Text>
          </View>
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="videocam-outline" size={64} color={theme.colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No Shorts Yet</Text>
            <Text style={styles.emptyMessage}>
              {user?.fullName ? `${user.fullName} hasn't created any shorts yet.` : "This user hasn't created any shorts yet."}
            </Text>
          </View>
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  // Reuse the Shorts tab screen but scoped to this user's shorts list
  return (
    <ErrorBoundary level="route">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {user?.fullName ? `${user.fullName}'s Shorts` : 'Shorts'}
          </Text>
        </View>
        {/* We pass initial data via props by wrapping Shorts in a provider-like pattern.
            For now, we simply render Shorts and let it deep-link using shortId; it will fetch its own data.
            This keeps behaviour consistent with global Shorts UI while giving it a dedicated layout and header. */}
        <Shorts />
      </SafeAreaView>
    </ErrorBoundary>
  );
}

