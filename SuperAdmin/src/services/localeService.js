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
    const response = await api.post('/api/v1/locales/upload', formData);
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
export const updateLocale = async (id, data, imageFiles = null, options = {}) => {
  try {
    if (imageFiles && imageFiles.length > 0) {
      const fd = new FormData();
      fd.append('name', data.name);
      fd.append('country', data.country);
      fd.append('countryCode', data.countryCode);
      if (data.stateProvince != null) fd.append('stateProvince', data.stateProvince);
      if (data.stateCode != null) fd.append('stateCode', data.stateCode);
      fd.append('city', data.city);
      if (data.description != null) fd.append('description', data.description);
      fd.append('displayOrder', String(data.displayOrder ?? 0));
      fd.append('spotTypes', JSON.stringify(data.spotTypes || []));
      if (data.travelInfo) fd.append('travelInfo', data.travelInfo);
      if (data.latitude != null && data.latitude !== '') fd.append('latitude', String(data.latitude));
      if (data.longitude != null && data.longitude !== '') fd.append('longitude', String(data.longitude));
      fd.append('replaceGallery', options.appendGallery ? 'false' : 'true');
      imageFiles.forEach((f) => fd.append('images', f));
      const response = await api.put(`/api/v1/locales/${id}`, fd, {
        transformRequest: [
          (data, headers) => {
            if (typeof FormData !== 'undefined' && data instanceof FormData) {
              if (headers && typeof headers.delete === 'function') {
                headers.delete('Content-Type');
              }
            }
            return data;
          },
        ],
      });
      return response.data;
    }
    const response = await api.put(`/api/v1/locales/${id}`, data);
    return response.data;
  } catch (error) {
    logger.error('Error updating locale:', error);
    throw error;
  }
};

/**
 * Get all unique countries from all locales (for filter dropdown)
 * @returns {Promise} Array of unique countries with codes, names, and localeCount
 */
export const getUniqueCountries = async () => {
  try {
    const response = await api.get('/api/v1/locales/countries');
    // Backend returns: { success: true, message, countries: [...] } (sendSuccess spreads data)
    return response.data.countries || [];
  } catch (error) {
    logger.error('Error fetching unique countries:', error);
    throw error;
  }
};

