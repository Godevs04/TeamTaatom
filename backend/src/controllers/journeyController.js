const mongoose = require('mongoose');
const { sendError, sendSuccess, ERROR_CODES } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const Journey = require('../models/Journey');
const TripVisit = require('../models/TripVisit');
const Post = require('../models/Post');
const User = require('../models/User');

// POST /api/v1/journey/start
const startJourney = async (req, res) => {
  try {
    const { startCoords, title, sourceUserId } = req.body;

    // Validate startCoords
    if (!startCoords || !startCoords.lat || !startCoords.lng) {
      return sendError(res, 'VAL_2001', 'startCoords with lat and lng are required');
    }

    // Check if user already has an active or paused journey
    const existingJourney = await Journey.findOne({
      user: req.user._id,
      status: { $in: ['active', 'paused'] }
    });

    if (existingJourney) {
      return sendError(res, 'BIZ_7001', 'You already have an active journey. Complete it first.');
    }

    // Create new journey
    const journey = new Journey({
      user: req.user._id,
      title: title || 'Untitled Journey',
      startCoords: {
        lat: parseFloat(startCoords.lat),
        lng: parseFloat(startCoords.lng)
      },
      endCoords: {
        lat: parseFloat(startCoords.lat),
        lng: parseFloat(startCoords.lng)
      },
      status: 'active',
      sessions: [
        {
          startedAt: new Date(),
          startCoords: {
            lat: parseFloat(startCoords.lat),
            lng: parseFloat(startCoords.lng)
          }
        }
      ],
      startedAt: new Date(),
      lastActiveAt: new Date(),
      polyline: [
        {
          lat: parseFloat(startCoords.lat),
          lng: parseFloat(startCoords.lng),
          timestamp: new Date(),
          accuracy: null
        }
      ],
      sourceUserId: sourceUserId || null,
      distanceTraveled: 0,
      privacy: (['public', 'followers'].includes(req.user.settings?.privacy?.profileVisibility)
        ? req.user.settings.privacy.profileVisibility
        : 'public')
    });

    await journey.save();
    logger.info(`Journey started for user ${req.user._id}:`, { journeyId: journey._id });

    return sendSuccess(res, 201, 'Journey started', { journey });
  } catch (error) {
    logger.error('Start journey error:', error);
    return sendError(res, 'ERR_5001', 'Failed to start journey');
  }
};

// POST /api/v1/journey/:journeyId/pause
const pauseJourney = async (req, res) => {
  try {
    const { journeyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(journeyId)) {
      return sendError(res, 'VAL_2001', 'Invalid journey ID');
    }

    const journey = await Journey.findById(journeyId);
    if (!journey) {
      return sendError(res, 'RES_3001', 'Journey not found');
    }

    // Only owner can pause
    if (journey.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1001', 'Unauthorized');
    }

    if (journey.status !== 'active') {
      return sendError(res, 'BIZ_7001', 'Journey is not active');
    }

    // End current session
    const currentSession = journey.sessions[journey.sessions.length - 1];
    if (currentSession && !currentSession.stoppedAt) {
      currentSession.stoppedAt = new Date();
      // Set endCoords to last polyline point if available
      if (journey.polyline.length > 0) {
        const lastPoint = journey.polyline[journey.polyline.length - 1];
        currentSession.endCoords = {
          lat: lastPoint.lat,
          lng: lastPoint.lng
        };
      }
    }

    journey.status = 'paused';
    journey.pausedAt = new Date();

    // Set endCoords to last polyline point
    if (journey.polyline.length > 0) {
      const lastPoint = journey.polyline[journey.polyline.length - 1];
      journey.endCoords = {
        lat: lastPoint.lat,
        lng: lastPoint.lng
      };
    }

    await journey.save();
    logger.info(`Journey paused for user ${req.user._id}:`, { journeyId: journey._id });

    return sendSuccess(res, 200, 'Journey paused', { journey });
  } catch (error) {
    logger.error('Pause journey error:', error);
    return sendError(res, 'ERR_5001', 'Failed to pause journey');
  }
};

