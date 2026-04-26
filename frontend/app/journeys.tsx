import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import JourneyCard from '../components/JourneyCard';
import { getUserJourneys } from '../services/journey';
import { ErrorBoundary } from '../utils/errorBoundary';

const GROWTH_GREEN = '#22C55E';

function JourneysListInner() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  const userId = typeof params.userId === 'string' ? params.userId : Array.isArray(params.userId) ? params.userId[0] : '';

  const [journeys, setJourneys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

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
    loadJourneys(1);
  }, [loadJourneys]);

  const handleRefresh = () => loadJourneys(1, true);
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadJourneys(page + 1);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: GROWTH_GREEN + '15' }]}>
        <Ionicons name="map-outline" size={56} color={GROWTH_GREEN} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No journeys yet</Text>
      <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
        Your completed journeys will appear here
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>My Journeys</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={GROWTH_GREEN} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>My Journeys</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Summary */}
      {journeys.length > 0 && (
        <View style={[styles.summaryBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.summaryText, { color: theme.colors.textSecondary }]}>
            {journeys.length} journey{journeys.length !== 1 ? 's' : ''}
            {' · '}
            {(() => {
              const totalM = journeys.reduce((s: number, j: any) => s + (j.distanceTraveled || 0), 0);
              return totalM >= 1000 ? `${(totalM / 1000).toFixed(1)} km` : `${Math.round(totalM)} m`;
            })()}
            {' traveled'}
          </Text>
        </View>
      )}

      <FlatList
        data={journeys}
        keyExtractor={(item) => item._id}
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
        contentContainerStyle={journeys.length === 0 ? { flex: 1 } : { paddingBottom: 30 }}
      />
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  summaryBar: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
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
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  startBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
});
