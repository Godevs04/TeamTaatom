export interface PostType {
  _id: string;
  user: {
    _id: string;
    fullName: string;
    profilePic: string;
    username?: string;
  };
  caption: string;
  imageUrl: string;
  thumbnailUrl?: string; // Thumbnail for video/short posts
  images?: string[]; // Multiple images for carousel
  videoUrl?: string;
  mediaUrl?: string; // Virtual field from backend
  cloudinaryPublicId?: string;
  cloudinaryPublicIds?: string[]; // Multiple public IDs
  tags?: string[];
  type?: 'photo' | 'short';
  aspectRatio?: '1:1' | '16:9' | 'full' | '1.91:1';
  filter?: 'original' | 'vivid' | 'warm' | 'cool' | 'bw';
  location?: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  spotType?: string;
  travelInfo?: string;
  likes: string[];
  comments: CommentType[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Virtual fields from backend
  likesCount: number;
  commentsCount: number;
  sharesCount?: number;
  viewsCount?: number; // Post view count
  isLiked: boolean;
  isSaved?: boolean;
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
    username?: string;
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