// POST /api/v1/journey/:journeyId/resume
const resumeJourney = async (req, res) => {
  try {
    const { journeyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(journeyId)) {
      return sendError(res, 'VAL_2001', 'Invalid journey ID');
    }

    const journey = await Journey.findById(journeyId);
    if (!journey) {
      return sendError(res, 'RES_3001', 'Journey not found');
    }

    // Only owner can resume
    if (journey.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1001', 'Unauthorized');
    }

    if (journey.status !== 'paused') {
      return sendError(res, 'BIZ_7001', 'Journey is not paused');
    }

    // Check if paused > 24hrs ago
    const now = new Date();
    const pausedTime = journey.pausedAt ? new Date(journey.pausedAt) : null;
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    if (pausedTime && (now - pausedTime) > twentyFourHoursMs) {
      // Auto-complete the journey instead
      journey.status = 'completed';
      journey.completedAt = new Date();
      journey.autoEnded = true;

      if (journey.polyline.length > 0) {
        const lastPoint = journey.polyline[journey.polyline.length - 1];
        journey.endCoords = {
          lat: lastPoint.lat,
          lng: lastPoint.lng
        };
      }

      await journey.save();
      logger.info(`Journey auto-ended (24hr rule) for user ${req.user._id}:`, { journeyId: journey._id });

      return sendSuccess(res, 200, 'Journey auto-ended (paused > 24 hours)', { journey });
    }

    // Resume journey
    journey.status = 'active';
    journey.pausedAt = null;
    journey.lastActiveAt = new Date();

    // Add new session
    if (journey.polyline.length > 0) {
      const lastPoint = journey.polyline[journey.polyline.length - 1];
      journey.sessions.push({
        startedAt: new Date(),
        startCoords: {
          lat: lastPoint.lat,
          lng: lastPoint.lng
        }
      });
    }

    await journey.save();
    logger.info(`Journey resumed for user ${req.user._id}:`, { journeyId: journey._id });

    return sendSuccess(res, 200, 'Journey resumed', { journey });
  } catch (error) {
    logger.error('Resume journey error:', error);
    return sendError(res, 'ERR_5001', 'Failed to resume journey');
  }
};

// PUT /api/v1/journey/:journeyId/location
const updateLocation = async (req, res) => {
  try {
    const { journeyId } = req.params;
    const { coordinates } = req.body;

    if (!mongoose.Types.ObjectId.isValid(journeyId)) {
      return sendError(res, 'VAL_2001', 'Invalid journey ID');
    }

    if (!coordinates || !Array.isArray(coordinates)) {
      return sendError(res, 'VAL_2001', 'coordinates array is required');
    }

    const journey = await Journey.findById(journeyId);
    if (!journey) {
      return sendError(res, 'RES_3001', 'Journey not found');
    }

    // Only owner can update
    if (journey.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1001', 'Unauthorized');
    }

    if (journey.status !== 'active') {
      return sendError(res, 'BIZ_7001', 'Journey is not active');
    }

    // Process each coordinate
    for (const coord of coordinates) {
      if (!coord.lat || !coord.lng) continue;

      const point = {
        lat: parseFloat(coord.lat),
        lng: parseFloat(coord.lng),
        timestamp: coord.timestamp ? new Date(coord.timestamp) : new Date(),
        accuracy: coord.accuracy ? parseFloat(coord.accuracy) : null
      };

      journey.polyline.push(point);

      // Calculate distance from previous point using Haversine formula
      if (journey.polyline.length > 1) {
        const prevPoint = journey.polyline[journey.polyline.length - 2];
        const distance = calculateHaversineDistance(
          prevPoint.lat,
          prevPoint.lng,
          point.lat,
          point.lng
        );
        journey.distanceTraveled += distance; // distance in meters
      }
    }

    // Update endCoords to last polyline point
    if (journey.polyline.length > 0) {
      const lastPoint = journey.polyline[journey.polyline.length - 1];
      journey.endCoords = {
        lat: lastPoint.lat,
        lng: lastPoint.lng
      };
    }

    journey.lastActiveAt = new Date();
    await journey.save();

    logger.debug(`Location updated for journey ${journeyId}:`, {
      pointsAdded: coordinates.length,
      totalDistance: journey.distanceTraveled
    });

    return sendSuccess(res, 200, 'Location updated', {
      journey,
      pointsAdded: coordinates.length
    });
  } catch (error) {
    logger.error('Update location error:', error);
    return sendError(res, 'ERR_5001', 'Failed to update location');
  }
};

