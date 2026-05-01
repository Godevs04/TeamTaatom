const Journey = require('../models/Journey');
const logger = require('../utils/logger');

const AUTO_END_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
const PAUSE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const checkAndAutoEndJourneys = async () => {
  try {
    const now = new Date();
    const expiryThreshold = new Date(now - PAUSE_EXPIRY_MS);

    // Find all paused journeys that expired (paused > 24 hours ago)
    const expiredJourneys = await Journey.find({
      status: 'paused',
      pausedAt: { $lt: expiryThreshold }
    });

    for (const journey of expiredJourneys) {
      try {
        // Set last polyline point as endCoords
        if (journey.polyline && journey.polyline.length > 0) {
          const lastPoint = journey.polyline[journey.polyline.length - 1];
          journey.endCoords = {
            lat: lastPoint.lat,
            lng: lastPoint.lng
          };
        }

        // Set status to completed, mark as auto-ended
        journey.status = 'completed';
        journey.completedAt = new Date();
        journey.autoEnded = true;

        // End current session if exists
        const currentSession = journey.sessions[journey.sessions.length - 1];
        if (currentSession && !currentSession.stoppedAt) {
          currentSession.stoppedAt = new Date();
          if (journey.polyline && journey.polyline.length > 0) {
            const lastPoint = journey.polyline[journey.polyline.length - 1];
            currentSession.endCoords = {
              lat: lastPoint.lat,
              lng: lastPoint.lng
            };
          }
        }

        await journey.save();
        logger.info(`Auto-ended expired journey ${journey._id} for user ${journey.user}`);
      } catch (error) {
        logger.error(`Error auto-ending journey ${journey._id}:`, error);
      }
    }

    if (expiredJourneys.length > 0) {
      logger.info(`Auto-ended ${expiredJourneys.length} expired journeys`);
    }
  } catch (error) {
    logger.error('Journey auto-end check failed:', error);
  }
};

const startAutoEndJob = () => {
  setInterval(checkAndAutoEndJourneys, AUTO_END_CHECK_INTERVAL);
  logger.info('Journey auto-end job started (runs every hour)');
};

module.exports = { startAutoEndJob, checkAndAutoEndJourneys };
