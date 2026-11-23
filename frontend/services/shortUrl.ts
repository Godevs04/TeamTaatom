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

/**
 * Create or get a short URL for a journey
 */
export const createJourneyShortUrl = async (journeyId: string): Promise<string> => {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 10000);
    });

    const response = await Promise.race([
      api.post<CreateShortUrlResponse>('/api/v1/short-url/create', {
        journeyId,
      }),
      timeoutPromise,
    ]);

    if (response.data.success && response.data.data?.shortUrl) {
      return response.data.data.shortUrl;
    }

    throw new Error('Failed to create short URL');
  } catch (error: any) {
    logger.error('Error creating journey short URL:', error);
    throw error;
  }
};

/**
 * Get short URL for a journey (with caching)
 */
export const getJourneyShortUrl = async (journeyId: string): Promise<string> => {
  try {
    const cacheKey = `journey_${journeyId}`;
    const cached = shortUrlCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.url;
    }

    const shortUrl = await createJourneyShortUrl(journeyId);

    shortUrlCache.set(cacheKey, {
      url: shortUrl,
      timestamp: Date.now(),
    });

    return shortUrl;
  } catch (error: any) {
    logger.error('Error in getJourneyShortUrl:', error);
    throw error;
  }
};

/**
 * Create or get a short URL for a Connect page
 */
export const createConnectShortUrl = async (connectPageId: string): Promise<string> => {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 10000);
    });

    const response = await Promise.race([
      api.post<CreateShortUrlResponse>('/api/v1/short-url/create', {
        connectPageId,
      }),
      timeoutPromise,
    ]);

    if (response.data.success && response.data.data?.shortUrl) {
      return response.data.data.shortUrl;
    }

    throw new Error('Failed to create Connect short URL');
  } catch (error: any) {
    logger.error('Error creating Connect short URL:', error);
    throw error;
  }
};

/**
 * Get short URL for a Connect page (with caching)
 */
export const getConnectShortUrl = async (connectPageId: string): Promise<string> => {
  try {
    const cacheKey = `connect_${connectPageId}`;
    const cached = shortUrlCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.url;
    }

    const shortUrl = await createConnectShortUrl(connectPageId);

    shortUrlCache.set(cacheKey, {
      url: shortUrl,
      timestamp: Date.now(),
    });

    return shortUrl;
  } catch (error: any) {
    logger.error('Error in getConnectShortUrl:', error);
    throw error;
  }
};

export type ResolvedShortUrl = {
  type: 'post' | 'journey' | 'connect_page';
  path: string;
  postId?: string;
  journeyId?: string;
  connectPageId?: string;
};

/**
 * Resolve a short code to an in-app path (public API).
 * Used when Universal Links open https://taatom.com/s/:code inside the app.
 */
export const resolveShortCode = async (shortCode: string): Promise<ResolvedShortUrl> => {
  const code = String(shortCode || '').trim();
  if (!/^[A-Za-z0-9]{4,16}$/.test(code)) {
    throw new Error('Invalid short code');
  }

  const response = await api.get(`/api/v1/short-url/resolve/${encodeURIComponent(code)}`);
  const body = response.data as {
    success?: boolean;
    data?: ResolvedShortUrl;
    path?: string;
    type?: ResolvedShortUrl['type'];
  };

  // sendSuccess wraps payload under data; tolerate flat shapes too
  const payload = (body?.data && typeof body.data === 'object' ? body.data : body) as ResolvedShortUrl;
  if (!payload?.path) {
    throw new Error('Failed to resolve short URL');
  }
  return payload;
};
