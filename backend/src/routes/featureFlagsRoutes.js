const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getFeatureFlags,
  createFeatureFlag,
  getAllFeatureFlags,
} = require('../controllers/featureFlagsController');

const router = express.Router();

// Routes
/**
 * @swagger
 * /api/v1/feature-flags:
 *   get:
 *     summary: Get feature flags available to the authenticated user
 *     tags: [Feature Flags]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Feature flag map
 */
router.get('/', authMiddleware, getFeatureFlags);
/**
 * @swagger
 * /api/v1/feature-flags:
 *   post:
 *     summary: Create or update a feature flag
 *     tags: [Feature Flags]
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
 *               key:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               rollout:
 *                 type: number
 *     responses:
 *       201:
 *         description: Feature flag created/updated
 */
router.post('/', authMiddleware, createFeatureFlag); // Admin check can be added
/**
 * @swagger
 * /api/v1/feature-flags/all:
 *   get:
 *     summary: Get all feature flags (admin)
 *     tags: [Feature Flags]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: All feature flags
 */
router.get('/all', authMiddleware, getAllFeatureFlags); // Admin check can be added

module.exports = router;

