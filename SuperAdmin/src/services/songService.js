import api from './api';

/**
 * Get all songs
 * @param {string} search - Search query
 * @param {string} genre - Genre filter
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise} Songs array with pagination
 */
export const getSongs = async (search = '', genre = '', page = 1, limit = 50, includeInactive = true) => {
  try {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (genre && genre !== 'all') params.append('genre', genre);
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    // For SuperAdmin, include inactive songs to see status
    if (includeInactive) {
      params.append('includeInactive', 'true');
    }

    const response = await api.get(`/api/v1/songs?${params.toString()}`);
    // Backend returns: { success: true, message, songs, pagination }
    return response.data;
  } catch (error) {
    console.error('Error fetching songs:', error);
    throw error;
  }
};

/**
 * Upload a new song
 * @param {FormData} formData - FormData with song file and metadata
 * @returns {Promise} Uploaded song data
 */
export const uploadSong = async (formData) => {
  try {
    const response = await api.post('/api/v1/songs/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading song:', error);
    throw error;
  }
};

/**
 * Delete a song
 * @param {string} id - Song ID
 * @returns {Promise} Deletion response
 */
export const deleteSong = async (id) => {
  try {
    const response = await api.delete(`/api/v1/songs/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting song:', error);
    throw error;
  }
};

/**
 * Get song by ID
 * @param {string} id - Song ID
 * @returns {Promise} Song data
 */
export const getSongById = async (id) => {
  try {
    const response = await api.get(`/api/v1/songs/${id}`);
    // Backend returns: { success: true, message, song }
    return response.data.song;
  } catch (error) {
    console.error('Error fetching song:', error);
    throw error;
  }
};

