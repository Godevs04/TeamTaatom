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
    // Truncate coordinates to 3 decimal places for privacy
    if (formData && typeof FormData !== 'undefined' && formData instanceof FormData) {
      if (formData.has('latitude') && formData.get('latitude')) {
        const lat = parseFloat(formData.get('latitude'));
        if (!isNaN(lat)) {
          formData.set('latitude', String(Math.round(lat * 1000) / 1000));
        }
      }
      if (formData.has('longitude') && formData.get('longitude')) {
        const lng = parseFloat(formData.get('longitude'));
        if (!isNaN(lng)) {
          formData.set('longitude', String(Math.round(lng * 1000) / 1000));
        }
      }
    }

    const response = await api.post('/api/v1/locales/upload', formData, {
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
    const sanitizedData = { ...data };
    if (sanitizedData.latitude != null && sanitizedData.latitude !== '') {
      sanitizedData.latitude = Math.round(parseFloat(sanitizedData.latitude) * 1000) / 1000;
    }
    if (sanitizedData.longitude != null && sanitizedData.longitude !== '') {
      sanitizedData.longitude = Math.round(parseFloat(sanitizedData.longitude) * 1000) / 1000;
    }

    if (imageFiles && imageFiles.length > 0) {
      const fd = new FormData();
      fd.append('name', sanitizedData.name);
      fd.append('country', sanitizedData.country);
      fd.append('countryCode', sanitizedData.countryCode);
      if (sanitizedData.stateProvince != null) fd.append('stateProvince', sanitizedData.stateProvince);
      if (sanitizedData.stateCode != null) fd.append('stateCode', sanitizedData.stateCode);
      fd.append('city', sanitizedData.city);
      if (sanitizedData.description != null) fd.append('description', sanitizedData.description);
      fd.append('displayOrder', String(sanitizedData.displayOrder ?? 0));
      fd.append('spotTypes', JSON.stringify(sanitizedData.spotTypes || []));
      if (sanitizedData.travelInfo) fd.append('travelInfo', sanitizedData.travelInfo);
      if (sanitizedData.latitude != null && sanitizedData.latitude !== '') fd.append('latitude', String(sanitizedData.latitude));
      if (sanitizedData.longitude != null && sanitizedData.longitude !== '') fd.append('longitude', String(sanitizedData.longitude));
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
    const response = await api.put(`/api/v1/locales/${id}`, sanitizedData);
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

