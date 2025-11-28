import api from './api';
import logger from '../utils/logger';

/**
 * Get all locales
 * @param {string} search - Search query
 * @param {string} countryCode - Country code filter
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise} Locales array with pagination
 */
export const getLocales = async (search = '', countryCode = '', page = 1, limit = 50, includeInactive = true) => {
  try {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (countryCode && countryCode !== 'all') params.append('countryCode', countryCode);
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    // For SuperAdmin, include inactive locales to see status
    if (includeInactive) {
      params.append('includeInactive', 'true');
    }

    const response = await api.get(`/api/v1/locales?${params.toString()}`);
    // Backend returns: { success: true, message, locales, pagination }
    return response.data;
  } catch (error) {
    logger.error('Error fetching locales:', error);
    throw error;
  }
};

/**
 * Upload a new locale
 * @param {FormData} formData - FormData with image file and metadata
 * @returns {Promise} Uploaded locale data
 */
export const uploadLocale = async (formData) => {
  try {
    const response = await api.post('/api/v1/locales/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    logger.error('Error uploading locale:', error);
    throw error;
  }
};

/**
 * Delete a locale
 * @param {string} id - Locale ID
 * @returns {Promise} Deletion response
 */
export const deleteLocale = async (id) => {
  try {
    const response = await api.delete(`/api/v1/locales/${id}`);
    return response.data;
  } catch (error) {
    logger.error('Error deleting locale:', error);
    throw error;
  }
};

/**
 * Get locale by ID
 * @param {string} id - Locale ID
 * @returns {Promise} Locale data
 */
export const getLocaleById = async (id) => {
  try {
    const response = await api.get(`/api/v1/locales/${id}`);
    // Backend returns: { success: true, message, locale }
    return response.data.locale;
  } catch (error) {
    logger.error('Error fetching locale:', error);
    throw error;
  }
};

/**
 * Toggle locale active/inactive status
 * @param {string} id - Locale ID
 * @param {boolean} isActive - New active status
 * @returns {Promise} Updated locale data
 */
export const toggleLocaleStatus = async (id, isActive) => {
  try {
    const response = await api.patch(`/api/v1/locales/${id}/toggle`, { isActive });
    return response.data;
  } catch (error) {
    logger.error('Error toggling locale status:', error);
    throw error;
  }
};

/**
 * Update locale details
 * @param {string} id - Locale ID
 * @param {object} data - Locale data to update (name, country, countryCode, etc.)
 * @returns {Promise} Updated locale data
 */
export const updateLocale = async (id, data) => {
  try {
    const response = await api.put(`/api/v1/locales/${id}`, data);
    return response.data;
  } catch (error) {
    logger.error('Error updating locale:', error);
    throw error;
  }
};

