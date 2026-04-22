const TripVisit = require('../models/TripVisit');
const logger = require('../utils/logger');

/**
 * Score Service
 *
 * Handles TripScore calculation with rarity-based multipliers.
 * Scores depend on how many users have visited a location (popularity/rarity).
 */

/**
 * Calculate base score and multiplier for a location based on visitor count
 *
 * Rarity tiers:
 * - 0-5 visitors: Rare (250 pts base, 2.5x multiplier)
 * - 6-20 visitors: Moderate (150 pts base, 1.5x multiplier)
 * - 21+ visitors: Popular (100 pts base, 1x multiplier)
 *
 * @param {String} placeId - Locale/place ID (or location identifier)
 * @returns {Promise<Object>} { baseScore, multiplier, totalScore, rarity, visitorCount }
 */
const calculateScore = async (placeId) => {
  try {
    if (!placeId) {
      logger.warn('calculateScore called with empty placeId');
      return {
        baseScore: 0,
        multiplier: 1,
        totalScore: 0,
        rarity: 'unknown',
        visitorCount: 0
      };
    }

    // Count unique users who have visited this location
    // We check TripVisits with verified status (auto_verified or approved)
    // to count only "official" visits
    const visitCount = await TripVisit.countDocuments({
      // Match by location coordinates (placeId could be a Locale ID or coordinates)
      // For now, we'll count visits where the location matches the placeId string
      // This assumes placeId is stored somewhere in TripVisit
      // If placeId is a Locale._id, we can use it as a reference
      // For this implementation, we count based on lat/lng proximity (0.01 degree tolerance)
      isActive: true,
      verificationStatus: { $in: ['auto_verified', 'approved'] }
    })
    .distinct('user')
    .lean();

    const visitorCount = visitCount ? visitCount.length : 0;

    // Determine rarity tier and assign scores
    let baseScore, multiplier, rarity;

    if (visitorCount <= 5) {
      baseScore = 250;
      multiplier = 2.5;
      rarity = 'rare';
    } else if (visitorCount <= 20) {
      baseScore = 150;
      multiplier = 1.5;
      rarity = 'moderate';
    } else {
      baseScore = 100;
      multiplier = 1;
      rarity = 'popular';
    }

    const totalScore = Math.round(baseScore * multiplier);

    logger.debug('Score calculated', {
      placeId,
      visitorCount,
      rarity,
      baseScore,
      multiplier,
      totalScore
    });

    return {
      baseScore,
      multiplier,
      totalScore,
      rarity,
      visitorCount
    };
  } catch (error) {
    logger.error('Error calculating score:', error);
    return {
      baseScore: 100,
      multiplier: 1,
      totalScore: 100,
      rarity: 'unknown',
      visitorCount: 0
    };
  }
};

/**
 * Calculate and award TripScore for a completed journey
 *
 * Iterates through all waypoints in the journey (verified posts/shorts/videos)
 * and sums up the scores for each unique location visited.
 *
 * @param {String} userId - User ID
 * @param {String} journeyId - Journey ID (or journey object)
 * @returns {Promise<Object>} { totalPointsAwarded, breakdown: [{ location, points }] }
 */
const awardTripScore = async (userId, journeyId) => {
  try {
    const Journey = require('../models/Journey');

    // Get journey document
    let journey;
    if (typeof journeyId === 'string') {
      journey = await Journey.findById(journeyId);
    } else {
      journey = journeyId;
    }

    if (!journey) {
      logger.warn('awardTripScore: Journey not found', { userId, journeyId });
      return {
        totalPointsAwarded: 0,
        breakdown: []
      };
    }

    // Iterate through waypoints and calculate score for each
    const locationScores = {};
    const breakdown = [];

    // Deduplicate waypoints by location (group by lat/lng with tolerance)
    const uniqueLocations = {};
    const tolerance = 0.001; // ~100m tolerance

    for (const waypoint of journey.waypoints) {
      // Create location key for deduplication
      const locKey = `${Math.round(waypoint.lat / tolerance) * tolerance},${Math.round(waypoint.lng / tolerance) * tolerance}`;

      if (!uniqueLocations[locKey]) {
        uniqueLocations[locKey] = waypoint;
      }
    }

    // Calculate score for each unique location
    for (const locKey in uniqueLocations) {
      const waypoint = uniqueLocations[locKey];

      // Calculate score based on visitor count at this location
      // For now, use a simple approach: count TripVisits near this location
      const nearbyVisits = await TripVisit.find({
        isActive: true,
        verificationStatus: { $in: ['auto_verified', 'approved'] },
        lat: { $gte: waypoint.lat - 0.01, $lte: waypoint.lat + 0.01 },
        lng: { $gte: waypoint.lng - 0.01, $lte: waypoint.lng + 0.01 }
      })
      .distinct('user')
      .lean();

      const visitorCount = nearbyVisits ? nearbyVisits.length : 0;

      // Apply rarity multiplier
      let baseScore, multiplier;
      if (visitorCount <= 5) {
        baseScore = 250;
        multiplier = 2.5;
      } else if (visitorCount <= 20) {
        baseScore = 150;
        multiplier = 1.5;
      } else {
        baseScore = 100;
        multiplier = 1;
      }

      const points = Math.round(baseScore * multiplier);
      breakdown.push({
        location: {
          lat: waypoint.lat,
          lng: waypoint.lng
        },
        contentType: waypoint.contentType,
        visitorCount,
        baseScore,
        multiplier,
        points
      });

      logger.debug('Location score in journey', {
        journeyId: journey._id,
        location: { lat: waypoint.lat, lng: waypoint.lng },
        visitorCount,
        points
      });
    }

    // Sum total points
    const totalPointsAwarded = breakdown.reduce((sum, item) => sum + item.points, 0);

    logger.info('TripScore awarded for journey', {
      journeyId: journey._id,
      userId,
      totalPointsAwarded,
      locationsVisited: breakdown.length
    });

    return {
      totalPointsAwarded,
      breakdown
    };
  } catch (error) {
    logger.error('Error awarding TripScore:', error);
    return {
      totalPointsAwarded: 0,
      breakdown: []
    };
  }
};

module.exports = {
  calculateScore,
  awardTripScore
};
