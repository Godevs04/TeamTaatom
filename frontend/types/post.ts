export interface PostType {
  _id: string;
  user: {
    _id: string;
    fullName: string;
    profilePic: string;
  };
  caption: string;
  imageUrl: string;
  images?: string[]; // Multiple images for carousel
  videoUrl?: string;
  mediaUrl?: string; // Virtual field from backend
  cloudinaryPublicId?: string;
  cloudinaryPublicIds?: string[]; // Multiple public IDs
  tags?: string[];
  type?: 'photo' | 'short';
  location?: {
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
  viewsCount?: number; // Post view count
  isLiked: boolean;
  // Post settings
  commentsDisabled?: boolean;
  isArchived?: boolean;
  isHidden?: boolean;
  // Song selection
  song?: {
    songId?: {
      _id: string;
      title: string;
      artist: string;
      duration: number;
      s3Url: string;
      thumbnailUrl?: string;
    };
    startTime?: number;
    endTime?: number;
    volume?: number;
  };
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
