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
    
    // Normalise input to handle both array and single interaction formats
    let interactions = req.body.interactions;
    if (!interactions) {
      if (req.body.postId) {
        interactions = [{
          postId: req.body.postId,
          action: req.body.interactionType || req.body.action || 'view',
          watchDuration: req.body.watchDuration,
          completionRate: req.body.completionRate,
          isRewatched: req.body.isRewatched
        }];
      } else {
        return sendError(res, 'VAL_2001', 'Interactions array or single interaction object is required');
      }
    }

    if (!Array.isArray(interactions) || interactions.length === 0) {
      return sendError(res, 'VAL_2001', 'Interactions must be a non-empty array');
    }

    let userInteraction = await UserInteraction.findOne({ user: userId });
    if (!userInteraction) {
      userInteraction = new UserInteraction({ user: userId });
    }

    if (!userInteraction.tagAffinities) {
      userInteraction.tagAffinities = new Map();
    }
    if (!userInteraction.spotTypeAffinities) {
      userInteraction.spotTypeAffinities = new Map();
    }
    if (!userInteraction.travelInfoAffinities) {
      userInteraction.travelInfoAffinities = new Map();
    }
    if (!userInteraction.creatorAffinities) {
      userInteraction.creatorAffinities = new Map();
    }

    const MAX_VIEWED_POSTS = 500;

    for (const item of interactions) {
      const { postId, action } = item;
      if (!postId) continue;

      try {
        const post = await Post.findById(postId).populate('song.songId');
        if (!post) continue;

        let watchDuration = item.watchDuration || (item.watchDurationMs ? item.watchDurationMs / 1000 : 0);
        let completionRate = item.completionRate;
        let videoDuration = 15; // default 15 seconds

        if (post.song && post.song.startTime && post.song.endTime) {
          videoDuration = post.song.endTime - post.song.startTime;
        } else if (post.song && post.song.songId && post.song.songId.duration) {
          videoDuration = Math.min(post.song.songId.duration, 60);
        }

        if (completionRate === undefined && watchDuration > 0 && videoDuration > 0) {
          completionRate = watchDuration / videoDuration;
        }

        // Calculate score delta based on interaction quality
        let scoreDelta = 0;
        const isSkip = (action === 'skip') || (watchDuration > 0 && watchDuration <= 2.0);
        const isRewatched = (completionRate >= 1.8) || (action === 'rewatch') || item.isRewatched === true;

        if (isSkip) {
          scoreDelta = -2;
        } else {
          if (completionRate >= 0.95) scoreDelta += 3;
          else if (completionRate >= 0.80) scoreDelta += 2;
          else if (completionRate >= 0.50) scoreDelta += 1;

          if (isRewatched) scoreDelta += 4;
        }

        if (action === 'like') scoreDelta += 2;
        if (action === 'comment') scoreDelta += 3;
        if (action === 'share') scoreDelta += 5;
        if (action === 'save') scoreDelta += 5;

        // Update post metrics
        if (action === 'view' || !action) {
          post.views = (post.views || 0) + 1;
          if (completionRate >= 0.95) {
            post.completionsCount = (post.completionsCount || 0) + 1;
          }
          if (isRewatched) {
            post.rewatchesCount = (post.rewatchesCount || 0) + 1;
          }
        } else if (action === 'share') {
          post.sharesCount = (post.sharesCount || 0) + 1;
        } else if (action === 'save') {
          post.savesCount = (post.savesCount || 0) + 1;
        }

        await post.save();

        // Add to viewed posts if seen threshold met
        const shouldMarkSeen = (action === 'skip') || (completionRate >= 0.5) || ['like', 'share', 'save', 'comment'].includes(action);
        if (shouldMarkSeen) {
          userInteraction.viewedPosts = userInteraction.viewedPosts.filter(
            vp => vp.postId.toString() !== postId.toString()
          );
          userInteraction.viewedPosts.push({ postId, viewedAt: new Date() });
        }

        // Apply scoreDelta to User affinities
        if (scoreDelta !== 0) {
          if (post.spotType) {
            const currentScore = userInteraction.spotTypeAffinities.get(post.spotType) || 0;
            userInteraction.spotTypeAffinities.set(post.spotType, currentScore + scoreDelta);
          }
          if (post.travelInfo) {
            const currentScore = userInteraction.travelInfoAffinities.get(post.travelInfo) || 0;
            userInteraction.travelInfoAffinities.set(post.travelInfo, currentScore + scoreDelta);
          }
          if (post.user) {
            const creatorIdStr = post.user.toString();
            const currentScore = userInteraction.creatorAffinities.get(creatorIdStr) || 0;
            userInteraction.creatorAffinities.set(creatorIdStr, currentScore + scoreDelta);
          }
          if (Array.isArray(post.tags) && post.tags.length > 0) {
            post.tags.forEach(tag => {
              const lowerTag = tag.toLowerCase().trim();
              if (lowerTag) {
                const currentScore = userInteraction.tagAffinities.get(lowerTag) || 0;
                userInteraction.tagAffinities.set(lowerTag, currentScore + scoreDelta);
              }
            });
          }
        }
      } catch (itemErr) {
        logger.warn(`Error processing telemetry item for post ${postId}:`, itemErr.message);
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
