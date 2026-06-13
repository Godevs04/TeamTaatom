export interface UserType {
  _id: string;
  fullName: string;
  username?: string;
  bio?: string;
  email: string;
  profilePic: string;
  followers: string[] | number;
  following: string[] | number;
  followingIds?: string[];
  totalLikes: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  profileOnboardingVersion?: number;
  interests?: string[];
  languagesKnown?: string[];
  nationality?: string;
  isFollowing?: boolean;
  followRequestSent?: boolean;
  requiresFollowApproval?: boolean;
  travelStyle?: string;
  settings?: {
    privacy?: {
      profileVisibility?: 'public' | 'followers' | 'private';
      showEmail?: boolean;
      showLocation?: boolean;
      allowMessages?: 'everyone' | 'followers' | 'none';
      requireFollowApproval?: boolean;
      allowFollowRequests?: boolean;
      shareActivity?: boolean;
      routeVisibility?: 'everyone' | 'approved_only' | 'private';
    };
  };
}

export interface FollowRequest {
  _id: string;
  user: UserType;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface FollowRequestsResponse {
  followRequests: FollowRequest[];
}
