import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { theme as themeConstants } from '../../constants/theme';
import {
  getPageAnalytics,
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
const CHART_HEIGHT = 160;

function MiniBarChart({
  data,
  color,
  themeColors,
}: {
  data: AnalyticsGrowthPoint[];
  color: string;
  themeColors: any;
}) {
  if (!data.length) {
    return (
      <View style={[chartStyles.empty, { backgroundColor: themeColors.background }]}>
        <Text style={[chartStyles.emptyText, { color: themeColors.textSecondary }]}>
          No data yet
        </Text>
      </View>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const barWidth = Math.max(4, Math.min(16, (CHART_WIDTH - 20) / data.length - 2));

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.barsRow}>
        {data.map((point, idx) => {
          const heightPercent = (point.count / maxCount) * 100;
          return (
            <View key={point.date} style={chartStyles.barColumn}>
              <View
                style={[
                  chartStyles.bar,
                  {
                    height: `${Math.max(heightPercent, 4)}%`,
                    width: barWidth,
                    backgroundColor: color,
                    borderRadius: barWidth / 2,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={chartStyles.labelRow}>
        {data.length > 0 && (
          <>
            <Text style={[chartStyles.dateLabel, { color: themeColors.textSecondary }]}>
              {data[0].date.slice(5)}
            </Text>
            <Text style={[chartStyles.dateLabel, { color: themeColors.textSecondary }]}>
              {data[data.length - 1].date.slice(5)}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    height: CHART_HEIGHT,
    paddingTop: 8,
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
    minHeight: 4,
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
  empty: {
    height: CHART_HEIGHT,
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
  const { pageId } = useLocalSearchParams<{ pageId: string }>();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<PageAnalyticsResponse | null>(null);

  useEffect(() => {
    if (pageId) loadAnalytics();
  }, [pageId]);

  const loadAnalytics = async () => {
    if (!pageId) return;
    try {
      setLoading(true);
      const data = await getPageAnalytics(pageId);
      setAnalytics(data);
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
          <ActivityIndicator size="large" color={theme.colors.primary} />
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
        <View style={styles.headerRight} />
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
        </View>

        {/* Follower Growth Chart */}
        <View style={[styles.chartCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.chartTitle, { color: theme.colors.text }]}>Follower Growth</Text>
          <Text style={[styles.chartSubtitle, { color: theme.colors.textSecondary }]}>Last 30 days</Text>
          <MiniBarChart
            data={analytics?.followerGrowth || []}
            color={theme.colors.primary}
            themeColors={theme.colors}
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
          />
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
    fontSize: isTablet ? 36 : 28,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
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
    fontSize: isTablet ? 18 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 2,
  },
  chartSubtitle: {
    fontSize: isTablet ? 13 : 12,
    marginBottom: 12,
  },
});
