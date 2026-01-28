import api from './api';
import { NotificationResponse, MarkAsReadResponse } from '../types/notification';
import logger from '../utils/logger';
import { parseError } from '../utils/errorCodes';

// Get notifications
export const getNotifications = async (page: number = 1, limit: number = 20): Promise<NotificationResponse> => {
  try {
    const response = await api.get(`/api/v1/notifications?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId: string): Promise<MarkAsReadResponse> => {
  try {
    const response = await api.put(`/api/v1/notifications/${notificationId}/read`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (): Promise<MarkAsReadResponse> => {
  try {
    const response = await api.put('/api/v1/notifications/read-all');
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Get unread notification count
export const getUnreadCount = async (): Promise<{ unreadCount: number }> => {
  try {
    const response = await api.get('/api/v1/notifications/unread-count');
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
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
    
    logger.debug(`Processing notification: ${notification.type}`, notification);
    
    // Determine navigation based on notification type
    switch (notification.type) {
      case 'like':
        // Navigate to the liked post/short
        if (notification.postId || notification.post?._id) {
          const postId = notification.postId || notification.post?._id;
          return {
            success: true,
            message: 'Navigating to liked post...',
            shouldNavigate: true,
            navigationPath: `/(tabs)/home?postId=${postId}` // Post detail page commented out - navigate to home with postId
          };
        }
        // Post was deleted
        return {
          success: true,
          message: 'The post you liked has been deleted by the user.',
          shouldNavigate: false
        };
        
      case 'comment':
        // Navigate to the commented post/short
        if (notification.postId || notification.post?._id) {
          const postId = notification.postId || notification.post?._id;
          return {
            success: true,
            message: 'Navigating to commented post...',
            shouldNavigate: true,
            navigationPath: `/(tabs)/home?postId=${postId}` // Post detail page commented out - navigate to home with postId
          };
        }
        // Post was deleted
        return {
          success: true,
          message: 'The post you commented on has been deleted by the user.',
          shouldNavigate: false
        };
        
      case 'follow':
        // Navigate to user profile
        if (notification.fromUserId || notification.fromUser?._id) {
          const userId = notification.fromUserId || notification.fromUser?._id;
          return {
            success: true,
            message: 'Navigating to profile...',
            shouldNavigate: true,
            navigationPath: `/profile/${userId}`
          };
        }
        // User account was deleted
        return {
          success: true,
          message: 'This user account is no longer available.',
          shouldNavigate: false
        };
        
      case 'post_deleted':
      case 'short_deleted':
        return {
          success: true,
          message: 'This content has been deleted by the user.',
          shouldNavigate: false
        };
        
      case 'mention':
        // Navigate to the post where user was mentioned
        if (notification.postId || notification.post?._id) {
          const postId = notification.postId || notification.post?._id;
          return {
            success: true,
            message: 'Navigating to post...',
            shouldNavigate: true,
            navigationPath: `/(tabs)/home?postId=${postId}` // Post detail page commented out - navigate to home with postId
          };
        }
        return {
          success: true,
          message: 'The post you were mentioned in has been deleted.',
          shouldNavigate: false
        };
        
      case 'share':
        // Navigate to the shared post
        if (notification.postId || notification.post?._id) {
          const postId = notification.postId || notification.post?._id;
          return {
            success: true,
            message: 'Navigating to shared post...',
            shouldNavigate: true,
            navigationPath: `/(tabs)/home?postId=${postId}` // Post detail page commented out - navigate to home with postId
          };
        }
        return {
          success: true,
          message: 'The shared post has been deleted by the user.',
          shouldNavigate: false
        };
        
      default:
        // For unknown notification types, don't show a message if navigation is possible
        if (notification.postId || notification.post?._id) {
          const postId = notification.postId || notification.post?._id;
          return {
            success: true,
            message: 'Navigating to post...',
            shouldNavigate: true,
            navigationPath: `/(tabs)/home?postId=${postId}` // Post detail page commented out - navigate to home with postId
          };
        }
        if (notification.fromUserId || notification.fromUser?._id) {
          const userId = notification.fromUserId || notification.fromUser?._id;
          return {
            success: true,
            message: 'Navigating to profile...',
            shouldNavigate: true,
            navigationPath: `/profile/${userId}`
          };
        }
        // No navigation possible, but successfully processed
        return {
          success: true,
          message: 'Notification processed successfully.',
          shouldNavigate: false
        };
    }
  } catch (error: any) {
    logger.error('handleNotificationClick', error);
    const errorMessage = error?.message || '';
    
    // Check if error indicates content was deleted
    if (errorMessage.toLowerCase().includes('deleted') || 
        errorMessage.toLowerCase().includes('removed') ||
        errorMessage.toLowerCase().includes('not found')) {
      return {
        success: true,
        message: 'This content is no longer available.',
        shouldNavigate: false
      };
    }
    
    return {
      success: false,
      message: errorMessage || 'Failed to process notification. Please try again.',
      shouldNavigate: false
    };
  }
};

