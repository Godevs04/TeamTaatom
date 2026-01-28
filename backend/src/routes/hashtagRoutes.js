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
 *     description: |
 *       Searches for hashtags matching the query string. Useful for autocomplete and hashtag discovery.
 *       
 *       **Search Behavior:**
 *       - Case-insensitive partial matching
 *       - Returns matching hashtags with usage counts
 *       - Results sorted by relevance and popularity
 *     tags: [Hashtags]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         description: Search query (hashtag name without #)
 *         example: "travel"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Maximum number of results
 *         example: 20
 *     responses:
 *       200:
 *         description: Hashtag search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 hashtags:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         example: "travel"
 *                       count:
 *                         type: integer
 *                         example: 1250
 *                       lastUsed:
 *                         type: string
 *                         format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/search', searchValidation, searchHashtags);
/**
 * @swagger
 * /api/v1/hashtags/trending:
 *   get:
 *     summary: Get trending hashtags
 *     description: |
 *       Returns the most popular hashtags within a specified time range.
 *       
 *       **Trending Algorithm:**
 *       - Based on usage frequency
 *       - Considers recency and volume
 *       - Time ranges: 1 hour, 24 hours, 7 days, 30 days
 *     tags: [Hashtags]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of trending hashtags to return
 *         example: 20
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *         description: Time range for trending calculation
 *         example: "24h"
 *     responses:
 *       200:
 *         description: Trending hashtags retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 hashtags:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         example: "travel"
 *                       count:
 *                         type: integer
 *                         example: 5420
 *                       trend:
 *                         type: string
 *                         enum: [up, down, stable]
 *                         example: "up"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/trending', trendingValidation, getTrendingHashtags);
/**
 * @swagger
 * /api/v1/hashtags/{hashtag}:
 *   get:
 *     summary: Get hashtag details (counts, metadata)
 *     description: |
 *       Retrieves detailed information about a specific hashtag including usage statistics and metadata.
 *       
 *       **Note:** Hashtag should be provided without the # symbol.
 *     tags: [Hashtags]
 *     parameters:
 *       - in: path
 *         name: hashtag
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         description: Hashtag name without # symbol
 *         example: "travel"
 *     responses:
 *       200:
 *         description: Hashtag details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 hashtag:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "travel"
 *                     count:
 *                       type: integer
 *                       example: 1250
 *                     lastUsed:
 *                       type: string
 *                       format: date-time
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:hashtag', hashtagParamValidation, getHashtagDetails);
/**
 * @swagger
 * /api/v1/hashtags/{hashtag}/posts:
 *   get:
 *     summary: Get posts attached to a hashtag
 *     description: |
 *       Retrieves all posts that contain the specified hashtag. Results are paginated and sorted by most recent.
 *       
 *       **Note:** Hashtag should be provided without the # symbol.
 *     tags: [Hashtags]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: hashtag
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         description: Hashtag name without # symbol
 *         example: "travel"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Number of posts per page
 *         example: 20
 *     responses:
 *       200:
 *         description: Posts with hashtag retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Post'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:hashtag/posts', hashtagParamValidation, paginationValidation, optionalAuth, getHashtagPosts);

module.exports = router;

