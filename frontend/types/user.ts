export interface UserType {
  _id: string;
  fullName: string;
  email: string;
  profilePic: string;
  followers: string[];
  following: string[];
  totalLikes: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}
