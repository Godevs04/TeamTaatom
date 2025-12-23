const AnalyticsEvent = require('../models/AnalyticsEvent');
const ErrorLog = require('../models/ErrorLog');
const User = require('../models/User');
const Post = require('../models/Post');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const { cacheWrapper, CacheKeys, CACHE_TTL } = require('../utils/cache');

/**
 * Get analytics summary (KPIs: DAU, MAU, engagement rate, crash count)
 * @route GET /api/v1/superadmin/analytics/summary
 */
const getAnalyticsSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to last 30 days if not provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const cacheKey = `analytics:summary:${start.toISOString()}:${end.toISOString()}`;
    
    const summary = await cacheWrapper(cacheKey, async () => {
      // Calculate DAU (Daily Active Users) - last 24 hours
      const dauStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dauUsers = await AnalyticsEvent.distinct('userId', {
        timestamp: { $gte: dauStart },
        userId: { $ne: null }
      });
      
      // Calculate MAU (Monthly Active Users) - last 30 days
      const mauStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const mauUsers = await AnalyticsEvent.distinct('userId', {
        timestamp: { $gte: mauStart },
        userId: { $ne: null }
      });
      
      // Calculate engagement rate (likes + comments + shares / total posts)
      const totalPosts = await Post.countDocuments({
        createdAt: { $gte: start, $lte: end },
        isActive: true
      });
      
      const engagementEvents = await AnalyticsEvent.countDocuments({
        event: { $in: ['post_liked', 'comment_added', 'engagement'] },
        timestamp: { $gte: start, $lte: end }
      });
      
      const engagementRate = totalPosts > 0 
        ? ((engagementEvents / totalPosts) * 100).toFixed(2)
        : 0;
      
      // Calculate crash count
      const crashCount = await ErrorLog.countDocuments({
        timestamp: { $gte: start, $lte: end },
        resolved: false
      });
      
      // Calculate post views
      const postViews = await AnalyticsEvent.countDocuments({
        event: 'post_view',
        timestamp: { $gte: start, $lte: end }
      });
      
      // Calculate total events
      const totalEvents = await AnalyticsEvent.countDocuments({
        timestamp: { $gte: start, $lte: end }
      });
      
      return {
        dau: dauUsers.length,
        mau: mauUsers.length,
        engagementRate: parseFloat(engagementRate),
        crashCount,
        postViews,
        totalEvents,
        totalPosts
      };
    }, CACHE_TTL.SHORT);
    
    return sendSuccess(res, 200, 'Analytics summary fetched successfully', { summary });
  } catch (error) {
    logger.error('Get analytics summary error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch analytics summary');
  }
};

/**
 * Get time series data for charts
 * @route GET /api/v1/superadmin/analytics/timeseries
 */
const getTimeSeriesData = async (req, res) => {
  try {
    const { startDate, endDate, eventType, platform, groupBy = 'day' } = req.query;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const cacheKey = `analytics:timeseries:${start.toISOString()}:${end.toISOString()}:${eventType || 'all'}:${platform || 'all'}:${groupBy}`;
    
    const timeSeries = await cacheWrapper(cacheKey, async () => {
      const matchStage = {
        timestamp: { $gte: start, $lte: end }
      };
      
      if (eventType) {
        matchStage.event = eventType;
      }
      
      if (platform) {
        matchStage.platform = platform;
      }
      
      // Determine date grouping format
      let dateFormat;
      if (groupBy === 'hour') {
        dateFormat = { $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp' } };
      } else if (groupBy === 'week') {
        dateFormat = { $dateToString: { format: '%Y-W%V', date: '$timestamp' } };
      } else if (groupBy === 'month') {
        dateFormat = { $dateToString: { format: '%Y-%m', date: '$timestamp' } };
      } else {
        dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } };
      }
      
      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: {
              date: dateFormat,
              event: '$event'
            },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            events: {
              $push: {
                event: '$_id.event',
                count: '$count'
              }
            },
            totalCount: { $sum: '$count' },
            uniqueUsers: { $sum: { $size: '$uniqueUsers' } }
          }
        },
        { $sort: { _id: 1 } }
      ];
      
      const results = await AnalyticsEvent.aggregate(pipeline);
      
      return results.map(item => ({
        date: item._id,
        totalEvents: item.totalCount,
        uniqueUsers: item.uniqueUsers,
        events: item.events
      }));
    }, CACHE_TTL.SHORT);
    
    return sendSuccess(res, 200, 'Time series data fetched successfully', { timeSeries });
  } catch (error) {
    logger.error('Get time series data error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch time series data');
  }
};

