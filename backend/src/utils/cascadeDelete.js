const Post = require('../models/Post');
const User = require('../models/User');
const Like = require('../models/Like');
const Follow = require('../models/Follow');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');
const Hashtag = require('../models/Hashtag');
const Collection = require('../models/Collection');
const Report = require('../models/Report');
const Chat = require('../models/Chat');
const Comment = require('../models/Comment');
const ConnectPage = require('../models/ConnectPage');
const ConnectFollow = require('../models/ConnectFollow');
const { deleteImage } = require('../config/cloudinary');
const { deleteObject } = require('../services/storage');
const { deleteTripVisitForContent } = require('../services/tripVisitService');
const logger = require('./logger');
const mongoose = require('mongoose');

/**
 * Run a set of operations in a database transaction with a resilient fallback
 * if the environment doesn't support transactions (e.g. standalone MongoDB developer node).
 * @param {Function} fn - Async function to run in transaction, taking the session as argument
 * @returns {Promise<any>}
 */
const runInTransaction = async (fn) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    
    const result = await fn(session);
    
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        logger.error('Failed to abort transaction:', abortErr);
      }
    }
    
    const isNoReplicaSet = error.message && (
      error.message.includes('Replica Set member') ||
      error.message.includes('Transaction numbers are only allowed') ||
      error.message.includes('does not support sessions')
    );
    
    if (isNoReplicaSet) {
      logger.warn('MongoDB environment does not support replica set transactions. Falling back to non-transactional execution...');
      return await fn(null);
    }
    
    throw error;
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch (endErr) {
        logger.error('Failed to end Mongoose session:', endErr);
      }
    }
  }
};

