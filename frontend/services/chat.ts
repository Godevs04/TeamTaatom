import api from './api';
import logger from '../utils/logger';

export interface Chat {
  _id: string;
  participants: Array<{
    _id: string;
    fullName: string;
    profilePic: string;
  }>;
  messages: Array<{
    _id: string;
    sender: string;
    text: string;
    timestamp: string;
    seen: boolean;
  }>;
  updatedAt: string;
  createdAt: string;
}

export interface ChatListResponse {
  chats: Chat[];
}

export interface ChatResponse {
  chat: Chat;
}

export interface MessagesResponse {
  messages: Array<{
    _id: string;
    sender: string;
    text: string;
    timestamp: string;
    seen: boolean;
  }>;
}

/**
 * List all chats for the current user
 */
export const listChats = async (): Promise<ChatListResponse> => {
  try {
    const response = await api.get('/api/v1/chat');
    return response.data;
  } catch (error: any) {
    logger.error('listChats', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch chats');
  }
};

/**
 * Get a specific chat between current user and another user
 */
export const getChat = async (otherUserId: string): Promise<ChatResponse> => {
  try {
    const response = await api.get(`/api/v1/chat/${otherUserId}`);
    return response.data;
  } catch (error: any) {
    logger.error('getChat', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch chat');
  }
};

/**
 * Get messages for a specific chat
 */
export const getMessages = async (otherUserId: string): Promise<MessagesResponse> => {
  try {
    const response = await api.get(`/api/v1/chat/${otherUserId}/messages`);
    return response.data;
  } catch (error: any) {
    logger.error('getMessages', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch messages');
  }
};

/**
 * Send a message in a chat
 */
export const sendMessage = async (
  otherUserId: string,
  text: string
): Promise<{ success: boolean; message: any }> => {
  try {
    const response = await api.post(`/api/v1/chat/${otherUserId}/messages`, { text });
    return response.data;
  } catch (error: any) {
    logger.error('sendMessage', error);
    throw new Error(error.response?.data?.message || 'Failed to send message');
  }
};

/**
 * Mark all messages as seen in a chat
 */
export const markAllMessagesSeen = async (otherUserId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.post(`/api/v1/chat/${otherUserId}/mark-all-seen`);
    return response.data;
  } catch (error: any) {
    logger.error('markAllMessagesSeen', error);
    throw new Error(error.response?.data?.message || 'Failed to mark messages as seen');
  }
};

// Clear all messages in a chat
export const clearChat = async (otherUserId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.delete(`/api/v1/chat/${otherUserId}/messages`);
    return response.data;
  } catch (error: any) {
    logger.error('clearChat', error);
    throw new Error(error.response?.data?.message || 'Failed to clear chat');
  }
};

// Mute or unmute chat notifications
export const toggleMuteChat = async (otherUserId: string): Promise<{ success: boolean; muted: boolean; message: string }> => {
  try {
    const response = await api.post(`/api/v1/chat/${otherUserId}/mute`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to toggle mute');
  }
};

// Get mute status for a chat
export const getMuteStatus = async (otherUserId: string): Promise<{ muted: boolean }> => {
  try {
    const response = await api.get(`/api/v1/chat/${otherUserId}/mute-status`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get mute status');
  }
};

