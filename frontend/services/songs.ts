import { getApiUrl } from '../utils/config';
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
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (genre && genre !== 'all') params.append('genre', genre);
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const response = await fetch(`${getApiUrl('/api/v1/songs')}?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch songs');
    }

    // Backend returns: { success: true, message, songs, pagination }
    return data;
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
    const response = await fetch(`${getApiUrl(`/api/v1/songs/${id}`)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch song');
    }

    // Backend returns: { success: true, message, song }
    return data.song;
  } catch (error) {
    logger.error('getSongById', error);
    throw error;
  }
};

