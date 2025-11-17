const User = require('../models/User');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const { isValidUsername } = require('../utils/mentionExtractor');

// @desc    Search users for mention autocomplete
// @route   GET /api/v1/mentions/search
// @access  Private
const searchUsersForMention = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length === 0) {
      return sendSuccess(res, 200, 'Users fetched successfully', { users: [] });
    }

    const searchQuery = q.trim().toLowerCase();
    
    // Validate username format
    if (!isValidUsername(searchQuery)) {
      return sendSuccess(res, 200, 'Users fetched successfully', { users: [] });
    }

    // Search users by username or fullName
    const users = await User.find({
      $and: [
        { isVerified: true },
        {
          $or: [
            { username: { $regex: `^${searchQuery}`, $options: 'i' } },
            { fullName: { $regex: searchQuery, $options: 'i' } }
          ]
        }
      ]
    })
    .select('username fullName profilePic')
    .limit(parseInt(limit))
    .lean();

    // Format for autocomplete
    const formattedUsers = users.map(user => ({
      _id: user._id,
      username: user.username,
      fullName: user.fullName,
      profilePic: user.profilePic,
      displayName: user.fullName || user.username
    }));

    return sendSuccess(res, 200, 'Users fetched successfully', { 
      users: formattedUsers 
    });
  } catch (error) {
    logger.error('Search users for mention error:', error);
    return sendError(res, 'SRV_6001', 'Error searching users');
  }
};

module.exports = {
  searchUsersForMention
};

