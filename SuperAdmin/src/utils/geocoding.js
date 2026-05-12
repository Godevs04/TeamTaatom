/**
 * Google Maps Geocoding Utility
 * Uses backend proxy to call Google Maps Geocoding API and Places API
 */

import api from '../services/api';

/**
 * Search for a place using Google Places API Text Search (via backend proxy)
 * @param {string} placeName - Place name (e.g., "Museum of Anthropology")
 * @returns {Promise<{lat: number, lng: number, name: string, formattedAddress: string, city: string, country: string, countryCode: string, stateProvince: string} | null>}
 */
export const searchPlace = async (placeName) => {
  if (!placeName || placeName.trim().length === 0) {
    return null;
  }

  try {
    // Mark this request to skip error logging in interceptor (expected failures)
    const response = await api.post('/api/v1/maps/search-place', {
      placeName: placeName.trim()
    }, {
      skipErrorLog: true // Custom flag to skip error logging
    });
    
    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }
    
    return null;

  } catch (error) {
    // Only log unexpected errors (network errors, 500s, etc.)
    // Don't log 404s or 400s as they're expected for invalid place names
    const status = error.response?.status;
    const isExpectedError = status === 404 || status === 400 || status === 422;
    
    if (!isExpectedError) {
      console.error('Place search error:', error);
    }
    
    return null;
  }
};

/**
 * Geocode an address using Google Maps Geocoding API (via backend proxy)
 * @param {string} address - Address string (e.g., "Museum of Anthropology, Vancouver, CA")
 * @returns {Promise<{lat: number, lng: number, formattedAddress: string, addressComponents?: object} | null>}
 */
export const geocodeAddress = async (address) => {
  if (!address || address.trim().length === 0) {
    return null;
  }

  try {
    // Mark this request to skip error logging in interceptor (expected failures)
    const response = await api.post('/api/v1/maps/geocode', {
      address: address.trim()
    }, {
      skipErrorLog: true // Custom flag to skip error logging
    });
    
    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }
    
    return null;

  } catch (error) {
    // Only log unexpected errors (network errors, 500s, etc.)
    // Don't log 404s or 400s as they're expected for invalid addresses
    const status = error.response?.status;
    const isExpectedError = status === 404 || status === 400 || status === 422;
    
    if (!isExpectedError) {
      console.error('Geocoding error:', error);
    }
    
    return null;
  }
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if coordinates are within a certain radius (default 0.5km)
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @param {number} radiusKm - Radius in kilometers (default: 0.5)
 * @returns {boolean} True if coordinates are within radius
 */
export const areCoordinatesNearby = (lat1, lon1, lat2, lon2, radiusKm = 0.5) => {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  if (distance === null) return false;
  return distance <= radiusKm;
};

/**
 * Build address string from locale form data
 * @param {object} formData - Form data with name, city, country, countryCode, stateProvince
 * @returns {string} Formatted address string
 */
export const buildAddressString = (formData) => {
  const parts = [];
  
  if (formData.name) {
    parts.push(formData.name);
  }
  
  if (formData.city) {
    parts.push(formData.city);
  }
  
  if (formData.stateProvince) {
    parts.push(formData.stateProvince);
  }
  
  if (formData.country) {
    parts.push(formData.country);
  } else if (formData.countryCode) {
    parts.push(formData.countryCode);
  }
  
  return parts.join(', ');
};

/**
 * Reverse-geocode coordinates and detect a tourist-oriented place (via backend + Google).
 * @returns {Promise<object | null>} API payload data or null on failure / expected empty result
 */
export const reverseGeocodeTourist = async (latitude, longitude) => {
  if (latitude == null || longitude == null) {
    return null;
  }

  try {
    const response = await api.post(
      '/api/v1/maps/reverse-geocode',
      { latitude, longitude },
      { skipErrorLog: true }
    );

    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }

    return null;
  } catch (error) {
    const status = error.response?.status;
    const isExpectedError = status === 404 || status === 400 || status === 422;

    if (!isExpectedError) {
      console.error('Reverse geocode error:', error);
    }

    return null;
  }
};

/**
 * OSM tourism POIs in bounding box (backend Overpass proxy).
 * @returns {Promise<{ pois: Array, hint?: string } | null>}
 */
export const fetchTourismOsmInBounds = async (south, west, north, east, signal) => {
  try {
    const response = await api.post(
      '/api/v1/maps/tourism-osm',
      { south, west, north, east },
      {
        skipErrorLog: true,
        skipRateLimit: true,
        signal,
        timeout: 55000,
      }
    );

    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }

    return null;
  } catch (error) {
    if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') {
      throw error;
    }
    const status = error.response?.status;
    const isExpectedError = status === 404 || status === 400 || status === 422;

    if (!isExpectedError) {
      console.error('tourism-osm error:', error);
    }

    return null;
  }
};

/**
 * Reverse geocode for locale import; keeps OSM display name when passed as preferredName.
 */
export const reverseAddressForImport = async (latitude, longitude, preferredName = '') => {
  try {
    const body = { latitude, longitude };
    if (preferredName && String(preferredName).trim()) {
      body.preferredName = String(preferredName).trim();
    }

    const response = await api.post('/api/v1/maps/reverse-address', body, {
      skipErrorLog: true,
      timeout: 20000,
    });

    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }

    return null;
  } catch (error) {
    const status = error.response?.status;
    const isExpectedError = status === 404 || status === 400 || status === 422;

    if (!isExpectedError) {
      console.error('reverse-address error:', error);
    }

    return null;
  }
};

