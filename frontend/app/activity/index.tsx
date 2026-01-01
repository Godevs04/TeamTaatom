import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Image,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { getActivityFeed, Activity as ActivityType } from '../../services/activity';
import EmptyState from '../../components/EmptyState';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { PostType } from '../../types/post';
import { triggerRefreshHaptic } from '../../utils/hapticFeedback';
import { theme } from '../../constants/theme';
import logger from '../../utils/logger';

// Responsive dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Elegant font families for each platform
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) {
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    return 'System';
  }
  return 'Roboto';
};

export default function ActivityFeedScreen() {
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filterType, setFilterType] = useState<ActivityType['type'] | 'all'>('all');
  const { theme } = useTheme();
  const { showError } = useAlert();
  const router = useRouter();

  const loadActivities = async (pageNum: number = 1, shouldAppend: boolean = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      }

      const response = await getActivityFeed({
        page: pageNum,
        limit: 20,
        type: filterType === 'all' ? undefined : filterType,
      });

      if (shouldAppend) {
        setActivities(prev => [...prev, ...response.activities]);
      } else {
        setActivities(response.activities);
      }

      setHasMore(response.pagination.hasNextPage);
      setPage(pageNum);
    } catch (error: any) {
      showError('Failed to load activity feed');
      logger.error('Error loading activities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivities(1, false);
  }, [filterType]);

  const handleRefresh = async () => {
    // Trigger haptic feedback for better UX
    triggerRefreshHaptic();
    setRefreshing(true);
    await loadActivities(1, false);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadActivities(page + 1, true);
    }
  };

  const getActivityIcon = (type: ActivityType['type']) => {
    switch (type) {
      case 'post_created':
        return 'image-outline';
      case 'post_liked':
        return 'heart';
      case 'comment_added':
        return 'chatbubble-outline';
      case 'user_followed':
        return 'person-add-outline';
      case 'collection_created':
        return 'albums-outline';
      case 'post_mention':
        return 'at-outline';
      default:
        return 'ellipse-outline';
    }
  };

  const getActivityText = (activity: ActivityType) => {
    const userName = activity.user?.fullName || 'Someone';
    switch (activity.type) {
      case 'post_created':
        return `${userName} created a new post`;
      case 'post_liked':
        return `${userName} liked a post`;
      case 'comment_added':
        return `${userName} commented on a post`;
      case 'user_followed':
        return `${userName} followed ${activity.targetUser?.fullName || 'someone'}`;
      case 'collection_created':
        return `${userName} created a collection`;
      case 'post_mention':
        return `${userName} mentioned you in a post`;
      default:
        return `${userName} did something`;
    }
  };

  const renderActivity = ({ item }: { item: ActivityType }) => (
    <TouchableOpacity
      style={[styles.activityItem, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}
      onPress={() => {
        if (item.post) {
          router.push(`/post/${item.post._id}`);
        } else if (item.collection) {
          router.push(`/collections/${item.collection._id}`);
        } else if (item.targetUser) {
          router.push(`/profile/${item.targetUser._id}`);
        }
      }}
    >
      <View style={styles.activityContent}>
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.surfaceSecondary }]}>
          <Ionicons name={getActivityIcon(item.type)} size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.activityText}>
          <Text style={[styles.activityMainText, { color: theme.colors.text }]}>
            {getActivityText(item)}
          </Text>
          <Text style={[styles.activityTime, { color: theme.colors.textSecondary }]}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>
      {item.post && (
        <Image
          source={{ uri: (item.post as PostType).imageUrl }}
          style={styles.postThumbnail}
        />
      )}
    </TouchableOpacity>
  );

  if (loading && activities.length === 0) {
    return <LoadingSkeleton />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Activity Feed</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { borderBottomColor: theme.colors.border }]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {(['all', 'post_created', 'post_liked', 'comment_added', 'user_followed'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterTab,
                filterType === type && { borderBottomColor: theme.colors.primary },
              ]}
              onPress={() => setFilterType(type)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: filterType === type ? theme.colors.primary : theme.colors.textSecondary },
                  filterType === type && styles.filterTextActive,
                ]}
              >
                {type === 'all' ? 'All' : type.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {activities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="notifications-outline"
            title="No Activity"
            description="Activity from your friends will appear here"
          />
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivity}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loading && activities.length > 0 ? <ActivityIndicator /> : null}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? (isTablet ? theme.spacing.md : 12) : (isTablet ? theme.spacing.lg : 16),
    paddingTop: Platform.OS === 'ios' ? (isTablet ? theme.spacing.md : 12) : (isTablet ? theme.spacing.xl : 20),
    borderBottomWidth: 1,
    minHeight: isTablet ? 64 : 56,
  },
  backButton: {
    // Minimum touch target: 44x44 for iOS, 48x48 for Android
    minWidth: isAndroid ? 48 : 44,
    minHeight: isAndroid ? 48 : 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.sm : 8,
    marginLeft: isTablet ? -theme.spacing.sm : -8,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  placeholder: {
    width: isTablet ? 48 : 40,
  },
  headerTitle: {
    fontSize: isTablet ? 22 : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    letterSpacing: isIOS ? 0.3 : 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  filterContainer: {
    borderBottomWidth: 1,
  },
  filterScrollContent: {
    paddingHorizontal: isTablet ? theme.spacing.md : 8,
  },
  filterTab: {
    paddingHorizontal: isTablet ? theme.spacing.lg : 16,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    minWidth: isTablet ? 100 : 80,
  },
  filterText: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  filterTextActive: {
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xxl : 20,
  },
  list: {
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: isTablet ? theme.spacing.md : 12,
    paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: isTablet ? 50 : 40,
    height: isTablet ? 50 : 40,
    borderRadius: isTablet ? 25 : 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: isTablet ? theme.spacing.md : 12,
  },
  activityText: {
    flex: 1,
  },
  activityMainText: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('500'),
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  activityTime: {
    fontSize: isTablet ? theme.typography.small.fontSize + 1 : 12,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  postThumbnail: {
    width: isTablet ? 60 : 50,
    height: isTablet ? 60 : 50,
    borderRadius: isTablet ? theme.borderRadius.md : 8,
  },
});

