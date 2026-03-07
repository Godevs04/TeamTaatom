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
  imageUrls?: string[];
  images?: string[]; // backend getPostById returns this
  videoUrl?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  user: User;

  // social
  isLiked?: boolean;
  likesCount?: number;
  commentsCount?: number;
  viewsCount?: number;

  // location (backend stores in location + detectedPlace; some APIs may flatten to address/latitude/longitude)
  address?: string;
  latitude?: number;
  longitude?: number;
  location?: {
    address?: string;
    coordinates?: { latitude?: number; longitude?: number };
  };
  detectedPlace?: {
    name?: string;
    formattedAddress?: string;
    city?: string;
    stateProvince?: string;
    country?: string;
    countryCode?: string;
    latitude?: number;
    longitude?: number;
  };
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

