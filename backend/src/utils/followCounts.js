const mongoose = require('mongoose');
const Follow = require('../models/Follow');
const logger = require('./logger');

const normalizeUserId = (userId) => {
  if (!userId) return null;
  if (typeof userId === 'string') return userId;
  if (userId._id) return normalizeUserId(userId._id);
  return userId.toString();
};

const getUserFollowCounts = async (userId, options = {}) => {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId || !mongoose.Types.ObjectId.isValid(normalizedUserId)) {
    return { followersCount: 0, followingCount: 0 };
  }

  const [followersCount, followingCount] = await Promise.all([
    Follow.countDocuments({ following: normalizedUserId, follower: { $ne: normalizedUserId } }),
    Follow.countDocuments({ follower: normalizedUserId, following: { $ne: normalizedUserId } }),
  ]);

  if (options.syncCache) {
    const User = mongoose.model('User');
    User.updateOne(
      { _id: normalizedUserId },
      { $set: { followersCount, followingCount } }
    ).catch((err) => {
      logger.warn('Failed to sync cached follow counts', {
        userId: normalizedUserId,
        error: err.message,
      });
    });
  }

  return { followersCount, followingCount };
};

module.exports = {
  getUserFollowCounts,
};
