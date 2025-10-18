import api from './api';
import { PostType } from '../types/post';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { isRateLimitError, handleRateLimitError } from '../utils/rateLimitHandler';

export interface CreatePostData {
  image: {
    uri: string;
    type: string;
    name: string;
  };
  caption: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface CreateShortData {
  video: {
    uri: string;
    type: string;
    name: string;
  };
  caption: string;
  tags?: string[];
  address?: string;
  latitude?: number;
  longitude?: number;
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
  const response = await api.get(`/posts/${postId}`);
  return response.data;
};

export const getPosts = async (page: number = 1, limit: number = 20): Promise<PostsResponse> => {
  try {
    const response = await api.get(`/posts?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    if (isRateLimitError(error)) {
      const rateLimitInfo = handleRateLimitError(error, 'getPosts');
      throw new Error(rateLimitInfo.message);
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
    
    // Add image
    formData.append('image', {
      uri: data.image.uri,
      type: data.image.type,
      name: data.image.name,
    } as any);
    
    // Add other fields
    formData.append('caption', data.caption);
    if (data.address) formData.append('address', data.address);
    if (data.latitude) formData.append('latitude', data.latitude.toString());
    if (data.longitude) formData.append('longitude', data.longitude.toString());

    // Get auth token
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      throw new Error('No auth token found');
    }

    // Get API base URL
    const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

    // Use fetch for progress tracking
    const response = await fetch(`${API_BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create post');
    }

    const responseData = await response.json();
    return responseData;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create post');
  }
};

// Create new post
export const createPost = async (data: CreatePostData): Promise<{ message: string; post: PostType }> => {
  try {
    const formData = new FormData();
    
    // Add image
    formData.append('image', {
      uri: data.image.uri,
      type: data.image.type,
      name: data.image.name,
    } as any);
    
    // Add other fields
    formData.append('caption', data.caption);
    if (data.address) formData.append('address', data.address);
    if (data.latitude) formData.append('latitude', data.latitude.toString());
    if (data.longitude) formData.append('longitude', data.longitude.toString());

    const response = await api.post('/posts', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to create post');
  }
};

// Get user's posts
export const getUserPosts = async (userId: string, page: number = 1, limit: number = 20): Promise<UserPostsResponse> => {
  try {
    const response = await api.get(`/posts/user/${userId}?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch user posts');
  }
};

// Like/unlike post
export const toggleLike = async (postId: string): Promise<{ message: string; isLiked: boolean; likesCount: number }> => {
  try {
    const response = await api.post(`/posts/${postId}/like`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update like status');
  }
};

// Add comment to post
export const addComment = async (postId: string, text: string): Promise<{ message: string; comment: any }> => {
  try {
    const response = await api.post(`/posts/${postId}/comments`, { text });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to add comment');
  }
};

// Delete comment
export const deleteComment = async (postId: string, commentId: string): Promise<{ message: string }> => {
  try {
    const response = await api.delete(`/posts/${postId}/comments/${commentId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to delete comment');
  }
};

// Delete post
export const deletePost = async (postId: string): Promise<{ message: string }> => {
  try {
    const response = await api.delete(`/posts/${postId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to delete post');
  }
};

// Get shorts
export const getShorts = async (page: number = 1, limit: number = 20): Promise<ShortsResponse> => {
  try {
    const response = await api.get(`/shorts?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch shorts');
  }
};

// Get user's shorts
export const getUserShorts = async (userId: string, page: number = 1, limit: number = 20): Promise<{ shorts: PostType[]; user: any; totalShorts: number }> => {
  try {
    const response = await api.get(`/shorts/user/${userId}?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch user shorts');
  }
};

// Create new short
export const createShort = async (data: CreateShortData): Promise<{ message: string; short: PostType }> => {
  try {
    console.log('createShort service called with data:', data);
    
    // Get auth token
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      throw new Error('No auth token found');
    }

    // Get API base URL
    const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
    
    const formData = new FormData();
    
    // Add video
    formData.append('video', {
      uri: data.video.uri,
      type: data.video.type,
      name: data.video.name,
    } as any);
    
    console.log('FormData video field:', {
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

    console.log('Sending request to /shorts endpoint');
    
    // Use fetch instead of axios for better FormData handling
    const response = await fetch(`${API_BASE_URL}/shorts`, {
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
    console.log('Response received:', responseData);
    return responseData;
  } catch (error: any) {
    console.error('createShort error:', error);
    throw new Error(error.message || 'Failed to create short');
  }
};
