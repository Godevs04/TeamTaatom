import api from './api';
import { PostType } from '../types/post';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRateLimitError, handleRateLimitError } from '../utils/rateLimitHandler';
import { getApiUrl } from '../utils/config';
import logger from '../utils/logger';

// Simple in-memory cache and rate-limit friendly helpers
const postByIdCache = new Map<string, { data: any; expiresAt: number }>();
const POST_CACHE_TTL_MS = 60_000; // 60s
let lastPostByIdCall = 0;
const MIN_SPACING_MS = 150; // space requests to avoid 429

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

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
  };
}

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
  };
}

// Get all posts
export const getPostById = async (postId: string) => {
  // cached response if fresh
  const cached = postByIdCache.get(postId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // spacing to avoid bursts
  const since = now - lastPostByIdCall;
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

export const getPosts = async (page: number = 1, limit: number = 20): Promise<PostsResponse> => {
  try {
    const response = await api.get(`/api/v1/posts?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    if (isRateLimitError(error)) {
      // gentle client backoff and retry once
      const rateLimitInfo = handleRateLimitError(error, 'getPosts');
      await sleep(500);
      try {
        const retry = await api.get(`/api/v1/posts?page=${page}&limit=${limit}`);
        return retry.data;
      } catch (e: any) {
        throw new Error(rateLimitInfo.message);
      }
    }
    throw new Error(error.response?.data?.message || 'Failed to fetch posts');
  }
};

// Create new post with progress tracking
export const createPostWithProgress = async (
  data: CreatePostData,
  onProgress?: (progress: number) => void
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
    if (data.latitude) formData.append('latitude', data.latitude.toString());
    if (data.longitude) formData.append('longitude', data.longitude.toString());
    
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

    // Use fetch for FormData to avoid axios Content-Type issues
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      throw new Error('No auth token found');
    }

    const response = await fetch(getApiUrl('/api/v1/posts'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type - let fetch handle it for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = 'Failed to create post';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (parseError) {
        // If JSON parsing fails, try to get text response
        try {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        } catch (textError) {
          // Fallback to status text
          errorMessage = response.statusText || errorMessage;
        }
      }
      throw new Error(errorMessage);
    }

    const responseData = await response.json();
    return responseData;
  } catch (error: any) {
    // Improved error handling: preserve original error message
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(error?.response?.data?.message || error?.message || 'Failed to create post');
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
    if (data.latitude) formData.append('latitude', data.latitude.toString());
    if (data.longitude) formData.append('longitude', data.longitude.toString());
    
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

    const response = await api.post('/api/v1/posts', formData, {
      headers: {
        'Content-Type': undefined, // Explicitly remove Content-Type for FormData
      },
    });

    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to create post');
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
    throw new Error(error.response?.data?.message || 'Failed to fetch travel map data');
  }
};

// Get user's posts
export const getUserPosts = async (userId: string, page: number = 1, limit: number = 20): Promise<UserPostsResponse> => {
  try {
    const response = await api.get(`/api/v1/posts/user/${userId}?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch user posts');
  }
};

// Like/unlike post
export const toggleLike = async (postId: string): Promise<{ message: string; isLiked: boolean; likesCount: number }> => {
  try {
    const response = await api.post(`/api/v1/posts/${postId}/like`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update like status');
  }
};

// Add comment to post
export const addComment = async (postId: string, text: string): Promise<{ message: string; comment: any }> => {
  try {
    const response = await api.post(`/api/v1/posts/${postId}/comments`, { text });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to add comment');
  }
};

// Delete comment
export const deleteComment = async (postId: string, commentId: string): Promise<{ message: string }> => {
  try {
    const response = await api.delete(`/api/v1/posts/${postId}/comments/${commentId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to delete comment');
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
    throw new Error(error.response?.data?.message || 'Failed to delete post');
  }
};

// Archive post
export const archivePost = async (postId: string): Promise<{ message: string; post: any }> => {
  try {
    const response = await api.patch(`/api/v1/posts/${postId}/archive`);
    postByIdCache.delete(postId);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to archive post');
  }
};

// Unarchive post
export const unarchivePost = async (postId: string): Promise<{ message: string; post: any }> => {
  try {
    const response = await api.patch(`/api/v1/posts/${postId}/unarchive`);
    postByIdCache.delete(postId);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to unarchive post');
  }
};

// Hide post
export const hidePost = async (postId: string): Promise<{ message: string }> => {
  try {
    const response = await api.patch(`/api/v1/posts/${postId}/hide`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to hide post');
  }
};

// Unhide post
export const unhidePost = async (postId: string): Promise<{ message: string; post: any }> => {
  try {
    const response = await api.patch(`/api/v1/posts/${postId}/unhide`);
    postByIdCache.delete(postId);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to unhide post');
  }
};

// Get archived posts
export const getArchivedPosts = async (page: number = 1, limit: number = 20): Promise<{ success: boolean; posts: PostType[]; page: number; limit: number; total: number }> => {
  try {
    const response = await api.get(`/api/v1/posts/archived?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch archived posts');
  }
};

// Get hidden posts
export const getHiddenPosts = async (page: number = 1, limit: number = 20): Promise<{ success: boolean; posts: PostType[]; page: number; limit: number; total: number }> => {
  try {
    const response = await api.get(`/api/v1/posts/hidden?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch hidden posts');
  }
};

// Toggle comments
export const toggleComments = async (postId: string): Promise<{ message: string; commentsDisabled: boolean }> => {
  try {
    const response = await api.patch(`/api/v1/posts/${postId}/toggle-comments`);
    postByIdCache.delete(postId);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to toggle comments');
  }
};

// Update post
export const updatePost = async (postId: string, caption: string): Promise<{ message: string; post: any }> => {
  try {
    const response = await api.patch(`/api/v1/posts/${postId}`, { caption });
    postByIdCache.delete(postId);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update post');
  }
};

// Delete short
export const deleteShort = async (shortId: string): Promise<{ message: string }> => {
  try {
    const response = await api.delete(`/api/v1/shorts/${shortId}`);
    // Clear cache for this short
    postByIdCache.delete(shortId);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to delete short');
  }
};

// Get shorts
export const getShorts = async (page: number = 1, limit: number = 20): Promise<ShortsResponse> => {
  try {
    const response = await api.get(`/api/v1/shorts?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch shorts');
  }
};

// Get user's shorts
export const getUserShorts = async (userId: string, page: number = 1, limit: number = 20): Promise<{ shorts: PostType[]; user: any; totalShorts: number }> => {
  try {
    const response = await api.get(`/api/v1/shorts/user/${userId}?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch user shorts');
  }
};

// Create new short
export const createShort = async (data: CreateShortData): Promise<{ message: string; short: PostType }> => {
  try {
    logger.debug('createShort service called with data:', data);
    
    // Get auth token
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      throw new Error('No auth token found');
    }

    const formData = new FormData();
    
    // Add video
    formData.append('video', {
      uri: data.video.uri,
      type: data.video.type,
      name: data.video.name,
    } as any);
    
    // Add optional image (thumbnail) - backend expects 'image' not 'images'
    if (data.image) {
      formData.append('image', {
        uri: data.image.uri,
        type: data.image.type,
        name: data.image.name,
      } as any);
    }
    
    logger.debug('FormData video field:', {
      uri: data.video.uri,
      type: data.video.type,
      name: data.video.name,
    });
    
    // Add other fields
    formData.append('caption', data.caption);
    if (data.tags && data.tags.length > 0) {
      formData.append('tags', JSON.stringify(data.tags));
    }
    if (data.address) formData.append('address', data.address);
    if (data.latitude) formData.append('latitude', data.latitude.toString());
    if (data.longitude) formData.append('longitude', data.longitude.toString());
    
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

    logger.debug('Sending request to /shorts endpoint');
    
    // Use fetch instead of axios for better FormData handling
    const response = await fetch(getApiUrl('/api/v1/shorts'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create short');
    }

    const responseData = await response.json();
    logger.debug('Response received:', responseData);
    return responseData;
  } catch (error: any) {
    logger.error('createShort', error);
    throw new Error(error.message || 'Failed to create short');
  }
};
