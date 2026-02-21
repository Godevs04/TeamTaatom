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
};

