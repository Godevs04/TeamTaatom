export interface UserType {
  uid: string;
  fullName: string;
  email: string;
  profilePic: string;
  gender?: 'male' | 'female';
  followers: number;
  following: number;
  createdAt: string;
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
