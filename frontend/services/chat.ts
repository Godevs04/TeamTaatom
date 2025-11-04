import api from './api';

// Clear all messages in a chat
export const clearChat = async (otherUserId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.delete(`/chat/${otherUserId}/messages`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to clear chat');
  }
};

// Mute or unmute chat notifications
export const toggleMuteChat = async (otherUserId: string): Promise<{ success: boolean; muted: boolean; message: string }> => {
  try {
    const response = await api.post(`/chat/${otherUserId}/mute`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to toggle mute');
  }
};

// Get mute status for a chat
export const getMuteStatus = async (otherUserId: string): Promise<{ muted: boolean }> => {
  try {
    const response = await api.get(`/chat/${otherUserId}/mute-status`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get mute status');
  }
};

