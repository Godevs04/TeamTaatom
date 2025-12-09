const TripVisit = require('../models/TripVisit');
const User = require('../models/User');
const Post = require('../models/Post');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { TRUSTED_TRUST_LEVELS } = require('../config/tripScoreConfig');

/**
 * TripScore Analytics Controller
 * Provides analytics endpoints for SuperAdmin dashboard
 */

// @desc    Get TripScore overall statistics
// @route   GET /api/v1/superadmin/tripscore/stats
// @access  Private (SuperAdmin)
const getTripScoreStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Total TripVisit records
    const totalVisits = await TripVisit.countDocuments({
      ...dateFilter,
      isActive: true
    });

    // Breakdown by trust level
    const trustBreakdown = await TripVisit.aggregate([
      {
        $match: {
          ...dateFilter,
          isActive: true
        }
      },
      {
        $group: {
          _id: '$trustLevel',
          count: { $sum: 1 }
        }
      }
    ]);

    const trustLevels = {
      high: 0,
      medium: 0,
      low: 0,
      unverified: 0,
      suspicious: 0
    };

    trustBreakdown.forEach(item => {
      trustLevels[item._id] = item.count;
    });

    // Breakdown by source type
    const sourceBreakdown = await TripVisit.aggregate([
      {
        $match: {
          ...dateFilter,
          isActive: true
        }
      },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      }
    ]);

    const sources = {
      taatom_camera_live: 0,
      gallery_exif: 0,
      gallery_no_exif: 0,
      manual_only: 0
    };

    sourceBreakdown.forEach(item => {
      sources[item._id] = item.count;
    });

    // Total unique users with TripVisits
    const uniqueUsers = await TripVisit.distinct('user', {
      ...dateFilter,
      isActive: true
    });

    // Total unique places visited (deduplicated by lat/lng)
    const uniquePlaces = await TripVisit.aggregate([
      {
        $match: {
          ...dateFilter,
          isActive: true,
          trustLevel: { $in: TRUSTED_TRUST_LEVELS }
        }
      },
      {
        $group: {
          _id: {
            lat: { $round: ['$lat', 3] }, // Round to ~100m precision
            lng: { $round: ['$lng', 3] }
          }
        }
      },
      {
        $count: 'count'
      }
    ]);

    // Visits that count towards TripScore (high + medium trust)
    const trustedVisits = await TripVisit.countDocuments({
      ...dateFilter,
      isActive: true,
      trustLevel: { $in: TRUSTED_TRUST_LEVELS }
    });

    // Suspicious visits count
    const suspiciousVisits = await TripVisit.countDocuments({
      ...dateFilter,
      isActive: true,
      trustLevel: 'suspicious'
    });

    return sendSuccess(res, 200, 'TripScore statistics fetched successfully', {
      stats: {
        totalVisits,
        uniqueUsers: uniqueUsers.length,
        uniquePlaces: uniquePlaces[0]?.count || 0,
        trustedVisits,
        suspiciousVisits,
        trustBreakdown: trustLevels,
        sourceBreakdown: sources
      }
    });
  } catch (error) {
    logger.error('Get TripScore stats error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching TripScore statistics');
  }
};

// @desc    Get top users by TripScore
// @route   GET /api/v1/superadmin/tripscore/top-users
// @access  Private (SuperAdmin)
const getTopUsersByTripScore = async (req, res) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Aggregate unique trusted visits per user
    const topUsers = await TripVisit.aggregate([
      {
        $match: {
          ...dateFilter,
          isActive: true,
          trustLevel: { $in: TRUSTED_TRUST_LEVELS }
        }
      },
      {
        $group: {
          _id: {
            user: '$user',
            lat: { $round: ['$lat', 3] },
            lng: { $round: ['$lng', 3] }
          }
        }
      },
      {
        $group: {
          _id: '$_id.user',
          tripScore: { $sum: 1 },
          uniquePlaces: { $sum: 1 }
        }
      },
      {
        $sort: { tripScore: -1 }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userData'
        }
      },
      {
        $unwind: {
          path: '$userData',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          userId: '$_id',
          tripScore: 1,
          uniquePlaces: 1,
          fullName: '$userData.fullName',
          username: '$userData.username',
          profilePic: '$userData.profilePic',
          email: '$userData.email'
        }
      }
    ]);

    return sendSuccess(res, 200, 'Top users fetched successfully', {
      topUsers
    });
  } catch (error) {
    logger.error('Get top users error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching top users');
  }
};