// POST /api/v1/journey/:journeyId/complete
const completeJourney = async (req, res) => {
  try {
    const { journeyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(journeyId)) {
      return sendError(res, 'VAL_2001', 'Invalid journey ID');
    }

    const journey = await Journey.findById(journeyId);
    if (!journey) {
      return sendError(res, 'RES_3001', 'Journey not found');
    }

    // Only owner can complete
    if (journey.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1001', 'Unauthorized');
    }

    if (!['active', 'paused'].includes(journey.status)) {
      return sendError(res, 'BIZ_7001', 'Journey is not active or paused');
    }

    // End current session
    const currentSession = journey.sessions[journey.sessions.length - 1];
    if (currentSession && !currentSession.stoppedAt) {
      currentSession.stoppedAt = new Date();
      if (journey.polyline.length > 0) {
        const lastPoint = journey.polyline[journey.polyline.length - 1];
        currentSession.endCoords = {
          lat: lastPoint.lat,
          lng: lastPoint.lng
        };
      }
    }

    journey.status = 'completed';
    journey.completedAt = new Date();
    journey.autoEnded = false;

    // Set endCoords to last polyline point
    if (journey.polyline.length > 0) {
      const lastPoint = journey.polyline[journey.polyline.length - 1];
      journey.endCoords = {
        lat: lastPoint.lat,
        lng: lastPoint.lng
      };
    }

    await journey.save();
    logger.info(`Journey completed for user ${req.user._id}:`, {
      journeyId: journey._id,
      distance: journey.distanceTraveled,
      waypoints: journey.waypoints.length
    });

    return sendSuccess(res, 200, 'Journey completed', { journey });
  } catch (error) {
    logger.error('Complete journey error:', error);
    return sendError(res, 'ERR_5001', 'Failed to complete journey');
  }
};

// GET /api/v1/journey/active
const getActiveJourney = async (req, res) => {
  try {
    let journey = await Journey.findOne({
      user: req.user._id,
      status: { $in: ['active', 'paused'] }
    });

    // Check if paused journey is older than 24 hours
    if (journey && journey.status === 'paused' && journey.pausedAt) {
      const now = new Date();
      const pausedTime = new Date(journey.pausedAt);
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;

      if ((now - pausedTime) > twentyFourHoursMs) {
        // Auto-complete the journey
        journey.status = 'completed';
        journey.completedAt = new Date();
        journey.autoEnded = true;

        if (journey.polyline.length > 0) {
          const lastPoint = journey.polyline[journey.polyline.length - 1];
          journey.endCoords = {
            lat: lastPoint.lat,
            lng: lastPoint.lng
          };
        }

        await journey.save();
        logger.info(`Auto-ended paused journey for user ${req.user._id}:`, { journeyId: journey._id });

        // Return null since journey is no longer active
        return sendSuccess(res, 200, 'No active journey', { journey: null });
      }
    }

    return sendSuccess(res, 200, 'Active journey retrieved', { journey: journey || null });
  } catch (error) {
    logger.error('Get active journey error:', error);
    return sendError(res, 'ERR_5001', 'Failed to get active journey');
  }
};

// POST /api/v1/journey/:journeyId/waypoint
const addWaypoint = async (req, res) => {
  try {
    const { journeyId } = req.params;
    const { postId, lat, lng, contentType } = req.body;

    if (!mongoose.Types.ObjectId.isValid(journeyId)) {
      return sendError(res, 'VAL_2001', 'Invalid journey ID');
    }

    if (!postId || !lat || !lng) {
      return sendError(res, 'VAL_2001', 'postId, lat, and lng are required');
    }

    const journey = await Journey.findById(journeyId);
    if (!journey) {
      return sendError(res, 'RES_3001', 'Journey not found');
    }

    // Only owner can add waypoint
    if (journey.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1001', 'Unauthorized');
    }

    if (journey.status !== 'active') {
      return sendError(res, 'BIZ_7001', 'Journey is not active');
    }

    // Verify post exists and belongs to user
    const post = await Post.findById(postId);
    if (!post) {
      return sendError(res, 'RES_3001', 'Post not found');
    }

    if (post.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1001', 'Unauthorized to add this post as waypoint');
    }

    // Add waypoint
    journey.waypoints.push({
      postId: mongoose.Types.ObjectId(postId),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      timestamp: new Date(),
      contentType: contentType || 'photo'
    });

    await journey.save();
    logger.debug(`Waypoint added to journey ${journeyId}:`, { postId, contentType });

    return sendSuccess(res, 201, 'Waypoint added', { journey });
  } catch (error) {
    logger.error('Add waypoint error:', error);
    return sendError(res, 'ERR_5001', 'Failed to add waypoint');
  }
};

