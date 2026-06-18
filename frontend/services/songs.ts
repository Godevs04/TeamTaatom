import api from './api';
import logger from '../utils/logger';

export interface Song {
  _id: string;
  title: string;
  artist: string;
  duration: number;
  s3Url: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  genre: string;
}

export interface SongSelection {
  songId: string;
  startTime?: number;
  volume?: number;
}

/**
 * Get all active songs for selection
 * @param search - Optional search query for title/artist
 * @param genre - Optional genre filter
 * @param page - Page number (default: 1)
 * @param limit - Items per page (default: 50)
 * @returns Promise with songs array and pagination info
 */
export const getSongs = async (
  search?: string,
  genre?: string,
  page: number = 1,
  limit: number = 50
): Promise<{ songs: Song[]; pagination: any }> => {
  try {
    const params: any = {};
    if (search) params.search = search;
    if (genre && genre !== 'all') params.genre = genre;
    params.page = page;
    params.limit = limit;

    const response = await api.get('/api/v1/songs', { params });
    return response.data;
  } catch (error) {
    logger.error('getSongs', error);
    throw error;
  }
};

/**
 * Get single song by ID
 * @param id - Song ID
 * @returns Promise with song object
 */
export const getSongById = async (id: string): Promise<Song> => {
  try {
    const response = await api.get(`/api/v1/songs/${id}`);
    return response.data.song;
  } catch (error) {
    logger.error('getSongById', error);
    throw error;
  }
};
