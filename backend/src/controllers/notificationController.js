const Notification = require('../models/Notification');
const User = require('../models/User');
const Post = require('../models/Post');
const { getIO } = require('../socket');
const { sendError, sendSuccess, ERROR_CODES } = require('../utils/errorCodes');
const logger = require('../utils/logger');

// @desc    Get user notifications
// @route   GET /notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await Notification.getUserNotifications(userId, page, limit);

    return sendSuccess(res, 200, 'Notifications fetched successfully', result);
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

