const logger = require('./logger');


let fetch;
if (typeof global.fetch === 'function') {
  fetch = global.fetch;
} else {
  try {
    fetch = require('node-fetch');
  } catch (error) {
    fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
  }
}

// Bounding box lookup function (mimics coordsToCountry)
const { lookupByCoords } = require('./coordsToCountry');

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
 * Geocodes an address string using Google Geocoding API.
 * @param {string} address The address to geocode
 * @returns {Promise<Object|null>} Geocoding result containing coordinates, city, country, etc., or null
 */
async function geocodeAddress(address) {
  if (!address || typeof address !== 'string' || address.trim() === '' || address.trim() === 'Unknown Location') {
    return null;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  if (!apiKey) {
    logger.warn('Google Maps API key not configured, skipping geocoding');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address.trim());
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    const response = await fetch(url, { timeout: 10000 });
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const location = result.geometry?.location;

      if (location && location.lat && location.lng) {
        let city = '';
        let country = '';
        let countryCode = '';
        let stateProvince = '';

        if (result.address_components) {
          result.address_components.forEach(component => {
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

        // Determine continent from coordinates
        let continent = getContinentFromCoordinates(location.lat, location.lng);
        
        // Lookup country/continent by coords bbox first to be consistent
        const bboxHit = lookupByCoords(location.lat, location.lng);
        if (bboxHit) {
          country = bboxHit.country || country;
          continent = bboxHit.continent || continent;
        }

        return {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: result.formatted_address || address,
          city,
          country,
          countryCode,
          stateProvince,
          continent
        };
      }
    } else {
      logger.warn(`Google Geocoding failed for address "${address}": status = ${data.status}`);
    }
  } catch (error) {
    logger.error(`Geocoding error for address "${address}":`, error);
  }

  return null;
}

module.exports = {
  geocodeAddress
};
