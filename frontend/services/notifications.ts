import api from './api';
import { NotificationResponse, MarkAsReadResponse } from '../types/notification';
import logger from '../utils/logger';
import { parseError } from '../utils/errorCodes';
import { contentNoun, contentRoute, refId } from '../utils/contentRoutes';

/** Route for a notification about a post, short or long video; null when the content is gone. */
const notificationContentRoute = (notification: any, openComments: boolean) => {
  const postId = refId(notification.postId) || refId(notification.post);
  if (!postId) return null;
  const postType = notification.post?.type || notification.postType;
  const ownerId = refId(notification.post?.user) || notification.postOwnerId || null;
  return { path: contentRoute(postId, postType, ownerId, { openComments }), noun: contentNoun(postType) };
};

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
  contentUnavailable?: boolean;
}> => {
  try {
    // Mark notification as read first
    await markNotificationAsRead(notification._id);
    
    logger.debug(`Processing notification: ${notification.type}`, notification);
    
    // Determine navigation based on notification type
    switch (notification.type) {
      case 'like':
      case 'comment':
      case 'mention':
      case 'post_mention':
      case 'share': {
        const openComments =
          notification.type === 'comment' ||
          (notification.type === 'post_mention' &&
            !!(notification.comment || notification.commentId || notification.metadata?.text != null));
        const route = notificationContentRoute(notification, openComments);
        if (route) {
          return {
            success: true,
            message: `Opening ${route.noun}...`,
            shouldNavigate: true,
            navigationPath: route.path,
          };
        }
        // Content was deleted
        return {
          success: true,
          message: 'This content is no longer available.',
          shouldNavigate: false,
          contentUnavailable: true
        };
      }
        
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
          message: 'This user is no longer available.',
          shouldNavigate: false,
          contentUnavailable: true
        };

      case 'follow_request':
        // In-app list opens FollowRequestPopup; from handler (e.g. push) navigate to requester profile
        if (notification.fromUserId || notification.fromUser?._id) {
          const userId = notification.fromUserId || notification.fromUser?._id;
          return {
            success: true,
            message: 'Navigating to profile...',
            shouldNavigate: true,
            navigationPath: `/profile/${userId}`
          };
        }
        return {
          success: true,
          message: 'This user account is no longer available.',
          shouldNavigate: false
        };

      case 'follow_approved':
      case 'route_access_approved':
        // Navigate to approver's profile
        if (notification.fromUserId || notification.fromUser?._id) {
          const userId = notification.fromUserId || notification.fromUser?._id;
          return {
            success: true,
            message: 'Navigating to profile...',
            shouldNavigate: true,
            navigationPath: `/profile/${userId}`
          };
        }
        return {
          success: true,
          message: 'This user account is no longer available.',
          shouldNavigate: false
        };

      case 'route_access_request':
        // Navigate to Route Access Requests screen under settings
        return {
          success: true,
          message: 'Opening route access requests...',
          shouldNavigate: true,
          navigationPath: '/settings/route-access-requests'
        };

      case 'route_access_accepted':
      case 'route_access_rejected':
        // No navigation needed, just read-marked
        return {
          success: true,
          message: 'Notification marked as read',
          shouldNavigate: false
        };

      case 'subscription_active': {
        // Sent to the page owner when someone activates a paid subscription /
        // purchase on their Connect page. Tapping opens the page so they can
        // see the new subscriber list.
        const connectPageId =
          notification.metadata?.connectPageId ||
          notification.connectPageId ||
          notification.entityId;
        if (connectPageId) {
          return {
            success: true,
            message: 'Opening your Connect page...',
            shouldNavigate: true,
            navigationPath: `/connect/page/${connectPageId}`,
          };
        }
        return {
          success: true,
          message: 'This page is no longer available.',
          shouldNavigate: false,
          contentUnavailable: true,
        };
      }

      case 'creator_program':
        return {
          success: true,
          message: notification.metadata?.message || 'Opening Creator Dashboard...',
          shouldNavigate: true,
          navigationPath: '/creator-monetization',
        };

      case 'post_deleted':
      case 'short_deleted':
        return {
          success: true,
          message: 'This content has been deleted by the user.',
          shouldNavigate: false
        };
        
      default: {
        // For unknown notification types, navigate by content type if available
        const route = notificationContentRoute(notification, false);
        if (route) {
          return {
            success: true,
            message: `Opening ${route.noun}...`,
            shouldNavigate: true,
            navigationPath: route.path,
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

