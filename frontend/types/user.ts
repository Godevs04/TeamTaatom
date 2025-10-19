export interface UserType {
  _id: string;
  fullName: string;
  bio?: string;
  email: string;
  profilePic: string;
  followers: string[];
  following: string[];
  totalLikes: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
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
