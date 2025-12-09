const TripVisit = require('../models/TripVisit');
const Post = require('../models/Post');
const User = require('../models/User');
const logger = require('../utils/logger');
const { 
  TRUSTED_TRUST_LEVELS,
  MAX_REALISTIC_SPEED_KMH, 
  MIN_DISTANCE_FOR_SPEED_CHECK_KM 
} = require('../config/tripScoreConfig');

/**
 * TripVisit Service - TripScore v2
 * 
 * Handles creation and management of TripVisit records derived from posts and shorts.
 * Implements trust level assignment and fraud detection logic.
 */

// Helper functions (imported from profileController or defined here)
const getContinentFromLocation = (address) => {
  if (!address) return 'Unknown';
  
  const addressLower = address.toLowerCase();
  
  if (addressLower.includes('asia') || addressLower.includes('india') || 
      addressLower.includes('china') || addressLower.includes('japan') || 
      addressLower.includes('thailand') || addressLower.includes('singapore') ||
      addressLower.includes('malaysia') || addressLower.includes('indonesia')) {
    return 'ASIA';
  } else if (addressLower.includes('europe') || addressLower.includes('france') || 
             addressLower.includes('germany') || addressLower.includes('italy') || 
             addressLower.includes('spain') || addressLower.includes('uk') ||
             addressLower.includes('england') || addressLower.includes('london')) {
    return 'EUROPE';
  } else if (addressLower.includes('north america') || addressLower.includes('united states') || 
             addressLower.includes('usa') || addressLower.includes('canada') || 
             addressLower.includes('mexico') || addressLower.includes('new york') ||
             addressLower.includes('california') || addressLower.includes('texas')) {
    return 'NORTH AMERICA';
  } else if (addressLower.includes('south america') || addressLower.includes('brazil') || 
             addressLower.includes('argentina') || addressLower.includes('chile') ||
             addressLower.includes('peru') || addressLower.includes('colombia')) {
    return 'SOUTH AMERICA';
  } else if (addressLower.includes('africa') || addressLower.includes('egypt') || 
             addressLower.includes('south africa') || addressLower.includes('nigeria') ||
             addressLower.includes('kenya') || addressLower.includes('morocco')) {
    return 'AFRICA';
  } else if (addressLower.includes('australia') || addressLower.includes('new zealand') || 
             addressLower.includes('fiji') || addressLower.includes('papua') ||
             addressLower.includes('samoa') || addressLower.includes('tonga')) {
    return 'AUSTRALIA';
  } else if (addressLower.includes('antarctica')) {
    return 'ANTARCTICA';
  }
  
  return 'Unknown';
};

const getContinentFromCoordinates = (latitude, longitude) => {
  // Coordinate-based continent detection
  if (latitude >= -10 && latitude <= 80 && longitude >= 25 && longitude <= 180) {
    return 'ASIA';
  } else if (latitude >= 35 && latitude <= 70 && longitude >= -10 && longitude <= 40) {
    return 'EUROPE';
  } else if (latitude >= 5 && latitude <= 85 && longitude >= -170 && longitude <= -50) {
    return 'NORTH AMERICA';
  } else if (latitude >= -60 && latitude <= 15 && longitude >= -85 && longitude <= -30) {
    return 'SOUTH AMERICA';
  } else if (latitude >= -40 && latitude <= 40 && longitude >= -20 && longitude <= 50) {
    return 'AFRICA';
  } else if (latitude >= -50 && latitude <= -10 && longitude >= 110 && longitude <= 180) {
    return 'AUSTRALIA';
  } else if (latitude <= -60) {
    return 'ANTARCTICA';
  }
  
  return 'Unknown';
};

const getCountryFromLocation = (address) => {
  if (!address) return 'Unknown';
  
  const addressLower = address.toLowerCase();
  
  // Extract country from address (simplified - can be enhanced)
  const countryKeywords = {
    'india': 'India',
    'china': 'China',
    'japan': 'Japan',
    'thailand': 'Thailand',
    'singapore': 'Singapore',
    'malaysia': 'Malaysia',
    'indonesia': 'Indonesia',
    'france': 'France',
    'germany': 'Germany',
    'italy': 'Italy',
    'spain': 'Spain',
    'united kingdom': 'United Kingdom',
    'uk': 'United Kingdom',
    'england': 'United Kingdom',
    'united states': 'United States',
    'usa': 'United States',
    'canada': 'Canada',
    'mexico': 'Mexico',
    'brazil': 'Brazil',
    'argentina': 'Argentina',
    'chile': 'Chile',
    'peru': 'Peru',
    'colombia': 'Colombia',
    'australia': 'Australia',
    'new zealand': 'New Zealand',
    'egypt': 'Egypt',
    'south africa': 'South Africa',
    'nigeria': 'Nigeria',
    'kenya': 'Kenya',
    'morocco': 'Morocco'
  };
  
  for (const [keyword, country] of Object.entries(countryKeywords)) {
    if (addressLower.includes(keyword)) {
      return country;
    }
  }
  
  return 'Unknown';
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
};

