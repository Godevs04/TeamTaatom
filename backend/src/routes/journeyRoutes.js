const express = require('express');
const router = express.Router();
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const { endpointLimiters } = require('../middleware/rateLimit');
const {
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
} = require('../controllers/journeyController');

// Auth required for all mutation endpoints
router.post('/start', authMiddleware, startJourney);
router.post('/:journeyId/pause', authMiddleware, pauseJourney);
router.post('/:journeyId/resume', authMiddleware, resumeJourney);
// /location is the high-frequency endpoint hit while a journey is active
// (the client batches every ~10s). Rate limit prevents a buggy retry loop
// from saturating the DB with duplicate polyline points.
router.put('/:journeyId/location', authMiddleware, endpointLimiters.journeyLocation, updateLocation);
router.post('/:journeyId/complete', authMiddleware, completeJourney);
router.post('/:journeyId/waypoint', authMiddleware, addWaypoint);
router.patch('/:journeyId/title', authMiddleware, updateJourneyTitle);
router.delete('/:journeyId', authMiddleware, deleteJourney);

// Read endpoints - optionalAuth for privacy
// Place /active and /user/:userId BEFORE /:journeyId to avoid route conflicts
router.get('/active', authMiddleware, getActiveJourney);
router.get('/user/:userId', optionalAuth, getUserJourneys);
router.get('/:journeyId', optionalAuth, getJourneyDetail);

module.exports = router;
