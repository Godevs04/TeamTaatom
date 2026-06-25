import api from './api';
import { PostType } from '../types/post';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRateLimitError, handleRateLimitError } from '../utils/rateLimitHandler';
import { getApiUrl } from '../utils/config';
import logger from '../utils/logger';
import { parseError } from '../utils/errorCodes';

// Simple in-memory cache and rate-limit friendly helpers
const postByIdCache = new Map<string, { data: any; expiresAt: number }>();
const postByIdInFlight = new Map<string, Promise<any>>();
const POST_CACHE_TTL_MS = 60_000; // 60s
let lastPostByIdCall = 0;
const MIN_SPACING_MS = 150; // space requests to avoid 429

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const hasFiniteCoordinate = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

export interface CreatePostData {
  images: Array<{
    uri: string;
    type: string;
    name: string;
  }>;
  caption: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  hasExifGps?: boolean;      // true if location came from EXIF GPS
  takenAt?: Date;            // capture date from EXIF or asset metadata
  source?: 'taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only';
  fromCamera?: boolean;      // true if taken via in-app camera
  songId?: string;
  songStartTime?: number;
  songEndTime?: number;
  songVolume?: number;
  spotType?: string;
  travelInfo?: string;
  aspectRatio?: '1:1' | '16:9' | 'full' | '1.91:1';
  filter?: 'original' | 'vivid' | 'warm' | 'cool' | 'bw';
  detectedPlace?: {          // Detected place data for admin review
    name?: string;
    country?: string;
    countryCode?: string;
    city?: string;
    stateProvince?: string;
    continent?: string;
    latitude?: number;
    longitude?: number;
    placeId?: string;
    formattedAddress?: string;
  };
}

export interface CreateShortData {
  video: {
    uri: string;
    type: string;
    name: string;
  };
  image?: {
    uri: string;
    type: string;
    name: string;
  };
  caption: string;
  audioSource?: 'taatom_library' | 'user_original';
  copyrightAccepted?: boolean;
  copyrightAcceptedAt?: string;
  tags?: string[];
  address?: string;
  latitude?: number;
  longitude?: number;
  hasExifGps?: boolean;      // true if location came from EXIF GPS
  takenAt?: Date;            // capture date from EXIF or asset metadata
  source?: 'taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only';
  fromCamera?: boolean;      // true if recorded via in-app camera
  songId?: string;
  songStartTime?: number;
  songEndTime?: number;
  songVolume?: number;
  spotType?: string;
  travelInfo?: string;
}

export interface PostsResponse {
  posts: PostType[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalPosts: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    limit: number;
    nextCursor?: string | null;
  };
}

export type FeedMode = 'recents' | 'friends' | 'popular';

export interface UserPostsResponse {
  posts: PostType[];
  user: {
    _id: string;
    fullName: string;
    profilePic: string;
  };
  totalPosts: number;
}

export interface ShortsResponse {
  shorts: PostType[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalShorts: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    limit: number;
    nextCursor?: string | null;
  };
}

