const { sendSuccess, sendError } = require('../utils/errorCodes');
const logger = require('../utils/logger');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

// Use dynamic import for node-fetch (ESM module in CommonJS context)
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

/** Google place types we treat as tourist / visitor destinations */
const TOURIST_PLACE_TYPES = new Set([
  'tourist_attraction',
  'museum',
  'art_gallery',
  'zoo',
  'aquarium',
  'amusement_park',
  'park',
  'national_park',
  'natural_feature',
  'campground',
  'stadium',
  'hindu_temple',
  'mosque',
  'church',
  'synagogue',
  'place_of_worship',
  'rv_park',
]);

const distanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const isTouristTypes = (types = []) => types.some((t) => TOURIST_PLACE_TYPES.has(t));

function extractNameFromGeocodeResult(result) {
  const comps = result.address_components || [];
  const establishment = comps.find((c) => c.types.includes('establishment'));
  if (establishment) return establishment.long_name;
  const poi = comps.find((c) => c.types.includes('point_of_interest'));
  if (poi) return poi.long_name;
  const parts = (result.formatted_address || '').split(',');
  const head = (parts[0] || '').trim();
  return head || 'Unknown place';
}

function parseAddressComponentsFromGeocodeResult(result) {
  let city = '';
  let country = '';
  let countryCode = '';
  let stateProvince = '';
  if (result.address_components) {
    result.address_components.forEach((component) => {
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
  return { city, country, countryCode, stateProvince };
}

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

/**
 * Reverse-geocode lat/lng and detect tourist-oriented places (Geocoding + optional Nearby fallback).
 * @route POST /api/v1/maps/reverse-geocode
 * @access Private (SuperAdmin)
 */
const reverseGeocode = async (req, res) => {
  try {
    const latRaw = req.body.latitude;
    const lngRaw = req.body.longitude;
    const lat = typeof latRaw === 'number' ? latRaw : parseFloat(String(latRaw), 10);
    const lng = typeof lngRaw === 'number' ? lngRaw : parseFloat(String(lngRaw), 10);

    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return sendError(res, 'VAL_2001', 'Valid latitude and longitude are required');
    }

    if (!GOOGLE_MAPS_API_KEY) {
      logger.error('Google Maps API key not configured');
      return sendError(res, 'SRV_6001', 'Google Maps API key is not configured');
    }

    const latlngParam = `${lat},${lng}`;
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(latlngParam)}&key=${GOOGLE_MAPS_API_KEY}`;
    const geoResponse = await fetch(geoUrl, { timeout: 12000 });
    const geoData = await geoResponse.json();

    if (geoData.status === 'REQUEST_DENIED') {
      logger.error('Google Maps reverse geocode denied:', geoData.error_message);
      return sendError(res, 'SRV_6001', geoData.error_message || 'Google Maps API request denied');
    }

    let chosen = null;
    if (geoData.status === 'OK' && geoData.results?.length) {
      chosen = geoData.results.find((r) => isTouristTypes(r.types));
    }

    let source = 'geocode';

    if (!chosen) {
      const nearbyUrl =
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
        `?location=${encodeURIComponent(latlngParam)}&radius=120&key=${GOOGLE_MAPS_API_KEY}`;
      const nearbyResponse = await fetch(nearbyUrl, { timeout: 12000 });
      const nearbyData = await nearbyResponse.json();

      if (nearbyData.status === 'REQUEST_DENIED') {
        logger.error('Google Places nearby denied:', nearbyData.error_message);
        return sendError(res, 'SRV_6001', nearbyData.error_message || 'Google Places API request denied');
      }

      if (nearbyData.status === 'OK' && nearbyData.results?.length) {
        const touristCandidates = nearbyData.results.filter((r) => isTouristTypes(r.types || []));
        if (touristCandidates.length) {
          touristCandidates.sort(
            (a, b) =>
              distanceKm(lat, lng, a.geometry.location.lat, a.geometry.location.lng) -
              distanceKm(lat, lng, b.geometry.location.lat, b.geometry.location.lng)
          );
          const best = touristCandidates[0];
          const loc = best.geometry?.location;
          if (loc?.lat != null && loc?.lng != null) {
            const gcUrl =
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${loc.lat},${loc.lng}`)}&key=${GOOGLE_MAPS_API_KEY}`;
            const gcRes = await fetch(gcUrl, { timeout: 12000 });
            const gcJson = await gcRes.json();
            let formattedAddress = best.vicinity ? `${best.name}, ${best.vicinity}` : best.name || '';
            let addrBits = { city: '', country: '', countryCode: '', stateProvince: '' };
            if (gcJson.status === 'OK' && gcJson.results?.length) {
              const gr = gcJson.results[0];
              formattedAddress = gr.formatted_address || formattedAddress;
              addrBits = parseAddressComponentsFromGeocodeResult(gr);
            }
            const continent = getContinentFromCoordinates(loc.lat, loc.lng);
            return sendSuccess(res, 200, 'Place resolved', {
              data: {
                isTouristPlace: true,
                lat: loc.lat,
                lng: loc.lng,
                name: best.name || 'Unknown place',
                formattedAddress,
                city: addrBits.city,
                country: addrBits.country,
                countryCode: addrBits.countryCode,
                stateProvince: addrBits.stateProvince,
                placeId: best.place_id || null,
                continent,
                types: best.types || [],
                source: 'nearby',
              },
            });
          }
        }
      }
    }

    if (!chosen) {
      return sendSuccess(res, 200, 'No tourist-oriented place at this location', {
        data: {
          isTouristPlace: false,
          lat,
          lng,
        },
      });
    }

    const location = chosen.geometry?.location;
    if (location?.lat == null || location?.lng == null) {
      return sendSuccess(res, 200, 'No tourist-oriented place at this location', {
        data: { isTouristPlace: false, lat, lng },
      });
    }

    const addrBits = parseAddressComponentsFromGeocodeResult(chosen);
    const continent = getContinentFromCoordinates(location.lat, location.lng);

    return sendSuccess(res, 200, 'Place resolved', {
      data: {
        isTouristPlace: true,
        lat: location.lat,
        lng: location.lng,
        name: extractNameFromGeocodeResult(chosen),
        formattedAddress: chosen.formatted_address || '',
        city: addrBits.city,
        country: addrBits.country,
        countryCode: addrBits.countryCode,
        stateProvince: addrBits.stateProvince,
        placeId: chosen.place_id || null,
        continent,
        types: chosen.types || [],
        source,
      },
    });
  } catch (error) {
    logger.error('Reverse geocode error:', error);
    return sendError(res, 'SRV_6001', 'Error resolving location: ' + error.message);
  }
};

const OVERPASS_API_URL = (process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter').trim();

/** Overpass instances reject unidentified clients (406); mirrors listed at https://wiki.openstreetmap.org/wiki/Overpass_API */
const OVERPASS_FALLBACK_URLS = [
  OVERPASS_API_URL,
  'https://overpass.kumi.systems/api/interpreter',
].filter((u, i, a) => u && a.indexOf(u) === i);

/**
 * OpenStreetMap tourism POIs inside bounding box (Overpass API).
 * Used by SuperAdmin map to show landmark pins without clicking first.
 */
const tourismOsmInBounds = async (req, res) => {
  try {
    let south = parseFloat(req.body.south, 10);
    let west = parseFloat(req.body.west, 10);
    let north = parseFloat(req.body.north, 10);
    let east = parseFloat(req.body.east, 10);

    if ([south, west, north, east].some((v) => Number.isNaN(v))) {
      return sendError(res, 'VAL_2001', 'Valid south, west, north, east are required');
    }

    if (south >= north || west >= east) {
      return sendError(res, 'VAL_2001', 'Invalid bounding box');
    }

    const latSpan = north - south;
    const lngSpan = east - west;

    /** Keep Overpass queries bounded (~regional); aligned with SuperAdmin map UI */
    if (latSpan > 0.55 || lngSpan > 0.55) {
      return sendSuccess(res, 200, 'Area too large — zoom in', {
        data: { pois: [], hint: 'zoom_in_area' },
      });
    }

    const query = `[out:json][timeout:45];
(
  node["tourism"](${south},${west},${north},${east});
  way["tourism"](${south},${west},${north},${east});
  relation["tourism"](${south},${west},${north},${east});
);
out center 120;`;

    const overpassHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'TeamTaatomBackend/1.0 (SuperAdmin tourism-osm; +https://openstreetmap.org)',
    };
    const body = `data=${encodeURIComponent(query)}`;

    let overpassResponse = null;
    let lastOverpassErr = null;

    for (const endpoint of OVERPASS_FALLBACK_URLS) {
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: overpassHeaders,
          body,
          signal: AbortSignal.timeout(47000),
        });
        if (resp.ok) {
          overpassResponse = resp;
          break;
        }
        lastOverpassErr = `${endpoint} ${resp.status}`;
        logger.warn('Overpass HTTP error:', resp.status, resp.statusText, endpoint);
      } catch (err) {
        lastOverpassErr = err.message;
        logger.warn('Overpass fetch failed:', endpoint, err.message);
      }
    }

    if (!overpassResponse || !overpassResponse.ok) {
      logger.warn('Overpass unavailable after retries:', lastOverpassErr);
      return sendSuccess(res, 200, 'Overpass unavailable', {
        data: { pois: [], hint: 'overpass_error' },
      });
    }

    const overpassData = await overpassResponse.json();
    const elements = overpassData.elements || [];

    const raw = [];
    for (const el of elements) {
      let lat;
      let lng;
      if (el.type === 'node' && el.lat != null && el.lon != null) {
        lat = el.lat;
        lng = el.lon;
      } else if ((el.type === 'way' || el.type === 'relation') && el.center?.lat != null && el.center?.lon != null) {
        lat = el.center.lat;
        lng = el.center.lon;
      } else {
        continue;
      }

      const tags = el.tags || {};
      const name =
        tags.name ||
        tags['name:en'] ||
        tags['name:ta'] ||
        tags.ref ||
        'Unnamed place';

      raw.push({
        id: `osm-${el.type}-${el.id}`,
        lat,
        lng,
        name: String(name).slice(0, 200),
        tourism: tags.tourism ? String(tags.tourism).slice(0, 80) : '',
      });
    }

    const seen = new Map();
    const pois = [];
    for (const p of raw) {
      const key = `${Math.round(p.lat * 10000)}_${Math.round(p.lng * 10000)}`;
      if (seen.has(key)) continue;
      seen.set(key, true);
      pois.push(p);
      if (pois.length >= 100) break;
    }

    pois.sort((a, b) => a.name.localeCompare(b.name));

    return sendSuccess(res, 200, 'Tourism POIs loaded', {
      data: { pois, hint: null },
    });
  } catch (error) {
    logger.error('tourismOsmInBounds error:', error);
    return sendSuccess(res, 200, 'Could not load OSM tourism data', {
      data: { pois: [], hint: 'error' },
    });
  }
};

/**
 * Full reverse geocode at lat/lng for locale form import (not tourist-only).
 * Optional preferredName overrides auto-extracted title (e.g. OSM name).
 */
const reverseAddressForImport = async (req, res) => {
  try {
    const latRaw = req.body.latitude;
    const lngRaw = req.body.longitude;
    const preferredName =
      req.body.preferredName != null && typeof req.body.preferredName === 'string'
        ? req.body.preferredName.trim().slice(0, 200)
        : '';

    const lat = typeof latRaw === 'number' ? latRaw : parseFloat(String(latRaw), 10);
    const lng = typeof lngRaw === 'number' ? lngRaw : parseFloat(String(lngRaw), 10);

    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return sendError(res, 'VAL_2001', 'Valid latitude and longitude are required');
    }

    if (!GOOGLE_MAPS_API_KEY) {
      logger.error('Google Maps API key not configured');
      return sendError(res, 'SRV_6001', 'Google Maps API key is not configured');
    }

    const latlngParam = `${lat},${lng}`;
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(latlngParam)}&key=${GOOGLE_MAPS_API_KEY}`;
    const geoResponse = await fetch(geoUrl, { timeout: 12000 });
    const geoData = await geoResponse.json();

    if (geoData.status === 'REQUEST_DENIED') {
      logger.error('Google reverse-address denied:', geoData.error_message);
      return sendError(res, 'SRV_6001', geoData.error_message || 'Google Maps API request denied');
    }

    if (geoData.status !== 'OK' || !geoData.results?.length) {
      return sendError(res, 'VAL_2001', 'Could not resolve address for this location');
    }

    const result = geoData.results[0];
    const location = result.geometry?.location;
    if (location?.lat == null || location?.lng == null) {
      return sendError(res, 'VAL_2001', 'Could not resolve coordinates');
    }

    const addrBits = parseAddressComponentsFromGeocodeResult(result);
    const geoLat = location.lat;
    const geoLng = location.lng;
    const autoName = extractNameFromGeocodeResult(result);
    const name = preferredName || autoName;
    const continent = getContinentFromCoordinates(geoLat, geoLng);

    return sendSuccess(res, 200, 'Address resolved', {
      data: {
        isTouristPlace: true,
        lat: geoLat,
        lng: geoLng,
        name,
        formattedAddress: result.formatted_address || '',
        city: addrBits.city,
        country: addrBits.country,
        countryCode: addrBits.countryCode,
        stateProvince: addrBits.stateProvince,
        placeId: result.place_id || null,
        continent,
        types: result.types || [],
        source: 'reverse-address',
      },
    });
  } catch (error) {
    logger.error('reverseAddressForImport error:', error);
    return sendError(res, 'SRV_6001', 'Error resolving address: ' + error.message);
  }
};

module.exports = {
  searchPlace,
  geocodeAddress,
  reverseGeocode,
  tourismOsmInBounds,
  reverseAddressForImport,
};

