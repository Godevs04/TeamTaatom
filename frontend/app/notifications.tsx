import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import NavBar from '../components/NavBar';
import FollowRequestPopup from '../components/FollowRequestPopup';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, handleNotificationClick } from '../services/notifications';
import { approveFollowRequest, rejectFollowRequest } from '../services/profile';
import { Notification } from '../types/notification';
import { triggerRefreshHaptic } from '../utils/hapticFeedback';
import { theme } from '../constants/theme';
import logger from '../utils/logger';

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

interface NotificationSection {
  title: string;
  data: Notification[];
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [followRequestPopup, setFollowRequestPopup] = useState({
    visible: false,
    notification: null as Notification | null,
    loading: false,
  });
  const router = useRouter();
  const { theme, mode } = useTheme();
  const { showSuccess, showError, showInfo, showWarning } = useAlert();

  const loadNotifications = useCallback(async (pageNum = 1, isRefresh = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await getNotifications(pageNum, 20);
      
      if (isRefresh || pageNum === 1) {
        setNotifications(response.notifications);
      } else {
        setNotifications(prev => [...prev, ...response.notifications]);
      }
      
      setHasMore(response.pagination.hasNextPage);
      setPage(pageNum);
    } catch (error) {
      logger.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    // Trigger haptic feedback for better UX
    triggerRefreshHaptic();
    setRefreshing(true);
    await loadNotifications(1, true);
    setRefreshing(false);
  }, [loadNotifications]);

