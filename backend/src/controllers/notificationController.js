const Notification = require('../models/Notification');
const User = require('../models/User');
const Post = require('../models/Post');
const { getIO } = require('../socket');
const { sendError, sendSuccess, ERROR_CODES } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const { generateSignedUrl, generateSignedUrls } = require('../services/mediaService');

// @desc    Get user notifications
// @route   GET /notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await Notification.getUserNotifications(userId, page, limit);

    // Generate signed URLs for profile pictures and post images
    const notificationsWithUrls = await Promise.all(result.notifications.map(async (notification) => {
      // Generate signed URL for fromUser profile picture
      if (notification.fromUser) {
        // Need to fetch full user data to get profilePicStorageKey
        const fromUser = await User.findById(notification.fromUser._id || notification.fromUser)
          .select('fullName profilePic profilePicStorageKey email')
          .lean();
        
        if (fromUser) {
          if (fromUser.profilePicStorageKey) {
            try {
              notification.fromUser.profilePic = await generateSignedUrl(fromUser.profilePicStorageKey, 'PROFILE');
            } catch (error) {
              logger.warn('Failed to generate profile picture URL for notification fromUser:', { 
                userId: fromUser._id, 
                error: error.message 
              });
              // Fallback to legacy URL if available
              notification.fromUser.profilePic = fromUser.profilePic || null;
            }
          } else if (fromUser.profilePic) {
            // Legacy: use existing profilePic if no storage key
            notification.fromUser.profilePic = fromUser.profilePic;
          } else {
            notification.fromUser.profilePic = null;
          }
          
          // Ensure other fields are set
          notification.fromUser.fullName = fromUser.fullName || notification.fromUser.fullName;
          notification.fromUser.email = fromUser.email || notification.fromUser.email;
        }
      }

      // Generate signed URL for post image
      if (notification.post) {
        // Need to fetch full post data to get storage keys
        const post = await Post.findById(notification.post._id || notification.post)
          .select('imageUrl storageKey storageKeys thumbnailUrl type')
          .lean();
        
        if (post) {
          // For shorts, prefer thumbnailUrl, then imageUrl
          if (post.type === 'short') {
            if (post.thumbnailUrl) {
              notification.post.imageUrl = post.thumbnailUrl;
            } else if (post.storageKeys && post.storageKeys.length > 0) {
              // Generate thumbnail from storage keys (usually second key is thumbnail)
              try {
                const thumbnailStorageKey = post.storageKeys[1] || post.storageKeys[0];
                notification.post.imageUrl = await generateSignedUrl(thumbnailStorageKey, 'IMAGE');
              } catch (error) {
                logger.warn('Failed to generate thumbnail URL for short in notification:', { 
                  postId: post._id, 
                  error: error.message 
                });
                notification.post.imageUrl = post.imageUrl || post.thumbnailUrl || null;
              }
            } else if (post.storageKey) {
              try {
                notification.post.imageUrl = await generateSignedUrl(post.storageKey, 'IMAGE');
              } catch (error) {
                logger.warn('Failed to generate image URL for short in notification:', { 
                  postId: post._id, 
                  error: error.message 
                });
                notification.post.imageUrl = post.imageUrl || post.thumbnailUrl || null;
              }
            } else {
              notification.post.imageUrl = post.thumbnailUrl || post.imageUrl || null;
            }
          } else {
            // For regular posts, generate image URL from storage keys
            if (post.storageKeys && post.storageKeys.length > 0) {
              try {
                const imageUrls = await generateSignedUrls(post.storageKeys, 'IMAGE');
                notification.post.imageUrl = imageUrls[0] || null;
              } catch (error) {
                logger.warn('Failed to generate image URLs for post in notification:', { 
                  postId: post._id, 
                  error: error.message 
                });
                notification.post.imageUrl = post.imageUrl || null;
              }
            } else if (post.storageKey) {
              try {
                notification.post.imageUrl = await generateSignedUrl(post.storageKey, 'IMAGE');
              } catch (error) {
                logger.warn('Failed to generate image URL for post in notification:', { 
                  postId: post._id, 
                  error: error.message 
                });
                notification.post.imageUrl = post.imageUrl || null;
              }
            } else {
              // Legacy: use existing imageUrl if no storage key
              notification.post.imageUrl = post.imageUrl || null;
            }
          }
          
          // Ensure caption is set
          notification.post.caption = post.caption || notification.post.caption;
        }
      }

      return notification;
    }));

    return sendSuccess(res, 200, 'Notifications fetched successfully', {
      ...result,
      notifications: notificationsWithUrls
    });
  } catch (error) {
    logger.error('Get notifications error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching notifications');
  }
};

// @desc    Mark notification as read
// @route   PUT /notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, toUser: userId },
      { isRead: true },
      { new: true }
    ).lean();

    if (!notification) {
      return sendError(res, 'RES_3001', 'Notification does not exist');
    }

    const unreadCount = await Notification.countDocuments({ 
      toUser: userId, 
      isRead: false 
    });

    return sendSuccess(res, 200, 'Notification marked as read', { unreadCount });
  } catch (error) {
    logger.error('Mark as read error:', error);
    return sendError(res, 'SRV_6001', 'Error updating notification');
  }
};

// @desc    Mark all notifications as read
// @route   PUT /notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { toUser: userId, isRead: false },
      { isRead: true }
    );

    return sendSuccess(res, 200, 'All notifications marked as read', { unreadCount: 0 });
  } catch (error) {
    logger.error('Mark all as read error:', error);
    return sendError(res, 'SRV_6001', 'Error updating notifications');
  }
};

// @desc    Get unread notification count
// @route   GET /notifications/unread-count
// @access  Private
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const unreadCount = await Notification.countDocuments({ 
      toUser: userId, 
      isRead: false 
    });

    return sendSuccess(res, 200, 'Unread count fetched successfully', { unreadCount });
  } catch (error) {
    logger.error('Get unread count error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching unread count');
  }
};

// @desc    Create notification (internal use)
// @route   POST /notifications/create
// @access  Private
const createNotification = async (req, res) => {
  try {
    const { type, fromUser, toUser, post, comment, metadata } = req.body;

    const notification = await Notification.createNotification({
      type,
      fromUser,
      toUser,
      post,
      comment,
      metadata
    });

    // Send real-time notification
    const io = getIO();
    if (io) {
      const nsp = io.of('/app');
      nsp.emit('notification', {
        userId: toUser,
        notification: {
          _id: notification._id,
          type: notification.type,
          fromUser: notification.fromUser,
          post: notification.post,
          comment: notification.comment,
          isRead: notification.isRead,
          createdAt: notification.createdAt
        }
      });
    }

    return sendSuccess(res, 201, 'Notification created', { notification });
  } catch (error) {
    logger.error('Create notification error:', error);
    return sendError(res, 'SRV_6001', 'Error creating notification');
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  createNotification,
};

