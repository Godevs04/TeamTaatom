export interface PostType {
  postId: string;
  uid: string;
  photoUrl: string;
  comment: string;
  location: {
    lat: number;
    lng: number;
  };
  placeName?: string;
  timestamp: any;
  likes: string[];
}

export interface CommentType {
  commentId: string;
  uid: string;
  text: string;
  timestamp: any;
}

export interface LocationType {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
}
