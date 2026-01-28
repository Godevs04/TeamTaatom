const { sendSuccess, sendError } = require('../utils/errorCodes');
const logger = require('../utils/logger');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

// Use dynamic import for node-fetch (ESM module in CommonJS context)
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Helper: infer continent from coordinates (aligned with TripVisit service)
const getContinentFromCoordinates = (latitude, longitude) => {
  if (latitude >= -10 && latitude <= 80 && longitude >= 25 && longitude <= 180) return 'ASIA';
  if (latitude >= 35 && latitude <= 70 && longitude >= -10 && longitude <= 40) return 'EUROPE';
  if (latitude >= 5 && latitude <= 85 && longitude >= -170 && longitude <= -50) return 'NORTH AMERICA';
  if (latitude >= -60 && latitude <= 15 && longitude >= -85 && longitude <= -30) return 'SOUTH AMERICA';
  if (latitude >= -40 && latitude <= 40 && longitude >= -20 && longitude <= 50) return 'AFRICA';
  if (latitude >= -50 && latitude <= -10 && longitude >= 110 && longitude <= 180) return 'AUSTRALIA';
  if (latitude <= -60) return 'ANTARCTICA';
  return 'UNKNOWN';
};

/**
 * Proxy Google Places API Text Search
 * @route POST /api/v1/maps/search-place
 * @access Private (SuperAdmin)
 */
const searchPlace = async (req, res) => {
  try {
    const { placeName } = req.body;

    if (!placeName || typeof placeName !== 'string' || placeName.trim().length === 0) {
      return sendError(res, 'VAL_2001', 'Place name is required');
    }

    if (!GOOGLE_MAPS_API_KEY) {
      logger.error('Google Maps API key not configured');
      return sendError(res, 'SRV_6001', 'Google Maps API key is not configured');
    }

    const encodedQuery = encodeURIComponent(placeName.trim());
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const location = result.geometry?.location;

      if (location && location.lat && location.lng) {
        // Get detailed address components using geocoding
        let city = '';
        let country = '';
        let countryCode = '';
        let stateProvince = '';

        if (result.formatted_address) {
          try {
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(result.formatted_address)}&key=${GOOGLE_MAPS_API_KEY}`;
            const geocodeResponse = await fetch(geocodeUrl, { timeout: 10000 });
            const geocodeData = await geocodeResponse.json();

            if (geocodeData.status === 'OK' && geocodeData.results && geocodeData.results.length > 0) {
              const geocodeResult = geocodeData.results[0];
              if (geocodeResult.address_components) {
                geocodeResult.address_components.forEach(component => {
                  if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                    city = component.long_name;
                  }
                  if (component.types.includes('administrative_area_level_1')) {
                    stateProvince = component.long_name;
                  }
                  if (component.types.includes('country')) {
                    country = component.long_name;
                    countryCode = component.short_name;
                  }
                });
              }
            }
          } catch (geocodeError) {
            logger.warn('Geocoding failed for address components:', geocodeError.message);
            // Continue without address components
          }
        }

        // If geocoding didn't provide components, try to extract from formatted_address
        if (!city && result.formatted_address) {
          const parts = result.formatted_address.split(',').map(p => p.trim());
          if (parts.length >= 2) {
            city = parts[parts.length - 3] || parts[parts.length - 2] || '';
            if (parts.length >= 3) {
              stateProvince = parts[parts.length - 2] || '';
            }
            const lastPart = parts[parts.length - 1];
            if (lastPart) {
              const countryMatch = lastPart.match(/([A-Z]{2})$/);
              if (countryMatch) {
                countryCode = countryMatch[1];
              }
              country = lastPart;
            }
          }
        }

        const continent = getContinentFromCoordinates(location.lat, location.lng);

        return sendSuccess(res, 200, 'Place found successfully', {
          data: {
            lat: location.lat,
            lng: location.lng,
            name: result.name || placeName,
            formattedAddress: result.formatted_address || '',
            city,
            country,
            countryCode,
            stateProvince,
            placeId: result.place_id,
            continent,
          }
        });
      }
    } else if (data.status === 'REQUEST_DENIED') {
      logger.error('Google Maps API request denied:', data.error_message);
      return sendError(res, 'SRV_6001', data.error_message || 'Google Maps API request denied');
    } else if (data.status === 'ZERO_RESULTS') {
      return sendError(res, 'VAL_2001', 'No place found with that name');
    }

    return sendError(res, 'SRV_6001', data.error_message || 'Failed to search place');
  } catch (error) {
    logger.error('Place search error:', error);
    return sendError(res, 'SRV_6001', 'Error searching for place: ' + error.message);
  }
};

/**
 * Proxy Google Geocoding API
 * @route POST /api/v1/maps/geocode
 * @access Private (SuperAdmin)
 */
const geocodeAddress = async (req, res) => {
  try {
    const { address } = req.body;

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return sendError(res, 'VAL_2001', 'Address is required');
    }

    if (!GOOGLE_MAPS_API_KEY) {
      logger.error('Google Maps API key not configured');
      return sendError(res, 'SRV_6001', 'Google Maps API key is not configured');
    }

    const encodedAddress = encodeURIComponent(address.trim());
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url, { timeout: 10000 });
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const location = result.geometry?.location;

      if (location && location.lat && location.lng) {
        const addressComponents = {
          city: '',
          country: '',
          countryCode: '',
          stateProvince: '',
        };

        if (result.address_components) {
          result.address_components.forEach(component => {
            if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
              addressComponents.city = component.long_name;
            }
            if (component.types.includes('administrative_area_level_1')) {
              addressComponents.stateProvince = component.long_name;
            }
            if (component.types.includes('country')) {
              addressComponents.country = component.long_name;
              addressComponents.countryCode = component.short_name;
            }
          });
        }

        const continent = getContinentFromCoordinates(location.lat, location.lng);

        return sendSuccess(res, 200, 'Address geocoded successfully', {
          data: {
            lat: location.lat,
            lng: location.lng,
            formattedAddress: result.formatted_address || address,
            addressComponents,
            continent,
          }
        });
      }
    } else if (data.status === 'REQUEST_DENIED') {
      logger.error('Google Maps API request denied:', data.error_message);
      return sendError(res, 'SRV_6001', data.error_message || 'Google Maps API request denied');
    } else if (data.status === 'ZERO_RESULTS') {
      return sendError(res, 'VAL_2001', 'No geocoding results for the provided address');
    }

    return sendError(res, 'SRV_6001', data.error_message || 'Failed to geocode address');
  } catch (error) {
    logger.error('Geocoding error:', error);
    return sendError(res, 'SRV_6001', 'Error geocoding address: ' + error.message);
  }
};

module.exports = {
  searchPlace,
  geocodeAddress,
};

