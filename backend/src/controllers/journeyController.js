const mongoose = require('mongoose');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const Journey = require('../models/Journey');
const Post = require('../models/Post');
const User = require('../models/User');
const { MAX_REALISTIC_SPEED_KMH } = require('../config/tripScoreConfig');
const { matchTrajectory } = require('../utils/mapMatcher');

// ─── Road Snap ──────────────────────────────────────────────────────
// Uses internal OSRM Match API to snap raw GPS points to the nearest road.
// Falls back to the original polyline on any error so journey completion is never blocked.

/**
 * Snap an array of { lat, lng } points to roads via OSRM Match API.
 * Returns the snapped points in the same { lat, lng, timestamp?, accuracy? } shape,
 * preserving timestamps via interpolation from the original array.
 */
const snapToRoads = async (polyline) => {
  if (polyline.length < 2) return polyline;

  try {
    const formattedPoints = polyline.map(p => ({
      lat: p.lat ?? p.latitude,
      lng: p.lng ?? p.longitude,
      timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
      segmentBreak: p.segmentBreak || false
    }));

    const snapped = await matchTrajectory(formattedPoints);
    return snapped.map(p => ({
      lat: p.lat,
      lng: p.lng,
      timestamp: p.timestamp,
      accuracy: 0,
      segmentBreak: p.segmentBreak
    }));
  } catch (err) {
    logger.warn('Custom HMM road snap failed (non-blocking), keeping raw polyline:', err.message);
    return polyline;
  }
};

/**
 * Split a polyline into segments based on session boundaries.
 * Each session has startedAt. Any coordinate whose timestamp is after a new session started
 * belongs to the new segment.
 */
