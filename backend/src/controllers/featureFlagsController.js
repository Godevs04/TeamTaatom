const FeatureFlag = require('../models/FeatureFlag');
const logger = require('../utils/logger');

// @desc    Get feature flags for user
// @route   GET /feature-flags
// @access  Private
const getFeatureFlags = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const platform = req.query.platform || 'unknown';

    // Get all active feature flags
    const flags = await FeatureFlag.find({ isActive: true }).lean();

    const userFlags = flags
      .filter(flag => {
        // Check date range
        const now = new Date();
        if (flag.startDate && now < flag.startDate) return false;
        if (flag.endDate && now > flag.endDate) return false;

        // Check platform targeting
        if (flag.targetPlatforms.length > 0 && !flag.targetPlatforms.includes(platform)) {
          return false;
        }

        // Check user targeting
        if (flag.targetUsers.length > 0 && !flag.targetUsers.includes(userId)) {
          return false;
        }

        // Check rollout percentage
        if (flag.rolloutPercentage < 100) {
          // Simple hash-based rollout
          const hash = hashUserId(userId, flag.name);
          const percentage = (hash % 100) + 1;
          if (percentage > flag.rolloutPercentage) {
            return false;
          }
        }

        return true;
      })
      .map(flag => ({
        name: flag.name,
        enabled: flag.enabled,
        variant: flag.variant,
        metadata: flag.metadata ? Object.fromEntries(flag.metadata) : {},
      }));

    res.json({
      success: true,
      flags: userFlags,
    });
  } catch (error) {
    logger.error('Error getting feature flags:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get feature flags'
    });
  }
};

// Simple hash function for consistent user assignment
function hashUserId(userId, flagName) {
  const str = `${userId}_${flagName}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// @desc    Create or update feature flag (Admin only)
// @route   POST /feature-flags
// @access  Private (Admin)
const createFeatureFlag = async (req, res) => {
  try {
    const {
      name,
      enabled,
      variant,
      metadata,
      targetUsers,
      targetPlatforms,
      rolloutPercentage,
      startDate,
      endDate,
    } = req.body;

    const flag = await FeatureFlag.findOneAndUpdate(
      { name },
      {
        enabled: enabled !== undefined ? enabled : false,
        variant: variant || null,
        metadata: metadata || {},
        targetUsers: targetUsers || [],
        targetPlatforms: targetPlatforms || [],
        rolloutPercentage: rolloutPercentage !== undefined ? rolloutPercentage : 100,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: true,
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      flag,
    });
  } catch (error) {
    logger.error('Error creating feature flag:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to create feature flag'
    });
  }
};

// @desc    Get all feature flags (Admin only)
// @route   GET /feature-flags/all
// @access  Private (Admin)
const getAllFeatureFlags = async (req, res) => {
  try {
    const flags = await FeatureFlag.find().sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      flags,
    });
  } catch (error) {
    logger.error('Error getting all feature flags:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to get feature flags'
    });
  }
};

module.exports = {
  getFeatureFlags,
  createFeatureFlag,
  getAllFeatureFlags,
};

