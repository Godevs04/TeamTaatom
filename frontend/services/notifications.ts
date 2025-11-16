import api from './api';
import { NotificationResponse, MarkAsReadResponse } from '../types/notification';

// Get notifications
export const getNotifications = async (page: number = 1, limit: number = 20): Promise<NotificationResponse> => {
  try {
    const response = await api.get(`/api/v1/notifications?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch notifications');
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId: string): Promise<MarkAsReadResponse> => {
  try {
    const response = await api.put(`/api/v1/notifications/${notificationId}/read`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to mark notification as read');
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (): Promise<MarkAsReadResponse> => {
  try {
    const response = await api.put('/api/v1/notifications/read-all');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to mark all notifications as read');
  }
};

// Get unread notification count
export const getUnreadCount = async (): Promise<{ unreadCount: number }> => {
  try {
    const response = await api.get('/api/v1/notifications/unread-count');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get unread count');
  }
};

// Handle notification click - navigate to appropriate content
export const handleNotificationClick = async (notification: any): Promise<{ 
  success: boolean; 
  message: string; 
  shouldNavigate: boolean; 
  navigationPath?: string; 
}> => {
  try {
    // Mark notification as read first
    await markNotificationAsRead(notification._id);
    
    console.log('Processing notification:', notification.type, notification);
    
    // Determine navigation based on notification type
    switch (notification.type) {
      case 'like':
      case 'comment':
        // Navigate to the post/short
        if (notification.postId) {
          return {
            success: true,
            message: 'Navigating to post...',
            shouldNavigate: true,
            navigationPath: `/post/${notification.postId}`
          };
        }
        break;
      case 'follow':
        // Navigate to user profile
        if (notification.fromUserId) {
          return {
            success: true,
            message: 'Navigating to profile...',
            shouldNavigate: true,
            navigationPath: `/profile/${notification.fromUserId}`
          };
        }
        break;
      case 'post_deleted':
      case 'short_deleted':
        return {
          success: true,
          message: 'This content has been deleted by the user.',
          shouldNavigate: false
        };
      case 'like':
        return {
          success: true,
          message: 'Navigating to liked post...',
          shouldNavigate: true,
          navigationPath: `/post/${notification.postId}`
        };
      case 'comment':
        return {
          success: true,
          message: 'Navigating to commented post...',
          shouldNavigate: true,
          navigationPath: `/post/${notification.postId}`
        };
      case 'follow':
        return {
          success: true,
          message: 'Navigating to profile...',
          shouldNavigate: true,
          navigationPath: `/profile/${notification.fromUserId}`
        };
      default:
        return {
          success: true,
          message: 'Notification processed successfully.',
          shouldNavigate: false
        };
    }
    
    return {
      success: true,
      message: 'The current action was Removed or Deleted by the user.',
      shouldNavigate: false
    };
  } catch (error: any) {
    console.error('Error handling notification click:', error);
    return {
      success: false,
      message: error.message || 'Failed to process notification',
      shouldNavigate: false
    };
  }
};