/**
 * Get event breakdown by type, platform, etc.
 * @route GET /api/v1/superadmin/analytics/breakdown
 */
const getEventBreakdown = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'event' } = req.query;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const cacheKey = `analytics:breakdown:${start.toISOString()}:${end.toISOString()}:${groupBy}`;
    
    const breakdown = await cacheWrapper(cacheKey, async () => {
      const groupField = groupBy === 'platform' ? '$platform' : '$event';
      
      const pipeline = [
        {
          $match: {
            timestamp: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: groupField,
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ];
      
      const results = await AnalyticsEvent.aggregate(pipeline);
      
      return results.map(item => ({
        name: item._id || 'Unknown',
        count: item.count,
        uniqueUsers: item.uniqueUsers.filter(id => id !== null).length
      }));
    }, CACHE_TTL.SHORT);
    
    return sendSuccess(res, 200, 'Event breakdown fetched successfully', { breakdown });
  } catch (error) {
    logger.error('Get event breakdown error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch event breakdown');
  }
};

/**
 * Get top features usage
 * @route GET /api/v1/superadmin/analytics/features
 */
const getTopFeatures = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const cacheKey = `analytics:features:${start.toISOString()}:${end.toISOString()}:${limit}`;
    
    const features = await cacheWrapper(cacheKey, async () => {
      const pipeline = [
        {
          $match: {
            event: 'feature_usage',
            timestamp: { $gte: start, $lte: end },
            'properties.feature_name': { $exists: true }
          }
        },
        {
          $group: {
            _id: '$properties.feature_name',
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: parseInt(limit) }
      ];
      
      const results = await AnalyticsEvent.aggregate(pipeline);
      
      return results.map(item => ({
        featureName: item._id,
        usageCount: item.count,
        uniqueUsers: item.uniqueUsers.filter(id => id !== null).length
      }));
    }, CACHE_TTL.SHORT);
    
    return sendSuccess(res, 200, 'Top features fetched successfully', { features });
  } catch (error) {
    logger.error('Get top features error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch top features');
  }
};

/**
 * Get drop-off points
 * @route GET /api/v1/superadmin/analytics/dropoffs
 */
const getDropOffPoints = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const cacheKey = `analytics:dropoffs:${start.toISOString()}:${end.toISOString()}:${limit}`;
    
    const dropOffs = await cacheWrapper(cacheKey, async () => {
      const pipeline = [
        {
          $match: {
            event: 'drop_off',
            timestamp: { $gte: start, $lte: end },
            'properties.step': { $exists: true }
          }
        },
        {
          $group: {
            _id: '$properties.step',
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: parseInt(limit) }
      ];
      
      const results = await AnalyticsEvent.aggregate(pipeline);
      
      return results.map(item => ({
        step: item._id,
        dropOffCount: item.count,
        affectedUsers: item.uniqueUsers.filter(id => id !== null).length
      }));
    }, CACHE_TTL.SHORT);
    
    return sendSuccess(res, 200, 'Drop-off points fetched successfully', { dropOffs });
  } catch (error) {
    logger.error('Get drop-off points error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch drop-off points');
  }
};

/**
 * Get recent events with pagination
 * @route GET /api/v1/superadmin/analytics/events
 */
