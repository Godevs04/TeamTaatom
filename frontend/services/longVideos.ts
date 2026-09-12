import api from './api';
import { PostType } from '../types/post';
import { isRateLimitError, handleRateLimitError } from '../utils/rateLimitHandler';
import { parseError } from '../utils/errorCodes';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface LongVideoPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface LongVideosResponse {
  videos: PostType[];
  posts: PostType[];
  pagination: LongVideoPagination;
}

export interface LongVideoResponse {
  video: PostType;
  post: PostType;
}

function normalizeVideo(raw: any): PostType {
  return {
    ...raw,
    type: 'long_video',
    caption: raw.caption || raw.title || '',
    imageUrl: raw.imageUrl || raw.thumbnailUrl || '',
    thumbnailUrl: raw.thumbnailUrl || raw.imageUrl,
    mediaUrl: raw.mediaUrl || raw.thumbnailUrl || raw.imageUrl,
    likes: raw.likes || [],
    comments: raw.comments || [],
    likesCount: raw.likesCount ?? 0,
    commentsCount: raw.commentsCount ?? 0,
    sharesCount: raw.sharesCount ?? 0,
    isLiked: !!raw.liked || !!raw.isLiked,
    isActive: raw.isActive !== false,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
    user: raw.user || {
      _id: '',
      fullName: 'Taatom',
      profilePic: '',
    },
  } as PostType;
}

export const getLongVideos = async (
  page: number = 1,
  limit: number = 15
): Promise<LongVideosResponse> => {
  try {
    const response = await api.get(`/api/v1/long-videos?page=${page}&limit=${limit}`);
    const data = response.data;
    const list = (data.videos || data.posts || []).map(normalizeVideo);
    return {
      videos: list,
      posts: list,
      pagination: {
        page: data.pagination?.page ?? page,
        limit: data.pagination?.limit ?? limit,
        total: data.pagination?.total ?? list.length,
        totalPages: data.pagination?.totalPages ?? 1,
        hasMore: data.pagination?.hasMore ?? false,
      },
    };
  } catch (error: any) {
    if (isRateLimitError(error)) {
      const rateLimitInfo = handleRateLimitError(error, 'getLongVideos');
      await sleep(500);
      try {
        const retry = await api.get(`/api/v1/long-videos?page=${page}&limit=${limit}`);
        const data = retry.data;
        const list = (data.videos || data.posts || []).map(normalizeVideo);
        return {
          videos: list,
          posts: list,
          pagination: {
            page: data.pagination?.page ?? page,
            limit: data.pagination?.limit ?? limit,
            total: data.pagination?.total ?? list.length,
            totalPages: data.pagination?.totalPages ?? 1,
            hasMore: data.pagination?.hasMore ?? false,
          },
        };
      } catch {
        throw new Error(rateLimitInfo.message);
      }
    }
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getLongVideo = async (id: string): Promise<LongVideoResponse> => {
  try {
    const response = await api.get(`/api/v1/long-videos/${id}`);
    const data = response.data;
    const video = normalizeVideo(data.video || data.post);
    return { video, post: video };
  } catch (error: any) {
    const parsedError = parseError(error);
    throw new Error(parsedError.userMessage);
  }
};

export const getUserLongVideos = async (
  userId: string,
  page: number = 1,
  limit: number = 15
): Promise<LongVideosResponse> => {
  const response = await api.get(
    `/api/v1/long-videos/user/${userId}?page=${page}&limit=${limit}`
  );
  const data = response.data;
  const list = (data.videos || data.posts || []).map(normalizeVideo);
  return {
    videos: list,
    posts: list,
    pagination: {
      page: data.pagination?.page ?? page,
      limit: data.pagination?.limit ?? limit,
      total: data.pagination?.total ?? list.length,
      totalPages: data.pagination?.totalPages ?? 1,
      hasMore: data.pagination?.hasMore ?? false,
    },
  };
};

export const uploadLongVideo = async (
  params: {
    videoUri: string;
    videoName?: string;
    videoType?: string;
    caption?: string;
    durationSeconds?: number;
    thumbnailUri?: string;
  },
  onProgress?: (progress: number) => void
): Promise<LongVideoResponse> => {
  const formData = new FormData();
  formData.append('video', {
    uri: params.videoUri,
    type: params.videoType || 'video/mp4',
    name: params.videoName || 'long-video.mp4',
  } as any);
  if (params.caption) formData.append('caption', params.caption);
  if (params.durationSeconds != null) {
    formData.append('durationSeconds', String(params.durationSeconds));
  }
  if (params.thumbnailUri) {
    formData.append('image', {
      uri: params.thumbnailUri,
      type: 'image/jpeg',
      name: 'thumb.jpg',
    } as any);
  }

  try {
    const response = await api.post('/api/v1/long-videos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 10 * 60 * 1000,
      onUploadProgress: (evt) => {
        if (!onProgress) return;
        if (evt.total) {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      },
    });
    const data = response.data;
    const video = normalizeVideo(data.video || data.post);
    onProgress?.(100);
    return { video, post: video };
  } catch (error: any) {
    if (isRateLimitError(error)) {
      throw new Error(handleRateLimitError(error, 'uploadLongVideo').message);
    }
    throw new Error(parseError(error).userMessage);
  }
};