const splitPolylineBySessions = (polyline, sessions) => {
  if (!sessions || sessions.length <= 1 || polyline.length === 0) {
    return [polyline];
  }

  const sessionStarts = sessions
    .slice(1)
    .map(s => s.startedAt ? new Date(s.startedAt).getTime() : 0)
    .filter(t => !isNaN(t) && t > 0)
    .sort((a, b) => a - b);

  if (sessionStarts.length === 0) {
    return [polyline];
  }

  const segments = [];
  let currentSegment = [polyline[0]];

  for (let i = 1; i < polyline.length; i++) {
    const point = polyline[i];
    const prevPoint = polyline[i - 1];

    const prevTime = prevPoint.timestamp ? new Date(prevPoint.timestamp).getTime() : 0;
    const currTime = point.timestamp ? new Date(point.timestamp).getTime() : 0;

    const hasBoundary = !isNaN(prevTime) && !isNaN(currTime) && sessionStarts.some(start => start > prevTime && start <= currTime);

    if (hasBoundary) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }
      currentSegment = [];
    }
    currentSegment.push(point);
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
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
      raw_polyline: [
        {
          lat: parseFloat(startCoords.lat),
          lng: parseFloat(startCoords.lng),
          timestamp: new Date(),
          accuracy: null,
          segmentBreak: false
        }
      ],
      snapped_polyline: [
        {
          lat: parseFloat(startCoords.lat),
          lng: parseFloat(startCoords.lng)
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

    // Filter coordinates by validity and accuracy threshold (drop > 20m)
    const filteredCoords = [];
    let skippedInvalid = 0;
    let skippedAccuracy = 0;

    for (const coord of coordinates) {
      if (!isValidCoord(coord.lat, coord.lng)) {
        skippedInvalid++;
        continue;
      }

      const accuracy = coord.accuracy != null ? parseFloat(coord.accuracy) : null;
      if (accuracy !== null && accuracy > 20) {
        skippedAccuracy++;
        continue;
      }

      filteredCoords.push({
        lat: parseFloat(coord.lat),
        lng: parseFloat(coord.lng),
        timestamp: coord.timestamp ? new Date(coord.timestamp) : new Date(),
        accuracy: accuracy,
        segmentBreak: coord.segmentBreak === true || coord.segmentBreak === 'true'
      });
    }

    if (filteredCoords.length === 0) {
      if (skippedInvalid > 0 || skippedAccuracy > 0) {
        logger.warn(`Journey ${journeyId} updateLocation: dropped all points`, {
          skippedInvalid,
          skippedAccuracy,
          userId: req.user._id.toString()
        });
      }
      journey.lastActiveAt = new Date();
      await journey.save();
      return sendSuccess(res, 200, 'Location updated (all points filtered out)', {
        journey,
        pointsAdded: 0
      });
    }

    // Call custom map matcher to snap coordinates to road network
    let snappedPoints = [];
    let matchSucceeded = false;

    if (filteredCoords.length >= 2) {
      try {
        const snapped = await matchTrajectory(filteredCoords);
        if (snapped && snapped.length > 0) {
          snappedPoints = snapped.map(p => ({
            lat: p.lat,
            lng: p.lng
          }));
          matchSucceeded = true;
        }
      } catch (err) {
        logger.warn(`Custom map matcher failed — falling back to raw coords: ${err.message}`);
      }
    }

    if (!matchSucceeded) {
      snappedPoints = filteredCoords.map(c => ({
        lat: c.lat,
        lng: c.lng
      }));
    }

    // For session/speed calculations on matched geometry points, reconstruct matching timestamps/segment breaks
    const snappedWithMetadata = snappedPoints.map((p, idx) => {
      let origIdx = 0;
      if (snappedPoints.length > 1) {
        origIdx = Math.min(
          Math.floor((idx / (snappedPoints.length - 1)) * (filteredCoords.length - 1)),
          filteredCoords.length - 1
        );
      }
      const originalPoint = filteredCoords[origIdx];
      return {
        lat: p.lat,
        lng: p.lng,
        timestamp: originalPoint.timestamp,
        accuracy: originalPoint.accuracy || 0,
        segmentBreak: originalPoint.segmentBreak || false
      };
    });

    const distanceSource = matchSucceeded ? snappedWithMetadata : filteredCoords;
    let addedDistance = 0;
    let skippedImpossible = 0;
    let startIndex = 0;

    let lastPointTime = journey.lastActiveAt;
    if (journey.raw_polyline.length > 0) {
      lastPointTime = journey.raw_polyline[journey.raw_polyline.length - 1].timestamp;
    }

    let lastPoint = journey.snapped_polyline.length > 0
      ? {
          lat: journey.snapped_polyline[journey.snapped_polyline.length - 1].lat,
          lng: journey.snapped_polyline[journey.snapped_polyline.length - 1].lng,
          timestamp: lastPointTime
        }
      : null;

    // Startup jump check
    if (lastPoint && distanceSource.length > 0) {
      const firstPoint = distanceSource[0];
      const prevTime = new Date(lastPoint.timestamp).getTime();
      const currTime = new Date(firstPoint.timestamp).getTime();

      if (journey.snapped_polyline.length === 1 && (currTime - prevTime) < 20000) {
        journey.startCoords = { lat: firstPoint.lat, lng: firstPoint.lng };
        if (journey.sessions && journey.sessions.length > 0) {
          journey.sessions[0].startCoords = { lat: firstPoint.lat, lng: firstPoint.lng };
        }

        if (journey.raw_polyline.length > 0) {
          journey.raw_polyline[0] = filteredCoords[0];
        }
        if (journey.snapped_polyline.length > 0) {
          journey.snapped_polyline[0] = { lat: snappedPoints[0].lat, lng: snappedPoints[0].lng };
        }

        lastPoint = firstPoint;
        startIndex = 1;
      }
    }

    // Process and push coordinates
    for (let i = startIndex; i < distanceSource.length; i++) {
      const point = distanceSource[i];
      const rawP = filteredCoords[i];
      const snappedP = snappedPoints[i];

      if (lastPoint) {
        const prevTime = new Date(lastPoint.timestamp).getTime();
        const currTime = new Date(point.timestamp).getTime();

        const hasSessionBoundary = journey.sessions && journey.sessions.some(s => {
          const sessionStart = new Date(s.startedAt).getTime();
          return sessionStart > prevTime && sessionStart <= currTime;
        });

        if (hasSessionBoundary) {
          journey.raw_polyline.push(rawP);
          journey.snapped_polyline.push({ lat: snappedP.lat, lng: snappedP.lng });
        } else {
          const distance = calculateHaversineDistance(
            lastPoint.lat,
            lastPoint.lng,
            point.lat,
            point.lng
          );

          // Speed sanity check: reject points implying motion faster than 200 km/h.
          const dtSec = Math.max(0.001, (new Date(point.timestamp) - new Date(lastPoint.timestamp)) / 1000);
          const speedKmh = (distance / 1000) / (dtSec / 3600);

          if (speedKmh > 200) {
            skippedImpossible++;
            continue;
          }

          journey.raw_polyline.push(rawP);
          journey.snapped_polyline.push({ lat: snappedP.lat, lng: snappedP.lng });
          addedDistance += distance;
        }
      } else {
        journey.raw_polyline.push(rawP);
        journey.snapped_polyline.push({ lat: snappedP.lat, lng: snappedP.lng });
      }

      lastPoint = {
        lat: snappedP.lat,
        lng: snappedP.lng,
        timestamp: rawP.timestamp
      };
    }

    if (skippedInvalid > 0 || skippedAccuracy > 0 || skippedImpossible > 0) {
      logger.warn(`Journey ${journeyId} updateLocation: dropped coordinates`, {
        skippedInvalid,
        skippedAccuracy,
        skippedImpossible,
        accepted: filteredCoords.length - startIndex - skippedImpossible,
        userId: req.user._id.toString()
      });
    }

    // Update endCoords to last snapped polyline point
    if (journey.snapped_polyline.length > 0) {
      const lastSnapped = journey.snapped_polyline[journey.snapped_polyline.length - 1];
      journey.endCoords = {
        lat: lastSnapped.lat,
        lng: lastSnapped.lng
      };
    }

    journey.distanceTraveled += addedDistance;
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
      if (journey.snapped_polyline.length > 0) {
        const lastPoint = journey.snapped_polyline[journey.snapped_polyline.length - 1];
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
    if (journey.snapped_polyline.length > 0) {
      const lastPoint = journey.snapped_polyline[journey.snapped_polyline.length - 1];
      journey.endCoords = {
        lat: lastPoint.lat,
        lng: lastPoint.lng
      };
    }

    // Snap raw GPS polyline to actual roads for a cleaner path display.
    // Non-blocking — falls back to raw polyline on any error.
    if (journey.raw_polyline.length >= 2 && shouldSnap !== false) {
      try {
        const segments = splitPolylineBySessions(journey.raw_polyline, journey.sessions);
        const snappedSegments = await Promise.all(
          segments.map(seg => snapToRoads(seg))
        );
        // Stripped of timestamps / segment-breaks forSnapped polyline storage optimization
        journey.snapped_polyline = snappedSegments.flat().map(p => ({
          lat: p.lat,
          lng: p.lng
        }));
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
      ? 'title startCoords endCoords startedAt completedAt distanceTraveled waypoints countries raw_polyline snapped_polyline polyline sessions tripScoreAwarded privacy'
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

    // Add basic waypoint count and dynamic polyline mapping (since lean bypasses getters)
    const enrichedJourneys = journeys.map(j => {
      let poly = j.polyline;
      if (includePolyline) {
        if (j.snapped_polyline && j.snapped_polyline.length > 0) {
          const raw = j.raw_polyline || [];
          poly = j.snapped_polyline.map((p, idx) => {
            let origIdx = 0;
            if (j.snapped_polyline.length > 1 && raw.length > 0) {
              origIdx = Math.min(
                Math.floor((idx / (j.snapped_polyline.length - 1)) * (raw.length - 1)),
                raw.length - 1
              );
            }
            const rawP = raw[origIdx];
            return {
              lat: p.lat,
              lng: p.lng,
              timestamp: rawP ? rawP.timestamp : new Date(),
              accuracy: rawP ? rawP.accuracy : 0,
              segmentBreak: rawP ? rawP.segmentBreak : false
            };
          });
        } else if (j.raw_polyline && j.raw_polyline.length > 0) {
          poly = j.raw_polyline;
        }
      }

      return {
        ...j,
        polyline: poly,
        waypointCount: j.waypoints ? j.waypoints.length : 0
      };
    });


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
