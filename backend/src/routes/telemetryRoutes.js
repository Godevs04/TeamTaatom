const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { recordInteraction } = require('../controllers/telemetryController');

const router = express.Router();

/**
 * @swagger
 * /api/v1/telemetry/interaction:
 *   post:
 *     summary: Record user interactions with posts
 *     tags: [Telemetry]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               interactions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     postId:
 *                       type: string
 *                     watchDurationMs:
 *                       type: integer
 *                     completionRate:
 *                       type: number
 *                     action:
 *                       type: string
 *                       enum: [view, like, share, skip]
 *     responses:
 *       200:
 *         description: Interactions recorded
 */
router.post('/interaction', authMiddleware, recordInteraction);

module.exports = router;
