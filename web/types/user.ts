/** TripScore summary returned with profile (unique places visited) */
export type TripScore = {
  totalScore: number;
  continents: Record<string, number>;
  countries: Record<string, number>;
  areas?: Array<{ name?: string; country?: string; continent?: string; count?: number }>;
};

export type User = {
  _id: string;
  username?: string;
  fullName?: string;
  email?: string;
  bio?: string;
  profilePic?: string;
  isVerified?: boolean;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  interests?: string[];
  /** When viewing another user's profile */
  isFollowing?: boolean;
  followRequestSent?: boolean;
  requiresFollowApproval?: boolean;
  /** TripScore (unique places visited). Only present when canViewProfile/canViewLocations */
  tripScore?: TripScore | null;
  /** Whether the viewer can see this user's locations/trip score */
  canViewLocations?: boolean;
};

export type FollowRequest = {
  _id: string;
  user: User;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
};

export type AccountActivity = {
  type: string;
  description: string;
  timestamp: string;
  ipAddress: string | null;
  device: string | null;
};

export type ActiveSession = {
  sessionId: string;
  device: string;
  ipAddress: string;
  location: string | null;
  lastActive: string;
};

export type BlockedUser = {
  _id: string;
  fullName: string;
  username: string;
  email: string;
  profilePic?: string;
};

