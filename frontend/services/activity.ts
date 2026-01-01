import api from './api';
import { PostType } from '../types/post';
import { UserType } from '../types/user';
import { Collection } from './collections';
import { parseError } from '../utils/errorCodes';

export interface Activity {
  _id: string;
  user: UserType;
  type:
    | 'post_created'
    | 'post_liked'
    | 'comment_added'
    | 'user_followed'
    | 'collection_created'
    | 'post_mention';
  post?: PostType;
  comment?: {
    _id: string;
    text: string;
  };
  collection?: Collection;
  targetUser?: UserType;
  metadata?: Record<string, any>;
  isPublic: boolean;
  createdAt: string;
}

export interface ActivityFeedResponse {
  activities: Activity[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalActivities: number;
    hasNextPage: boolean;
    limit: number;
  };
}

export interface ActivityFeedParams {
  page?: number;
  limit?: number;
  type?: Activity['type'];
  includeOwn?: boolean;
}

/**
 * Get activity feed (friend activities)
 */
export const getActivityFeed = async (params: ActivityFeedParams = {}): Promise<ActivityFeedResponse> => {
  try {
    const response = await api.get('/api/v1/activity', {
      params: {
        page: params.page || 1,
        limit: params.limit || 20,
        type: params.type,
        includeOwn: params.includeOwn !== undefined ? params.includeOwn : true,
      },
    });
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

/**
 * Get user's activity
 */
export const getUserActivity = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
  type?: Activity['type']
): Promise<ActivityFeedResponse> => {
  try {
    const response = await api.get(`/api/v1/activity/user/${userId}`, {
      params: { page, limit, type },
    });
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

/**
 * Update activity privacy settings
 */
export const updateActivityPrivacy = async (isPublic: boolean): Promise<void> => {
  try {
    await api.put('/api/v1/activity/privacy', { isPublic });
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

