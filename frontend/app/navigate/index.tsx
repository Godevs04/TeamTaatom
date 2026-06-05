import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Platform,
  StatusBar,
  RefreshControl,
  LayoutAnimation,
  Animated,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { useJourney } from '../../context/JourneyContext';
import JourneyCard from '../../components/JourneyCard';
import { getUserJourneys, deleteJourney } from '../../services/journey';
import NavBar from '../../components/NavBar';

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
  const { showAlert, showError, showSuccess, showDestructiveConfirm } = useAlert();
  const {
    initialized,
    isTracking,
    isPaused,
    journey,
    distance,
    duration,
    resumeJourneyRecording,
    stopJourneyRecording,
  } = useJourney();

  const [userId, setUserId] = useState<string>('');
  const [journeys, setJourneys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Animated toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastAnim = React.useRef(new Animated.Value(0)).current;

  const showToast = (message: string) => {
    setToastMessage(message);
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      setToastMessage(null);
    });
  };

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

      const data = await getUserJourneys(userId, pageNum, 20, true);
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

  const handleEndJourney = async () => {
    try {
      setIsLoading(true);
      await stopJourneyRecording();
      showSuccess('Journey Saved!', 'Your journey has been saved successfully.');
      router.push('/navigate/complete');
    } catch (err: any) {
      showError(err.message || 'Unknown error', 'Failed to end journey');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteJourney = (journeyItem: any) => {
    showDestructiveConfirm(
      'Are you sure you want to delete this journey? This action cannot be undone.',
      async () => {
        const previousJourneys = [...journeys];
        // Optimistic UI Update
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setJourneys((prev) => prev.filter((j) => j._id !== journeyItem._id));

        try {
          await deleteJourney(journeyItem._id);
        } catch (err: any) {
          // Revert state
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setJourneys(previousJourneys);
          showToast('Failed to delete journey. Please check your connection.');
        }
      },
      'Delete Journey',
      'Delete',
      'Cancel'
    );
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

  const renderEmptyState = () => null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <NavBar title="My Journeys" showBack={true} onBack={() => router.back()} />

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
                <LoadingGlobe color="white" size="small" />
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
          <LoadingGlobe size="large" color={GROWTH_GREEN} />
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
              onLongPress={() => handleDeleteJourney(item)}
            />
          )}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={GROWTH_GREEN} colors={[GROWTH_GREEN]} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <LoadingGlobe style={{ padding: 16 }} color={GROWTH_GREEN} /> : null}
          contentContainerStyle={journeys.length === 0 ? { flex: 1 } : { paddingTop: 6, paddingBottom: 30 }}
        />
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <LoadingGlobe size="large" color={GROWTH_GREEN} />
        </View>
      )}

      {toastMessage && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              backgroundColor: '#EF4444',
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
              opacity: toastAnim,
            },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={20} color="white" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </View>
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
  toastContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    gap: 8,
    zIndex: 9999,
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
