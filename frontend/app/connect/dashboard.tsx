import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { theme as themeConstants } from '../../constants/theme';
import {
  getPageAnalytics,
  getPageSubscribers,
  PageAnalyticsResponse,
  AnalyticsGrowthPoint,
} from '../../services/connect';
import logger from '../../utils/logger';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

const CHART_WIDTH = screenWidth - (isTablet ? 96 : 64);
const CHART_HEIGHT = 120;
const MIN_BARS_FOR_CHART = 3;

function MiniBarChart({
  data,
  color,
  themeColors,
  total,
  label,
}: {
  data: AnalyticsGrowthPoint[];
  color: string;
  themeColors: any;
  total: number;
  label: string;
}) {
  if (!data.length || total === 0) {
    return (
      <View style={[chartStyles.empty, { backgroundColor: themeColors.background }]}>
        <Text style={[chartStyles.emptyText, { color: themeColors.textSecondary }]}>
          No data yet
        </Text>
      </View>
    );
  }

  const activeDays = data.filter(d => d.count > 0);

  // Sparse data — show compact summary instead of misleading chart
  if (activeDays.length < MIN_BARS_FOR_CHART) {
    return (
      <View style={chartStyles.sparseContainer}>
        {activeDays.map((point) => (
          <View key={point.date} style={[chartStyles.sparseRow, { borderBottomColor: themeColors.border }]}>
            <View style={[chartStyles.sparseDot, { backgroundColor: color }]} />
            <Text style={[chartStyles.sparseDate, { color: themeColors.textSecondary }]}>
              {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
            <Text style={[chartStyles.sparseCount, { color: themeColors.text }]}>
              +{point.count} {label.toLowerCase()}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const barWidth = Math.max(4, Math.min(12, (CHART_WIDTH - 20) / data.length - 2));

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.barsRow}>
        {data.map((point) => {
          const heightPercent = (point.count / maxCount) * 100;
          return (
            <View key={point.date} style={chartStyles.barColumn}>
              <View
                style={[
                  chartStyles.bar,
                  {
                    height: `${Math.max(heightPercent, 2)}%`,
                    width: barWidth,
                    backgroundColor: point.count > 0 ? color : themeColors.border,
                    opacity: point.count > 0 ? 1 : 0.3,
                    borderRadius: barWidth / 2,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={chartStyles.labelRow}>
        <Text style={[chartStyles.dateLabel, { color: themeColors.textSecondary }]}>
          {data[0].date.slice(5)}
        </Text>
        <Text style={[chartStyles.dateLabel, { color: themeColors.textSecondary }]}>
          {data[data.length - 1].date.slice(5)}
        </Text>
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    height: CHART_HEIGHT,
    paddingTop: 4,
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-evenly',
    paddingHorizontal: 4,
  },
  barColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    height: '100%',
  },
  bar: {
    minHeight: 2,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '400',
  },
  sparseContainer: {
    paddingVertical: 4,
  },
  sparseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  sparseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sparseDate: {
    fontSize: 13,
    fontFamily: getFontFamily('400'),
    width: 60,
  },
  sparseCount: {
    fontSize: 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  empty: {
    paddingVertical: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default function ConnectDashboardScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { pageId, category } = useLocalSearchParams<{ pageId: string; category?: string }>();
  const isCommunity = category === 'community';
  const subscribersLabel = isCommunity ? 'Buyers' : 'Subscribers';
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<PageAnalyticsResponse | null>(null);
  const [allSubscribers, setAllSubscribers] = useState<any[]>([]);
  const [totalActiveSubscribers, setTotalActiveSubscribers] = useState(0);
  const [subStats, setSubStats] = useState<{ total: number; active: number; initialized: number; cancelled: number; expired: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const subscribers = statusFilter === 'all'
    ? allSubscribers
    : allSubscribers.filter((s: any) => s.status === statusFilter);

  useEffect(() => {
    if (pageId) loadAnalytics();
  }, [pageId]);

  const loadAnalytics = async () => {
    if (!pageId) return;
    try {
      setLoading(true);
      const [analyticsData, subData] = await Promise.all([
        getPageAnalytics(pageId),
        getPageSubscribers(pageId).catch(() => null),
      ]);
      setAnalytics(analyticsData);
      if (subData) {
        setAllSubscribers(subData.subscribers || []);
        setTotalActiveSubscribers(subData.totalActiveSubscribers || 0);
        setSubStats(subData.stats || null);
      }
    } catch (error) {
      logger.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Dashboard</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={isTablet ? 28 : 24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Dashboard</Text>
        <TouchableOpacity
          style={styles.headerRight}
          onPress={() => router.push('/connect/payouts' as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="wallet-outline" size={isTablet ? 26 : 22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="people" size={28} color={theme.colors.primary} />
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>
              {analytics?.totalFollowers || 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Followers</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="eye" size={28} color={theme.colors.success} />
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>
              {analytics?.totalViews || 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Views</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="star" size={28} color="#8b5cf6" />
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>
              {totalActiveSubscribers}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{subscribersLabel}</Text>
          </View>
        </View>

        {/* Follower Growth Chart */}
        <View style={[styles.chartCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.chartTitle, { color: theme.colors.text }]}>Follower Growth</Text>
          <Text style={[styles.chartSubtitle, { color: theme.colors.textSecondary }]}>Last 30 days</Text>
          <MiniBarChart
            data={analytics?.followerGrowth || []}
            color={theme.colors.primary}
            themeColors={theme.colors}
            total={analytics?.totalFollowers || 0}
            label="Followers"
          />
        </View>

        {/* View Growth Chart */}
        <View style={[styles.chartCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.chartTitle, { color: theme.colors.text }]}>Page Views</Text>
          <Text style={[styles.chartSubtitle, { color: theme.colors.textSecondary }]}>Last 30 days</Text>
          <MiniBarChart
            data={analytics?.viewGrowth || []}
            color={theme.colors.success}
            themeColors={theme.colors}
            total={analytics?.totalViews || 0}
            label="Views"
          />
        </View>

        {/* Subscribers */}
        <View style={[styles.chartCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.subscribersHeader}>
            <View>
              <Text style={[styles.chartTitle, { color: theme.colors.text }]}>{subscribersLabel}</Text>
              <Text style={[styles.chartSubtitle, { color: theme.colors.textSecondary }]}>
                {statusFilter === 'all'
                  ? `${subStats?.total || allSubscribers.length} total ${subscribersLabel.toLowerCase()}`
                  : `${subscribers.length} ${statusFilter} ${subscribersLabel.toLowerCase()}`}
              </Text>
            </View>
            {subscribers.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/connect/page/[id]', params: { id: pageId } } as any)}
                activeOpacity={0.7}
              >
                <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Status Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            contentContainerStyle={styles.filterRowContent}
          >
            {[
              { value: 'all', label: 'All', count: subStats?.total || allSubscribers.length },
              { value: 'active', label: 'Active', count: subStats?.active || 0 },
              { value: 'initialized', label: 'Pending', count: subStats?.initialized || 0 },
              { value: 'cancelled', label: 'Cancelled', count: subStats?.cancelled || 0 },
              { value: 'expired', label: 'Expired', count: subStats?.expired || 0 },
            ].map((f) => (
              <TouchableOpacity
                key={f.value}
                onPress={() => setStatusFilter(f.value)}
                activeOpacity={0.7}
                style={{ borderRadius: 20, overflow: 'hidden' }}
              >
                {statusFilter === f.value ? (
                  <LinearGradient
                    colors={['#50C878', '#38BDF8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.filterButton,
                      { borderColor: 'transparent' },
                    ]}
                  >
                    <Text style={[styles.filterButtonText, { color: '#ffffff' }]}>
                      {f.label} ({f.count})
                    </Text>
                  </LinearGradient>
                ) : (
                  <View
                    style={[
                      styles.filterButton,
                      {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.filterButtonText, { color: theme.colors.textSecondary }]}>
                      {f.label} ({f.count})
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {subscribers.length > 0 ? (
            <View style={styles.subscribersList}>
              {subscribers.map((sub, index) => {
                const amountColor =
                  sub.status === 'active' ? theme.colors.success
                    : sub.status === 'initialized' ? '#f59e0b'
                    : '#9ca3af';
                const statusLabel =
                  sub.status === 'active' ? 'Active'
                    : sub.status === 'initialized' ? 'Pending'
                    : sub.status === 'cancelled' ? 'Cancelled'
                    : sub.status === 'expired' ? 'Expired'
                    : sub.status || '';
                return (
                  <View
                    key={sub._id || index}
                    style={[
                      styles.subscriberRow,
                      index < subscribers.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
                    ]}
                  >
                    <View style={[styles.subscriberAvatar, { backgroundColor: '#8b5cf6' }]}>
                      {sub.userId?.profilePic ? (
                        <Image source={{ uri: sub.userId.profilePic }} style={styles.subscriberAvatarImage} />
                      ) : (
                        <Text style={styles.subscriberAvatarText}>
                          {(sub.userId?.fullName || 'U').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={styles.subscriberInfo}>
                      <Text style={[styles.subscriberName, { color: theme.colors.text }]} numberOfLines={1}>
                        {sub.userId?.fullName || sub.userId?.username || 'Unknown'}
                      </Text>
                      <Text style={[styles.subscriberDate, { color: theme.colors.textSecondary }]}>
                        {sub.activatedAt
                          ? new Date(sub.activatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : sub.status === 'initialized' ? 'Pending payment' : ''}
                      </Text>
                    </View>
                    <View style={styles.subscriberAmountCol}>
                      <Text style={[styles.subscriberAmount, { color: amountColor }]}>
                        ₹{sub.amount || 0}
                      </Text>
                      {sub.status !== 'active' && (
                        <Text style={[styles.subscriberStatus, { color: amountColor }]}>
                          {statusLabel}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.noSubscribers}>
              <Ionicons name="star-outline" size={32} color={theme.colors.textSecondary} />
              <Text style={[styles.noSubscribersText, { color: theme.colors.textSecondary }]}>
                No {subscribersLabel.toLowerCase()} yet
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    paddingVertical: isTablet ? themeConstants.spacing.md : 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: isTablet ? themeConstants.spacing.sm : 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: isTablet ? 22 : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: isIOS ? 0.3 : 0.2,
  },
  headerRight: {
    width: isTablet ? 48 : 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: isTablet ? 16 : 12,
    padding: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    paddingBottom: 0,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: isTablet ? themeConstants.spacing.xl : 20,
    borderRadius: themeConstants.borderRadius.md,
    gap: 8,
  },
  statNumber: {
    fontSize: 22,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  statLabel: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  chartCard: {
    margin: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    marginBottom: 0,
    padding: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.lg,
    borderRadius: themeConstants.borderRadius.md,
  },
  chartTitle: {
    fontSize: 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 2,
  },
  chartSubtitle: {
    fontSize: isTablet ? 13 : 12,
    marginBottom: 12,
  },
  subscribersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  filterRow: {
    marginBottom: 12,
  },
  filterRowContent: {
    gap: 8,
    paddingHorizontal: 2,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 12,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  subscribersList: {
    gap: 0,
  },
  subscriberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  subscriberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  subscriberAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  subscriberAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  subscriberInfo: {
    flex: 1,
    gap: 2,
  },
  subscriberName: {
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  subscriberDate: {
    fontSize: isTablet ? 12 : 11,
    fontFamily: getFontFamily('400'),
  },
  subscriberAmountCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  subscriberAmount: {
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
  },
  subscriberStatus: {
    fontSize: 10,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  noSubscribers: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  noSubscribersText: {
    fontSize: 14,
    fontFamily: getFontFamily('400'),
    fontStyle: 'italic',
  },
});
