const mongoose = require('mongoose');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const Journey = require('../models/Journey');
const Post = require('../models/Post');
const User = require('../models/User');
const { MAX_REALISTIC_SPEED_KMH } = require('../config/tripScoreConfig');

// ─── Road Snap ──────────────────────────────────────────────────────
// Uses Google Maps Roads API to snap raw GPS points to the nearest road.
// The API accepts up to 100 points per request, so longer polylines are
// chunked with a 1-point overlap so the snapped segments join seamlessly.
// Falls back to the original polyline on any error (network, quota, etc.)
// so journey completion is never blocked.
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Snap an array of { lat, lng } points to roads via Google Maps Roads API.
 * Returns the snapped points in the same { lat, lng, timestamp?, accuracy? } shape,
 * preserving timestamps via interpolation from the original array.
 */
const snapToRoads = async (polyline) => {
  if (!GOOGLE_MAPS_API_KEY || polyline.length < 2) return polyline;

  const CHUNK_SIZE = 100; // Roads API limit per request
  const snappedAll = [];

  try {
    for (let i = 0; i < polyline.length; i += CHUNK_SIZE - 1) {
      const chunk = polyline.slice(i, i + CHUNK_SIZE);
      const pathParam = chunk.map(p => `${p.lat},${p.lng}`).join('|');

      const url = `https://roads.googleapis.com/v1/snapToRoads?path=${pathParam}&interpolate=true&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        logger.warn(`Roads API returned ${response.status} — falling back to raw polyline`);
        return polyline;
      }

      const data = await response.json();
      if (!data.snappedPoints || data.snappedPoints.length === 0) {
        // Chunk had no road matches — keep originals for this segment
        if (snappedAll.length === 0) return polyline;
        continue;
      }

      // Map snapped points back, interpolating timestamps from the original
      // chunk based on the originalIndex provided by the API.
      for (const sp of data.snappedPoints) {
        // Skip the first point of subsequent chunks (overlap point)
        if (snappedAll.length > 0 && i > 0 &&
            sp.location.latitude === snappedAll[snappedAll.length - 1].lat &&
            sp.location.longitude === snappedAll[snappedAll.length - 1].lng) {
          continue;
        }

        const origIdx = sp.originalIndex != null ? sp.originalIndex : 0;
        const origPoint = chunk[Math.min(origIdx, chunk.length - 1)];
        snappedAll.push({
          lat: sp.location.latitude,
          lng: sp.location.longitude,
          timestamp: origPoint.timestamp || new Date(),
          accuracy: 0, // snapped = perfect road accuracy
        });
      }
    }

    if (snappedAll.length < 2) return polyline;
    logger.debug(`Road snap: ${polyline.length} raw → ${snappedAll.length} snapped points`);
    return snappedAll;
  } catch (err) {
    logger.warn('Road snap failed (non-blocking), keeping raw polyline:', err.message);
    return polyline;
  }
};

// Treat coords as valid only when both axes are real numbers within bounds.
// `lat == null` correctly catches null/undefined while preserving 0 (equator,
// prime meridian) — a truthy `!lat` check would silently drop both.
const isValidCoord = (lat, lng) => {
  const la = Number(lat);
  const ln = Number(lng);
  return (
    Number.isFinite(la) && Number.isFinite(ln) &&
    la >= -90 && la <= 90 &&
    ln >= -180 && ln <= 180
  );
};

// POST /api/v1/journey/start
const startJourney = async (req, res) => {
  try {
    const { startCoords, title, sourceUserId } = req.body;

    // Validate startCoords
    if (!startCoords || !isValidCoord(startCoords.lat, startCoords.lng)) {
      return sendError(res, 'VAL_2001', 'startCoords with lat and lng within valid bounds are required');
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
    let skippedInvalid = 0;
    let skippedImpossible = 0;
    for (const coord of coordinates) {
      // Reject out-of-bounds / NaN before they enter the polyline. A single
      // bad point (e.g. parseFloat overflow → lat:300) corrupts distance math
      // and map rendering permanently — and there's no easy DB cleanup.
      if (!isValidCoord(coord.lat, coord.lng)) {
        skippedInvalid++;
        continue;
      }

      const point = {
        lat: parseFloat(coord.lat),
        lng: parseFloat(coord.lng),
        timestamp: coord.timestamp ? new Date(coord.timestamp) : new Date(),
        accuracy: coord.accuracy ? parseFloat(coord.accuracy) : null
      };

      // Calculate distance from previous point using Haversine formula
      if (journey.polyline.length > 0) {
        const prevPoint = journey.polyline[journey.polyline.length - 1];

        // Check if there was a pause/resume boundary between prevPoint and the new point.
        // We scan for any session in journey.sessions that started after prevPoint.timestamp
        // and before or at point.timestamp.
        const prevTime = new Date(prevPoint.timestamp).getTime();
        const currTime = new Date(point.timestamp).getTime();
        const hasSessionBoundary = journey.sessions && journey.sessions.some(s => {
          const sessionStart = new Date(s.startedAt).getTime();
          return sessionStart > prevTime && sessionStart <= currTime;
        });

        if (hasSessionBoundary) {
          // A new session started between these points, so we do NOT count the distance
          // traveled while paused/suspended.
          journey.polyline.push(point);
        } else {
          const distance = calculateHaversineDistance(
            prevPoint.lat,
            prevPoint.lng,
            point.lat,
            point.lng
          );

          // Speed sanity check: reject points implying motion faster than a
          // commercial flight (~1000 km/h). Catches GPS jumps from indoor
          // multipath, spoofed coords, and parseFloat overflow that's still
          // technically in-bounds but absurd vs. the previous point.
          const dtSec = Math.max(
            0.001,
            (point.timestamp - prevPoint.timestamp) / 1000,
          );
          const speedKmh = (distance / 1000) / (dtSec / 3600);
          if (speedKmh > MAX_REALISTIC_SPEED_KMH) {
            skippedImpossible++;
            continue;
          }

          journey.polyline.push(point);
          journey.distanceTraveled += distance; // distance in meters
        }
      } else {
        journey.polyline.push(point);
      }
    }

    if (skippedInvalid > 0 || skippedImpossible > 0) {
      logger.warn(`Journey ${journeyId} updateLocation: dropped points`, {
        skippedInvalid,
        skippedImpossible,
        accepted: coordinates.length - skippedInvalid - skippedImpossible,
        userId: req.user._id.toString(),
      });
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
    const { snapToRoads: shouldSnap } = req.body;

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

    // Set endCoords to last polyline point before snapping to roads.
    // This ensures that the final destination pin marks the exact physical end location
    // of the user, even if the travel route line is snapped/smoothed to vehicle roads.
    if (journey.polyline.length > 0) {
      const lastPoint = journey.polyline[journey.polyline.length - 1];
      journey.endCoords = {
        lat: lastPoint.lat,
        lng: lastPoint.lng
      };
    }

    // Snap raw GPS polyline to actual roads for a cleaner path display.
    // Non-blocking — falls back to raw polyline on any error.
    if (journey.polyline.length >= 2 && shouldSnap !== false) {
      try {
        journey.polyline = await snapToRoads(journey.polyline);
      } catch (snapErr) {
        logger.warn('Road snap error (non-blocking):', snapErr.message);
      }
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

const checkRouteAccess = (owner, viewerId) => {
  // owner is the user object of the journey owner. viewerId is the logged-in user's ID
  const isOwner = viewerId && owner._id.toString() === viewerId.toString();
  if (isOwner) return true;

  const routeVisibility = owner.settings?.privacy?.routeVisibility || 'everyone';

  if (routeVisibility === 'private') {
    return false;
  }

  if (routeVisibility === 'approved_only') {
    if (!viewerId) return false;
    const approvedUsers = owner.routeAccessApprovedUsers || [];
    return approvedUsers.some(id => id.toString() === viewerId.toString());
  }

  // If routeVisibility is 'everyone', follow standard profileVisibility rules
  const profileVisibility = owner.settings?.privacy?.profileVisibility || 'public';
  if (profileVisibility === 'private') {
    return false;
  }
  if (profileVisibility === 'followers') {
    const followers = owner.followers || [];
    return viewerId && followers.some(id => id.toString() === viewerId.toString());
  }

  return true;
};

// GET /api/v1/journey/:journeyId
const getJourneyDetail = async (req, res) => {
  try {
    const { journeyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(journeyId)) {
      return sendError(res, 'VAL_2001', 'Invalid journey ID');
    }

    let journey = await Journey.findById(journeyId)
      .populate('user', 'fullName profilePic followers settings routeAccessApprovedUsers');

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
    const viewerId = req.user ? req.user._id : null;
    const isOwner = viewerId && journey.user._id.toString() === viewerId.toString();

    // Check finished check: active/paused journeys are completely hidden from non-owners
    if (!isOwner && journey.status !== 'completed') {
      return sendError(res, 'AUTH_1001', 'You do not have permission to view active journeys');
    }

    // Check route privacy access
    if (!isOwner && !checkRouteAccess(journey.user, viewerId)) {
      return sendError(res, 'AUTH_1001', 'You do not have permission to view this journey');
    }

    // Check per-journey privacy
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

    const targetUser = await User.findById(userId).select('followers privacy settings routeAccessApprovedUsers');
    if (!targetUser) {
      return sendError(res, 'RES_3001', 'User not found');
    }

    // Privacy check
    const viewerId = req.user ? req.user._id : null;
    const isOwner = viewerId && targetUser._id.toString() === userId;

    // Check route privacy access
    if (!isOwner && !checkRouteAccess(targetUser, viewerId)) {
      return sendSuccess(res, 200, 'Journeys retrieved (privacy filtered)', {
        journeys: [],
        pagination: { page, limit, total: 0 }
      });
    }

    // Include polyline data when requested (for map view)
    const includePolyline = req.query.includePolyline === 'true';
    const selectFields = includePolyline
      ? 'title startCoords endCoords startedAt completedAt distanceTraveled waypoints countries polyline sessions tripScoreAwarded privacy'
      : 'title startCoords endCoords startedAt completedAt distanceTraveled waypoints countries tripScoreAwarded privacy';

    // Get journeys
    // For non-owners, also filter by completed status and per-journey privacy
    const journeyQuery = {
      user: userId
    };

    if (isOwner) {
      journeyQuery.status = { $in: ['active', 'paused', 'completed'] };
    } else {
      journeyQuery.status = 'completed'; // Non-owners only see completed journeys
      const isFollower = req.user && targetUser.followers &&
        targetUser.followers.some(f => f.toString() === req.user._id.toString());
      if (isFollower) {
        journeyQuery.privacy = { $in: ['public', 'followers'] };
      } else {
        journeyQuery.privacy = 'public';
      }
    }

    const journeys = await Journey.find(journeyQuery)
      .select(selectFields + ' status')
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Journey.countDocuments(journeyQuery);

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

// PATCH /api/v1/journey/:journeyId/title
const updateJourneyTitle = async (req, res) => {
  try {
    const { journeyId } = req.params;
    const { title } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(journeyId)) {
      return sendError(res, 'VAL_2001', 'Invalid journey ID');
    }

    if (title === undefined || title === null) {
      return sendError(res, 'VAL_2001', 'Title is required');
    }

    if (typeof title === 'string' && title.length > 100) {
      return sendError(res, 'VAL_2001', 'Title must be 100 characters or less');
    }

    const journey = await Journey.findOne({ _id: journeyId, user: userId });
    if (!journey) {
      return sendError(res, 'RES_3001', 'Journey not found');
    }

    journey.title = title.trim();
    await journey.save();

    return sendSuccess(res, 200, 'Journey title updated', { journey });
  } catch (error) {
    logger.error('Update journey title error:', error);
    return sendError(res, 'ERR_5001', 'Failed to update journey title');
  }
};

// DELETE /api/v1/journey/:journeyId
const deleteJourney = async (req, res) => {
  try {
    const { journeyId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(journeyId)) {
      return sendError(res, 'VAL_2001', 'Invalid journey ID');
    }

    const journey = await Journey.findOne({ _id: journeyId, user: userId });
    if (!journey) {
      return sendError(res, 'RES_3001', 'Journey not found');
    }

    await Journey.deleteOne({ _id: journeyId, user: userId });

    return sendSuccess(res, 200, 'Journey deleted successfully');
  } catch (error) {
    logger.error('Delete journey error:', error);
    return sendError(res, 'ERR_5001', 'Failed to delete journey');
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
  getUserJourneys,
  updateJourneyTitle,
  deleteJourney
};
