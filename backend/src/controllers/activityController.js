const Activity = require('../models/Activity');
const User = require('../models/User');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');

// @desc    Get activity feed
// @route   GET /api/v1/activity
// @access  Private
const getActivityFeed = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type,
      includeOwn = true 
    } = req.query;

    const userId = req.user._id.toString();

    const result = await Activity.getActivityFeed(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      type: type || null,
      includeOwn: includeOwn === 'true' || includeOwn === true
    });

    return sendSuccess(res, 200, 'Activity feed fetched successfully', result);
  } catch (error) {
    logger.error('Get activity feed error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching activity feed');
  }
};

// @desc    Get user's activity
// @route   GET /api/v1/activity/user/:userId
// @access  Public
const getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Check if user exists
    const user = await User.findById(userId).select('_id').lean();
    if (!user) {
      return sendError(res, 'RES_3001', 'User not found');
    }

    // Check privacy settings
    const fullUser = await User.findById(userId).select('settings.privacy.profileVisibility').lean();
    const isPublic = fullUser?.settings?.privacy?.profileVisibility !== 'private';
    
    // If private and not the owner, return empty
    if (!isPublic && userId !== req.user?._id?.toString()) {
      return sendSuccess(res, 200, 'Activity fetched successfully', {
        activities: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalActivities: 0,
          hasNextPage: false,
          limit: parseInt(limit)
        }
      });
    }

    const query = { user: userId, isPublic: true };
    if (type) {
      query.type = type;
    }

    const activities = await Activity.find(query)
      .populate('user', 'fullName profilePic username')
      .populate('targetUser', 'fullName profilePic username')
      .populate('post', 'imageUrl caption type')
      .populate('collection', 'name coverImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalActivities = await Activity.countDocuments(query).lean();

    return sendSuccess(res, 200, 'User activity fetched successfully', {
      activities,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalActivities / parseInt(limit)),
        totalActivities,
        hasNextPage: skip + parseInt(limit) < totalActivities,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Get user activity error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching user activity');
  }
};

// @desc    Update activity privacy
// @route   PUT /api/v1/activity/privacy
// @access  Private
const updateActivityPrivacy = async (req, res) => {
  try {
    const { isPublic } = req.body;
    const userId = req.user._id.toString();

    // Update all user's activities
    await Activity.updateMany(
      { user: userId },
      { isPublic: isPublic !== undefined ? isPublic : true }
    );

    // Also update user's privacy setting
    await User.findByIdAndUpdate(userId, {
      'settings.privacy.shareActivity': isPublic !== undefined ? isPublic : true
    });

    return sendSuccess(res, 200, 'Activity privacy updated successfully');
  } catch (error) {
    logger.error('Update activity privacy error:', error);
    return sendError(res, 'SRV_6001', 'Error updating activity privacy');
  }
};

module.exports = {
  getActivityFeed,
  getUserActivity,
  updateActivityPrivacy
};

