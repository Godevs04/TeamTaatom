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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import NavBar from '../components/NavBar';
import FollowRequestPopup from '../components/FollowRequestPopup';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../services/notifications';
import { approveFollowRequest, rejectFollowRequest } from '../services/profile';
import { Notification } from '../types/notification';

const { width } = Dimensions.get('window');

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
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
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
    // Mark as read if not already read
    if (!notification.isRead) {
      try {
        await markNotificationAsRead(notification._id);
        setNotifications(prev =>
          prev.map(n =>
            n._id === notification._id ? { ...n, isRead: true } : n
          )
        );
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Navigate based on notification type
    switch (notification.type) {
      case 'like':
      case 'comment':
        if (notification.post) {
          router.push(`/post/${notification.post._id}`);
        }
        break;
      case 'follow':
      case 'follow_approved':
        router.push(`/profile/${notification.fromUser._id}`);
        break;
      case 'follow_request':
        // Show popup for follow request instead of navigating
        setFollowRequestPopup({
          visible: true,
          notification: notification,
          loading: false,
        });
        break;
      default:
        break;
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true }))
      );
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleFollowRequestApprove = async () => {
    if (!followRequestPopup.notification) return;

    setFollowRequestPopup(prev => ({ ...prev, loading: true }));

    try {
      // Use the requester's user ID directly from the notification
      const requesterId = followRequestPopup.notification.fromUser._id;
      console.log('Approving follow request for user:', requesterId);

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
        console.log('🔍 Current follow requests data:', debugData);
      } catch (debugError) {
        console.log('Debug endpoint failed:', debugError);
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
      console.error('Failed to approve follow request:', error);
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
      console.log('Rejecting follow request for user:', requesterId);

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
      console.error('Failed to reject follow request:', error);
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

  // Alert functions
  const showSuccess = (message: string) => {
    // For now, just log success - you can integrate with your alert system
    console.log('Success:', message);
  };

  const showError = (message: string) => {
    // For now, just log error - you can integrate with your alert system
    console.error('Error:', message);
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
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  notificationItem: {
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
  },
  notificationLeft: {
    marginRight: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  notificationIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  notificationText: {
    flex: 1,
    marginRight: 12,
  },
  notificationMessage: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
  },
  notificationRight: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  postThumbnailContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postThumbnail: {
    width: 48,
    height: 48,
  },
  unreadDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  footerLoader: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  markAllText: {
    fontSize: 17,
    fontWeight: '600',
  },
});