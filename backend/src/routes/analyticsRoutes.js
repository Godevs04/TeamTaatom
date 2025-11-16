const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');
const {
  trackEvents,
  getAnalyticsData,
  logError,
  getErrorLogs,
} = require('../controllers/analyticsController');

const router = express.Router();

// Rate limiting for analytics endpoints
const analyticsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many analytics requests, please try again later',
});

const errorLogRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 error logs per minute
  message: 'Too many error logs, please try again later',
});

// Routes
router.post('/events', authMiddleware, analyticsRateLimit, trackEvents);
router.get('/data', authMiddleware, getAnalyticsData); // Admin check can be added
router.post('/errors', errorLogRateLimit, logError);
router.get('/errors', authMiddleware, getErrorLogs); // Admin check can be added

module.exports = router;