/**
 * Determine source type from post metadata
 * @param {Object} post - Post document
 * @param {Object} metadata - Additional metadata (e.g., from request body)
 * @returns {String} Source type
 */
const determineSource = (post, metadata = {}) => {
  // Check if post has metadata indicating source
  if (metadata.source) {
    return metadata.source;
  }
  
  // Check if post has EXIF data indicating gallery with GPS
  if (metadata.hasExifGps || post.metadata?.exifGps) {
    return 'gallery_exif';
  }
  
  // Check if coordinates are from live GPS (non-zero, recent timestamp)
  if (post.location?.coordinates?.latitude !== 0 && 
      post.location?.coordinates?.longitude !== 0) {
    // If coordinates exist and post was created recently (within 1 hour of upload),
    // likely from in-app camera with live GPS
    const timeDiff = Date.now() - new Date(post.createdAt).getTime();
    if (timeDiff < 3600000 && metadata.fromCamera) { // 1 hour
      return 'taatom_camera_live';
    }
    
    // If coordinates exist but no EXIF metadata provided, check if we have explicit indication
    // If metadata object is empty or hasExifGps is explicitly false, it's gallery without EXIF
    if (metadata.hasExifGps === false || (Object.keys(metadata).length === 0 && !post.metadata?.exifGps)) {
      return 'gallery_no_exif';
    }
    
    // If we have coordinates but no explicit EXIF info, default to gallery_no_exif
    return 'gallery_no_exif';
  }
  
  // Default to manual if no other indicators (no location or zero coordinates)
  return 'manual_only';
};

/**
 * Assign trust level based on source and fraud checks
 * @param {Object} visitData - Visit data including source, coordinates, timestamps
 * @param {Array} userPreviousVisits - Previous trusted visits for this user
 * @returns {String} Trust level
 */
const assignTrustLevel = async (visitData, userPreviousVisits = []) => {
  const { source, lat, lng, takenAt, uploadedAt } = visitData;
  
  // High trust: Taatom camera with live GPS
  if (source === 'taatom_camera_live') {
    return 'high';
  }
  
  // Medium trust: Gallery with EXIF GPS (default, can be downgraded)
  if (source === 'gallery_exif') {
    // Check for impossible travel patterns
    if (userPreviousVisits.length > 0 && takenAt) {
      const lastTrustedVisit = userPreviousVisits[userPreviousVisits.length - 1];
      if (lastTrustedVisit.takenAt) {
        const timeDiffHours = Math.abs(new Date(takenAt) - new Date(lastTrustedVisit.takenAt)) / (1000 * 60 * 60);
        const distance = calculateDistance(
          lastTrustedVisit.lat,
          lastTrustedVisit.lng,
          lat,
          lng
        );
        
        // Check for impossible travel using configurable thresholds
        // Commercial flights can do ~900 km/h, so MAX_REALISTIC_SPEED_KMH (1000 km/h) is reasonable
        // But anything faster than this average is suspicious
        const minTimeForDistance = distance / MAX_REALISTIC_SPEED_KMH;
        
        if (timeDiffHours > 0 && timeDiffHours < minTimeForDistance && distance > MIN_DISTANCE_FOR_SPEED_CHECK_KM) {
          logger.warn(`Suspicious travel detected: ${distance.toFixed(0)}km in ${timeDiffHours.toFixed(2)}h (speed: ${(distance / timeDiffHours).toFixed(0)} km/h)`);
          return 'suspicious';
        }
      }
    }
    
    return 'medium';
  }
  
  // Low trust: Gallery without EXIF
  if (source === 'gallery_no_exif') {
    return 'low';
  }
  
  // Unverified: Manual only
  if (source === 'manual_only') {
    return 'unverified';
  }
  
  return 'unverified';
};

/**
 * Get user's previous trusted visits for fraud detection
 * @param {String} userId - User ID
 * @param {Number} limit - Number of recent visits to fetch
 * @returns {Array} Array of previous visits
 */
const getUserPreviousVisits = async (userId, limit = 10) => {
  try {
    // Only fetch trusted visits (high/medium) for fraud detection
    // Only TripVisits with trustLevel in ['high','medium'] contribute to TripScore.
    // Low/unverified/suspicious visits are excluded from scoring.
    return await TripVisit.find({
      user: userId,
      isActive: true,
      trustLevel: { $in: TRUSTED_TRUST_LEVELS }
    })
    .sort({ takenAt: -1, uploadedAt: -1 })
    .limit(limit)
    .select('lat lng takenAt uploadedAt trustLevel')
    .lean();
  } catch (error) {
    logger.error('Error fetching user previous visits:', error);
    return [];
  }
};

