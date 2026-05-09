export interface UserType {
  _id: string;
  fullName: string;
  username?: string;
  bio?: string;
  email: string;
  profilePic: string;
  followers: string[] | number;
  following: string[] | number;
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
