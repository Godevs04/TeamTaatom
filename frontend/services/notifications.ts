import api from './api';
import { NotificationResponse, MarkAsReadResponse } from '../types/notification';

// Get notifications
export const getNotifications = async (page: number = 1, limit: number = 20): Promise<NotificationResponse> => {
  try {
    const response = await api.get(`/notifications?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch notifications');
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId: string): Promise<MarkAsReadResponse> => {
  try {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to mark notification as read');
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (): Promise<MarkAsReadResponse> => {
  try {
    const response = await api.put('/notifications/read-all');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to mark all notifications as read');
  }
};

// Get unread notification count
export const getUnreadCount = async (): Promise<{ unreadCount: number }> => {
  try {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get unread count');
  }
};

