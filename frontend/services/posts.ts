import api from './api';
import { PostType } from '../types/post';

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

// Get all posts
export const getPosts = async (page: number = 1, limit: number = 20): Promise<PostsResponse> => {
  try {
    const response = await api.get(`/posts?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch posts');
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
