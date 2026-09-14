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
  type?: "post" | "short" | "photo" | "long_video";
  caption?: string;
  imageUrl?: string;
  imageUrls?: string[];
  images?: string[]; // backend getPostById returns this
  videoUrl?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  youtubeUrl?: string | null;
  youtubeVideoId?: string | null;
  youtubeChannelTitle?: string | null;
  durationSeconds?: number | null;
  source?: "upload" | "youtube" | null;
  user: User;

  // social
  isLiked?: boolean;
  isSaved?: boolean;
  likesCount?: number;
  commentsCount?: number;
  viewsCount?: number;
  /** Post owner has turned commenting off */
  commentsDisabled?: boolean;

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

  // music
  song?: Song;
  songStartTime?: number;
  songEndTime?: number;
  songVolume?: number;

  comments?: Comment[];

  /** Long-video monetization schedule from API (optional). */
  adSchedule?: {
    slots?: Array<{
      atSeconds: number | "end";
      type?: string;
      preferRewarded?: boolean;
    }>;
  };

  createdAt?: string;
  updatedAt?: string;
};