// GET /api/v1/journey/:journeyId
const getJourneyDetail = async (req, res) => {
  try {
    const { journeyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(journeyId)) {
      return sendError(res, 'VAL_2001', 'Invalid journey ID');
    }

    let journey = await Journey.findById(journeyId)
      .populate('user', 'fullName profilePic followers');

    if (!journey) {
      return sendError(res, 'RES_3001', 'Journey not found');
    }

    // Populate waypoint posts (skip entries without a post ref)
    try {
      await journey.populate({
        path: 'waypoints.post',
        select: 'caption storageKeys location mediaType',
        match: { _id: { $exists: true } }
      });
    } catch (popErr) {
      logger.warn('Failed to populate waypoint posts:', popErr);
    }

    // Privacy check
    const isOwner = req.user && req.user._id.toString() === journey.user._id.toString();
    const isFollower = req.user && journey.user.followers &&
      journey.user.followers.some(f => f.toString() === req.user._id.toString());

    if (!isOwner && journey.privacy === 'followers' && !isFollower) {
      return sendError(res, 'AUTH_1001', 'You do not have permission to view this journey');
    }

    if (!isOwner && journey.privacy === 'private') {
      return sendError(res, 'AUTH_1001', 'This journey is private');
    }

    return sendSuccess(res, 200, 'Journey detail retrieved', { journey });
  } catch (error) {
    logger.error('Get journey detail error:', { message: error.message, stack: error.stack });
    return sendError(res, 'ERR_5001', 'Failed to get journey detail');
  }
};

// GET /api/v1/journey/user/:userId
const getUserJourneys = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 50);
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, 'VAL_2001', 'Invalid user ID');
    }

    const targetUser = await User.findById(userId).select('followers privacy settings');
    if (!targetUser) {
      return sendError(res, 'RES_3001', 'User not found');
    }

    // Privacy check
    const isOwner = req.user && req.user._id.toString() === userId;
    const isFollower = req.user && targetUser.followers &&
      targetUser.followers.some(f => f.toString() === req.user._id.toString());

    const profileVisibility = targetUser.settings?.privacy?.profileVisibility || 'public';

    if (!isOwner && profileVisibility === 'followers' && !isFollower) {
      return sendSuccess(res, 200, 'Journeys retrieved (privacy filtered)', {
        journeys: [],
        pagination: { page, limit, total: 0 }
      });
    }

    if (!isOwner && profileVisibility === 'private') {
      return sendSuccess(res, 200, 'Journeys retrieved (privacy filtered)', {
        journeys: [],
        pagination: { page, limit, total: 0 }
      });
    }

    // Include polyline data when requested (for map view)
    const includePolyline = req.query.includePolyline === 'true';
    const selectFields = includePolyline
      ? 'title startCoords endCoords startedAt completedAt distanceTraveled waypoints countries polyline tripScoreAwarded'
      : 'title startCoords endCoords startedAt completedAt distanceTraveled waypoints countries tripScoreAwarded';

    // Get all journeys (active, paused, completed) for display
    const journeys = await Journey.find({
      user: userId,
      status: { $in: ['active', 'paused', 'completed'] }
    })
      .select(selectFields + ' status')
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Journey.countDocuments({
      user: userId,
      status: { $in: ['active', 'paused', 'completed'] }
    });

    // Add basic waypoint count (no full population for performance)
    const enrichedJourneys = journeys.map(j => ({
      ...j,
      waypointCount: j.waypoints ? j.waypoints.length : 0
    }));

    return sendSuccess(res, 200, 'Journeys retrieved', {
      journeys: enrichedJourneys,
      pagination: { page, limit, total }
    });
  } catch (error) {
    logger.error('Get user journeys error:', error);
    return sendError(res, 'ERR_5001', 'Failed to get user journeys');
  }
};

// Helper function: Calculate Haversine distance between two points
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in meters
};

module.exports = {
  startJourney,
  pauseJourney,
  resumeJourney,
  updateLocation,
  completeJourney,
  getActiveJourney,
  addWaypoint,
  getJourneyDetail,
  getUserJourneys
};