const runCascadeDeletePost = async (postId, post = null, session = null) => {
  try {
    // Fetch post if not provided
    if (!post) {
      post = await Post.findById(postId).session(session);
      if (!post) {
        logger.warn(`Post ${postId} not found for cascade delete`);
        return;
      }
    }

    // Delete storage objects (Sevalla R2)
    // Priority: storageKey/storageKeys > cloudinaryPublicId/cloudinaryPublicIds (backward compatibility)
    const keysToDelete = [];
    
    if (post.storageKey) {
      keysToDelete.push(post.storageKey);
    }
    if (post.storageKeys && post.storageKeys.length > 0) {
      keysToDelete.push(...post.storageKeys);
    }
    // Backward compatibility: also try to delete old Cloudinary keys if storage keys don't exist
    if (keysToDelete.length === 0) {
      if (post.cloudinaryPublicId) {
        keysToDelete.push(post.cloudinaryPublicId);
      }
      if (post.cloudinaryPublicIds && post.cloudinaryPublicIds.length > 0) {
        keysToDelete.push(...post.cloudinaryPublicIds);
      }
    }
    
    // Delete all storage objects
    if (keysToDelete.length > 0) {
      await Promise.all(
        keysToDelete.map(async (key) => {
          try {
            await deleteObject(key);
            logger.debug(`Deleted storage object: ${key}`);
          } catch (error) {
            logger.error(`Error deleting storage object ${key}:`, error);
            // Try legacy Cloudinary delete as fallback
            try {
              await deleteImage(key);
              logger.debug(`Deleted Cloudinary image (legacy): ${key}`);
            } catch (cloudinaryError) {
              logger.error(`Error deleting Cloudinary image (legacy) ${key}:`, cloudinaryError);
            }
          }
        })
      );
    }

    // Delete notifications related to this post
    const notificationsDeleted = await Notification.deleteMany({ post: postId }, { session });
    logger.debug(`Deleted ${notificationsDeleted.deletedCount} notifications for post ${postId}`);

    // Delete activities related to this post
    const activitiesDeleted = await Activity.deleteMany({ post: postId }, { session });
    logger.debug(`Deleted ${activitiesDeleted.deletedCount} activities for post ${postId}`);

    // Update hashtags (decrement count, remove from recentPosts)
    if (post.tags && post.tags.length > 0) {
      await Promise.all(
        post.tags.map(async (tagName) => {
          try {
            const hashtag = await Hashtag.findOne({ name: tagName.toLowerCase() }).session(session);
            if (hashtag) {
              await hashtag.decrementPostCount();
              hashtag.recentPosts = hashtag.recentPosts.filter(
                (pid) => pid.toString() !== postId.toString()
              );
              await hashtag.save({ session });
              logger.debug(`Updated hashtag: ${tagName}`);
            }
          } catch (error) {
            logger.error(`Error updating hashtag ${tagName}:`, error);
          }
        })
      );
    }

    // Remove post from all collections (bookmarks are stored in collections)
    const collectionsUpdated = await Collection.updateMany(
      { posts: postId },
      { $pull: { posts: postId } },
      { session }
    );
    logger.debug(`Removed post ${postId} from ${collectionsUpdated.modifiedCount} collections (bookmarks)`);

    // Delete reports related to this post
    const reportsDeleted = await Report.deleteMany({ reportedContent: postId }, { session });
    logger.debug(`Deleted ${reportsDeleted.deletedCount} reports for post ${postId}`);

    // Delete standalone comments (if using separate Comment model)
    const commentsDeleted = await Comment.deleteMany({ post: postId }, { session });
    logger.debug(`Deleted ${commentsDeleted.deletedCount} standalone comments for post ${postId}`);

    // Delete TripVisits related to this post
    try {
      await deleteTripVisitForContent(postId, 'post');
      logger.debug(`Deleted TripVisits for post ${postId}`);
    } catch (error) {
      logger.error(`Error deleting TripVisits for post ${postId}:`, error);
    }

    // Delete video storage if it's a short
    if (post.type === 'short' && post.videoUrl) {
      // Extract storage key from videoUrl if it's a storage URL
      // Video storage keys might be in storageKey or need to be extracted from videoUrl
      if (post.storageKey && post.storageKey.includes('video')) {
        try {
          await deleteObject(post.storageKey);
          logger.debug(`Deleted video storage object: ${post.storageKey}`);
        } catch (error) {
          logger.error(`Error deleting video storage object ${post.storageKey}:`, error);
        }
      }
    }

    // Note: Embedded comments and likes in Post model are automatically removed when post is soft-deleted
    // They don't need explicit deletion as they're part of the post document

    // Update user's total likes count (decrement for each like)
    const postLikes = await Like.find({ post: postId }).session(session).select('user').lean();
    const likesCount = postLikes.length;
    if (likesCount > 0) {
      await User.findByIdAndUpdate(post.user, {
        $inc: { totalLikes: -likesCount }
      }, { session });
      await User.updateOne({ _id: post.user, totalLikes: { $lt: 0 } }, { $set: { totalLikes: 0 } }).session(session);
      logger.debug(`Updated user ${post.user} totalLikes (decremented by ${likesCount})`);
      
      // Delete associated Like documents
      await Like.deleteMany({ post: postId }, { session });
      logger.debug(`Deleted ${likesCount} Like documents for post ${postId}`);
    }

    // Note: Song reference in post.song.songId is just a reference, not ownership
    // Songs are shared resources, so we don't delete them when a post is deleted
    // The song will remain available for other posts

    logger.info(`Successfully cascade deleted post ${postId}`);
  } catch (error) {
    logger.error(`Error in runCascadeDeletePost for ${postId}:`, error);
    throw error;
  }
};

/**
 * Cascade delete all data related to a post
 * @param {String} postId - The post ID to delete
 * @param {Object} post - The post document (optional, will fetch if not provided)
 * @param {Object} parentSession - Optional parent database session/transaction
 */
const cascadeDeletePost = async (postId, post = null, parentSession = null) => {
  if (parentSession) {
    return await runCascadeDeletePost(postId, post, parentSession);
  }
  return await runInTransaction(async (session) => {
    return await runCascadeDeletePost(postId, post, session);
  });
};

