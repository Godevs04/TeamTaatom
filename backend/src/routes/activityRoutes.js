const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getActivityFeed,
  getUserActivity,
  updateActivityPrivacy
} = require('../controllers/activityController');

// Activity feed routes
router.get('/', authMiddleware, getActivityFeed);
router.get('/user/:userId', getUserActivity);
router.put('/privacy', authMiddleware, updateActivityPrivacy);

module.exports = router;

