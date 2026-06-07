const UserInteraction = require('../models/UserInteraction');
const Post = require('../models/Post');
const { sendSuccess, sendError } = require('../utils/errorCodes');
const logger = require('../utils/logger');

// @desc    Record user interaction with a post (telemetry)
// @route   POST /api/v1/telemetry/interaction
// @access  Private
const recordInteraction = async (req, res) => {
  try {
    const userId = req.user._id;
    const { interactions } = req.body; // Array of { postId, watchDurationMs, completionRate, action }

    if (!Array.isArray(interactions) || interactions.length === 0) {
      return sendError(res, 'VAL_2001', 'Interactions array is required');
    }

    let userInteraction = await UserInteraction.findOne({ user: userId });
    if (!userInteraction) {
      userInteraction = new UserInteraction({ user: userId });
    }

    // Keep viewedPosts capped at 500
    const MAX_VIEWED_POSTS = 500;

    for (const item of interactions) {
      const { postId, watchDurationMs, completionRate, action } = item;
      
      if (!postId) continue;

      // Add to viewed posts if action is 'view'
      if (action === 'view' || !action) {
        // Remove if already exists so we can push to the end (most recent)
        userInteraction.viewedPosts = userInteraction.viewedPosts.filter(
          vp => vp.postId.toString() !== postId.toString()
        );
        userInteraction.viewedPosts.push({ postId, viewedAt: new Date() });
      }

      // Calculate score delta based on interaction quality
      let scoreDelta = 0;
      
      // Base score from completion rate (0.0 to 1.0)
      if (completionRate !== undefined) {
        if (completionRate >= 0.8) scoreDelta += 2; // high completion
        else if (completionRate >= 0.5) scoreDelta += 1; // medium completion
        else if (completionRate < 0.2) scoreDelta -= 1; // skipped early
      }

      if (action === 'like') scoreDelta += 3;
      if (action === 'share') scoreDelta += 4;

      // Apply delta to affinities if we have a non-zero score change
      if (scoreDelta !== 0) {
        try {
          const post = await Post.findById(postId).select('spotType travelInfo user');
          if (post) {
            // Update Spot Type affinity
            if (post.spotType) {
              const currentScore = userInteraction.spotTypeAffinities.get(post.spotType) || 0;
              userInteraction.spotTypeAffinities.set(post.spotType, currentScore + scoreDelta);
            }
            
            // Update Travel Info affinity
            if (post.travelInfo) {
              const currentScore = userInteraction.travelInfoAffinities.get(post.travelInfo) || 0;
              userInteraction.travelInfoAffinities.set(post.travelInfo, currentScore + scoreDelta);
            }

            // Update Creator affinity
            if (post.user) {
              const creatorIdStr = post.user.toString();
              const currentScore = userInteraction.creatorAffinities.get(creatorIdStr) || 0;
              userInteraction.creatorAffinities.set(creatorIdStr, currentScore + scoreDelta);
            }
          }
        } catch (postErr) {
          logger.warn(`Could not fetch post ${postId} for telemetry affinities`);
        }
      }
    }

    // Enforce cap on viewedPosts
    if (userInteraction.viewedPosts.length > MAX_VIEWED_POSTS) {
      userInteraction.viewedPosts = userInteraction.viewedPosts.slice(-MAX_VIEWED_POSTS);
    }

    await userInteraction.save();

    return sendSuccess(res, 200, 'Interactions recorded successfully');
  } catch (error) {
    logger.error('Record interaction error:', error);
    return sendError(res, 'SRV_6001', 'Error recording interactions');
  }
};

module.exports = {
  recordInteraction
};
