const mongoose = require('mongoose');
const Follow = require('../models/Follow');
const logger = require('./logger');

/**
 * Normalize any user id shape to a 24-char hex string.
 * Mongoose ObjectId exposes an `_id` getter that returns another ObjectId,
 * so naive `userId._id` recursion overflows the stack — handle ObjectId first.
 */
const normalizeUserId = (userId) => {
  if (!userId) return null;

  if (typeof userId === 'string') {
    const trimmed = userId.trim();
    return mongoose.Types.ObjectId.isValid(trimmed) ? trimmed : null;
  }

  if (userId instanceof mongoose.Types.ObjectId) {
    return userId.toString();
  }

  if (typeof userId.toString === 'function') {
    const asString = userId.toString();
    if (mongoose.Types.ObjectId.isValid(asString)) {
      return asString;
    }
  }

  if (userId._id && userId._id !== userId) {
    return normalizeUserId(userId._id);
  }

  return null;
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
