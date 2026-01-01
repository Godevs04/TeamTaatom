const express = require('express');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
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
/**
 * @swagger
 * /api/v1/analytics/events:
 *   post:
 *     summary: Track analytics events
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               events:
 *                 type: array
 *                 items:
 *                   type: object
 *             example:
 *               events:
 *                 - name: post_view
 *                   userId: 123
 *                   metadata:
 *                     postId: 999
 *     responses:
 *       202:
 *         description: Events queued for processing
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/events', optionalAuth, analyticsRateLimit, trackEvents);
/**
 * @swagger
 * /api/v1/analytics/data:
 *   get:
 *     summary: Get aggregated analytics dashboard data
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard metrics
 *       403:
 *         description: Forbidden (non-admin)
 */
router.get('/data', authMiddleware, getAnalyticsData); // Admin check can be added
/**
 * @swagger
 * /api/v1/analytics/errors:
 *   post:
 *     summary: Log client-side errors
 *     tags: [Analytics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *               stack:
 *                 type: string
 *     responses:
 *       202:
 *         description: Error log accepted
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/errors', errorLogRateLimit, logError);
/**
 * @swagger
 * /api/v1/analytics/errors:
 *   get:
 *     summary: Get captured error logs
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of error logs
 */
router.get('/errors', authMiddleware, getErrorLogs); // Admin check can be added

module.exports = router;

