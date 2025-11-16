import api from './api';

export interface Hashtag {
  name: string;
  postCount: number;
  lastUsedAt: string;
}

export interface HashtagPostsResponse {
  hashtag: Hashtag;
  posts: any[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalPosts: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    limit: number;
  };
}

/**
 * Search hashtags
 */
export const searchHashtags = async (query: string, limit: number = 20): Promise<Hashtag[]> => {
  try {
    const response = await api.get('/api/v1/hashtags/search', {
      params: { q: query, limit },
    });
    return response.data.hashtags || [];
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to search hashtags');
  }
};

/**
 * Get trending hashtags
 */
export const getTrendingHashtags = async (
  limit: number = 20,
  timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
): Promise<Hashtag[]> => {
  try {
    const response = await api.get('/api/v1/hashtags/trending', {
      params: { limit, timeRange },
    });
    return response.data.hashtags || [];
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get trending hashtags');
  }
};

/**
 * Get hashtag details
 */
export const getHashtagDetails = async (hashtag: string): Promise<Hashtag> => {
  try {
    const hashtagName = hashtag.replace(/^#/, '').toLowerCase();
    const response = await api.get(`/api/v1/hashtags/${hashtagName}`);
    return response.data.hashtag;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get hashtag details');
  }
};

/**
 * Get posts by hashtag
 */
export const getHashtagPosts = async (
  hashtag: string,
  page: number = 1,
  limit: number = 20
): Promise<HashtagPostsResponse> => {
  try {
    const hashtagName = hashtag.replace(/^#/, '').toLowerCase();
    const response = await api.get(`/api/v1/hashtags/${hashtagName}/posts`, {
      params: { page, limit },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get hashtag posts');
  }
};

