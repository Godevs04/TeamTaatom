import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  LayoutAnimation,
  Animated,
} from 'react-native';
import LoadingGlobe from '../components/LoadingGlobe';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import NavBar from '../components/NavBar';
import JourneyCard from '../components/JourneyCard';
import { getUserJourneys, deleteJourney } from '../services/journey';
import { getUserFromStorage } from '../services/auth';
import { getProfile } from '../services/profile';
import { ErrorBoundary } from '../utils/errorBoundary';

const GROWTH_GREEN = '#22C55E';

function safeDecodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function JourneysListInner() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  const { showDestructiveConfirm } = useAlert();
  const userId = typeof params.userId === 'string' ? params.userId : Array.isArray(params.userId) ? params.userId[0] : '';
  const userNameParam = typeof params.userName === 'string' ? params.userName : Array.isArray(params.userName) ? params.userName[0] : '';
  const decodedUserName = userNameParam ? safeDecodeParam(userNameParam).trim() : '';

  const [journeys, setJourneys] = useState<any[]>([]);
  const [headerTitle, setHeaderTitle] = useState(decodedUserName ? `${decodedUserName}'s Journeys` : 'My Journeys');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const hasInitiallyLoaded = React.useRef(false);

  useEffect(() => {
    let cancelled = false;

    const resolveHeaderTitle = async () => {
      if (!userId) {
        if (!cancelled) setHeaderTitle('My Journeys');
        return;
      }

      if (decodedUserName) {
        if (!cancelled) setHeaderTitle(`${decodedUserName}'s Journeys`);
      }

      try {
        const currentUser = await getUserFromStorage();
        if (cancelled) return;

        const currentUserId = currentUser?._id || (currentUser as any)?.id;
        if (!currentUser || currentUserId === userId) {
          setHeaderTitle('My Journeys');
          return;
        }

        if (decodedUserName) return;

        const profileResponse = await getProfile(userId);
        if (cancelled) return;
        const name = profileResponse.profile?.fullName || profileResponse.profile?.username;
        setHeaderTitle(name ? `${name}'s Journeys` : 'Journeys');
      } catch {
        if (!cancelled && !decodedUserName) {
          setHeaderTitle('Journeys');
        }
      }
    };

    resolveHeaderTitle();
    return () => { cancelled = true; };
  }, [userId, decodedUserName]);

  useEffect(() => {
    loadJourneys(1);
  }, [loadJourneys]);

  // Reload list when screen regains focus (e.g. after deleting a journey on detail screen)
  useFocusEffect(
    useCallback(() => {
      if (hasInitiallyLoaded.current) {
        // Screen regained focus after navigating away — silently refresh the list
        loadJourneys(1, true);
      } else {
        hasInitiallyLoaded.current = true;
      }
    }, [loadJourneys])
  );

  const handleRefresh = () => loadJourneys(1, true);
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadJourneys(page + 1);
    }
  };

  const totalDistance = () => {
    const totalM = journeys.reduce((s: number, j: any) => s + (j.distanceTraveled || 0), 0);
    return totalM >= 1000 ? `${(totalM / 1000).toFixed(1)} km` : `${Math.round(totalM)} m`;
  };

  const renderEmptyState = () => null;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title={headerTitle} showBack onBack={() => router.back()} />
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={GROWTH_GREEN} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar title={headerTitle} showBack onBack={() => router.back()} />

      <FlatList
        data={journeys}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={journeys.length > 0 ? (
          <View style={styles.summaryBar}>
            <Text style={[styles.summaryText, { color: theme.colors.textSecondary }]}>
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

export default function JourneysList() {
  return (
    <ErrorBoundary level="route">
      <JourneysListInner />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryBar: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
