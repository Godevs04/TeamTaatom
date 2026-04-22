const logger = require('../utils/logger');

/**
 * Geofence Service
 *
 * Handles location-based geofencing using Haversine distance calculation.
 * No external dependency on geolib — implemented using standard formula.
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Number} lat1 - Starting latitude
 * @param {Number} lon1 - Starting longitude
 * @param {Number} lat2 - Ending latitude
 * @param {Number} lon2 - Ending longitude
 * @returns {Number} Distance in meters
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Radius of Earth in meters (was 6371 km in tripVisitService)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in meters
  return distance;
};

/**
 * Check if user coordinates are within geofence of destination
 * @param {Number} userLat - User's current latitude
 * @param {Number} userLng - User's current longitude
 * @param {Number} destLat - Destination latitude
 * @param {Number} destLng - Destination longitude
 * @param {Number} radiusMeters - Geofence radius in meters (default: 50m)
 * @returns {Object} { isWithin: boolean, distance: number }
 */
const isWithinGeofence = (userLat, userLng, destLat, destLng, radiusMeters = 50) => {
  try {
    // Validate inputs
    if (typeof userLat !== 'number' || typeof userLng !== 'number' ||
        typeof destLat !== 'number' || typeof destLng !== 'number') {
      logger.warn('Invalid coordinates passed to isWithinGeofence', {
        userLat, userLng, destLat, destLng
      });
      return {
        isWithin: false,
        distance: -1
      };
    }

    const distance = calculateDistance(userLat, userLng, destLat, destLng);
    const isWithin = distance <= radiusMeters;

    logger.debug('Geofence check', {
      userCoords: { lat: userLat, lng: userLng },
      destCoords: { lat: destLat, lng: destLng },
      distance: distance.toFixed(2),
      radiusMeters,
      isWithin
    });

    return {
      isWithin,
      distance: parseFloat(distance.toFixed(2))
    };
  } catch (error) {
    logger.error('Error in isWithinGeofence:', error);
    return {
      isWithin: false,
      distance: -1
    };
  }
};

module.exports = {
  calculateDistance,
  isWithinGeofence
};