// Get all posts
export const getPostById = async (postId: string, bypassCache: boolean = false) => {
  if (bypassCache) {
    postByIdCache.delete(postId);
  } else {
    // cached response if fresh
    const cached = postByIdCache.get(postId);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  const inFlight = postByIdInFlight.get(postId);
  if (inFlight) {
    return inFlight;
  }

  const request = fetchPostById(postId);
  postByIdInFlight.set(postId, request);

  try {
    return await request;
  } finally {
    postByIdInFlight.delete(postId);
  }
};

const fetchPostById = async (postId: string) => {
  // spacing to avoid bursts
  const since = Date.now() - lastPostByIdCall;
  if (since < MIN_SPACING_MS) {
    await sleep(MIN_SPACING_MS - since);
  }
  lastPostByIdCall = Date.now();

  // retry with small backoff if 429
  let attempt = 0;
  const maxAttempts = 3;
  let delay = 300;
  while (attempt < maxAttempts) {
    try {
      const response = await api.get(`/api/v1/posts/${postId}`);
      const data = response.data;
      postByIdCache.set(postId, { data, expiresAt: Date.now() + POST_CACHE_TTL_MS });
      return data;
    } catch (error: any) {
      if (isRateLimitError(error) && attempt < maxAttempts - 1) {
        await sleep(delay);
        delay *= 2;
        attempt++;
        continue;
      }
      throw error;
    }
  }
};

export const getPosts = async (
  page: number = 1,
  limit: number = 20,
  feed: FeedMode = 'recents'
): Promise<PostsResponse> => {
  try {
    const response = await api.get(`/api/v1/posts?page=${page}&limit=${limit}&feed=${feed}`);
    return response.data;
  } catch (error: any) {
    if (isRateLimitError(error)) {
      // gentle client backoff and retry once
      const rateLimitInfo = handleRateLimitError(error, 'getPosts');
      await sleep(500);
      try {
        const retry = await api.get(`/api/v1/posts?page=${page}&limit=${limit}&feed=${feed}`);
        return retry.data;
      } catch (e: any) {
        throw new Error(rateLimitInfo.message);
      }
    }
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Create new post with progress tracking
export const createPostWithProgress = async (
  data: CreatePostData,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<{ message: string; post: PostType }> => {
  try {
    const formData = new FormData();
    
    // Add all images
    data.images.forEach((image) => {
      formData.append('images', {
        uri: image.uri,
        type: image.type,
        name: image.name,
      } as any);
    });
    
    // Add other fields
    formData.append('caption', data.caption);
    if (data.address) formData.append('address', data.address);
    if (hasFiniteCoordinate(data.latitude)) formData.append('latitude', data.latitude.toString());
    if (hasFiniteCoordinate(data.longitude)) formData.append('longitude', data.longitude.toString());
    
    // Add location metadata for TripScore v2
    if (data.hasExifGps !== undefined) {
      formData.append('hasExifGps', data.hasExifGps ? 'true' : 'false');
    }
    // Defensive: ensure takenAt is a valid Date before calling toISOString
    if (data.takenAt) {
      let takenAtDate: Date | null = null;
      if (data.takenAt instanceof Date) {
        takenAtDate = data.takenAt;
      } else if (typeof data.takenAt === 'string') {
        takenAtDate = new Date(data.takenAt);
      }
      // Only append if we have a valid Date
      if (takenAtDate && !isNaN(takenAtDate.getTime())) {
        formData.append('takenAt', takenAtDate.toISOString());
      } else {
        logger.warn('takenAt is not a valid Date, skipping');
      }
    }
    if (data.source) {
      formData.append('source', data.source);
    }
    if (data.fromCamera !== undefined) {
      formData.append('fromCamera', data.fromCamera ? 'true' : 'false');
    }
    
    if (data.songId) {
      formData.append('songId', data.songId);
      if (data.songStartTime !== undefined) formData.append('songStartTime', data.songStartTime.toString());
      if (data.songEndTime !== undefined) formData.append('songEndTime', data.songEndTime.toString());
      if (data.songVolume !== undefined) formData.append('songVolume', data.songVolume.toString());
    }
    
    // Add TripScore metadata
    if (data.spotType) formData.append('spotType', data.spotType);
    if (data.travelInfo) formData.append('travelInfo', data.travelInfo);
    if ((data as any).aspectRatio) formData.append('aspectRatio', (data as any).aspectRatio);
    if ((data as any).filter && (data as any).filter !== 'original') formData.append('filter', (data as any).filter);
    
    // Add detected place data for admin review
    if (data.detectedPlace) {
      formData.append('detectedPlaceName', data.detectedPlace.name || '');
      formData.append('detectedPlaceCountry', data.detectedPlace.country || '');
      formData.append('detectedPlaceCountryCode', data.detectedPlace.countryCode || '');
      formData.append('detectedPlaceCity', data.detectedPlace.city || '');
      formData.append('detectedPlaceStateProvince', data.detectedPlace.stateProvince || '');
      if (data.detectedPlace.latitude !== undefined && data.detectedPlace.latitude !== null) {
        formData.append('detectedPlaceLatitude', data.detectedPlace.latitude.toString());
      }
      if (data.detectedPlace.longitude !== undefined && data.detectedPlace.longitude !== null) {
        formData.append('detectedPlaceLongitude', data.detectedPlace.longitude.toString());
      }
      formData.append('detectedPlacePlaceId', data.detectedPlace.placeId || '');
      formData.append('detectedPlaceFormattedAddress', data.detectedPlace.formattedAddress || '');
    }

    const response = await api.post('/api/v1/posts', formData, {
      timeout: 300000, // 5 minutes timeout for uploading posts/images
      headers: {
        'Content-Type': 'multipart/form-data', // Let client set boundary for FormData
      },
      signal,
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          onProgress(Math.min(progress, 95));
        }
      }
    });

    if (onProgress) {
      onProgress(100);
    }

    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Create new post
export const createPost = async (data: CreatePostData): Promise<{ message: string; post: PostType }> => {
  try {
    const formData = new FormData();
    
    // Add all images
    data.images.forEach((image) => {
      formData.append('images', {
        uri: image.uri,
        type: image.type,
        name: image.name,
      } as any);
    });
    
    // Add other fields
    formData.append('caption', data.caption);
    if (data.address) formData.append('address', data.address);
    if (hasFiniteCoordinate(data.latitude)) formData.append('latitude', data.latitude.toString());
    if (hasFiniteCoordinate(data.longitude)) formData.append('longitude', data.longitude.toString());
    
    // Add location metadata for TripScore v2
    if (data.hasExifGps !== undefined) {
      formData.append('hasExifGps', data.hasExifGps ? 'true' : 'false');
    }
    // Defensive: ensure takenAt is a valid Date before calling toISOString
    if (data.takenAt) {
      let takenAtDate: Date | null = null;
      if (data.takenAt instanceof Date) {
        takenAtDate = data.takenAt;
      } else if (typeof data.takenAt === 'string') {
        takenAtDate = new Date(data.takenAt);
      }
      // Only append if we have a valid Date
      if (takenAtDate && !isNaN(takenAtDate.getTime())) {
        formData.append('takenAt', takenAtDate.toISOString());
      } else {
        logger.warn('takenAt is not a valid Date, skipping');
      }
    }
    if (data.source) {
      formData.append('source', data.source);
    }
    if (data.fromCamera !== undefined) {
      formData.append('fromCamera', data.fromCamera ? 'true' : 'false');
    }
    
    if (data.songId) {
      formData.append('songId', data.songId);
      if (data.songStartTime !== undefined) formData.append('songStartTime', data.songStartTime.toString());
      if (data.songEndTime !== undefined) formData.append('songEndTime', data.songEndTime.toString());
      if (data.songVolume !== undefined) formData.append('songVolume', data.songVolume.toString());
    }
    
    // Add TripScore metadata
    if (data.spotType) formData.append('spotType', data.spotType);
    if (data.travelInfo) formData.append('travelInfo', data.travelInfo);
    if ((data as any).aspectRatio) formData.append('aspectRatio', (data as any).aspectRatio);
    if ((data as any).filter && (data as any).filter !== 'original') formData.append('filter', (data as any).filter);
    
    // Add detected place data for admin review
    // Always send all fields if detectedPlace exists (even if some are empty strings)
    // This ensures country and city are sent even if name is empty
    if (data.detectedPlace) {
      formData.append('detectedPlaceName', data.detectedPlace.name || '');
      formData.append('detectedPlaceCountry', data.detectedPlace.country || '');
      formData.append('detectedPlaceCountryCode', data.detectedPlace.countryCode || '');
      formData.append('detectedPlaceCity', data.detectedPlace.city || '');
      formData.append('detectedPlaceStateProvince', data.detectedPlace.stateProvince || '');
      if (data.detectedPlace.latitude !== undefined && data.detectedPlace.latitude !== null) {
        formData.append('detectedPlaceLatitude', data.detectedPlace.latitude.toString());
      }
      if (data.detectedPlace.longitude !== undefined && data.detectedPlace.longitude !== null) {
        formData.append('detectedPlaceLongitude', data.detectedPlace.longitude.toString());
      }
      formData.append('detectedPlacePlaceId', data.detectedPlace.placeId || '');
      formData.append('detectedPlaceFormattedAddress', data.detectedPlace.formattedAddress || '');
    }

    const response = await api.post('/api/v1/posts', formData, {
      timeout: 300000, // 5 minutes timeout for uploading posts/images
      headers: {
        'Content-Type': 'multipart/form-data', // Explicitly remove Content-Type for FormData
      },
    });

    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Get travel map data for a user
export const getTravelMapData = async (userId: string): Promise<{
  success: boolean;
  data: {
    locations: Array<{
      number: number;
      latitude: number;
      longitude: number;
      address: string;
      date: string;
    }>;
    statistics: {
      totalLocations: number;
      totalDistance: number;
      totalDays: number;
    };
  };
}> => {
  try {
    const response = await api.get(`/api/v1/profile/${userId}/travel-map`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Get user's posts
export const getUserPosts = async (userId: string, page: number = 1, limit: number = 20): Promise<UserPostsResponse> => {
  try {
    const response = await api.get(`/api/v1/posts/user/${userId}?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Like/unlike post
export const toggleLike = async (postId: string): Promise<{ message: string; isLiked: boolean; likesCount: number }> => {
  try {
    postByIdCache.delete(postId);
    const response = await api.post(`/api/v1/posts/${postId}/like`);
    postByIdCache.delete(postId);
    return response.data;
  } catch (error: any) {
    postByIdCache.delete(postId);
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Increment post/short share count
export const incrementShareCount = async (postId: string): Promise<{ message: string; sharesCount: number }> => {
  try {
    const response = await api.post(`/api/v1/posts/${postId}/share`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Add comment to post
export const addComment = async (postId: string, text: string): Promise<{ message: string; comment: any }> => {
  try {
    postByIdCache.delete(postId);
    const response = await api.post(`/api/v1/posts/${postId}/comments`, { text });
    postByIdCache.delete(postId);
    return response.data;
  } catch (error: any) {
    postByIdCache.delete(postId);
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Delete comment
export const deleteComment = async (postId: string, commentId: string): Promise<{ message: string }> => {
  try {
    postByIdCache.delete(postId);
    const response = await api.delete(`/api/v1/posts/${postId}/comments/${commentId}`);
    postByIdCache.delete(postId);
    return response.data;
  } catch (error: any) {
    postByIdCache.delete(postId);
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Delete post
export const deletePost = async (postId: string): Promise<{ message: string }> => {
  try {
    const response = await api.delete(`/api/v1/posts/${postId}`);
    // Clear cache for this post
    postByIdCache.delete(postId);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Archive post
export const archivePost = async (postId: string): Promise<{ message: string; post: any }> => {
  try {
    const response = await api.patch(`/api/v1/posts/${postId}/archive`);
    postByIdCache.delete(postId);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Unarchive post
export const unarchivePost = async (postId: string): Promise<{ message: string; post: any }> => {
  try {
    const response = await api.patch(`/api/v1/posts/${postId}/unarchive`);
    postByIdCache.delete(postId);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Hide post
export const hidePost = async (postId: string): Promise<{ message: string }> => {
  try {
    const response = await api.patch(`/api/v1/posts/${postId}/hide`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Unhide post
export const unhidePost = async (postId: string): Promise<{ message: string; post: any }> => {
  try {
    const response = await api.patch(`/api/v1/posts/${postId}/unhide`);
    postByIdCache.delete(postId);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Get archived posts
export const getArchivedPosts = async (page: number = 1, limit: number = 20): Promise<{ success: boolean; posts: PostType[]; page: number; limit: number; total: number }> => {
  try {
    const response = await api.get(`/api/v1/posts/archived?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Get hidden posts
export const getHiddenPosts = async (page: number = 1, limit: number = 20): Promise<{ success: boolean; posts: PostType[]; page: number; limit: number; total: number }> => {
  try {
    const response = await api.get(`/api/v1/posts/hidden?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Toggle comments
export const toggleComments = async (postId: string): Promise<{ message: string; commentsDisabled: boolean }> => {
  try {
    const response = await api.patch(`/api/v1/posts/${postId}/toggle-comments`);
    postByIdCache.delete(postId);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Update post
export const updatePost = async (postId: string, caption: string): Promise<{ message: string; post: any }> => {
  try {
    const response = await api.patch(`/api/v1/posts/${postId}`, { caption });
    postByIdCache.delete(postId);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Delete short (shorts are posts; backend uses DELETE /posts/:id for both)
export const deleteShort = async (shortId: string): Promise<{ message: string }> => {
  try {
    const response = await api.delete(`/api/v1/posts/${shortId}`);
    postByIdCache.delete(shortId);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage ?? 'Failed to delete short. Please try again.');
  }
};

// Get shorts
export const getShorts = async (cursorOrPage: string | number = 1, limit: number = 20): Promise<ShortsResponse> => {
  try {
    const queryParam = typeof cursorOrPage === 'string' ? `cursor=${encodeURIComponent(cursorOrPage)}` : `page=${cursorOrPage}`;
    const response = await api.get(`/api/v1/shorts?${queryParam}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Get user's shorts
export const getUserShorts = async (userId: string, page: number = 1, limit: number = 20): Promise<{ shorts: PostType[]; user: any; totalShorts: number }> => {
  try {
    const response = await api.get(`/api/v1/shorts/user/${userId}?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Send telemetry data
export const sendInteractionTelemetry = async (data: {
  postId: string;
  interactionType: 'view' | 'like' | 'comment' | 'share' | 'save';
  watchDuration?: number;
  spotType?: string;
  travelInfo?: string;
}): Promise<void> => {
  try {
    // Fire and forget
    api.post('/api/v1/telemetry/interaction', data).catch(e => {
      logger.debug('Telemetry error (ignored):', e.message);
    });
  } catch (error) {
    // Ignore synchronous errors
  }
};

// Create new short with progress tracking
export const createShortWithProgress = async (
  data: CreateShortData,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<{ message: string; short: PostType }> => {
  try {
    logger.debug('createShortWithProgress service called with data:', data);
    const formData = new FormData();
    
    // Add video
    formData.append('video', {
      uri: data.video.uri,
      type: data.video.type,
      name: data.video.name,
    } as any);
    
    // Add optional image (thumbnail)
    if (data.image) {
      formData.append('image', {
        uri: data.image.uri,
        type: data.image.type,
        name: data.image.name,
      } as any);
    }
    
    // Add other fields
    formData.append('caption', data.caption);
    if (data.tags && data.tags.length > 0) {
      formData.append('tags', JSON.stringify(data.tags));
    }
    if (data.address) formData.append('address', data.address);
    if (hasFiniteCoordinate(data.latitude)) formData.append('latitude', data.latitude.toString());
    if (hasFiniteCoordinate(data.longitude)) formData.append('longitude', data.longitude.toString());
    
    // Add location metadata for TripScore v2
    if (data.hasExifGps !== undefined) {
      formData.append('hasExifGps', data.hasExifGps ? 'true' : 'false');
    }
    // Defensive: ensure takenAt is a valid Date
    if (data.takenAt) {
      let takenAtDate: Date | null = null;
      if (data.takenAt instanceof Date) {
        takenAtDate = data.takenAt;
      } else if (typeof data.takenAt === 'string') {
        takenAtDate = new Date(data.takenAt);
      }
      if (takenAtDate && !isNaN(takenAtDate.getTime())) {
        formData.append('takenAt', takenAtDate.toISOString());
      }
    }
    if (data.source) {
      formData.append('source', data.source);
    }
    if (data.fromCamera !== undefined) {
      formData.append('fromCamera', data.fromCamera ? 'true' : 'false');
    }
    
    if (data.songId) {
      formData.append('songId', data.songId);
      if (data.songStartTime !== undefined) formData.append('songStartTime', data.songStartTime.toString());
      if (data.songEndTime !== undefined) formData.append('songEndTime', data.songEndTime.toString());
      if (data.songVolume !== undefined) formData.append('songVolume', data.songVolume.toString());
    }
    
    // Add TripScore metadata
    if (data.spotType) formData.append('spotType', data.spotType);
    if (data.travelInfo) formData.append('travelInfo', data.travelInfo);
    
    // Add copyright compliance fields
    if (data.audioSource) {
      formData.append('audioSource', data.audioSource);
    }
    if (data.copyrightAccepted !== undefined) {
      formData.append('copyrightAccepted', data.copyrightAccepted ? 'true' : 'false');
    }
    if (data.copyrightAcceptedAt) {
      formData.append('copyrightAcceptedAt', data.copyrightAcceptedAt);
    }

    const response = await api.post('/api/v1/shorts', formData, {
      timeout: 600000, // 10 minutes timeout for video upload and transcode enqueue
      headers: {
        'Content-Type': 'multipart/form-data', // let client set boundary
      },
      signal,
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          onProgress(Math.min(progress, 95));
        }
      }
    });

    if (onProgress) {
      onProgress(100);
    }

    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Create new short (without progress tracking - for backward compatibility)
export const createShort = async (data: CreateShortData): Promise<{ message: string; short: PostType }> => {
  try {
    logger.debug('createShort service called with data:', data);
    const formData = new FormData();
    
    // Add video
    formData.append('video', {
      uri: data.video.uri,
      type: data.video.type,
      name: data.video.name,
    } as any);
    
    // Add optional image (thumbnail)
    if (data.image) {
      formData.append('image', {
        uri: data.image.uri,
        type: data.image.type,
        name: data.image.name,
      } as any);
    }
    
    // Add other fields
    formData.append('caption', data.caption);
    if (data.tags && data.tags.length > 0) {
      formData.append('tags', JSON.stringify(data.tags));
    }
    if (data.address) formData.append('address', data.address);
    if (hasFiniteCoordinate(data.latitude)) formData.append('latitude', data.latitude.toString());
    if (hasFiniteCoordinate(data.longitude)) formData.append('longitude', data.longitude.toString());
    
    // Add location metadata for TripScore v2
    if (data.hasExifGps !== undefined) {
      formData.append('hasExifGps', data.hasExifGps ? 'true' : 'false');
    }
    // Defensive: ensure takenAt is a valid Date
    if (data.takenAt) {
      let takenAtDate: Date | null = null;
      if (data.takenAt instanceof Date) {
        takenAtDate = data.takenAt;
      } else if (typeof data.takenAt === 'string') {
        takenAtDate = new Date(data.takenAt);
      }
      if (takenAtDate && !isNaN(takenAtDate.getTime())) {
        formData.append('takenAt', takenAtDate.toISOString());
      }
    }
    if (data.source) {
      formData.append('source', data.source);
    }
    if (data.fromCamera !== undefined) {
      formData.append('fromCamera', data.fromCamera ? 'true' : 'false');
    }
    
    if (data.songId) {
      formData.append('songId', data.songId);
      if (data.songStartTime !== undefined) formData.append('songStartTime', data.songStartTime.toString());
      if (data.songEndTime !== undefined) formData.append('songEndTime', data.songEndTime.toString());
      if (data.songVolume !== undefined) formData.append('songVolume', data.songVolume.toString());
    }
    
    // Add TripScore metadata
    if (data.spotType) formData.append('spotType', data.spotType);
    if (data.travelInfo) formData.append('travelInfo', data.travelInfo);
    
    // Add copyright compliance fields
    if (data.audioSource) {
      formData.append('audioSource', data.audioSource);
    }
    if (data.copyrightAccepted !== undefined) {
      formData.append('copyrightAccepted', data.copyrightAccepted ? 'true' : 'false');
    }
    if (data.copyrightAcceptedAt) {
      formData.append('copyrightAcceptedAt', data.copyrightAcceptedAt);
    }

    const response = await api.post('/api/v1/shorts', formData, {
      timeout: 600000, // 10 minutes timeout for video upload and transcode enqueue
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Get post likers
export const getPostLikers = async (postId: string, page: number = 1, limit: number = 20): Promise<{ success: boolean; likers: any[]; pagination: any }> => {
  try {
    const response = await api.get(`/api/v1/posts/${postId}/likes?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};
