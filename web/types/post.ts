import type { User } from "./user";

export type Comment = {
  _id: string;
  text: string;
  createdAt: string;
  user: User;
};

export type Song = {
  songId?: string;
  title?: string;
  artist?: string;
  duration?: number;
  s3Url?: string;
  thumbnailUrl?: string;
  storageKey?: string;
};

export type Post = {
  _id: string;
  type?: "post" | "short";
  caption?: string;
  imageUrl?: string;
  imageUrls?: string[]; // some endpoints may return arrays
  videoUrl?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  user: User;

  // social
  isLiked?: boolean;
  likesCount?: number;
  commentsCount?: number;
  viewsCount?: number;

  // location
  address?: string;
  latitude?: number;
  longitude?: number;
  hasExifGps?: boolean;
  source?: string;

  // music
  song?: Song;
  songStartTime?: number;
  songEndTime?: number;
  songVolume?: number;

  comments?: Comment[];

  createdAt?: string;
  updatedAt?: string;
};

