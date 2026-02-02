import api from './api';
import { UserType, FollowRequestsResponse } from '../types/user';
import logger from '../utils/logger';
import { parseError } from '../utils/errorCodes';

export interface ProfileResponse {
  profile: UserType & {
    postsCount: number;
    followersCount: number;
    followingCount: number;
    bio: string;
    locations: Array<{
      latitude: number;
      longitude: number;
      address: string;
      date: string;
    }>;
    tripScore: {
      totalScore: number;
      continents: { [key: string]: number };
      countries: { [key: string]: number };
      areas: Array<{
        address: string;
        continent: string;
        likes: number;
        date: string;
      }>;
    } | null;
    isFollowing: boolean;
    isOwnProfile: boolean;
  };
}

export interface UpdateProfileData {
  fullName?: string;
  bio?: string;
  profilePic?: {
    uri: string;
    type: string;
    name: string;
  };
}

export interface SearchUsersResponse {
  users: Array<UserType & {
    followersCount: number;
    followingCount: number;
    isFollowing: boolean;
  }>;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    hasNextPage: boolean;
    limit: number;
  };
}

// Get user profile
export const getProfile = async (userId: string): Promise<ProfileResponse> => {
  try {
    const response = await api.get(`/api/v1/profile/${userId}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Update user profile
export const updateProfile = async (userId: string, data: UpdateProfileData): Promise<{ message: string; user: UserType }> => {
  try {
    const formData = new FormData();
    
    if (data.fullName) {
      formData.append('fullName', data.fullName);
    }
    
    if (data.bio !== undefined) {
      formData.append('bio', data.bio);
    }
    
    if (data.profilePic) {
      // For React Native, we need to structure the file object properly
      formData.append('profilePic', {
        uri: data.profilePic.uri,
        type: data.profilePic.type || 'image/jpeg',
        name: data.profilePic.name || `profile_${Date.now()}.jpg`,
      } as any);
    }

    logger.debug('Updating profile with data:', {
      userId,
      hasFullName: !!data.fullName,
      hasBio: data.bio !== undefined,
      hasProfilePic: !!data.profilePic,
    });

    const response = await api.put(`/api/v1/profile/${userId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    logger.debug('Profile update response:', response.data);
    return response.data;
  } catch (error: any) {
    logger.error('updateProfile', error.response?.data || error.message || error);
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Follow/unfollow user
export const toggleFollow = async (userId: string): Promise<{
  message: string;
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
  followRequestSent?: boolean;
}> => {
  try {
    const response = await api.post(`/api/v1/profile/${userId}/follow`);
    // The backend sendSuccess spreads data directly, so response.data contains all fields
    const data = response.data;
    return {
      message: data?.message || 'Success',
      isFollowing: Boolean(data?.isFollowing ?? false),
      followersCount: data?.followersCount ?? 0,
      followingCount: data?.followingCount ?? 0,
      followRequestSent: Boolean(data?.followRequestSent ?? false)
    };
  } catch (error: any) {
    // Handle 409 (Conflict) as a special case for follow request already pending
    if (error.response?.status === 409) {
      const parsedError = parseError(error);
      const conflictError = new Error(parsedError.userMessage);
      (conflictError as any).isConflict = true;
      throw conflictError;
    }
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Search users
export const searchUsers = async (query: string, page: number = 1, limit: number = 20): Promise<SearchUsersResponse> => {
  try {
    const response = await api.get(`/api/v1/profile/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Update FCM push token
export const updateFCMPushToken = async (userId: string, fcmToken: string): Promise<void> => {
  try {
    await api.put(`/api/v1/profile/${userId}/push-token`, { 
      expoPushToken: fcmToken // Backend still uses expoPushToken field name for backward compatibility
    });
  } catch (error: any) {
    logger.error('updateFCMPushToken', error.response?.data || error.message || error);
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Legacy: Keep for backward compatibility (deprecated)
export const updateExpoPushToken = updateFCMPushToken;

// Get follow requests
export const getFollowRequests = async (): Promise<FollowRequestsResponse> => {
  try {
    const response = await api.get('/api/v1/profile/follow-requests');
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Approve follow request
export const approveFollowRequest = async (requestId: string): Promise<{ message: string; followersCount: number; alreadyProcessed?: boolean }> => {
  try {
    const response = await api.post(`/api/v1/profile/follow-requests/${requestId}/approve`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    // If error is "already processed", treat as success (idempotent operation)
    if (parsedError.userMessage?.toLowerCase().includes('already processed') || 
        parsedError.userMessage?.toLowerCase().includes('already approved')) {
      return {
        message: 'Follow request already approved',
        followersCount: 0,
        alreadyProcessed: true
      };
    }
    throw new Error(parsedError.userMessage);
  }
};

// Reject follow request
export const rejectFollowRequest = async (requestId: string): Promise<{ message: string }> => {
  try {
    const response = await api.post(`/api/v1/profile/follow-requests/${requestId}/reject`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Block or unblock a user
export const toggleBlockUser = async (userId: string): Promise<{ message: string; isBlocked: boolean }> => {
  try {
    const response = await api.post(`/api/v1/profile/${userId}/block`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Get block status
export const getBlockStatus = async (userId: string): Promise<{ isBlocked: boolean }> => {
  try {
    const response = await api.get(`/api/v1/profile/${userId}/block-status`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// Get suggested users to follow
export const getSuggestedUsers = async (limit: number = 10): Promise<SearchUsersResponse> => {
  try {
    const response = await api.get(`/api/v1/profile/suggested-users?limit=${limit}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

// TripScore functions
export interface TripScoreContinentsResponse {
  continents: { [key: string]: number };
}

export interface TripScoreCountriesResponse {
  countries: Array<{
    name: string;
    count: number;
    score: number;
  }>;
}

export interface TripScoreCountryDetailsResponse {
  country: {
    name: string;
    totalScore: number;
    locations: Array<{
      address: string;
      count: number;
      score: number;
    }>;
  };
}

export interface TripScoreLocationsResponse {
  locations: Array<{
    address: string;
    latitude: number;
    longitude: number;
    count: number;
    score: number;
  }>;
}

export const getTripScoreContinents = async (userId: string): Promise<TripScoreContinentsResponse> => {
  try {
    const response = await api.get(`/api/v1/profile/${userId}/tripscore/continents`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getTripScoreCountries = async (
  userId: string,
  continent: string
): Promise<TripScoreCountriesResponse> => {
  try {
    const response = await api.get(`/api/v1/profile/${userId}/tripscore/continents/${continent}/countries`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getTripScoreCountryDetails = async (
  userId: string,
  country: string
): Promise<TripScoreCountryDetailsResponse> => {
  try {
    const response = await api.get(`/api/v1/profile/${userId}/tripscore/countries/${country}`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getTripScoreLocations = async (
  userId: string,
  country: string
): Promise<TripScoreLocationsResponse> => {
  try {
    const response = await api.get(`/api/v1/profile/${userId}/tripscore/countries/${country}/locations`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export interface TravelMapDataResponse {
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
}

export const getTravelMapData = async (userId: string): Promise<TravelMapDataResponse> => {
  try {
    const response = await api.get(`/api/v1/profile/${userId}/travel-map`);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};
