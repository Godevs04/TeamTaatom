import api from './api';
import { PostType } from '../types/post';

export interface Collection {
  _id: string;
  name: string;
  description?: string;
  user: {
    _id: string;
    fullName: string;
    profilePic: string;
    username?: string;
  };
  posts: PostType[];
  coverImage?: string;
  isPublic: boolean;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionsResponse {
  collections: Collection[];
}

export interface CollectionResponse {
  collection: Collection;
}

export interface CreateCollectionData {
  name: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateCollectionData {
  name?: string;
  description?: string;
  isPublic?: boolean;
}

/**
 * Create a new collection
 */
export const createCollection = async (data: CreateCollectionData): Promise<CollectionResponse> => {
  try {
    const response = await api.post('/api/v1/collections', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to create collection');
  }
};

/**
 * Get user's collections
 */
export const getCollections = async (userId?: string): Promise<CollectionsResponse> => {
  try {
    const params = userId ? { userId } : {};
    const response = await api.get('/api/v1/collections', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch collections');
  }
};

/**
 * Get single collection by ID
 */
export const getCollection = async (collectionId: string): Promise<CollectionResponse> => {
  try {
    const response = await api.get(`/api/v1/collections/${collectionId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch collection');
  }
};

/**
 * Update collection
 */
export const updateCollection = async (
  collectionId: string,
  data: UpdateCollectionData
): Promise<CollectionResponse> => {
  try {
    const response = await api.put(`/api/v1/collections/${collectionId}`, data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update collection');
  }
};

/**
 * Delete collection
 */
export const deleteCollection = async (collectionId: string): Promise<void> => {
  try {
    await api.delete(`/api/v1/collections/${collectionId}`);
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to delete collection');
  }
};

/**
 * Add post to collection
 */
export const addPostToCollection = async (
  collectionId: string,
  postId: string
): Promise<CollectionResponse> => {
  try {
    const response = await api.post(`/api/v1/collections/${collectionId}/posts`, { postId });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to add post to collection');
  }
};

/**
 * Remove post from collection
 */
export const removePostFromCollection = async (
  collectionId: string,
  postId: string
): Promise<CollectionResponse> => {
  try {
    const response = await api.delete(`/api/v1/collections/${collectionId}/posts/${postId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to remove post from collection');
  }
};

/**
 * Reorder posts in collection
 */
export const reorderCollectionPosts = async (
  collectionId: string,
  postIds: string[]
): Promise<CollectionResponse> => {
  try {
    const response = await api.put(`/api/v1/collections/${collectionId}/reorder`, { postIds });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to reorder posts');
  }
};

