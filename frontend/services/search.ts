import api from './api';
import { PostType } from '../types/post';

export interface AdvancedSearchParams {
  q?: string; // Text search in caption
  hashtag?: string; // Hashtag filter
  location?: string; // Location filter (address)
  startDate?: string; // Start date (ISO string)
  endDate?: string; // End date (ISO string)
  type?: 'photo' | 'short'; // Post type filter
  page?: number;
  limit?: number;
}

export interface SearchPostsResponse {
  posts: PostType[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalPosts: number;
    hasNextPage: boolean;
    limit: number;
  };
}

/**
 * Advanced search for posts
 */
export const searchPosts = async (params: AdvancedSearchParams): Promise<SearchPostsResponse> => {
  try {
    const response = await api.get('/api/v1/search/posts', {
      params: {
        q: params.q,
        hashtag: params.hashtag,
        location: params.location,
        startDate: params.startDate,
        endDate: params.endDate,
        type: params.type,
        page: params.page || 1,
        limit: params.limit || 20,
      },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to search posts');
  }
};

/**
 * Search posts by location
 */
export const searchByLocation = async (
  location: string,
  page: number = 1,
  limit: number = 20
): Promise<SearchPostsResponse> => {
  try {
    const response = await api.get('/api/v1/search/location', {
      params: { location, page, limit },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to search by location');
  }
};

