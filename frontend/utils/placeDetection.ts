import api from '../services/api';
import logger from './logger';

/**
 * Search for a place using Google Places API (via backend proxy)
 * @param placeName - Place name (e.g., "Museum of Anthropology")
 * @returns Place details with location, address components, etc.
 */
export const searchPlace = async (placeName: string): Promise<{
  lat: number;
  lng: number;
  name: string;
  formattedAddress: string;
  city: string;
  country: string;
  countryCode: string;
  stateProvince: string;
  continent?: string;
  placeId?: string;
} | null> => {
  if (!placeName || placeName.trim().length === 0) {
    return null;
  }

  try {
    // Use user-accessible endpoint
    const response = await api.post('/api/v1/maps/search-place-user', {
      placeName: placeName.trim()
    });
    
    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }
    
    return null;
  } catch (error: any) {
    // Only log unexpected errors (network errors, 500s, etc.)
    const status = error.response?.status;
    const isExpectedError = status === 404 || status === 400 || status === 422;
    
    if (!isExpectedError) {
      logger.error('Place search error:', error);
    }
    
    return null;
  }
};