// @desc    Get suspicious visits
// @route   GET /api/v1/superadmin/tripscore/suspicious-visits
// @access  Private (SuperAdmin)
const getSuspiciousVisits = async (req, res) => {
  try {
    const { limit = 50, page = 1, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const suspiciousVisits = await TripVisit.find({
      ...dateFilter,
      isActive: true,
      trustLevel: 'suspicious'
    })
    .populate('user', 'fullName username email profilePic')
    .populate('post', 'caption createdAt')
    .select('lat lng continent country address source trustLevel takenAt uploadedAt createdAt metadata')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

    const total = await TripVisit.countDocuments({
      ...dateFilter,
      isActive: true,
      trustLevel: 'suspicious'
    });

    return sendSuccess(res, 200, 'Suspicious visits fetched successfully', {
      suspiciousVisits,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get suspicious visits error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching suspicious visits');
  }
};

// @desc    Get trust level breakdown over time
// @route   GET /api/v1/superadmin/tripscore/trust-timeline
// @access  Private (SuperAdmin)
const getTrustTimeline = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Determine date grouping format
    let dateFormat;
    switch (groupBy) {
      case 'hour':
        dateFormat = { $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' } };
        break;
      case 'day':
        dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        break;
      case 'week':
        dateFormat = { $dateToString: { format: '%Y-W%V', date: '$createdAt' } };
        break;
      case 'month':
        dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      default:
        dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    }

    const timeline = await TripVisit.aggregate([
      {
        $match: {
          ...dateFilter,
          isActive: true
        }
      },
      {
        $group: {
          _id: {
            date: dateFormat,
            trustLevel: '$trustLevel'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    // Transform to chart-friendly format
    const chartData = {};
    timeline.forEach(item => {
      const date = item._id.date;
      const trustLevel = item._id.trustLevel;
      
      if (!chartData[date]) {
        chartData[date] = {
          date,
          high: 0,
          medium: 0,
          low: 0,
          unverified: 0,
          suspicious: 0
        };
      }
      
      chartData[date][trustLevel] = item.count;
    });

    return sendSuccess(res, 200, 'Trust timeline fetched successfully', {
      timeline: Object.values(chartData)
    });
  } catch (error) {
    logger.error('Get trust timeline error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching trust timeline');
  }
};

// @desc    Get continent breakdown
// @route   GET /api/v1/superadmin/tripscore/continents
// @access  Private (SuperAdmin)
const getContinentBreakdown = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const continentBreakdown = await TripVisit.aggregate([
      {
        $match: {
          ...dateFilter,
          isActive: true,
          trustLevel: { $in: TRUSTED_TRUST_LEVELS }
        }
      },
      {
        $group: {
          _id: {
            continent: '$continent',
            lat: { $round: ['$lat', 3] },
            lng: { $round: ['$lng', 3] }
          }
        }
      },
      {
        $group: {
          _id: '$_id.continent',
          uniquePlaces: { $sum: 1 },
          totalVisits: { $sum: 1 }
        }
      },
      {
        $sort: { uniquePlaces: -1 }
      }
    ]);

    return sendSuccess(res, 200, 'Continent breakdown fetched successfully', {
      continents: continentBreakdown
    });
  } catch (error) {
    logger.error('Get continent breakdown error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching continent breakdown');
  }
};

// @desc    Get detailed locations breakdown
// @route   GET /api/v1/superadmin/tripscore/locations
// @access  Private (SuperAdmin)
const getDetailedLocations = async (req, res) => {
  try {
    const { startDate, endDate, limit = 100, page = 1, groupBy = 'location' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    let locations = [];

    if (groupBy === 'location') {
      // Group by unique location (lat/lng)
      const locationGroups = await TripVisit.aggregate([
        {
          $match: {
            ...dateFilter,
            isActive: true,
            trustLevel: { $in: TRUSTED_TRUST_LEVELS }
          }
        },
        {
          $group: {
            _id: {
              lat: { $round: ['$lat', 3] },
              lng: { $round: ['$lng', 3] }
            },
            address: { $first: '$address' },
            country: { $first: '$country' },
            continent: { $first: '$continent' },
            city: { $first: '$city' },
            visitCount: { $sum: 1 },
            users: { $addToSet: '$user' },
            sources: { $push: '$source' },
            trustLevels: { $push: '$trustLevel' },
            firstVisit: { $min: '$createdAt' },
            lastVisit: { $max: '$createdAt' }
          }
        },
        {
          $project: {
            lat: '$_id.lat',
            lng: '$_id.lng',
            address: 1,
            country: 1,
            continent: 1,
            city: 1,
            visitCount: 1,
            uniqueUsers: { $size: '$users' },
            sources: 1,
            trustLevels: 1,
            firstVisit: 1,
            lastVisit: 1
          }
        },
        {
          $sort: { visitCount: -1 }
        },
        {
          $skip: skip
        },
        {
          $limit: parseInt(limit)
        }
      ]);

      locations = locationGroups;
    } else if (groupBy === 'user') {
      // Group by user
      const userGroups = await TripVisit.aggregate([
        {
          $match: {
            ...dateFilter,
            isActive: true,
            trustLevel: { $in: TRUSTED_TRUST_LEVELS }
          }
        },
        {
          $group: {
            _id: {
              user: '$user',
              lat: { $round: ['$lat', 3] },
              lng: { $round: ['$lng', 3] }
            }
          }
        },
        {
          $group: {
            _id: '$_id.user',
            uniquePlaces: { $sum: 1 },
            totalVisits: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userData'
          }
        },
        {
          $unwind: {
            path: '$userData',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            userId: '$_id',
            uniquePlaces: 1,
            totalVisits: 1,
            fullName: '$userData.fullName',
            username: '$userData.username',
            email: '$userData.email',
            profilePic: '$userData.profilePic'
          }
        },
        {
          $sort: { uniquePlaces: -1 }
        },
        {
          $skip: skip
        },
        {
          $limit: parseInt(limit)
        }
      ]);

      locations = userGroups;
    } else if (groupBy === 'country') {
      // Group by country
      const countryGroups = await TripVisit.aggregate([
        {
          $match: {
            ...dateFilter,
            isActive: true,
            trustLevel: { $in: TRUSTED_TRUST_LEVELS }
          }
        },
        {
          $group: {
            _id: {
              country: '$country',
              lat: { $round: ['$lat', 3] },
              lng: { $round: ['$lng', 3] }
            },
            continent: { $first: '$continent' }
          }
        },
        {
          $group: {
            _id: '$_id.country',
            continent: { $first: '$continent' },
            uniquePlaces: { $sum: 1 },
            totalVisits: { $sum: 1 },
            users: { $addToSet: '$user' }
          }
        },
        {
          $project: {
            country: '$_id',
            continent: 1,
            uniquePlaces: 1,
            totalVisits: 1,
            uniqueUsers: { $size: '$users' }
          }
        },
        {
          $sort: { uniquePlaces: -1 }
        },
        {
          $skip: skip
        },
        {
          $limit: parseInt(limit)
        }
      ]);

      locations = countryGroups;
    } else if (groupBy === 'state') {
      // Group by state/province (extract from address)
      const stateGroups = await TripVisit.aggregate([
        {
          $match: {
            ...dateFilter,
            isActive: true,
            trustLevel: { $in: TRUSTED_TRUST_LEVELS },
            address: { $exists: true, $ne: '' }
          }
        },
        {
          $addFields: {
            state: {
              $arrayElemAt: [
                {
                  $split: ['$address', ',']
                },
                1
              ]
            }
          }
        },
        {
          $match: {
            state: { $exists: true, $ne: null, $ne: '' }
          }
        },
        {
          $group: {
            _id: {
              state: { $trim: { input: '$state' } },
              country: '$country',
              lat: { $round: ['$lat', 3] },
              lng: { $round: ['$lng', 3] }
            },
            continent: { $first: '$continent' }
          }
        },
        {
          $group: {
            _id: {
              state: '$_id.state',
              country: '$_id.country'
            },
            continent: { $first: '$continent' },
            uniquePlaces: { $sum: 1 },
            totalVisits: { $sum: 1 },
            users: { $addToSet: '$user' }
          }
        },
        {
          $project: {
            state: '$_id.state',
            country: '$_id.country',
            continent: 1,
            uniquePlaces: 1,
            totalVisits: 1,
            uniqueUsers: { $size: '$users' }
          }
        },
        {
          $sort: { uniquePlaces: -1 }
        },
        {
          $skip: skip
        },
        {
          $limit: parseInt(limit)
        }
      ]);

      locations = stateGroups;
    }

    const total = await TripVisit.countDocuments({
      ...dateFilter,
      isActive: true,
      trustLevel: { $in: TRUSTED_TRUST_LEVELS }
    });

    return sendSuccess(res, 200, 'Detailed locations fetched successfully', {
      locations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      groupBy
    });
  } catch (error) {
    logger.error('Get detailed locations error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching detailed locations');
  }
};

module.exports = {
  getTripScoreStats,
  getTopUsersByTripScore,
  getSuspiciousVisits,
  getTrustTimeline,
  getContinentBreakdown,
  getDetailedLocations
};