  const loadMore = useCallback(async () => {
    if (!loadingMore && hasMore) {
      await loadNotifications(page + 1);
    }
  }, [loadNotifications, loadingMore, hasMore, page]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = async (notification: Notification) => {
    try {
      // Handle special cases first
      if (notification.type === 'follow_request') {
        setFollowRequestPopup({
          visible: true,
          notification: notification,
          loading: false,
        });
        return;
      }

      // Use the new handleNotificationClick service
      const result = await handleNotificationClick(notification);
      
      if (result.success) {
        // Update notification as read in local state
        setNotifications(prev =>
          prev.map(n =>
            n._id === notification._id ? { ...n, isRead: true } : n
          )
        );

        // Navigate if needed
        if (result.shouldNavigate && result.navigationPath) {
          logger.debug('Navigating to:', result.navigationPath);
          router.push(result.navigationPath);
        } else {
          // Show info message for non-navigable notifications
          logger.debug('Showing info message:', result.message);
          showInfo(result.message);
        }
      } else {
        showError(result.message);
      }
    } catch (error: any) {
      logger.error('Failed to handle notification press:', error);
      showError('Failed to process notification. Please try again.');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true }))
      );
    } catch (error) {
      logger.error('Failed to mark all as read:', error);
    }
  };

  const handleFollowRequestApprove = async () => {
    if (!followRequestPopup.notification) return;

    setFollowRequestPopup(prev => ({ ...prev, loading: true }));

    try {
      // Use the requester's user ID directly from the notification
      const requesterId = followRequestPopup.notification.fromUser._id;
      logger.debug('Approving follow request for user:', requesterId);

      // Debug: Check current follow requests data
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const token = await AsyncStorage.getItem('authToken');
        const debugResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/profile/follow-requests/debug`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const debugData = await debugResponse.json();
        logger.debug('🔍 Current follow requests data:', debugData);
      } catch (debugError) {
        logger.debug('Debug endpoint failed:', debugError);
      }

      await approveFollowRequest(requesterId);
      
      // Remove the notification from the list
      setNotifications(prev => 
        prev.filter(n => n._id !== followRequestPopup.notification!._id)
      );

      // Close popup
      setFollowRequestPopup({
        visible: false,
        notification: null,
        loading: false,
      });
      
      // Show success message
      showSuccess('Follow request approved successfully!');
    } catch (error) {
      logger.error('Failed to approve follow request:', error);
      showError('Failed to approve follow request. Please try again.');
      setFollowRequestPopup(prev => ({ ...prev, loading: false }));
    }
  };

  const handleFollowRequestReject = async () => {
    if (!followRequestPopup.notification) return;

    setFollowRequestPopup(prev => ({ ...prev, loading: true }));

    try {
      // Use the requester's user ID directly from the notification
      const requesterId = followRequestPopup.notification.fromUser._id;
      logger.debug('Rejecting follow request for user:', requesterId);

      await rejectFollowRequest(requesterId);
      
      // Remove the notification from the list
      setNotifications(prev => 
        prev.filter(n => n._id !== followRequestPopup.notification!._id)
      );

      // Close popup
      setFollowRequestPopup({
        visible: false,
        notification: null,
        loading: false,
      });
      
      // Show success message
      showSuccess('Follow request rejected successfully!');
    } catch (error) {
      logger.error('Failed to reject follow request:', error);
      showError('Failed to reject follow request. Please try again.');
      setFollowRequestPopup(prev => ({ ...prev, loading: false }));
    }
  };

  const handleFollowRequestCancel = () => {
    setFollowRequestPopup({
      visible: false,
      notification: null,
      loading: false,
    });
  };

  const groupNotificationsByTime = (notifications: Notification[]): NotificationSection[] => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const todayNotifications = notifications.filter(n => new Date(n.createdAt) >= today);
    const yesterdayNotifications = notifications.filter(n => 
      new Date(n.createdAt) >= yesterday && new Date(n.createdAt) < today
    );
    const lastWeekNotifications = notifications.filter(n => 
      new Date(n.createdAt) >= lastWeek && new Date(n.createdAt) < yesterday
    );
    const lastMonthNotifications = notifications.filter(n => 
      new Date(n.createdAt) >= lastMonth && new Date(n.createdAt) < lastWeek
    );

    const sections: NotificationSection[] = [];
    
    if (todayNotifications.length > 0) {
      sections.push({ title: 'Today', data: todayNotifications });
    }
    if (yesterdayNotifications.length > 0) {
      sections.push({ title: 'Yesterday', data: yesterdayNotifications });
    }
    if (lastWeekNotifications.length > 0) {
      sections.push({ title: 'Last 7 days', data: lastWeekNotifications });
    }
    if (lastMonthNotifications.length > 0) {
      sections.push({ title: 'Last 30 days', data: lastMonthNotifications });
    }

    return sections;
  };

  const getNotificationIconColor = (type: string) => {
    switch (type) {
      case 'like':
      case 'comment':
        return '#FF3B30'; // Red color for likes and comments
      case 'follow':
      case 'follow_request':
      case 'follow_approved':
        return '#007AFF'; // Blue color for follows and follow requests
      default:
        return theme.colors.primary;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return 'heart';
      case 'comment':
        return 'chatbubble';
      case 'follow':
        return 'person-add';
      case 'follow_request':
        return 'person-add-outline';
      case 'follow_approved':
        return 'checkmark-circle';
      default:
        return 'notifications';
    }
  };

  const getNotificationMessage = (notification: Notification) => {
    const { type, fromUser } = notification;
    const userName = fromUser?.fullName || 'Someone';

    switch (type) {
      case 'like':
        return `${userName} liked your post`;
      case 'comment':
        return `${userName} commented on your post`;
      case 'follow':
        return `${userName} started following you`;
      case 'follow_request':
        return `${userName} wants to follow you`;
      case 'follow_approved':
        return `${userName} approved your follow request`;
      default:
        return 'You have a new notification';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInMonths = Math.floor(diffInDays / 30);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays < 30) {
      return `${diffInDays}d ago`;
    } else if (diffInMonths < 12) {
      return `${diffInMonths}mo ago`;
    } else {
      const years = Math.floor(diffInMonths / 12);
      return `${years}y ago`;
    }
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        {
          backgroundColor: item.isRead 
            ? (mode === 'dark' ? '#1C1C1E' : '#FFFFFF') 
            : (mode === 'dark' ? '#2C2C2E' : '#F8F9FA'),
          borderLeftWidth: item.isRead ? 0 : 4,
          borderLeftColor: item.isRead ? 'transparent' : '#007AFF',
          shadowColor: mode === 'dark' ? '#000' : '#000',
          shadowOpacity: mode === 'dark' ? 0.3 : 0.08,
        },
      ]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationLeft}>
          <View style={styles.avatarContainer}>
            {item.fromUser?.profilePic ? (
              <Image
                source={{ uri: item.fromUser.profilePic }}
                style={[
                  styles.avatar,
                  { borderColor: mode === 'dark' ? '#3A3A3C' : '#E5E5E7' }
                ]}
                onError={(error) => {
                  if (__DEV__) {
                    logger.warn('Profile image failed to load:', {
                      userId: item.fromUser?._id,
                      url: item.fromUser?.profilePic?.substring(0, 80),
                      error: error?.nativeEvent?.error?.message || 'Unknown'
                    });
                  }
                }}
                defaultSource={require('../assets/avatars/male_avatar.png')}
              />
            ) : (
              <View style={[
                styles.avatarPlaceholder,
                { 
                  backgroundColor: mode === 'dark' ? '#3A3A3C' : '#F2F2F7',
                  borderColor: mode === 'dark' ? '#3A3A3C' : '#E5E5E7'
                }
              ]}>
                <Ionicons 
                  name="person" 
                  size={24} 
                  color={mode === 'dark' ? '#8E8E93' : '#8E8E93'} 
                />
              </View>
            )}
            
            <View style={[
              styles.notificationIcon, 
              { 
                backgroundColor: getNotificationIconColor(item.type),
                borderColor: mode === 'dark' ? '#1C1C1E' : '#FFFFFF'
              }
            ]}>
              <Ionicons
                name={getNotificationIcon(item.type) as any}
                size={12}
                color="white"
              />
            </View>
          </View>
        </View>

        <View style={styles.notificationText}>
          <Text style={[
            styles.notificationMessage, 
            { color: mode === 'dark' ? '#FFFFFF' : '#1C1C1E' }
          ]}>
            {getNotificationMessage(item)}
          </Text>
          <Text style={[
            styles.notificationTime, 
            { color: mode === 'dark' ? '#8E8E93' : '#8E8E93' }
          ]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>

        <View style={styles.notificationRight}>
          {item.post?.imageUrl && (
            <View style={[
              styles.postThumbnailContainer,
              { borderColor: mode === 'dark' ? '#3A3A3C' : '#E5E5E7' }
            ]}>
              <Image
                source={{ uri: item.post.imageUrl }}
                style={styles.postThumbnail}
                resizeMode="cover"
                onError={(error) => {
                  if (__DEV__) {
                    logger.warn('Post thumbnail failed to load:', {
                      postId: item.post?._id,
                      url: item.post?.imageUrl?.substring(0, 80),
                      error: error?.nativeEvent?.error?.message || 'Unknown'
                    });
                  }
                }}
              />
            </View>
          )}
          {!item.isRead && (
            <View style={[
              styles.unreadDot,
              { borderColor: mode === 'dark' ? '#1C1C1E' : '#FFFFFF' }
            ]} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: NotificationSection }) => (
    <View style={[
      styles.sectionHeader,
      { backgroundColor: mode === 'dark' ? '#000000' : '#F8F9FA' }
    ]}>
      <Text style={[
        styles.sectionTitle,
        { color: mode === 'dark' ? '#FFFFFF' : '#1C1C1E' }
      ]}>
        {section.title}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={[
        styles.footerLoader,
        { backgroundColor: mode === 'dark' ? '#000000' : '#F8F9FA' }
      ]}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[
        styles.container,
        { backgroundColor: mode === 'dark' ? '#000000' : '#F8F9FA' }
      ]}>
        <NavBar title="Notifications" showBack={true} onBack={() => router.back()} />
        <View style={[
          styles.loadingContainer,
          { backgroundColor: mode === 'dark' ? '#000000' : '#F8F9FA' }
        ]}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  const sections = groupNotificationsByTime(notifications);

  return (
    <View style={[
      styles.container,
      { backgroundColor: mode === 'dark' ? '#000000' : '#F8F9FA' }
    ]}>
      <NavBar
        title="Notifications"
        showBack={true}
        onBack={() => router.back()}
        rightComponent={
          notifications.some(n => !n.isRead) ? (
            <TouchableOpacity onPress={handleMarkAllAsRead}>
              <Text style={[
                styles.markAllText,
                { color: '#007AFF' }
              ]}>
                Mark All Read
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {notifications.length === 0 ? (
        <View style={[
          styles.emptyContainer,
          { backgroundColor: mode === 'dark' ? '#000000' : '#F8F9FA' }
        ]}>
          <Ionicons 
            name="notifications-outline" 
            size={80} 
            color={mode === 'dark' ? '#3A3A3C' : '#C7C7CC'} 
          />
          <Text style={[
            styles.emptyTitle,
            { color: mode === 'dark' ? '#FFFFFF' : '#1C1C1E' }
          ]}>
            No Notifications Yet
          </Text>
          <Text style={[
            styles.emptyMessage,
            { color: mode === 'dark' ? '#8E8E93' : '#8E8E93' }
          ]}>
            When someone likes your posts, comments, or follows you, you'll see it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <View>
              {renderSectionHeader({ section: item })}
              {item.data.map((notification) => (
                <View key={notification._id}>
                  {renderNotificationItem({ item: notification })}
                </View>
              ))}
            </View>
          )}
          keyExtractor={(item) => item.title}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.1}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
        />
      )}
      
      <FollowRequestPopup
        visible={followRequestPopup.visible}
        userName={followRequestPopup.notification?.fromUser?.fullName || ''}
        userEmail={followRequestPopup.notification?.fromUser?.email || ''}
        onApprove={handleFollowRequestApprove}
        onReject={handleFollowRequestReject}
        onCancel={handleFollowRequestCancel}
        loading={followRequestPopup.loading}
      />
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xxl : 40,
  },
  emptyTitle: {
    fontSize: isTablet ? theme.typography.h1.fontSize : 28,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginTop: isTablet ? theme.spacing.xl : 20,
    marginBottom: isTablet ? theme.spacing.md : 12,
    textAlign: 'center',
    letterSpacing: isIOS ? -0.3 : 0,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  emptyMessage: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 17,
    fontFamily: getFontFamily('400'),
    textAlign: 'center',
    lineHeight: isTablet ? 26 : 24,
    fontWeight: '400',
    maxWidth: isTablet ? 500 : 300,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  sectionHeader: {
    paddingHorizontal: isTablet ? theme.spacing.xl : 20,
    paddingVertical: isTablet ? theme.spacing.md : 12,
  },
  sectionTitle: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 17,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  notificationItem: {
    marginHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    marginVertical: isTablet ? 6 : 4,
    borderRadius: isTablet ? theme.borderRadius.lg : 16,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.md : 12,
    paddingHorizontal: isTablet ? theme.spacing.lg : 16,
  },
  notificationLeft: {
    marginRight: isTablet ? theme.spacing.lg : 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: isTablet ? 60 : 48,
    height: isTablet ? 60 : 48,
    borderRadius: isTablet ? 30 : 24,
    borderWidth: 2,
  },
  avatarPlaceholder: {
    width: isTablet ? 60 : 48,
    height: isTablet ? 60 : 48,
    borderRadius: isTablet ? 30 : 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  notificationIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: isTablet ? 24 : 20,
    height: isTablet ? 24 : 20,
    borderRadius: isTablet ? 12 : 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  notificationText: {
    flex: 1,
    marginRight: isTablet ? theme.spacing.md : 12,
  },
  notificationMessage: {
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    lineHeight: isTablet ? 22 : 20,
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  notificationTime: {
    fontSize: isTablet ? theme.typography.small.fontSize + 1 : 12,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    opacity: 0.7,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  notificationRight: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  postThumbnailContainer: {
    borderRadius: isTablet ? theme.borderRadius.md : 12,
    overflow: 'hidden',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postThumbnail: {
    width: isTablet ? 60 : 48,
    height: isTablet ? 60 : 48,
  },
  unreadDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: isTablet ? 12 : 10,
    height: isTablet ? 12 : 10,
    borderRadius: isTablet ? 6 : 5,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  footerLoader: {
    paddingVertical: isTablet ? theme.spacing.xl : 24,
    alignItems: 'center',
  },
  markAllText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 17,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});