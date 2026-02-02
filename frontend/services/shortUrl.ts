import api from './api';
import logger from '../utils/logger';
import { parseError } from '../utils/errorCodes';

export interface CreateShortUrlResponse {
  success: boolean;
  message: string;
  data: {
    shortUrl: string;
    shortCode: string;
    postId: string;
  };
}

/**
 * Create or get a short URL for a post
 * @param postId - The ID of the post to create a short URL for
 * @returns The short URL response
 */
export const createShortUrl = async (postId: string): Promise<string> => {
  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 second timeout
    });

    const response = await Promise.race([
      api.post<CreateShortUrlResponse>('/api/v1/short-url/create', {
        postId,
      }),
      timeoutPromise,
    ]);

    if (response.data.success && response.data.data?.shortUrl) {
      return response.data.data.shortUrl;
    }

    throw new Error('Failed to create short URL');
  } catch (error: any) {
    logger.error('Error creating short URL:', error);
    // Don't throw - let the caller handle fallback
    throw error;
  }
};

/**
 * Get short URL for a post (with caching to avoid multiple API calls)
 */
const shortUrlCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getShortUrl = async (postId: string): Promise<string> => {
  try {
    // Check cache first
    const cached = shortUrlCache.get(postId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      logger.debug('Using cached short URL for post:', postId);
      return cached.url;
    }

    logger.debug('Fetching short URL for post:', postId);
    // Fetch from API
    const shortUrl = await createShortUrl(postId);
    
    // Cache the result
    shortUrlCache.set(postId, {
      url: shortUrl,
      timestamp: Date.now(),
    });

    logger.debug('Short URL fetched successfully:', shortUrl);
    return shortUrl;
  } catch (error: any) {
    logger.error('Error in getShortUrl:', error);
    // Re-throw to let caller handle fallback
    throw error;
  }
};
