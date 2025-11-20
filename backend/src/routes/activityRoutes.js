const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getActivityFeed,
  getUserActivity,
  updateActivityPrivacy
} = require('../controllers/activityController');

// Activity feed routes
/**
 * @swagger
 * /api/v1/activity:
 *   get:
 *     summary: Get personalized activity feed for authenticated user
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Activity feed items
 */
router.get('/', authMiddleware, getActivityFeed);
/**
 * @swagger
 * /api/v1/activity/user/{userId}:
 *   get:
 *     summary: Get activity for a specific user
 *     tags: [Activity]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User activity list
 */
router.get('/user/:userId', getUserActivity);
/**
 * @swagger
 * /api/v1/activity/privacy:
 *   put:
 *     summary: Update activity feed privacy settings
 *     tags: [Activity]
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
 *               visibility:
 *                 type: string
 *                 enum: [public, followers, private]
 *     responses:
 *       200:
 *         description: Privacy settings updated
 */
router.put('/privacy', authMiddleware, updateActivityPrivacy);

module.exports = router;

