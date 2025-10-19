const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  createNotification
} = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware/authMiddleware');

// All notification routes require authentication
router.use(authMiddleware);

// Get user notifications with pagination
router.get('/', getNotifications);

// Mark specific notification as read
router.put('/:id/read', markAsRead);

// Mark all notifications as read
router.put('/read-all', markAllAsRead);

// Get unread notification count
router.get('/unread-count', getUnreadCount);

// Create notification (for internal use)
router.post('/create', createNotification);

module.exports = router;
