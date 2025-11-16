const AnalyticsEvent = require('../models/AnalyticsEvent');
const ErrorLog = require('../models/ErrorLog');
const { logger } = require('../utils/logger');

// @desc    Track analytics events
// @route   POST /analytics/events
// @access  Private
const trackEvents = async (req, res) => {
  try {
    const { events } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Events array is required'
      });
    }

    // Validate and save events
    const eventsToSave = events.map(event => ({
      event: event.event,
      userId: event.userId || userId,
      properties: event.properties || {},
      platform: event.platform,
      sessionId: event.sessionId,
      timestamp: new Date(event.timestamp || Date.now()),
    }));

    // Bulk insert events
    await AnalyticsEvent.insertMany(eventsToSave);

    res.json({
      success: true,
      message: 'Events tracked successfully',
      count: eventsToSave.length
    });
  } catch (error) {
    logger.error('Error tracking analytics events:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to track events'
    });
  }
};

// @desc    Get analytics data
// @route   GET /analytics/data
// @access  Private (Admin)
const getAnalyticsData = async (req, res) => {
  try {
    const { startDate, endDate, eventType, userId } = req.query;
    const query = {};

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    if (eventType) {
      query.event = eventType;
    }

    if (userId) {
      query.userId = userId;
    }

    const events = await AnalyticsEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(1000)
      .lean();

    // Aggregate data
    const eventCounts = {};
    const userEngagement = {};
    const featureUsage = {};

    events.forEach(event => {
      // Count events
      eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;

      // Track user engagement
      if (event.userId) {
        if (!userEngagement[event.userId]) {
          userEngagement[event.userId] = { events: 0, sessions: new Set() };
        }
        userEngagement[event.userId].events++;
        userEngagement[event.userId].sessions.add(event.sessionId);
      }

      // Track feature usage
      if (event.event === 'feature_usage' && event.properties?.feature_name) {
        const featureName = event.properties.feature_name;
        featureUsage[featureName] = (featureUsage[featureName] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: {
        totalEvents: events.length,
        eventCounts,
        uniqueUsers: Object.keys(userEngagement).length,
        userEngagement: Object.entries(userEngagement).map(([userId, data]) => ({
          userId,
          events: data.events,
          sessions: data.sessions.size,
        })),
        featureUsage,
      }
    });
  } catch (error) {
    logger.error('Error getting analytics data:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get analytics data'
    });
  }
};

// @desc    Log error
// @route   POST /analytics/errors
// @access  Public (but should be rate limited)
const logError = async (req, res) => {
  try {
    const { message, stack, name, platform, userId, timestamp, context } = req.body;

    const errorLog = new ErrorLog({
      message: message || 'Unknown error',
      stack: stack || '',
      name: name || 'Error',
      platform: platform || 'unknown',
      userId: userId || null,
      context: context || {},
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    await errorLog.save();

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      logger.error('Error logged:', errorLog);
    }

    res.json({
      success: true,
      message: 'Error logged successfully'
    });
  } catch (error) {
    logger.error('Error logging error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to log error'
    });
  }
};

// @desc    Get error logs
// @route   GET /analytics/errors
// @access  Private (Admin)
const getErrorLogs = async (req, res) => {
  try {
    const { limit = 100, platform, startDate, endDate } = req.query;
    const query = {};

    if (platform) {
      query.platform = platform;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const errors = await ErrorLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      errors,
      count: errors.length
    });
  } catch (error) {
    logger.error('Error getting error logs:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get error logs'
    });
  }
};

module.exports = {
  trackEvents,
  getAnalyticsData,
  logError,
  getErrorLogs,
};

