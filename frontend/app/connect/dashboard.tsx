import React, { useState, useEffect, useMemo } from 'react';
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
const CHART_HEIGHT = 128;
const MIN_BARS_FOR_CHART = 3;

type ThemeColors = {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  success?: string;
};

function sumGrowth(data: AnalyticsGrowthPoint[]): number {
  return data.reduce((acc, d) => acc + (d.count || 0), 0);
}

function MiniBarChart({
  data,
  color,
  themeColors,
  total,
  label,
  isDark,
}: {
  data: AnalyticsGrowthPoint[];
  color: string;
  themeColors: ThemeColors;
  total: number;
  label: string;
  isDark: boolean;
}) {
  if (!data.length || total === 0) {
    return (
      <View
        style={[
          chartStyles.empty,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
            borderColor: themeColors.border,
          },
        ]}
      >
        <View style={[chartStyles.emptyIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name="analytics-outline" size={22} color={color} />
        </View>
        <Text style={[chartStyles.emptyTitle, { color: themeColors.text }]}>No activity yet</Text>
        <Text style={[chartStyles.emptyText, { color: themeColors.textSecondary }]}>
          {label} over the last 30 days will appear here
        </Text>
      </View>
    );
  }

  const activeDays = data.filter((d) => d.count > 0);
  const periodTotal = sumGrowth(data);

  if (activeDays.length < MIN_BARS_FOR_CHART) {
    return (
      <View style={chartStyles.sparseContainer}>
        <View
          style={[
            chartStyles.periodPill,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : `${color}12`,
              borderColor: isDark ? themeColors.border : `${color}28`,
            },
          ]}
        >
          <Text style={[chartStyles.periodPillValue, { color }]}>+{periodTotal}</Text>
          <Text style={[chartStyles.periodPillLabel, { color: themeColors.textSecondary }]}>
            this period
          </Text>
        </View>
        {activeDays.map((point) => (
          <View
            key={point.date}
            style={[
              chartStyles.sparseRow,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.025)',
                borderColor: themeColors.border,
              },
            ]}
          >
            <View style={[chartStyles.sparseDotWrap, { backgroundColor: `${color}22` }]}>
              <View style={[chartStyles.sparseDot, { backgroundColor: color }]} />
            </View>
            <View style={chartStyles.sparseMeta}>
              <Text style={[chartStyles.sparseDate, { color: themeColors.text }]}>
                {new Date(point.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              <Text style={[chartStyles.sparseHint, { color: themeColors.textSecondary }]}>
                Daily {label.toLowerCase()}
              </Text>
            </View>
            <Text style={[chartStyles.sparseCount, { color }]}>+{point.count}</Text>
          </View>
        ))}
      </View>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const barWidth = Math.max(4, Math.min(12, (CHART_WIDTH - 20) / data.length - 2));

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.chartTopRow}>
        <Text style={[chartStyles.periodTotal, { color }]}>+{periodTotal}</Text>
        <Text style={[chartStyles.periodTotalLabel, { color: themeColors.textSecondary }]}>
          in 30 days
        </Text>
      </View>
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
                    opacity: point.count > 0 ? 1 : 0.25,
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
    height: CHART_HEIGHT + 28,
    paddingTop: 4,
  },
  chartTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  periodTotal: {
    fontSize: 20,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  periodTotalLabel: {
    fontSize: 12,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
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
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: getFontFamily('500'),
  },
  sparseContainer: {
    gap: 10,
    paddingTop: 4,
  },
  periodPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  periodPillValue: {
    fontSize: 18,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  periodPillLabel: {
    fontSize: 12,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  sparseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  sparseDotWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sparseMeta: {
    flex: 1,
    gap: 2,
  },
  sparseDate: {
    fontSize: 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  sparseHint: {
    fontSize: 12,
    fontFamily: getFontFamily('400'),
  },
  sparseCount: {
    fontSize: 16,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  empty: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 12,
    fontFamily: getFontFamily('400'),
    textAlign: 'center',
    lineHeight: 17,
  },
});

function MetricCard({
  icon,
  value,
  label,
  accent,
  isDark,
  surface,
  text,
  textSecondary,
  border,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number | string;
  label: string;
  accent: string;
  isDark: boolean;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
}) {
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: surface,
          borderColor: border,
          shadowColor: isDark ? '#000' : accent,
        },
      ]}
    >
      <LinearGradient
        colors={isDark ? [`${accent}33`, `${accent}12`] : [`${accent}22`, `${accent}08`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statIconWell}
      >
        <Ionicons name={icon} size={18} color={accent} />
      </LinearGradient>
      <Text style={[styles.statNumber, { color: text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function SectionCard({
  children,
  surface,
  border,
  isDark,
}: {
  children: React.ReactNode;
  surface: string;
  border: string;
  isDark: boolean;
}) {
  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: surface,
          borderColor: border,
          shadowOpacity: isDark ? 0 : 0.06,
        },
      ]}
    >
      {children}
    </View>
  );
}

export default function ConnectDashboardScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { pageId, category } = useLocalSearchParams<{ pageId: string; category?: string }>();
  const isCommunity = category === 'community';
  const subscribersLabel = isCommunity ? 'Buyers' : 'Subscribers';
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<PageAnalyticsResponse | null>(null);
  const [allSubscribers, setAllSubscribers] = useState<any[]>([]);
  const [totalActiveSubscribers, setTotalActiveSubscribers] = useState(0);
  const [subStats, setSubStats] = useState<{
    total: number;
    active: number;
    initialized: number;
    cancelled: number;
    expired: number;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const subscribers =
    statusFilter === 'all'
      ? allSubscribers
      : allSubscribers.filter((s: any) => s.status === statusFilter);

  const followerDelta = useMemo(
    () => sumGrowth(analytics?.followerGrowth || []),
    [analytics?.followerGrowth]
  );
  const viewDelta = useMemo(() => sumGrowth(analytics?.viewGrowth || []), [analytics?.viewGrowth]);

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

  const gradientColors = (theme.colors.gradient?.button || ['#1C73B4', '#50C878']) as [
    string,
    string,
    ...string[],
  ];
  const buyersAccent = '#7C5CFC';

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
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
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
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
          <View
            style={[
              styles.walletBtn,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(28,115,180,0.08)',
              },
            ]}
          >
            <Ionicons name="wallet-outline" size={isTablet ? 22 : 18} color={theme.colors.primary} />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero overview */}
        <LinearGradient
          colors={
            isDark
              ? ['rgba(28,115,180,0.28)', 'rgba(80,200,120,0.08)', 'transparent']
              : ['rgba(28,115,180,0.12)', 'rgba(80,200,120,0.06)', 'transparent']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={[styles.heroEyebrow, { color: theme.colors.primary }]}>PAGE INSIGHTS</Text>
          <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
            How your page is growing
          </Text>
          <Text style={[styles.heroSubtitle, { color: theme.colors.textSecondary }]}>
            Followers, views, and {subscribersLabel.toLowerCase()} from the last 30 days
          </Text>
          <View style={styles.heroChips}>
            <View
              style={[
                styles.heroChip,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)',
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons name="trending-up" size={14} color={theme.colors.primary} />
              <Text style={[styles.heroChipText, { color: theme.colors.text }]}>
                +{followerDelta} followers
              </Text>
            </View>
            <View
              style={[
                styles.heroChip,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)',
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons name="eye-outline" size={14} color={theme.colors.success || '#22c55e'} />
              <Text style={[styles.heroChipText, { color: theme.colors.text }]}>
                +{viewDelta} views
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Metrics */}
        <View style={styles.statsRow}>
          <MetricCard
            icon="people"
            value={analytics?.totalFollowers || 0}
            label="Followers"
            accent={theme.colors.primary}
            isDark={!!isDark}
            surface={theme.colors.surface}
            text={theme.colors.text}
            textSecondary={theme.colors.textSecondary}
            border={theme.colors.border}
          />
          <MetricCard
            icon="eye"
            value={analytics?.totalViews || 0}
            label="Views"
            accent={theme.colors.success || '#22c55e'}
            isDark={!!isDark}
            surface={theme.colors.surface}
            text={theme.colors.text}
            textSecondary={theme.colors.textSecondary}
            border={theme.colors.border}
          />
          <MetricCard
            icon="star"
            value={totalActiveSubscribers}
            label={subscribersLabel}
            accent={buyersAccent}
            isDark={!!isDark}
            surface={theme.colors.surface}
            text={theme.colors.text}
            textSecondary={theme.colors.textSecondary}
            border={theme.colors.border}
          />
        </View>

        {/* Follower Growth */}
        <SectionCard surface={theme.colors.surface} border={theme.colors.border} isDark={!!isDark}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: `${theme.colors.primary}18` }]}>
              <Ionicons name="people-outline" size={16} color={theme.colors.primary} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.chartTitle, { color: theme.colors.text }]}>Follower Growth</Text>
              <Text style={[styles.chartSubtitle, { color: theme.colors.textSecondary }]}>
                Last 30 days
              </Text>
            </View>
          </View>
          <MiniBarChart
            data={analytics?.followerGrowth || []}
            color={theme.colors.primary}
            themeColors={theme.colors}
            total={analytics?.totalFollowers || 0}
            label="Followers"
            isDark={!!isDark}
          />
        </SectionCard>

        {/* Page Views */}
        <SectionCard surface={theme.colors.surface} border={theme.colors.border} isDark={!!isDark}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIcon,
                { backgroundColor: `${theme.colors.success || '#22c55e'}18` },
              ]}
            >
              <Ionicons name="eye-outline" size={16} color={theme.colors.success || '#22c55e'} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.chartTitle, { color: theme.colors.text }]}>Page Views</Text>
              <Text style={[styles.chartSubtitle, { color: theme.colors.textSecondary }]}>
                Last 30 days
              </Text>
            </View>
          </View>
          <MiniBarChart
            data={analytics?.viewGrowth || []}
            color={theme.colors.success || '#22c55e'}
            themeColors={theme.colors}
            total={analytics?.totalViews || 0}
            label="Views"
            isDark={!!isDark}
          />
        </SectionCard>

        {/* Buyers / Subscribers */}
        <SectionCard surface={theme.colors.surface} border={theme.colors.border} isDark={!!isDark}>
          <View style={styles.subscribersHeader}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: `${buyersAccent}18` }]}>
                <Ionicons name="star-outline" size={16} color={buyersAccent} />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.chartTitle, { color: theme.colors.text }]}>
                  {subscribersLabel}
                </Text>
                <Text style={[styles.chartSubtitle, { color: theme.colors.textSecondary }]}>
                  {statusFilter === 'all'
                    ? `${subStats?.total || allSubscribers.length} total ${subscribersLabel.toLowerCase()}`
                    : `${subscribers.length} ${statusFilter} ${subscribersLabel.toLowerCase()}`}
                </Text>
              </View>
            </View>
            {subscribers.length > 0 && (
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: '/connect/page/[id]', params: { id: pageId } } as any)
                }
                activeOpacity={0.7}
                style={[
                  styles.viewAllBtn,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(28,115,180,0.08)',
                  },
                ]}
              >
                <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>View</Text>
                <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>

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
            ].map((f) => {
              const active = statusFilter === f.value;
              return (
                <TouchableOpacity
                  key={f.value}
                  onPress={() => setStatusFilter(f.value)}
                  activeOpacity={0.7}
                >
                  {active ? (
                    <LinearGradient
                      colors={gradientColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.filterButtonActive}
                    >
                      <Text style={styles.filterButtonTextActive}>
                        {f.label} ({f.count})
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View
                      style={[
                        styles.filterButton,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.04)'
                            : theme.colors.background,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.filterButtonText, { color: theme.colors.textSecondary }]}
                      >
                        {f.label} ({f.count})
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {subscribers.length > 0 ? (
            <View style={styles.subscribersList}>
              {subscribers.map((sub, index) => {
                const amountColor =
                  sub.status === 'active'
                    ? theme.colors.success || '#22c55e'
                    : sub.status === 'initialized'
                      ? '#d97706'
                      : theme.colors.textSecondary;
                const statusLabel =
                  sub.status === 'active'
                    ? 'Active'
                    : sub.status === 'initialized'
                      ? 'Pending'
                      : sub.status === 'cancelled'
                        ? 'Cancelled'
                        : sub.status === 'expired'
                          ? 'Expired'
                          : sub.status || '';
                return (
                  <View
                    key={sub._id || index}
                    style={[
                      styles.subscriberRow,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.03)'
                          : 'rgba(15,23,42,0.02)',
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={['#1C73B4', '#7C5CFC']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.subscriberAvatar}
                    >
                      {sub.userId?.profilePic ? (
                        <Image
                          source={{ uri: sub.userId.profilePic }}
                          style={styles.subscriberAvatarImage}
                        />
                      ) : (
                        <Text style={styles.subscriberAvatarText}>
                          {(sub.userId?.fullName || 'U').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </LinearGradient>
                    <View style={styles.subscriberInfo}>
                      <Text
                        style={[styles.subscriberName, { color: theme.colors.text }]}
                        numberOfLines={1}
                      >
                        {sub.userId?.fullName || sub.userId?.username || 'Unknown'}
                      </Text>
                      <Text style={[styles.subscriberDate, { color: theme.colors.textSecondary }]}>
                        {sub.activatedAt
                          ? new Date(sub.activatedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : sub.status === 'initialized'
                            ? 'Pending payment'
                            : ''}
                      </Text>
                    </View>
                    <View style={styles.subscriberAmountCol}>
                      <Text style={[styles.subscriberAmount, { color: amountColor }]}>
                        ₹{sub.amount || 0}
                      </Text>
                      {sub.status !== 'active' && (
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: `${amountColor}18` },
                          ]}
                        >
                          <Text style={[styles.subscriberStatus, { color: amountColor }]}>
                            {statusLabel}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View
              style={[
                styles.noSubscribers,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)',
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <LinearGradient
                colors={isDark ? [`${buyersAccent}40`, `${buyersAccent}15`] : [`${buyersAccent}22`, `${buyersAccent}08`]}
                style={styles.noSubscribersIcon}
              >
                <Ionicons name="sparkles-outline" size={26} color={buyersAccent} />
              </LinearGradient>
              <Text style={[styles.noSubscribersTitle, { color: theme.colors.text }]}>
                No {subscribersLabel.toLowerCase()} yet
              </Text>
              <Text style={[styles.noSubscribersText, { color: theme.colors.textSecondary }]}>
                When people subscribe, they’ll show up here with status and revenue.
              </Text>
            </View>
          )}
        </SectionCard>

        <View style={{ height: 48 }} />
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
    paddingVertical: isTablet ? themeConstants.spacing.md : 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    letterSpacing: isIOS ? 0.2 : 0.1,
  },
  headerRight: {
    width: isTablet ? 48 : 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingBottom: 8,
  },
  hero: {
    marginHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    marginTop: isTablet ? themeConstants.spacing.lg : themeConstants.spacing.md,
    paddingHorizontal: isTablet ? 24 : 18,
    paddingTop: isTablet ? 22 : 18,
    paddingBottom: isTablet ? 20 : 16,
    borderRadius: 20,
  },
  heroEyebrow: {
    fontSize: 11,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: isTablet ? 26 : 22,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('400'),
    lineHeight: 18,
    marginBottom: 14,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroChipText: {
    fontSize: 12,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: isTablet ? 14 : 10,
    paddingHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    paddingTop: 14,
  },
  statCard: {
    flex: 1,
    alignItems: 'flex-start',
    paddingHorizontal: isTablet ? 16 : 12,
    paddingVertical: isTablet ? 16 : 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  statIconWell: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: isTablet ? 26 : 22,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  sectionCard: {
    marginHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    marginTop: 14,
    padding: isTablet ? themeConstants.spacing.xl : 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  chartTitle: {
    fontSize: 16,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  chartSubtitle: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('400'),
    marginTop: 2,
  },
  subscribersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 2,
  },
  viewAllText: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  filterRow: {
    marginBottom: 14,
    marginTop: 4,
  },
  filterRowContent: {
    gap: 8,
    paddingHorizontal: 1,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterButtonActive: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  filterButtonText: {
    fontSize: 12,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  filterButtonTextActive: {
    fontSize: 12,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    color: '#fff',
  },
  subscribersList: {
    gap: 8,
  },
  subscriberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  subscriberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  subscriberAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 14,
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
    gap: 4,
  },
  subscriberAmount: {
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  subscriberStatus: {
    fontSize: 10,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  noSubscribers: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  noSubscribersIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  noSubscribersTitle: {
    fontSize: 15,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
  },
  noSubscribersText: {
    fontSize: 13,
    fontFamily: getFontFamily('400'),
    textAlign: 'center',
    lineHeight: 18,
  },
});
