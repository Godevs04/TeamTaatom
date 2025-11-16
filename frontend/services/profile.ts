import api from './api';
import { UserType, FollowRequestsResponse } from '../types/user';

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
    throw new Error(error.response?.data?.message || 'Failed to fetch profile');
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

    console.log('Updating profile with data:', {
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

    console.log('Profile update response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Profile update error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to update profile');
  }
};

// Follow/unfollow user
export const toggleFollow = async (userId: string): Promise<{
  message: string;
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
}> => {
  try {
    const response = await api.post(`/api/v1/profile/${userId}/follow`);
    return response.data;
  } catch (error: any) {
    // Handle 409 (Conflict) as a special case for follow request already pending
    if (error.response?.status === 409) {
      const conflictError = new Error(error.response?.data?.message || 'Follow request already pending');
      (conflictError as any).isConflict = true;
      throw conflictError;
    }
    throw new Error(error.response?.data?.message || 'Failed to update follow status');
  }
};

// Search users
export const searchUsers = async (query: string, page: number = 1, limit: number = 20): Promise<SearchUsersResponse> => {
  try {
    const response = await api.get(`/api/v1/profile/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to search users');
  }
};

// Update Expo push token
export const updateExpoPushToken = async (userId: string, expoPushToken: string): Promise<void> => {
  try {
    await api.put(`/api/v1/profile/${userId}/push-token`, { expoPushToken });
  } catch (error: any) {
    console.error('Failed to update Expo push token:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to update Expo push token');
  }
};

// Get follow requests
export const getFollowRequests = async (): Promise<FollowRequestsResponse> => {
  try {
    const response = await api.get('/api/v1/profile/follow-requests');
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to fetch follow requests');
  }
};

// Approve follow request
export const approveFollowRequest = async (requestId: string): Promise<{ message: string; followersCount: number }> => {
  try {
    const response = await api.post(`/api/v1/profile/follow-requests/${requestId}/approve`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to approve follow request');
  }
};

// Reject follow request
export const rejectFollowRequest = async (requestId: string): Promise<{ message: string }> => {
  try {
    const response = await api.post(`/api/v1/profile/follow-requests/${requestId}/reject`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to reject follow request');
  }
};

// Block or unblock a user
export const toggleBlockUser = async (userId: string): Promise<{ message: string; isBlocked: boolean }> => {
  try {
    const response = await api.post(`/api/v1/profile/${userId}/block`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update block status');
  }
};

// Get block status
export const getBlockStatus = async (userId: string): Promise<{ isBlocked: boolean }> => {
  try {
    const response = await api.get(`/api/v1/profile/${userId}/block-status`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to get block status');
  }
};