/**
 * Check if a visit already exists for this location (deduplication)
 * @param {String} userId - User ID
 * @param {Number} lat - Latitude
 * @param {Number} lng - Longitude
 * @param {Number} tolerance - Coordinate tolerance (default 0.001 degrees ≈ 111m)
 * @returns {Object|null} Existing visit or null
 */
const findExistingVisit = async (userId, lat, lng, tolerance = 0.001) => {
  try {
    return await TripVisit.findVisitByLocation(userId, lat, lng, tolerance);
  } catch (error) {
    logger.error('Error finding existing visit:', error);
    return null;
  }
};

/**
 * Create a TripVisit from a Post
 * @param {Object} post - Post document
 * @param {Object} metadata - Additional metadata (source, exif data, etc.)
 * @returns {Object|null} Created TripVisit or null if invalid
 */
const createTripVisitFromPost = async (post, metadata = {}) => {
  try {
    // Validate post has location
    if (!post.location || 
        !post.location.coordinates ||
        post.location.coordinates.latitude === 0 ||
        post.location.coordinates.longitude === 0) {
      logger.debug('Post has no valid location, skipping TripVisit creation');
      return null;
    }
    
    // Check if visit already exists (deduplication)
    const existingVisit = await findExistingVisit(
      post.user,
      post.location.coordinates.latitude,
      post.location.coordinates.longitude
    );
    
    if (existingVisit) {
      logger.debug('Visit already exists for this location, updating instead');
      return await updateTripVisitFromPost(post, metadata, existingVisit._id);
    }
    
    const lat = post.location.coordinates.latitude;
    const lng = post.location.coordinates.longitude;
    const address = post.location.address || 'Unknown Location';
    
    // Determine continent
    let continent = getContinentFromLocation(address);
    if (continent === 'Unknown') {
      continent = getContinentFromCoordinates(lat, lng);
    }
    
    // Determine country
    const country = getCountryFromLocation(address);
    
    // Determine source
    const source = determineSource(post, metadata);
    
    // Get previous visits for fraud detection
    const previousVisits = await getUserPreviousVisits(post.user.toString());
    
    // Assign trust level
    const trustLevel = await assignTrustLevel({
      source,
      lat,
      lng,
      takenAt: metadata.takenAt || post.createdAt,
      uploadedAt: post.createdAt
    }, previousVisits);
    
    // Calculate distance from previous visit if applicable
    let distanceFromPrevious = null;
    let timeFromPrevious = null;
    let flaggedReason = null;
    
    if (previousVisits.length > 0 && metadata.takenAt) {
      const lastVisit = previousVisits[0];
      distanceFromPrevious = calculateDistance(lastVisit.lat, lastVisit.lng, lat, lng);
      if (lastVisit.takenAt) {
        timeFromPrevious = Math.abs(new Date(metadata.takenAt) - new Date(lastVisit.takenAt)) / (1000 * 60 * 60);
        
        // Check for suspicious travel patterns using configurable thresholds
        if (timeFromPrevious > 0 && distanceFromPrevious > 0) {
          const speed = distanceFromPrevious / timeFromPrevious; // km/h
          if (speed > MAX_REALISTIC_SPEED_KMH && distanceFromPrevious > MIN_DISTANCE_FOR_SPEED_CHECK_KM) {
            flaggedReason = `Impossible travel speed: ${distanceFromPrevious.toFixed(0)}km in ${timeFromPrevious.toFixed(1)}h (${speed.toFixed(0)} km/h)`;
          }
        }
      }
    }
    
    // Create TripVisit
    const tripVisit = new TripVisit({
      user: post.user,
      post: post._id,
      contentType: 'post',
      lat,
      lng,
      continent: continent === 'Unknown' ? 'Unknown' : continent.toUpperCase(),
      country,
      city: null, // Can be extracted from address if needed
      address,
      source,
      trustLevel,
      takenAt: metadata.takenAt || post.createdAt,
      uploadedAt: post.createdAt,
      isActive: post.isActive !== false,
      metadata: {
        exifAvailable: metadata.hasExifGps || false,
        exifTimestamp: metadata.takenAt || null,
        distanceFromPrevious,
        timeFromPrevious,
        flaggedReason: flaggedReason || null
      }
    });
    
    await tripVisit.save();
    logger.debug(`Created TripVisit for post ${post._id}: ${source} -> ${trustLevel}`);
    
    return tripVisit;
  } catch (error) {
    logger.error('Error creating TripVisit from post:', error);
    // Don't throw - TripVisit creation failure shouldn't break post creation
    return null;
  }
};

