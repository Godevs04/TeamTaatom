const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');
const Hashtag = require('../models/Hashtag');
const Collection = require('../models/Collection');
const Report = require('../models/Report');
const Chat = require('../models/Chat');
const Comment = require('../models/Comment');
const { deleteImage } = require('../config/cloudinary');
const { deleteObject } = require('../services/storage');
const logger = require('./logger');

/**
 * Cascade delete all data related to a post
 * @param {String} postId - The post ID to delete
 * @param {Object} post - The post document (optional, will fetch if not provided)
 */
const cascadeDeletePost = async (postId, post = null) => {
  try {
    // Fetch post if not provided
    if (!post) {
      post = await Post.findById(postId);
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
    const notificationsDeleted = await Notification.deleteMany({ post: postId });
    logger.debug(`Deleted ${notificationsDeleted.deletedCount} notifications for post ${postId}`);

    // Delete activities related to this post
    const activitiesDeleted = await Activity.deleteMany({ post: postId });
    logger.debug(`Deleted ${activitiesDeleted.deletedCount} activities for post ${postId}`);

    // Update hashtags (decrement count, remove from recentPosts)
    if (post.tags && post.tags.length > 0) {
      await Promise.all(
        post.tags.map(async (tagName) => {
          try {
            const hashtag = await Hashtag.findOne({ name: tagName.toLowerCase() });
            if (hashtag) {
              await hashtag.decrementPostCount();
              hashtag.recentPosts = hashtag.recentPosts.filter(
                (pid) => pid.toString() !== postId.toString()
              );
              await hashtag.save();
              logger.debug(`Updated hashtag: ${tagName}`);
            }
          } catch (error) {
            logger.error(`Error updating hashtag ${tagName}:`, error);
          }
        })
      );
    }

    // Remove post from all collections
    const collectionsUpdated = await Collection.updateMany(
      { posts: postId },
      { $pull: { posts: postId } }
    );
    logger.debug(`Removed post ${postId} from ${collectionsUpdated.modifiedCount} collections`);

    // Delete reports related to this post
    const reportsDeleted = await Report.deleteMany({ reportedContent: postId });
    logger.debug(`Deleted ${reportsDeleted.deletedCount} reports for post ${postId}`);

    // Delete standalone comments (if using separate Comment model)
    const commentsDeleted = await Comment.deleteMany({ post: postId });
    logger.debug(`Deleted ${commentsDeleted.deletedCount} standalone comments for post ${postId}`);

    // Update user's total likes count
    if (post.likes && post.likes.length > 0) {
      await User.findByIdAndUpdate(post.user, {
        $inc: { totalLikes: -post.likes.length }
      });
      logger.debug(`Updated user ${post.user} totalLikes`);
    }

    logger.info(`Successfully cascade deleted post ${postId}`);
  } catch (error) {
    logger.error(`Error in cascadeDeletePost for ${postId}:`, error);
    throw error;
  }
};

/**
 * Cascade delete all data related to a user
 * @param {String} userId - The user ID to delete
 */
const cascadeDeleteUser = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`User ${userId} not found for cascade delete`);
      return;
    }

    // Get all user's posts first
    const userPosts = await Post.find({ user: userId });
    const postIds = userPosts.map((p) => p._id);

    // Cascade delete all posts (this will handle post-related data)
    await Promise.all(
      userPosts.map(async (post) => {
        try {
          await cascadeDeletePost(post._id, post);
        } catch (error) {
          logger.error(`Error cascade deleting post ${post._id}:`, error);
        }
      })
    );

    // Soft delete all posts (mark as inactive) - cascade delete already handled individual posts
    // This is just a safety measure in case any posts were missed
    await Post.updateMany({ user: userId, isActive: true }, { isActive: false });
    logger.debug(`Soft deleted remaining posts for user ${userId}`);

    // Delete standalone comments by this user
    const commentsDeleted = await Comment.deleteMany({ user: userId });
    logger.debug(`Deleted ${commentsDeleted.deletedCount} comments by user ${userId}`);

    // Remove user's comments from all posts (embedded comments)
    await Post.updateMany(
      { 'comments.user': userId },
      { $pull: { comments: { user: userId } } }
    );
    logger.debug(`Removed embedded comments by user ${userId}`);

    // Remove user from all posts' likes arrays
    await Post.updateMany({ likes: userId }, { $pull: { likes: userId } });
    logger.debug(`Removed user ${userId} from all post likes`);

    // Delete all notifications (both fromUser and toUser)
    const notificationsDeleted = await Notification.deleteMany({
      $or: [{ fromUser: userId }, { toUser: userId }]
    });
    logger.debug(`Deleted ${notificationsDeleted.deletedCount} notifications for user ${userId}`);

    // Delete all activities (both user and targetUser)
    const activitiesDeleted = await Activity.deleteMany({
      $or: [{ user: userId }, { targetUser: userId }]
    });
    logger.debug(`Deleted ${activitiesDeleted.deletedCount} activities for user ${userId}`);

    // Delete all collections
    const collectionsDeleted = await Collection.deleteMany({ user: userId });
    logger.debug(`Deleted ${collectionsDeleted.deletedCount} collections for user ${userId}`);

    // Delete all reports (both reportedBy and reportedUser)
    const reportsDeleted = await Report.deleteMany({
      $or: [{ reportedBy: userId }, { reportedUser: userId }]
    });
    logger.debug(`Deleted ${reportsDeleted.deletedCount} reports for user ${userId}`);

    // Delete or update chats (remove user from participants)
    const chatsUpdated = await Chat.updateMany(
      { participants: userId },
      { $pull: { participants: userId } }
    );
    logger.debug(`Removed user ${userId} from ${chatsUpdated.modifiedCount} chats`);

    // Delete chats where user is the only participant
    await Chat.deleteMany({ participants: { $size: 0 } });
    logger.debug(`Deleted empty chats`);

    // Remove user from all followers/following lists
    await User.updateMany(
      { followers: userId },
      { $pull: { followers: userId } }
    );
    await User.updateMany(
      { following: userId },
      { $pull: { following: userId } }
    );
    logger.debug(`Removed user ${userId} from followers/following lists`);

    // Remove user from follow requests
    await User.updateMany(
      { 'followRequests.user': userId },
      { $pull: { followRequests: { user: userId } } }
    );
    await User.updateMany(
      { 'sentFollowRequests.user': userId },
      { $pull: { sentFollowRequests: { user: userId } } }
    );
    logger.debug(`Removed user ${userId} from follow requests`);

    // Remove user from blocked users lists
    await User.updateMany(
      { blockedUsers: userId },
      { $pull: { blockedUsers: userId } }
    );
    logger.debug(`Removed user ${userId} from blocked users lists`);

    logger.info(`Successfully cascade deleted user ${userId}`);
  } catch (error) {
    logger.error(`Error in cascadeDeleteUser for ${userId}:`, error);
    throw error;
  }
};

module.exports = {
  cascadeDeletePost,
  cascadeDeleteUser
};

