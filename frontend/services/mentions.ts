import api from './api';
import { parseError } from '../utils/errorCodes';

export interface MentionUser {
  _id: string;
  username: string;
  fullName: string;
  profilePic: string;
  displayName: string;
}

export interface MentionSearchResponse {
  users: MentionUser[];
}

/**
 * Search users for mention autocomplete
 */
export const searchUsersForMention = async (
  query: string,
  limit: number = 10
): Promise<MentionUser[]> => {
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const response = await api.get('/api/v1/mentions/search', {
      params: { q: query.trim(), limit },
    });
    return response.data.users || [];
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

