const User = require('../models/User');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const { isValidUsername } = require('../utils/mentionExtractor');
const { escapeRegex } = require('../utils/regexEscape');

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

    // isValidUsername restricts searchQuery to [a-z0-9_.], but "." is itself a
    // regex metacharacter (matches any character) -- escape so a literal dot
    // in a username only matches a literal dot.
    const escapedQuery = escapeRegex(searchQuery);

    const currentUserId = req.user?._id;
    const excludeIds = [];
    if (currentUserId) {
      excludeIds.push(currentUserId);
      const [currentUserDoc, whoBlockedMe] = await Promise.all([
        User.findById(currentUserId).select('blockedUsers').lean(),
        User.find({ blockedUsers: currentUserId }).select('_id').lean()
      ]);
      const myBlocked = currentUserDoc?.blockedUsers || [];
      const blockedMeIds = whoBlockedMe.map(u => u._id);
      excludeIds.push(...myBlocked, ...blockedMeIds);
    }

    // Search users by username or fullName
    const matchConditions = [
      { isVerified: true },
      {
        $or: [
          { username: { $regex: `^${escapedQuery}`, $options: 'i' } },
          { fullName: { $regex: escapedQuery, $options: 'i' } }
        ]
      }
    ];

    if (excludeIds.length > 0) {
      matchConditions.push({ _id: { $nin: excludeIds } });
    }

    const users = await User.find({
      $and: matchConditions
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