const getRecentEvents = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      eventType, 
      platform, 
      startDate, 
      endDate,
      search 
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const query = {
      timestamp: { $gte: start, $lte: end }
    };
    
    if (eventType) {
      query.event = eventType;
    }
    
    if (platform) {
      query.platform = platform;
    }
    
    if (search) {
      query.$or = [
        { event: { $regex: search, $options: 'i' } },
        { 'properties.feature_name': { $regex: search, $options: 'i' } }
      ];
    }
    
    const [events, total] = await Promise.all([
      AnalyticsEvent.find(query)
        .populate('userId', 'fullName username profilePic')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AnalyticsEvent.countDocuments(query)
    ]);
    
    return sendSuccess(res, 200, 'Recent events fetched successfully', {
      events,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalEvents: total,
        hasNextPage: skip + parseInt(limit) < total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Get recent events error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch recent events');
  }
};

/**
 * Get user retention data
 * @route GET /api/v1/superadmin/analytics/retention
 */
const getUserRetention = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    const cacheKey = `analytics:retention:${start.toISOString()}:${end.toISOString()}`;
    
    const retention = await cacheWrapper(cacheKey, async () => {
      // Get all users who had their first event in the period
      const firstEvents = await AnalyticsEvent.aggregate([
        {
          $match: {
            timestamp: { $gte: start, $lte: end },
            userId: { $ne: null }
          }
        },
        {
          $group: {
            _id: '$userId',
            firstEventDate: { $min: '$timestamp' }
          }
        }
      ]);
      
      const cohortData = {};
      
      for (const user of firstEvents) {
        const cohortDate = new Date(user.firstEventDate);
        const cohortKey = cohortDate.toISOString().split('T')[0];
        
        if (!cohortData[cohortKey]) {
          cohortData[cohortKey] = {
            cohortDate: cohortKey,
            totalUsers: 0,
            day1: 0,
            day7: 0,
            day14: 0,
            day30: 0
          };
        }
        
        cohortData[cohortKey].totalUsers++;
        
        // Check if user was active on day 1, 7, 14, 30
        const userId = user._id;
        const day1 = new Date(cohortDate.getTime() + 1 * 24 * 60 * 60 * 1000);
        const day7 = new Date(cohortDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        const day14 = new Date(cohortDate.getTime() + 14 * 24 * 60 * 60 * 1000);
        const day30 = new Date(cohortDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        const [activeDay1, activeDay7, activeDay14, activeDay30] = await Promise.all([
          AnalyticsEvent.countDocuments({ userId, timestamp: { $gte: day1, $lt: new Date(day1.getTime() + 24 * 60 * 60 * 1000) } }),
          AnalyticsEvent.countDocuments({ userId, timestamp: { $gte: day7, $lt: new Date(day7.getTime() + 24 * 60 * 60 * 1000) } }),
          AnalyticsEvent.countDocuments({ userId, timestamp: { $gte: day14, $lt: new Date(day14.getTime() + 24 * 60 * 60 * 1000) } }),
          AnalyticsEvent.countDocuments({ userId, timestamp: { $gte: day30, $lt: new Date(day30.getTime() + 24 * 60 * 60 * 1000) } })
        ]);
        
        if (activeDay1 > 0) cohortData[cohortKey].day1++;
        if (activeDay7 > 0) cohortData[cohortKey].day7++;
        if (activeDay14 > 0) cohortData[cohortKey].day14++;
        if (activeDay30 > 0) cohortData[cohortKey].day30++;
      }
      
      return Object.values(cohortData).map(cohort => ({
        ...cohort,
        day1Retention: ((cohort.day1 / cohort.totalUsers) * 100).toFixed(2),
        day7Retention: ((cohort.day7 / cohort.totalUsers) * 100).toFixed(2),
        day14Retention: ((cohort.day14 / cohort.totalUsers) * 100).toFixed(2),
        day30Retention: ((cohort.day30 / cohort.totalUsers) * 100).toFixed(2)
      }));
    }, CACHE_TTL.MEDIUM);
    
    return sendSuccess(res, 200, 'User retention data fetched successfully', { retention });
  } catch (error) {
    logger.error('Get user retention error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch user retention data');
  }
};

module.exports = {
  getAnalyticsSummary,
  getTimeSeriesData,
  getEventBreakdown,
  getTopFeatures,
  getDropOffPoints,
  getRecentEvents,
  getUserRetention
};

