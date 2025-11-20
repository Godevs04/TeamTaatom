const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { searchUsersForMention } = require('../controllers/mentionController');

/**
 * @swagger
 * /api/v1/mentions/search:
 *   get:
 *     summary: Search users for @mentions while composing content
 *     tags: [Mentions]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Partial username/full name
 *     responses:
 *       200:
 *         description: Users matching the query
 */
router.get('/search', authMiddleware, searchUsersForMention);

module.exports = router;

