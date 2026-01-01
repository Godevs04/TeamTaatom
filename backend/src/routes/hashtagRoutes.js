const express = require('express');
const router = express.Router();
const { query, param } = require('express-validator');
const {
  searchHashtags,
  getTrendingHashtags,
  getHashtagPosts,
  getHashtagDetails,
} = require('../controllers/hashtagController');
const { optionalAuth } = require('../middleware/authMiddleware');

// Validation rules
const searchValidation = [
  query('q')
    .trim()
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Query must be between 1 and 100 characters'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

const trendingValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('timeRange')
    .optional()
    .isIn(['1h', '24h', '7d', '30d'])
    .withMessage('Time range must be one of: 1h, 24h, 7d, 30d'),
];

const hashtagParamValidation = [
  param('hashtag')
    .trim()
    .notEmpty()
    .withMessage('Hashtag is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Hashtag must be between 1 and 100 characters'),
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
];

// Routes
/**
 * @swagger
 * /api/v1/hashtags/search:
 *   get:
 *     summary: Search hashtags by keyword
 *     tags: [Hashtags]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', searchValidation, searchHashtags);
/**
 * @swagger
 * /api/v1/hashtags/trending:
 *   get:
 *     summary: Get trending hashtags
 *     tags: [Hashtags]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *     responses:
 *       200:
 *         description: Trending hashtags
 */
router.get('/trending', trendingValidation, getTrendingHashtags);
/**
 * @swagger
 * /api/v1/hashtags/{hashtag}:
 *   get:
 *     summary: Get hashtag details (counts, metadata)
 *     tags: [Hashtags]
 *     parameters:
 *       - in: path
 *         name: hashtag
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hashtag details
 */
router.get('/:hashtag', hashtagParamValidation, getHashtagDetails);
/**
 * @swagger
 * /api/v1/hashtags/{hashtag}/posts:
 *   get:
 *     summary: Get posts attached to a hashtag
 *     tags: [Hashtags]
 *     parameters:
 *       - in: path
 *         name: hashtag
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Paginated posts list
 */
router.get('/:hashtag/posts', hashtagParamValidation, paginationValidation, optionalAuth, getHashtagPosts);

module.exports = router;

