import api from './api';
import logger from '../utils/logger';
import { parseError } from '../utils/errorCodes';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ContentBlock {
  _id?: string;
  type: 'heading' | 'text' | 'image' | 'video' | 'button' | 'divider' | 'embed';
  content: string;
  order: number;
  url?: string;
  embedType?: 'youtube' | 'map' | 'custom' | '';
}

export interface CanvasElement {
  _id?: string;
  type: 'text' | 'image' | 'video';
  // text: the string. image/video: signed URL on read, storage key on persist (server handles).
  content: string;
  // Normalized to canvas frame: 0..1 of frame width/height.
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  zIndex: number;
  // Text-only
  fontSize?: number;
  color?: string;
  fontWeight?: string;
  backgroundColor?: string;
}

export interface BuyItem {
  _id?: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  active: boolean;
}

export interface SubscriptionApproval {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  requestedPrice: number | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string;
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
  canvasContent?: CanvasElement[];
  canvasBackground?: string;
  subscriptionPrice: number | null;
  subscriptionCurrency: string;
  subscriptionApproval?: SubscriptionApproval;
  chatRoomId: string | null;
  followerCount: number;
  viewCount: number;
  isAdminPage: boolean;
  isDefault: boolean;
  buyItems: BuyItem[];
  status: string;
  isFollowing?: boolean;
  // True for pages created by the current viewer. Set server-side by
  // /connect-pages so the client can hide the Follow button without an
  // extra getMyPages round-trip.
  isOwn?: boolean;
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
  subscriptionPrice?: number;
  profileImage?: { uri: string; type?: string; name?: string } | null;
  bannerImage?: { uri: string; type?: string; name?: string } | null;
}): Promise<{ page: ConnectPageType }> => {
  try {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('type', data.type);
    if (data.bio) formData.append('bio', data.bio);
    formData.append('features', JSON.stringify(data.features));
    if (data.subscriptionPrice) formData.append('subscriptionPrice', String(data.subscriptionPrice));
    if ((data as any).subscriptionCurrency) formData.append('subscriptionCurrency', (data as any).subscriptionCurrency);
    if ((data as any).country) formData.append('country', (data as any).country);
    if ((data as any).payoutInfo) formData.append('payoutInfo', JSON.stringify((data as any).payoutInfo));

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

// User-created (non-admin) Connect pages — drives the Connect tab. Backend
// places followed entries first per fetched page so pagination stays stable.
export const getConnectPages = async (page = 1, limit = 20): Promise<ConnectPagesResponse> => {
  try {
    const response = await api.get(`/api/v1/connect/connect-pages?page=${page}&limit=${limit}`);
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
  travel_style?: string;
  page?: number;
  limit?: number;
}): Promise<FindUsersResponse> => {
  try {
    const query = new URLSearchParams();
    if (params.target_country) query.append('target_country', params.target_country);
    if (params.current_country) query.append('current_country', params.current_country);
    if (params.travel_style) query.append('travel_style', params.travel_style);
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

export const uploadContentImage = async (pageId: string, imageUri: string): Promise<{ storageKey: string; signedUrl: string }> => {
  try {
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: `content_${Date.now()}.jpg`,
    } as any);

    const response = await api.post(`/api/v1/connect/page/${pageId}/content-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

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

export const getCanvasContent = async (
  pageId: string
): Promise<{ canvasContent: CanvasElement[]; canvasBackground: string }> => {
  try {
    const response = await api.get(`/api/v1/connect/page/${pageId}/canvas`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const updateCanvasContent = async (
  pageId: string,
  content: CanvasElement[],
  background?: string
): Promise<{ canvasContent: CanvasElement[]; canvasBackground: string }> => {
  try {
    const response = await api.put(`/api/v1/connect/page/${pageId}/canvas`, { content, background });
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const uploadContentVideo = async (
  pageId: string,
  videoUri: string
): Promise<{ storageKey: string; signedUrl: string }> => {
  try {
    const formData = new FormData();
    const ext = (videoUri.split('.').pop() || 'mp4').toLowerCase();
    const mime = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
    formData.append('video', {
      uri: videoUri,
      type: mime,
      name: `canvas_${Date.now()}.${ext}`,
    } as any);

    const response = await api.post(`/api/v1/connect/page/${pageId}/content-video`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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
// Subscriptions (Payment)
// ─────────────────────────────────────────────

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  minPrice: number;
  maxPrice: number;
  decimals: number;
}

export interface CurrencyConfigResponse {
  currencies: Record<string, CurrencyConfig>;
  countryToCurrency: Record<string, string>;
  supportedCurrencies: string[];
}

export interface SubscriptionResponse {
  subscriptionId: string;
  cashfreeSubscriptionId: string;
  paymentSessionId: string;
  amount: number;
  currency: string;
}

export interface SubscriptionStatus {
  isSubscribed: boolean;
  subscription: {
    _id: string;
    status: string;
    amount: number;
    activatedAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
}

export const createSubscription = async (connectPageId: string): Promise<SubscriptionResponse> => {
  try {
    const response = await api.post('/api/v1/connect/subscribe', { connectPageId });
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getSubscriptionStatus = async (connectPageId: string): Promise<SubscriptionStatus> => {
  try {
    const response = await api.get(`/api/v1/connect/subscription/status/${connectPageId}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const cancelSubscription = async (subscriptionId: string): Promise<void> => {
  try {
    await api.post('/api/v1/connect/subscription/cancel', { subscriptionId });
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getMySubscriptions = async (): Promise<{ subscriptions: any[] }> => {
  try {
    const response = await api.get('/api/v1/connect/my-subscriptions');
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getPageSubscribers = async (pageId: string): Promise<{
  subscribers: any[];
  totalActiveSubscribers: number;
  monthlyRevenue: number;
}> => {
  try {
    const response = await api.get(`/api/v1/connect/page/${pageId}/subscribers`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// ─────────────────────────────────────────────
// Payout Preview
// ─────────────────────────────────────────────

export interface PayoutPreview {
  grossAmount: number;
  gatewayFee: number;
  gatewayFeePercent: number;
  fxCharge: number;
  netAfterGateway: number;
  commissionPercent: number;
  commissionAmount: number;
  gstPercent: number;
  gstAmount: number;
  taatoKeeps: number;
  wiseFee: number;
  wiseFeePercent: number;
  creatorPayout: number;
  currency: string;
  currencySymbol: string;
  isInternational: boolean;
  feeStructure: {
    gatewayFeePercent: number;
    fxChargePercent: number;
    commissionPercent: number;
    gstPercent: number;
    wiseFeePercent: number;
  };
  note: string;
}

export const getPayoutPreview = async (connectPageId: string): Promise<{ preview: PayoutPreview | null }> => {
  try {
    const response = await api.get(`/api/v1/connect/subscription/payout-preview/${connectPageId}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// ─────────────────────────────────────────────
// Currency Config
// ─────────────────────────────────────────────

export const fetchCurrencyConfig = async (): Promise<CurrencyConfigResponse> => {
  try {
    const response = await api.get('/api/v1/connect/currency-config');
    return response.data?.data || response.data;
  } catch (error: any) {
    logger.warn('Failed to fetch currency config, using fallback');
    // Fallback with basic INR/USD
    return {
      currencies: {
        INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', minPrice: 100, maxPrice: 10000, decimals: 2 },
        USD: { code: 'USD', symbol: '$', name: 'US Dollar', minPrice: 1, maxPrice: 200, decimals: 2 },
        EUR: { code: 'EUR', symbol: '€', name: 'Euro', minPrice: 1, maxPrice: 200, decimals: 2 },
        GBP: { code: 'GBP', symbol: '£', name: 'British Pound', minPrice: 1, maxPrice: 200, decimals: 2 },
      },
      countryToCurrency: { IN: 'INR', US: 'USD', GB: 'GBP', DE: 'EUR' },
      supportedCurrencies: ['INR', 'USD', 'EUR', 'GBP'],
    };
  }
};

/**
 * Get currency symbol for a currency code
 */
export const getCurrencySymbol = (code: string): string => {
  const symbols: Record<string, string> = {
    INR: '₹', USD: '$', EUR: '€', GBP: '£',
    AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ',
    JPY: '¥', KRW: '₩', THB: '฿',
  };
  return symbols[code] || code;
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
