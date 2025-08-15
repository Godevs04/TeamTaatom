export interface PostType {
  _id: string;
  user: {
    _id: string;
    fullName: string;
    profilePic: string;
  };
  caption: string;
  imageUrl: string;
  cloudinaryPublicId: string;
  location: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  likes: string[];
  comments: CommentType[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Virtual fields from backend
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
}

export interface CommentType {
  _id: string;
  user: {
    _id: string;
    fullName: string;
    profilePic: string;
  };
  text: string;
  createdAt: string;
}

export interface LocationType {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
}
