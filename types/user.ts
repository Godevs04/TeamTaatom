export interface UserType {
  uid: string;
  fullName: string;
  email: string;
  profilePic: string;
  followers: string[];
  following: string[];
  createdAt: string;
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
