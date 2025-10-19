const Notification = require('../models/Notification');
const User = require('../models/User');
const Post = require('../models/Post');
const { getIO } = require('../socket');

// @desc    Get user notifications
// @route   GET /notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await Notification.getUserNotifications(userId, page, limit);

    res.status(200).json(result);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching notifications'
    });
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
    );

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
        message: 'Notification does not exist'
      });
    }

    const unreadCount = await Notification.countDocuments({ 
      toUser: userId, 
      isRead: false 
    });

    res.status(200).json({
      message: 'Notification marked as read',
      unreadCount
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error updating notification'
    });
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

    res.status(200).json({
      message: 'All notifications marked as read',
      unreadCount: 0
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error updating notifications'
    });
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

    res.status(200).json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching unread count'
    });
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

    res.status(201).json({
      message: 'Notification created',
      notification
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error creating notification'
    });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  createNotification,
};

