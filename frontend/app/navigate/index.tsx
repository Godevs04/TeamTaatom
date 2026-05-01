import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { useJourneyTracking } from '../../hooks/useJourneyTracking';
import JourneyCard from '../../components/JourneyCard';
import { getUserJourneys } from '../../services/journey';

const GROWTH_GREEN = '#22C55E';
const ACTION_BLUE = '#3B82F6';
const ALERT_RED = '#EF4444';


/**
 * Journey Home Screen
 *
 * Shows list of user's past journeys
 * - If a journey is paused, shows pause summary with continue/end
 * - If a journey is active, redirects to tracking screen
 * - Otherwise shows journey history list
 */
export default function NavigateIndexScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const {
    initialized,
    isTracking,
    isPaused,
    journey,
    distance,
    duration,
    resumeJourneyRecording,
    stopJourneyRecording,
  } = useJourneyTracking();

  const [userId, setUserId] = useState<string>('');
  const [journeys, setJourneys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Get current user ID
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const parsed = JSON.parse(userData);
          setUserId(parsed._id || '');
        }
      } catch (err) {
        console.error('Failed to get user data:', err);
      }
    };
    loadUserId();
  }, []);

  // Fetch journeys
  const loadJourneys = useCallback(async (pageNum: number = 1, isRefresh: boolean = false) => {
    if (!userId) return;
    try {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const data = await getUserJourneys(userId, pageNum, 20);
      const fetched = data?.journeys ?? [];

      if (pageNum === 1) {
        setJourneys(fetched);
      } else {
        setJourneys((prev) => [...prev, ...fetched]);
      }

      setHasMore(fetched.length >= 20);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load journeys:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) loadJourneys(1);
  }, [userId, loadJourneys]);

  // Redirect to tracking screen if journey is active (only after hook initialized)
  useEffect(() => {
    if (initialized && isTracking && !isPaused) {
      router.replace('/navigate/tracking');
    }
  }, [initialized, isTracking, isPaused, router]);

  const handleContinueJourney = async () => {
    try {
      setIsLoading(true);
      await resumeJourneyRecording();
      router.push('/navigate/tracking');
    } catch (err: any) {
      showAlert('Failed to continue journey', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndJourney = () => {
    Alert.alert('End Journey?', 'This will complete your current journey. You can view it later in your profile.', [
      {
        text: 'Cancel',
        onPress: () => {},
        style: 'cancel',
      },
      {
        text: 'End Journey',
        onPress: async () => {
          try {
            setIsLoading(true);
            await stopJourneyRecording();
            router.push('/navigate/complete');
          } catch (err: any) {
            showAlert('Failed to end journey', err.message);
          } finally {
            setIsLoading(false);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleRefresh = () => loadJourneys(1, true);
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadJourneys(page + 1);
    }
  };

  const formatDistance = () => {
    if (distance < 1000) {
      return `${Math.round(distance)} m`;
    }
    return `${(distance / 1000).toFixed(1)} km`;
  };

  const formatDuration = () => {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const totalDistance = () => {
    const totalM = journeys.reduce((s: number, j: any) => s + (j.distanceTraveled || 0), 0);
    return totalM >= 1000 ? `${(totalM / 1000).toFixed(1)} km` : `${Math.round(totalM)} m`;
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: GROWTH_GREEN + '10' }]}>
        <Ionicons name="map-outline" size={48} color={GROWTH_GREEN} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No journeys yet</Text>
      <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
        Start a journey from the map to begin tracking your travels
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>My Journeys</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Paused Journey Banner */}
      {isPaused && journey && (
        <View style={[styles.pausedBanner, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {journey.title && (
              <Text style={[styles.summaryTitle, { color: theme.colors.text }]} numberOfLines={1}>
                {journey.title}
              </Text>
            )}

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Ionicons name="navigate" size={18} color={GROWTH_GREEN} />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{formatDistance()}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Distance</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="time" size={18} color={ACTION_BLUE} />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{formatDuration()}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Duration</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="location-sharp" size={18} color={ALERT_RED} />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{journey.waypoints?.length || 0}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Waypoints</Text>
              </View>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: ACTION_BLUE + '15' }]}>
              <Ionicons name="pause-circle" size={14} color={ACTION_BLUE} />
              <Text style={[styles.statusText, { color: ACTION_BLUE }]}>Journey Paused</Text>
            </View>
          </View>

          <View style={styles.pausedActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: GROWTH_GREEN, flex: 1 }]}
              onPress={handleContinueJourney}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Ionicons name="play-circle" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Continue</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { borderColor: ALERT_RED, borderWidth: 1.5 }]}
              onPress={handleEndJourney}
              disabled={isLoading}
            >
              <Ionicons name="stop-circle" size={18} color={ALERT_RED} />
              <Text style={[styles.actionButtonTextOutline, { color: ALERT_RED }]}>End</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Journey List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={GROWTH_GREEN} />
        </View>
      ) : (
        <FlatList
          data={journeys}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={journeys.length > 0 ? (
            <View style={styles.summaryBar}>
              <Text style={[styles.summaryBarText, { color: theme.colors.textSecondary }]}>
                {journeys.length} journey{journeys.length !== 1 ? 's' : ''} · {totalDistance()} traveled
              </Text>
            </View>
          ) : null}
          renderItem={({ item }) => (
            <JourneyCard
              journey={item}
              onPress={() => router.push(`/navigate/detail?journeyId=${item._id}`)}
            />
          )}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={GROWTH_GREEN} colors={[GROWTH_GREEN]} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} color={GROWTH_GREEN} /> : null}
          contentContainerStyle={journeys.length === 0 ? { flex: 1 } : { paddingTop: 6, paddingBottom: 30 }}
        />
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={GROWTH_GREEN} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    minHeight: Platform.OS === 'android' ? 60 : 56,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Paused journey banner
  pausedBanner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statBox: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pausedActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 6,
    minHeight: 44,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextOutline: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Journey list
  summaryBar: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  summaryBarText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});
