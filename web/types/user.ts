/** TripScore summary returned with profile (unique places visited) */
export type TripScore = {
  totalScore: number;
  continents: Record<string, number>;
  countries: Record<string, number>;
  areas?: Array<{ name?: string; country?: string; continent?: string; count?: number }>;
};

/** Profile gallery photo (shown inline next to the name). `url` is a short-lived signed URL. */
export type ProfileImage = {
  _id: string;
  url: string;
};

export type User = {
  _id: string;
  username?: string;
  fullName?: string;
  email?: string;
  bio?: string;
  profilePic?: string;
  /** Up to PROFILE_IMAGES_MAX photos shown inline to the right of the full name */
  profileImages?: ProfileImage[];
  isVerified?: boolean;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  interests?: string[];
  languagesKnown?: string[];
  nationality?: string;
  currentLocation?: string;
  /** Server-driven: bump when onboarding must run again for all users below this version */
  profileOnboardingVersion?: number;
  /** When viewing another user's profile */
  isFollowing?: boolean;
  followRequestSent?: boolean;
  requiresFollowApproval?: boolean;
  /** TripScore (unique places visited). Only present when canViewProfile/canViewLocations */
  tripScore?: TripScore | null;
  /** Whether the viewer can see this user's locations/trip score */
  canViewLocations?: boolean;
  /** Journey route visibility for this profile owner */
  routeVisibility?: "everyone" | "private" | "approved_only";
  /** Viewer's access when routeVisibility is approved_only */
  routeAccessStatus?: "none" | "pending" | "approved";
  canViewPosts?: boolean;
  isOwnProfile?: boolean;
  profileVisibility?: "public" | "followers" | "private";
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

