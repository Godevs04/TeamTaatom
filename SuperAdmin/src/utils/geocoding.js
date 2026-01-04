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
    const response = await api.post('/api/v1/maps/search-place', {
      placeName: placeName.trim()
    });
    
    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }
    
    return null;

  } catch (error) {
    console.error('Place search error:', error);
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
    const response = await api.post('/api/v1/maps/geocode', {
      address: address.trim()
    });
    
    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }
    
    return null;

  } catch (error) {
    console.error('Geocoding error:', error);
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