/**
 * Update TripVisit from Post (when post is updated or visit already exists)
 * @param {Object} post - Post document
 * @param {Object} metadata - Additional metadata
 * @param {String} existingVisitId - Optional existing visit ID
 * @returns {Object|null} Updated TripVisit or null
 */
const updateTripVisitFromPost = async (post, metadata = {}, existingVisitId = null) => {
  try {
    if (!post.location || 
        !post.location.coordinates ||
        post.location.coordinates.latitude === 0 ||
        post.location.coordinates.longitude === 0) {
      // If post no longer has valid location, deactivate visit
      if (existingVisitId) {
        await TripVisit.findByIdAndUpdate(existingVisitId, { isActive: false });
      }
      return null;
    }
    
    let tripVisit;
    if (existingVisitId) {
      tripVisit = await TripVisit.findById(existingVisitId);
      if (!tripVisit) {
        // Visit was deleted, create new one
        return await createTripVisitFromPost(post, metadata);
      }
    } else {
      // Try to find existing visit
      const existing = await findExistingVisit(
        post.user,
        post.location.coordinates.latitude,
        post.location.coordinates.longitude
      );
      if (existing) {
        tripVisit = existing;
      } else {
        // Create new visit
        return await createTripVisitFromPost(post, metadata);
      }
    }
    
    // Update visit data
    const lat = post.location.coordinates.latitude;
    const lng = post.location.coordinates.longitude;
    const address = post.location.address || 'Unknown Location';
    
    let continent = getContinentFromLocation(address);
    if (continent === 'Unknown') {
      continent = getContinentFromCoordinates(lat, lng);
    }
    
    const country = getCountryFromLocation(address);
    const source = determineSource(post, metadata);
    
    // Re-evaluate trust level
    const previousVisits = await getUserPreviousVisits(post.user.toString());
    const trustLevel = await assignTrustLevel({
      source,
      lat,
      lng,
      takenAt: metadata.takenAt || post.createdAt,
      uploadedAt: post.createdAt
    }, previousVisits);
    
    // Update visit
    tripVisit.lat = lat;
    tripVisit.lng = lng;
    tripVisit.continent = continent === 'Unknown' ? 'Unknown' : continent.toUpperCase();
    tripVisit.country = country;
    tripVisit.address = address;
    tripVisit.source = source;
    tripVisit.trustLevel = trustLevel;
    tripVisit.uploadedAt = post.createdAt;
    tripVisit.isActive = post.isActive !== false;
    
    if (metadata.takenAt) {
      tripVisit.takenAt = metadata.takenAt;
    }
    
    await tripVisit.save();
    logger.debug(`Updated TripVisit ${tripVisit._id}: ${source} -> ${trustLevel}`);
    
    return tripVisit;
  } catch (error) {
    logger.error('Error updating TripVisit from post:', error);
    return null;
  }
};

/**
 * Create TripVisit from Short (similar to post)
 * @param {Object} short - Short document (Post with type='short')
 * @param {Object} metadata - Additional metadata
 * @returns {Object|null} Created TripVisit or null
 */
const createTripVisitFromShort = async (short, metadata = {}) => {
  // Shorts use the same Post model, so we can reuse the post function
  return await createTripVisitFromPost(short, { ...metadata, contentType: 'short' });
};

/**
 * Update TripVisit from Short
 * @param {Object} short - Short document
 * @param {Object} metadata - Additional metadata
 * @param {String} existingVisitId - Optional existing visit ID
 * @returns {Object|null} Updated TripVisit or null
 */
const updateTripVisitFromShort = async (short, metadata = {}, existingVisitId = null) => {
  return await updateTripVisitFromPost(short, { ...metadata, contentType: 'short' }, existingVisitId);
};

/**
 * Delete or deactivate TripVisit when post/short is deleted
 * @param {String} postId - Post/Short ID
 * @param {String} contentType - 'post' or 'short'
 * @returns {Promise<void>}
 */
const deleteTripVisitForContent = async (postId, contentType = 'post') => {
  try {
    await TripVisit.updateMany(
      { 
        post: postId,
        contentType 
      },
      { 
        isActive: false 
      }
    );
    logger.debug(`Deactivated TripVisits for ${contentType} ${postId}`);
  } catch (error) {
    logger.error('Error deleting TripVisit:', error);
  }
};

module.exports = {
  createTripVisitFromPost,
  updateTripVisitFromPost,
  createTripVisitFromShort,
  updateTripVisitFromShort,
  deleteTripVisitForContent,
  assignTrustLevel,
  determineSource,
  getUserPreviousVisits,
  findExistingVisit
};