const runCascadeDeleteUser = async (userId, session = null) => {
  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      logger.warn(`User ${userId} not found for cascade delete`);
      return;
    }

    // Get all user's posts first
    const userPosts = await Post.find({ user: userId }).session(session);

    // Cascade delete all posts (this will handle post-related data)
    await Promise.all(
      userPosts.map(async (post) => {
        try {
          await runCascadeDeletePost(post._id, post, session);
        } catch (error) {
          logger.error(`Error cascade deleting post ${post._id}:`, error);
          throw error; // Re-throw to trigger rollback of user deletion transaction
        }
      })
    );

    // Soft delete all posts (mark as inactive) - cascade delete already handled individual posts
    // This is just a safety measure in case any posts were missed
    await Post.updateMany({ user: userId, isActive: true }, { isActive: false }, { session });
    logger.debug(`Soft deleted remaining posts for user ${userId}`);

    // Delete standalone comments by this user
    const commentsDeleted = await Comment.deleteMany({ user: userId }, { session });
    logger.debug(`Deleted ${commentsDeleted.deletedCount} comments by user ${userId}`);

    // Remove user's comments from all posts (embedded comments)
    await Post.updateMany(
      { 'comments.user': userId },
      { $pull: { comments: { user: userId } } },
      { session }
    );
    logger.debug(`Removed embedded comments by user ${userId}`);

    // Find all likes by this user
    const userLikes = await Like.find({ user: userId }).session(session).select('post').lean();
    const postIdsLiked = userLikes.map(l => l.post);
    
    if (postIdsLiked.length > 0) {
      const postsLiked = await Post.find({ _id: { $in: postIdsLiked } }).session(session).select('_id user').lean();
      
      // Decrement likesCount on all affected posts
      await Post.updateMany({ _id: { $in: postIdsLiked } }, { $inc: { likesCount: -1 } }, { session });
      logger.debug(`Decremented likesCount for ${postIdsLiked.length} posts liked by user ${userId}`);
      
      // Group posts by owner to decrement totalLikes
      const ownerLikesDecrement = {};
      for (const p of postsLiked) {
        if (p.user) {
          const ownerId = p.user.toString();
          ownerLikesDecrement[ownerId] = (ownerLikesDecrement[ownerId] || 0) + 1;
        }
      }
      for (const [ownerId, count] of Object.entries(ownerLikesDecrement)) {
        await User.findByIdAndUpdate(ownerId, { $inc: { totalLikes: -count } }, { session });
        await User.updateOne({ _id: ownerId, totalLikes: { $lt: 0 } }, { $set: { totalLikes: 0 } }).session(session);
      }
      logger.debug(`Decremented totalLikes for ${Object.keys(ownerLikesDecrement).length} post owners`);
      
      // Delete Like documents
      await Like.deleteMany({ user: userId }, { session });
      logger.debug(`Deleted ${userLikes.length} Like documents by user ${userId}`);
    }

    // Delete all notifications (both fromUser and toUser)
    const notificationsDeleted = await Notification.deleteMany({
      $or: [{ fromUser: userId }, { toUser: userId }]
    }, { session });
    logger.debug(`Deleted ${notificationsDeleted.deletedCount} notifications for user ${userId}`);

    // Delete all activities (both user and targetUser)
    const activitiesDeleted = await Activity.deleteMany({
      $or: [{ user: userId }, { targetUser: userId }]
    }, { session });
    logger.debug(`Deleted ${activitiesDeleted.deletedCount} activities for user ${userId}`);

    // Delete all collections
    const collectionsDeleted = await Collection.deleteMany({ user: userId }, { session });
    logger.debug(`Deleted ${collectionsDeleted.deletedCount} collections for user ${userId}`);

    // Delete all reports (both reportedBy and reportedUser)
    const reportsDeleted = await Report.deleteMany({
      $or: [{ reportedBy: userId }, { reportedUser: userId }]
    }, { session });
    logger.debug(`Deleted ${reportsDeleted.deletedCount} reports for user ${userId}`);

    // Delete or update chats (remove user from participants)
    const chatsUpdated = await Chat.updateMany(
      { participants: userId },
      { $pull: { participants: userId } },
      { session }
    );
    logger.debug(`Removed user ${userId} from ${chatsUpdated.modifiedCount} chats`);

    // Delete chats where user is the only participant
    await Chat.deleteMany({ participants: { $size: 0 } }, { session });
    logger.debug(`Deleted empty chats`);

    // Find follow relationships where the user is a follower or followed
    const followsAsFollower = await Follow.find({ follower: userId }).session(session).select('following').lean();
    const followsAsFollowing = await Follow.find({ following: userId }).session(session).select('follower').lean();
    
    const followedUserIds = followsAsFollower.map(f => f.following);
    const followerUserIds = followsAsFollowing.map(f => f.follower);
    
    // Decrement followersCount for users followed by this user
    if (followedUserIds.length > 0) {
      await User.updateMany({ _id: { $in: followedUserIds } }, { $inc: { followersCount: -1 } }, { session });
    }
    
    // Decrement followingCount for users who follow this user
    if (followerUserIds.length > 0) {
      await User.updateMany({ _id: { $in: followerUserIds } }, { $inc: { followingCount: -1 } }, { session });
    }
    
    // Delete Follow relationships
    await Follow.deleteMany({
      $or: [
        { follower: userId },
        { following: userId }
      ]
    }, { session });
    logger.debug(`Removed user ${userId} follow relationships and updated counts`);

    // Remove user from follow requests
    await User.updateMany(
      { 'followRequests.user': userId },
      { $pull: { followRequests: { user: userId } } },
      { session }
    );
    await User.updateMany(
      { 'sentFollowRequests.user': userId },
      { $pull: { sentFollowRequests: { user: userId } } },
      { session }
    );
    logger.debug(`Removed user ${userId} from follow requests`);

    // Remove user from blocked users lists
    await User.updateMany(
      { blockedUsers: userId },
      { $pull: { blockedUsers: userId } },
      { session }
    );
    logger.debug(`Removed user ${userId} from blocked users lists`);

    // Connect-page cleanup
    try {
      // Pages they OWN
      const ownedPages = await ConnectPage.find({ userId }).session(session).select('_id').lean();
      const ownedPageIds = ownedPages.map((p) => p._id);
      if (ownedPageIds.length > 0) {
        await ConnectFollow.deleteMany({ connectPageId: { $in: ownedPageIds } }, { session });
        await ConnectPage.deleteMany({ _id: { $in: ownedPageIds } }, { session });
        logger.debug(`Deleted ${ownedPageIds.length} ConnectPages owned by ${userId} and all their follows`);
      }

      // Pages they FOLLOW
      const followedPages = await ConnectFollow.find({ followerId: userId })
        .session(session)
        .select('connectPageId')
        .lean();
      const affectedPageIds = [...new Set(followedPages.map((f) => f.connectPageId.toString()))];
      if (affectedPageIds.length > 0) {
        await ConnectFollow.deleteMany({ followerId: userId }, { session });
        await Promise.all(
          affectedPageIds.map(async (pageId) => {
            try {
              const liveCount = await ConnectFollow.countDocuments({
                connectPageId: pageId,
                status: 'active'
              }).session(session);
              await ConnectPage.findByIdAndUpdate(pageId, { $set: { followerCount: liveCount } }, { session });
            } catch (e) {
              logger.warn(`Failed to resync followerCount for page ${pageId}:`, e);
            }
          })
        );
        logger.debug(`Removed ${userId} from ${affectedPageIds.length} ConnectFollows and resynced counts`);
      }
    } catch (e) {
      logger.error(`ConnectPage / ConnectFollow cascade cleanup failed for user ${userId}:`, e);
      throw e; // Re-throw to trigger rollback of user deletion transaction
    }

    logger.info(`Successfully cascade deleted user ${userId}`);
  } catch (error) {
    logger.error(`Error in runCascadeDeleteUser for ${userId}:`, error);
    throw error;
  }
};

/**
 * Cascade delete all data related to a user
 * @param {String} userId - The user ID to delete
 * @param {Object} parentSession - Optional parent database session/transaction
 */
const cascadeDeleteUser = async (userId, parentSession = null) => {
  if (parentSession) {
    return await runCascadeDeleteUser(userId, parentSession);
  }
  return await runInTransaction(async (session) => {
    return await runCascadeDeleteUser(userId, session);
  });
};

module.exports = {
  cascadeDeletePost,
  cascadeDeleteUser
};

