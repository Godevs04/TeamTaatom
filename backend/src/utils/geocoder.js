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

const CANONICAL_LANDMARKS = {
  'big ben': {
    lat: 51.5007,
    lng: -0.1246,
    formattedAddress: 'Big Ben, Westminster, London SW1A 0AA, UK',
    city: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    stateProvince: 'England',
    continent: 'EUROPE'
  },
  'bigben': {
    lat: 51.5007,
    lng: -0.1246,
    formattedAddress: 'Big Ben, Westminster, London SW1A 0AA, UK',
    city: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    stateProvince: 'England',
    continent: 'EUROPE'
  },
  'elizabeth tower': {
    lat: 51.5007,
    lng: -0.1246,
    formattedAddress: 'Elizabeth Tower, Westminster, London SW1A 0AA, UK',
    city: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    stateProvince: 'England',
    continent: 'EUROPE'
  },
  'london eye': {
    lat: 51.503324,
    lng: -0.119543,
    formattedAddress: 'London Eye, Riverside Building, County Hall, London SE1 7PB, UK',
    city: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    stateProvince: 'England',
    continent: 'EUROPE'
  }
};

const normalizeLandmark = (value) => (
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

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

const geocodeCache = new Map();

/**
 * Geocodes an address string using Google Geocoding API.
 * @param {string} address The address to geocode
 * @returns {Promise<Object|null>} Geocoding result containing coordinates, city, country, etc., or null
 */
async function geocodeAddress(address) {
  if (!address || typeof address !== 'string' || address.trim() === '' || address.trim() === 'Unknown Location') {
    return null;
  }

  const normalizedAddress = address.trim().toLowerCase();
  if (geocodeCache.has(normalizedAddress)) {
    return geocodeCache.get(normalizedAddress);
  }

  const canonical = CANONICAL_LANDMARKS[normalizeLandmark(address)];
  if (canonical) {
    geocodeCache.set(normalizedAddress, { ...canonical });
    return { ...canonical };
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

        const geocodedResult = {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: result.formatted_address || address,
          city,
          country,
          countryCode,
          stateProvince,
          continent
        };

        geocodeCache.set(normalizedAddress, geocodedResult);
        return geocodedResult;
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
