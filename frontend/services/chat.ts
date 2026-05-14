import api from './api';
import logger from '../utils/logger';
import { parseError } from '../utils/errorCodes';

export interface ChatAttachment {
  type: 'image' | 'video' | 'file' | 'post';
  url?: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  width?: number;
  height?: number;
  storageKey?: string;
  // For shared posts
  postId?: string;
  postPreview?: {
    caption: string;
    imageUrl: string;
    authorName: string;
    authorProfilePic: string;
  };
}

export interface ChatMessage {
  _id: string;
  sender: string;
  text: string;
  attachments?: ChatAttachment[];
  timestamp: string;
  seen: boolean;
  seenBy?: string[];
  senderName?: string;
  senderProfilePic?: string;
}

export interface Chat {
  _id: string;
  participants: Array<{
    _id: string;
    fullName: string;
    profilePic: string;
  }>;
  messages: ChatMessage[];
  type?: 'user_chat' | 'admin_support' | 'connect_page';
  connectPageId?: {
    _id: string;
    name: string;
    profileImage: string;
    followerCount: number;
  } | null;
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
  messages: ChatMessage[];
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
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
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
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
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
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

/**
 * Send a message in a chat (1:1)
 */
export const sendMessage = async (
  otherUserId: string,
  text: string,
  attachments?: ChatAttachment[]
): Promise<{ success: boolean; message: any }> => {
  try {
    const body: { text?: string; attachments?: ChatAttachment[] } = {};
    if (text) body.text = text;
    if (attachments && attachments.length > 0) body.attachments = attachments;
    const response = await api.post(`/api/v1/chat/${otherUserId}/messages`, body);
    return response.data;
  } catch (error: any) {
    logger.error('sendMessage', error);
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

/**
 * Send a message to a group/room chat
 */
export const sendMessageToRoom = async (
  chatId: string,
  text: string,
  attachments?: ChatAttachment[]
): Promise<{ success: boolean; message: any }> => {
  try {
    const body: { text?: string; attachments?: ChatAttachment[] } = {};
    if (text) body.text = text;
    if (attachments && attachments.length > 0) body.attachments = attachments;
    const response = await api.post(`/api/v1/chat/room/${chatId}/messages`, body);
    return response.data;
  } catch (error: any) {
    logger.error('sendMessageToRoom', error);
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

/**
 * Upload media/files for chat attachments
 * Returns array of attachment metadata ready to be sent with a message
 */
export const uploadChatMedia = async (
  files: Array<{ uri: string; name: string; type: string; duration?: number; width?: number; height?: number }>
): Promise<{ attachments: ChatAttachment[] }> => {
  try {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
    });

    // Send media metadata as JSON so backend can include it in attachments
    const metadata = files.map((file) => ({
      name: file.name,
      duration: file.duration,
      width: file.width,
      height: file.height,
    }));
    formData.append('metadata', JSON.stringify(metadata));

    const response = await api.post('/api/v1/chat/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // 60s timeout for file uploads
    });
    return response.data;
  } catch (error: any) {
    logger.error('uploadChatMedia', error);
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

/**
 * Share/forward a post to a chat
 */
export const sharePostToChat = async (
  postId: string,
  target: { otherUserId?: string; chatId?: string }
): Promise<{ success: boolean; message: any }> => {
  try {
    const response = await api.post('/api/v1/chat/share-post', {
      postId,
      ...target,
    });
    return response.data;
  } catch (error: any) {
    logger.error('sharePostToChat', error);
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
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
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Clear all messages in a chat
export const clearChat = async (otherUserId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.delete(`/api/v1/chat/${otherUserId}/messages`);
    return response.data;
  } catch (error: any) {
    logger.error('clearChat', error);
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Mute or unmute chat notifications
export const toggleMuteChat = async (otherUserId: string): Promise<{ success: boolean; muted: boolean; message: string }> => {
  try {
    const response = await api.post(`/chat/${otherUserId}/mute`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Get mute status for a chat
export const getMuteStatus = async (otherUserId: string): Promise<{ muted: boolean }> => {
  try {
    const response = await api.get(`/chat/${otherUserId}/mute-status`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};
