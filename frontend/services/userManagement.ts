import api from './api';
import logger from '../utils/logger';
import { parseError } from '../utils/errorCodes';

export interface AccountActivity {
  type: string;
  description: string;
  timestamp: string;
  ipAddress: string | null;
  device: string | null;
  location: string | null;
}

export interface ActiveSession {
  sessionId: string;
  device: string;
  ipAddress: string;
  location: string | null;
  lastActive: string;
  isCurrent: boolean;
}

export interface BlockedUser {
  _id: string;
  fullName: string;
  username: string;
  email: string;
  profilePic: string;
}

export interface QuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  days: string[];
}

// Get account activity
export const getAccountActivity = async (): Promise<{ activities: AccountActivity[]; totalCount: number }> => {
  try {
    const response = await api.get('/api/v1/users/me/activity');
    // Backend sendSuccess spreads data directly, so activities and totalCount are at root level
    return {
      activities: response.data.activities || [],
      totalCount: response.data.totalCount || 0
    };
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Get active sessions
export const getActiveSessions = async (): Promise<{ sessions: ActiveSession[]; totalCount: number }> => {
  try {
    const response = await api.get('/api/v1/users/me/sessions');
    // Backend sendSuccess spreads data directly, so sessions and totalCount are at root level
    return {
      sessions: response.data.sessions || [],
      totalCount: response.data.totalCount || 0
    };
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Logout from session
export const logoutFromSession = async (sessionId: string): Promise<void> => {
  try {
    await api.delete(`/api/v1/users/me/sessions/${sessionId}`);
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Get blocked users
export const getBlockedUsers = async (): Promise<{ blockedUsers: BlockedUser[]; totalCount: number }> => {
  try {
    const response = await api.get('/api/v1/users/me/blocked');
    // Backend sendSuccess spreads data directly
    return {
      blockedUsers: response.data.blockedUsers || [],
      totalCount: response.data.totalCount || 0
    };
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Unblock user
export const unblockUser = async (userId: string): Promise<void> => {
  try {
    await api.delete(`/api/v1/users/me/blocked/${userId}`);
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Resend verification email
export const resendVerificationEmail = async (): Promise<{ email: string }> => {
  try {
    const response = await api.post('/api/v1/users/me/verify-email');
    // Backend sendSuccess spreads data directly
    return {
      email: response.data.email || ''
    };
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Sync user data
export const syncUserData = async (): Promise<any> => {
  try {
    const response = await api.post('/api/v1/sync');
    // Backend sendSuccess spreads data directly
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Delete account (GDPR/DPDP compliance)
export const deleteAccount = async (password: string): Promise<{ message: string }> => {
  try {
    const response = await api.delete('/api/v1/users/me', {
      data: { password }
    });
    // Backend sendSuccess spreads data directly
    return {
      message: response.data.message || 'Account deleted successfully'
    };
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Export user data (GDPR compliance)
export const exportUserData = async (): Promise<any> => {
  try {
    const response = await api.get('/api/v1/users/me/export');
    // Backend sends JSON data directly
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

