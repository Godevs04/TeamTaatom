import api from './api';
import logger from '../utils/logger';
import { parseError } from '../utils/errorCodes';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ContentBlock {
  _id?: string;
  type: 'heading' | 'text' | 'image' | 'video';
  content: string;
  order: number;
}

export interface BuyItem {
  _id?: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  active: boolean;
}

export interface ConnectPageType {
  _id: string;
  userId: {
    _id: string;
    username: string;
    fullName: string;
    profilePic: string;
  } | string;
  name: string;
  type: 'public' | 'private';
  profileImage: string;
  bannerImage: string;
  bio: string;
  features: {
    website: boolean;
    groupChat: boolean;
    subscription: boolean;
  };
  websiteContent: ContentBlock[];
  subscriptionContent: ContentBlock[];
  subscriptionPrice: number | null;
  chatRoomId: string | null;
  followerCount: number;
  viewCount: number;
  isAdminPage: boolean;
  isDefault: boolean;
  buyItems: BuyItem[];
  status: string;
  isFollowing?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationType {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ConnectPagesResponse {
  pages: ConnectPageType[];
  pagination: PaginationType;
}

export interface ConnectFollowerUser {
  _id: string;
  username: string;
  fullName: string;
  profilePic: string;
  role: 'admin' | 'member';
}

export interface ConnectFollowersResponse {
  followers: ConnectFollowerUser[];
  pagination: PaginationType;
}

export interface FindUsersResponse {
  users: Array<{
    _id: string;
    username: string;
    fullName: string;
    profilePic: string;
    bio: string;
    language: string;
    isFollowing: boolean;
  }>;
  pagination: PaginationType;
}

export interface GeoItem {
  code: string;
  name: string;
}

// ─────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────

export const createConnectPage = async (data: {
  name: string;
  type: 'public' | 'private';
  bio?: string;
  features: { website: boolean; groupChat: boolean; subscription: boolean };
  profileImage?: { uri: string; type?: string; name?: string } | null;
  bannerImage?: { uri: string; type?: string; name?: string } | null;
}): Promise<{ page: ConnectPageType }> => {
  try {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('type', data.type);
    if (data.bio) formData.append('bio', data.bio);
    formData.append('features', JSON.stringify(data.features));

    if (data.profileImage) {
      formData.append('profileImage', {
        uri: data.profileImage.uri,
        type: data.profileImage.type || 'image/jpeg',
        name: data.profileImage.name || `connect_${Date.now()}.jpg`,
      } as any);
    }

    if (data.bannerImage) {
      formData.append('bannerImage', {
        uri: data.bannerImage.uri,
        type: data.bannerImage.type || 'image/jpeg',
        name: data.bannerImage.name || `banner_${Date.now()}.jpg`,
      } as any);
    }

    const response = await api.post('/api/v1/connect/create', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getMyPages = async (): Promise<{ pages: ConnectPageType[] }> => {
  try {
    const response = await api.get('/api/v1/connect/my-pages');
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getPageDetail = async (pageId: string): Promise<{
  page: ConnectPageType;
  isOwner: boolean;
  isFollowing: boolean;
}> => {
  try {
    const response = await api.get(`/api/v1/connect/page/${pageId}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const updateConnectPage = async (pageId: string, data: Partial<ConnectPageType>): Promise<{ page: ConnectPageType }> => {
  try {
    const response = await api.put(`/api/v1/connect/page/${pageId}`, data);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const deleteConnectPage = async (pageId: string): Promise<void> => {
  try {
    await api.delete(`/api/v1/connect/page/${pageId}`);
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// ─────────────────────────────────────────────
// Discovery
// ─────────────────────────────────────────────

export const getCommunities = async (page = 1, limit = 20): Promise<ConnectPagesResponse> => {
  try {
    const response = await api.get(`/api/v1/connect/communities?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const searchByName = async (query: string, page = 1, limit = 20): Promise<ConnectPagesResponse> => {
  try {
    const response = await api.get(`/api/v1/connect/search-by-name?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const findUsers = async (params: {
  target_country?: string;
  current_country?: string;
  lang: string;
  page?: number;
  limit?: number;
}): Promise<FindUsersResponse> => {
  try {
    const query = new URLSearchParams();
    if (params.target_country) query.append('target_country', params.target_country);
    if (params.current_country) query.append('current_country', params.current_country);
    query.append('lang', params.lang);
    query.append('page', String(params.page || 1));
    query.append('limit', String(params.limit || 20));
    const response = await api.get(`/api/v1/connect/find-users?${query.toString()}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// ─────────────────────────────────────────────
// Follow System (ConnectFollow)
// ─────────────────────────────────────────────

export const followConnectPage = async (connectPageId: string): Promise<void> => {
  try {
    await api.post('/api/v1/connect/follow', { connectPageId });
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const unfollowConnectPage = async (connectPageId: string): Promise<void> => {
  try {
    await api.post('/api/v1/connect/unfollow', { connectPageId });
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const archiveConnectPage = async (connectPageId: string): Promise<void> => {
  try {
    await api.post('/api/v1/connect/archive', { connectPageId });
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const unarchiveConnectPage = async (connectPageId: string): Promise<void> => {
  try {
    await api.post('/api/v1/connect/unarchive', { connectPageId });
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getFollowing = async (page = 1, limit = 20): Promise<ConnectPagesResponse> => {
  try {
    const response = await api.get(`/api/v1/connect/following?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getArchived = async (page = 1, limit = 20): Promise<ConnectPagesResponse> => {
  try {
    const response = await api.get(`/api/v1/connect/archived?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getPageFollowers = async (pageId: string, page = 1, limit = 20): Promise<ConnectFollowersResponse> => {
  try {
    const response = await api.get(`/api/v1/connect/page/${pageId}/followers?page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// ─────────────────────────────────────────────
// Content (Website & Subscription)
// ─────────────────────────────────────────────

export const updateWebsiteContent = async (pageId: string, content: ContentBlock[]): Promise<{ websiteContent: ContentBlock[] }> => {
  try {
    const response = await api.put(`/api/v1/connect/page/${pageId}/website`, { content });
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getWebsiteContent = async (pageId: string): Promise<{ websiteContent: ContentBlock[] }> => {
  try {
    const response = await api.get(`/api/v1/connect/page/${pageId}/website`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const updateSubscriptionContent = async (pageId: string, content: ContentBlock[]): Promise<{ subscriptionContent: ContentBlock[] }> => {
  try {
    const response = await api.put(`/api/v1/connect/page/${pageId}/subscription`, { content });
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getSubscriptionContent = async (pageId: string): Promise<{ subscriptionContent: ContentBlock[] }> => {
  try {
    const response = await api.get(`/api/v1/connect/page/${pageId}/subscription`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// ─────────────────────────────────────────────
// Views
// ─────────────────────────────────────────────

export const recordPageView = async (pageId: string): Promise<void> => {
  try {
    await api.post(`/api/v1/connect/page/${pageId}/view`);
  } catch (error: any) {
    // View recording is non-critical, don't throw
    logger.warn('Failed to record page view:', error);
  }
};

// ─────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────

export interface AnalyticsGrowthPoint {
  date: string;
  count: number;
}

export interface PageAnalyticsResponse {
  totalFollowers: number;
  totalViews: number;
  followerGrowth: AnalyticsGrowthPoint[];
  viewGrowth: AnalyticsGrowthPoint[];
}

export const getPageAnalytics = async (pageId: string): Promise<PageAnalyticsResponse> => {
  try {
    const response = await api.get(`/api/v1/connect/page/${pageId}/analytics`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// ─────────────────────────────────────────────
// Geo
// ─────────────────────────────────────────────

export const getCountries = async (): Promise<{ countries: GeoItem[] }> => {
  try {
    const response = await api.get('/api/v1/geo/countries');
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getLanguages = async (): Promise<{ languages: GeoItem[] }> => {
  try {
    const response = await api.get('/api/v1/geo/languages');
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};
