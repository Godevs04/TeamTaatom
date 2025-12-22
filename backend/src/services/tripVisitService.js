const TripVisit = require('../models/TripVisit');
const Post = require('../models/Post');
const User = require('../models/User');
const logger = require('../utils/logger');
const Chat = require('../models/Chat');
const mongoose = require('mongoose');
const { 
  TRUSTED_TRUST_LEVELS,
  VERIFIED_STATUSES,
  MAX_REALISTIC_SPEED_KMH, 
  MIN_DISTANCE_FOR_SPEED_CHECK_KM 
} = require('../config/tripScoreConfig');

// Static Taatom Official system user ID (must exist in DB for chat system)
const TAATOM_OFFICIAL_USER_ID = process.env.TAATOM_OFFICIAL_USER_ID || '000000000000000000000001';

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
    // Only fetch verified visits for fraud detection
    // Only TripVisits with verificationStatus in ['auto_verified','approved'] contribute to TripScore.
    // Pending/rejected visits are excluded from scoring.
    return await TripVisit.find({
      user: userId,
      isActive: true,
      verificationStatus: { $in: VERIFIED_STATUSES }
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
 * @param {Number} tolerance - Coordinate tolerance (default 0.01 degrees ≈ 1.1km)
 * @returns {Object|null} Existing visit or null
 */
const findExistingVisit = async (userId, lat, lng, tolerance = 0.01) => {
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
    // Validate post has location data (address or coordinates)
    // Scenario 5: No location object at all - skip TripVisit creation
    if (!post.location) {
      logger.debug('[TripVisit Debug] Scenario 5: Post has no location object, skipping TripVisit creation');
      return null;
    }
    
    // Extract coordinates - may be 0,0 for manual locations
    const lat = post.location.coordinates?.latitude ?? 0;
    const lng = post.location.coordinates?.longitude ?? 0;
    const address = post.location.address || 'Unknown Location';
    
    // Check if coordinates are valid (not 0,0)
    const hasValidCoords = 
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !(lat === 0 && lng === 0);
    
    // Scenario 5: Only skip if BOTH coordinates are missing/0 AND address is completely empty/null
    // If location object exists, create TripVisit (even with 0,0 and "Unknown Location" = manual location needs review)
    if (!hasValidCoords && (!post.location.address || post.location.address.trim() === '')) {
      logger.debug('[TripVisit Debug] Scenario 5: Post has no meaningful location data (no address and no valid coordinates), skipping TripVisit creation');
      return null;
    }
    
    // If we have location object but coordinates are 0,0, treat as manual location (Scenario 3)
    // This will create TripVisit with pending_review status
    
    // Check if visit already exists (deduplication) - only if we have valid coordinates
    let existingVisit = null;
    if (hasValidCoords) {
      existingVisit = await findExistingVisit(post.user, lat, lng);
      if (existingVisit) {
        logger.debug('Visit already exists for this location, updating instead');
        return await updateTripVisitFromPost(post, metadata, existingVisit._id);
      }
    }
    
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
    let trustLevel = await assignTrustLevel({
      source,
      lat,
      lng,
      takenAt: metadata.takenAt || post.createdAt,
      uploadedAt: post.createdAt
    }, previousVisits);
    
    // Set verification status based on source and coordinates
    // NEW RULE: Only content taken from Taatom camera increases TripScore immediately
    // - Photos (type === 'photo') from Taatom camera → auto-verified
    // - Videos/shorts (type === 'short') from Taatom camera → auto-verified
    // - All other scenarios → pending review
    let verificationStatus = 'pending_review';
    let verificationReason = null;
    
    // Priority 1: Check for suspicious patterns (regardless of source)
    if (trustLevel === 'suspicious') {
      verificationStatus = 'pending_review';
      verificationReason = 'suspicious_pattern';
    }
    // Priority 2: Manual location (0,0 coordinates) - always pending review
    else if (!hasValidCoords) {
      verificationStatus = 'pending_review';
      verificationReason = 'manual_location';
      // Override trust level for manual locations
      trustLevel = 'unverified';
    }
    // Priority 3: Content from Taatom camera (photos OR videos/shorts) - auto-verified
    // This increases TripScore immediately
    else if (source === 'taatom_camera_live') {
      verificationStatus = 'auto_verified';
      // No reason needed for auto-verified
    }
    // Priority 4: All other cases go to pending review:
    // - Photos from gallery (source !== 'taatom_camera_live')
    // - Videos/shorts from gallery (source !== 'taatom_camera_live')
    // - Gallery with EXIF GPS
    // - Gallery without EXIF
    // - Manual locations
    else {
      verificationStatus = 'pending_review';
      if (source === 'gallery_exif') {
        verificationReason = 'gallery_exif_requires_review';
      } else if (source === 'gallery_no_exif') {
        verificationReason = 'no_exif';
      } else if (source === 'manual_only') {
        verificationReason = 'manual_location';
      } else {
        verificationReason = 'requires_admin_review';
      }
    }
    
    // [TripVisit Debug] - Temporary debug logs for verification
    logger.info('[TripVisit Debug]', {
      postId: post._id?.toString(),
      userId: post.user?.toString(),
      postType: post.type,
      source,
      trustLevel,
      verificationStatus,
      verificationReason,
      lat,
      lng,
      hasValidCoords,
      fromCamera: metadata.fromCamera,
      hasExifGps: metadata.hasExifGps,
      address: post.location?.address,
      scenario: !hasValidCoords ? 'Manual Location (Pending Review)' :
                source === 'taatom_camera_live' ? `${post.type === 'short' ? 'Short' : 'Photo'} from Taatom Camera (Auto-Verified)` :
                source === 'gallery_exif' ? 'Gallery EXIF (Pending Review)' :
                source === 'gallery_no_exif' ? 'Gallery No EXIF (Pending Review)' :
                trustLevel === 'suspicious' ? 'Suspicious Pattern (Pending Review)' :
                'Unknown (Pending Review)'
    });
    
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
      spotType: post.spotType || null, // Copy from post
      travelInfo: post.travelInfo || null, // Copy from post
      source,
      trustLevel,
      verificationStatus,
      verificationReason,
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
    logger.info(`✅ Created TripVisit ${tripVisit._id} for post ${post._id}: source=${source}, trustLevel=${trustLevel}, verificationStatus=${verificationStatus}, lat=${lat}, lng=${lng}`);
    
    // Log if this will contribute to TripScore
    if (verificationStatus === 'auto_verified' || verificationStatus === 'approved') {
      logger.info(`🎯 TripVisit ${tripVisit._id} will contribute to TripScore (${verificationStatus})`);
    }
    
    // Send notification if pending review (fire-and-forget)
    if (verificationStatus === 'pending_review') {
      sendPendingReviewNotification(post.user, tripVisit).catch(err => {
        logger.error('Failed to send pending review notification:', err);
      });
    }
    
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
    // Validate post has location data (address or coordinates)
    if (!post.location || (!post.location.address && !post.location.coordinates)) {
      // If post no longer has location data, deactivate visit
      if (existingVisitId) {
        await TripVisit.findByIdAndUpdate(existingVisitId, { isActive: false });
      }
      return null;
    }
    
    // Extract coordinates - may be 0,0 for manual locations
    const lat = post.location.coordinates?.latitude ?? 0;
    const lng = post.location.coordinates?.longitude ?? 0;
    const address = post.location.address || 'Unknown Location';
    
    // Check if coordinates are valid (not 0,0)
    const hasValidCoords = 
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !(lat === 0 && lng === 0);
    
    let tripVisit;
    if (existingVisitId) {
      tripVisit = await TripVisit.findById(existingVisitId);
      if (!tripVisit) {
        // Visit was deleted, create new one
        return await createTripVisitFromPost(post, metadata);
      }
    } else {
      // Try to find existing visit - only if we have valid coordinates
      if (hasValidCoords) {
        const existing = await findExistingVisit(post.user, lat, lng);
        if (existing) {
          tripVisit = existing;
        } else {
          // Create new visit
          return await createTripVisitFromPost(post, metadata);
        }
      } else {
        // Manual location - create new visit
        return await createTripVisitFromPost(post, metadata);
      }
    }
    
    let continent = getContinentFromLocation(address);
    if (continent === 'Unknown') {
      continent = getContinentFromCoordinates(lat, lng);
    }
    
    const country = getCountryFromLocation(address);
    const source = determineSource(post, metadata);
    
    // Re-evaluate trust level
    const previousVisits = await getUserPreviousVisits(post.user.toString());
    let trustLevel = await assignTrustLevel({
      source,
      lat,
      lng,
      takenAt: metadata.takenAt || post.createdAt,
      uploadedAt: post.createdAt
    }, previousVisits);
    
    // Set verification status based on source and coordinates
    // NEW RULE: Only content taken from Taatom camera increases TripScore immediately
    // - Photos (type === 'photo') from Taatom camera → auto-verified
    // - Videos/shorts (type === 'short') from Taatom camera → auto-verified
    // - All other scenarios → pending review
    let verificationStatus = 'pending_review';
    let verificationReason = null;
    
    // Priority 1: Check for suspicious patterns (regardless of source)
    if (trustLevel === 'suspicious') {
      verificationStatus = 'pending_review';
      verificationReason = 'suspicious_pattern';
    }
    // Priority 2: Manual location (0,0 coordinates) - always pending review
    else if (!hasValidCoords) {
      verificationStatus = 'pending_review';
      verificationReason = 'manual_location';
      // Override trust level for manual locations
      trustLevel = 'unverified';
    }
    // Priority 3: Content from Taatom camera (photos OR videos/shorts) - auto-verified
    // This increases TripScore immediately
    else if (source === 'taatom_camera_live') {
      verificationStatus = 'auto_verified';
      // No reason needed for auto-verified
    }
    // Priority 4: All other cases go to pending review:
    // - Photos from gallery (source !== 'taatom_camera_live')
    // - Videos/shorts from gallery (source !== 'taatom_camera_live')
    // - Gallery with EXIF GPS
    // - Gallery without EXIF
    // - Manual locations
    else {
      verificationStatus = 'pending_review';
      if (source === 'gallery_exif') {
        verificationReason = 'gallery_exif_requires_review';
      } else if (source === 'gallery_no_exif') {
        verificationReason = 'no_exif';
      } else if (source === 'manual_only') {
        verificationReason = 'manual_location';
      } else {
        verificationReason = 'requires_admin_review';
      }
    }
    
    // Update visit
    tripVisit.lat = lat;
    tripVisit.lng = lng;
    tripVisit.continent = continent === 'Unknown' ? 'Unknown' : continent.toUpperCase();
    tripVisit.country = country;
    tripVisit.address = address;
    tripVisit.source = source;
    tripVisit.trustLevel = trustLevel;
    tripVisit.verificationStatus = verificationStatus;
    tripVisit.verificationReason = verificationReason;
    tripVisit.uploadedAt = post.createdAt;
    tripVisit.isActive = post.isActive !== false;
    
    if (metadata.takenAt) {
      tripVisit.takenAt = metadata.takenAt;
    }
    
    await tripVisit.save();
    logger.info(`✅ Updated TripVisit ${tripVisit._id} for post ${post._id}: source=${source}, trustLevel=${trustLevel}, verificationStatus=${verificationStatus}, lat=${lat}, lng=${lng}`);
    
    // Log if this will contribute to TripScore
    if (verificationStatus === 'auto_verified' || verificationStatus === 'approved') {
      logger.info(`🎯 TripVisit ${tripVisit._id} will contribute to TripScore (${verificationStatus})`);
    }
    
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

/**
 * Send pending review notification via chat
 * Fire-and-forget, does not block TripVisit creation
 */
const sendPendingReviewNotification = async (userId, tripVisit) => {
  try {
    // Get or create TAATOM_OFFICIAL system user
    let officialUser = await User.findById(TAATOM_OFFICIAL_USER_ID) ||
                       await User.findOne({ email: 'official@taatom.com' }) || 
                       await User.findOne({ username: 'taatom_official' });
    
    if (!officialUser) {
      // Create TAATOM_OFFICIAL system user if it doesn't exist
      try {
        const crypto = require('crypto');
        officialUser = await User.create({
          _id: new mongoose.Types.ObjectId(TAATOM_OFFICIAL_USER_ID),
          email: 'official@taatom.com',
          username: 'taatom_official',
          fullName: 'Taatom Official',
          password: crypto.randomBytes(32).toString('hex'), // Random password, never used
          isVerified: true,
          isActive: true,
          isSystem: true // Mark as system user
        });
        logger.info('Created TAATOM_OFFICIAL system user for notifications');
      } catch (createError) {
        // If user already exists (race condition), fetch it
        if (createError.code === 11000) {
          officialUser = await User.findById(TAATOM_OFFICIAL_USER_ID) ||
                         await User.findOne({ email: 'official@taatom.com' }) ||
                         await User.findOne({ username: 'taatom_official' });
        }
        if (!officialUser) {
          logger.error('Failed to create/find TAATOM_OFFICIAL user:', createError);
          return; // Skip notification if user creation fails
        }
      }
    }
    
    // Ensure user has verified status for UI display
    if (!officialUser.isVerified) {
      officialUser.isVerified = true;
      await officialUser.save();
    }

    const message = '👋 Your recent post is under verification to confirm the trip location.\nWe\'ll notify you shortly.';

    // Get or create chat
    let chat = await Chat.findOne({ 
      participants: { $all: [officialUser._id, userId] } 
    });

    if (!chat) {
      chat = await Chat.create({ 
        participants: [officialUser._id, userId], 
        messages: [] 
      });
    }

    // Add message
    const chatMessage = {
      sender: officialUser._id,
      text: message,
      timestamp: new Date(),
      seen: false
    };

    chat.messages.push(chatMessage);
    await chat.save();

    // Emit socket event if available
    try {
      const { getIO } = require('../socket');
      const io = getIO();
      if (io && io.of('/app')) {
        const nsp = io.of('/app');
        nsp.to(`user:${userId}`).emit('message:new', { 
          chatId: chat._id, 
          message: {
            ...chatMessage,
            _id: chat.messages[chat.messages.length - 1]._id
          }
        });
      }
    } catch (socketError) {
      logger.debug('Socket not available for pending review notification:', socketError);
    }

    logger.debug(`Pending review notification sent to user ${userId}`);
  } catch (error) {
    logger.error('Error sending pending review notification:', error);
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

