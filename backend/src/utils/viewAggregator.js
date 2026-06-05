const Post = require('../models/Post');
const logger = require('./logger');
const { deleteCache, CacheKeys } = require('./cache');

// In-memory store for pending view increments: postId -> incrementCount
const pendingViews = new Map();
let flushInterval = null;

const addView = (postId) => {
  if (!postId) return;
  const idStr = postId.toString();
  pendingViews.set(idStr, (pendingViews.get(idStr) || 0) + 1);
  
  // Start the background worker flush interval if it's not already running
  if (!flushInterval) {
    flushInterval = setInterval(flush, 10000); // 10 seconds
  }
};

const flush = async () => {
  if (pendingViews.size === 0) return;

  const copy = new Map(pendingViews);
  pendingViews.clear();

  logger.info(`[VIEW AGGREGATOR] Committing view increments for ${copy.size} posts to database...`);

  const operations = [];
  for (const [postId, count] of copy.entries()) {
    operations.push({
      updateOne: {
        filter: { _id: postId },
        update: { $inc: { views: count } }
      }
    });
  }

  try {
    const result = await Post.bulkWrite(operations, { ordered: false });
    logger.info(`[VIEW AGGREGATOR] Bulk update finished successfully. Modified: ${result.nModified || 0} posts.`);

    const postIds = Array.from(copy.keys());
    
    // Invalidate post detail caches in parallel
    const deletePromises = postIds.map(postId => deleteCache(CacheKeys.post(postId)).catch(() => {}));
    await Promise.all(deletePromises);

    // Fetch the updated view counts from the database to broadcast exact state to the clients
    const updatedPosts = await Post.find({ _id: { $in: postIds } }).select('views').lean();

    // Broadcast updated view counts via Socket.IO
    const io = global.socketIO;
    const nsp = io?.of?.('/app');
    if (nsp) {
      for (const post of updatedPosts) {
        const postIdStr = post._id.toString();
        try {
          nsp.emitPostView(postIdStr, post.views, null);
        } catch (socketError) {
          logger.debug(`[VIEW AGGREGATOR] Failed to emit Socket.IO view update for ${postIdStr}:`, socketError);
        }
      }
    }
  } catch (error) {
    logger.error('[VIEW AGGREGATOR] Error flushing view increments to database:', error);
    
    // Restore the counts in memory so they are not lost on temporary DB failure
    for (const [postId, count] of copy.entries()) {
      pendingViews.set(postId, (pendingViews.get(postId) || 0) + count);
    }
  }
};

const shutdown = async () => {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
  await flush();
};

module.exports = {
  addView,
  flush,
  shutdown
};
