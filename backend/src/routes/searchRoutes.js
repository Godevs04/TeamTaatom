const express = require('express');
const router = express.Router();
const { searchPosts, searchByLocation } = require('../controllers/searchController');

// Advanced search routes
/**
 * @swagger
 * /api/v1/search/posts:
 *   get:
 *     summary: Advanced search across posts
 *     description: |
 *       Searches posts by caption text and optional hashtags. Supports full-text search with pagination.
 *       
 *       **Search Features:**
 *       - Searches post captions (case-insensitive)
 *       - Optional hashtag filtering
 *       - Paginated results
 *       - Authentication optional
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: Search query text
 *         example: "sunset beach"
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated hashtags to filter by (without #)
 *         example: "travel,beach,photography"
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
 *         description: Number of results per page
 *         example: 20
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
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
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/posts', searchPosts);
/**
 * @swagger
 * /api/v1/search/location:
 *   get:
 *     summary: Search posts by geolocation radius
 *     description: |
 *       Finds posts within a specified radius of a geographic location.
 *       
 *       **Use Cases:**
 *       - Find posts near a location
 *       - Discover content from specific areas
 *       - Location-based feed
 *       
 *       **Coordinates:**
 *       - Latitude: -90 to 90
 *       - Longitude: -180 to 180
 *       - Radius: Default 10km, max 100km
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *           minimum: -90
 *           maximum: 90
 *         description: Latitude coordinate
 *         example: 40.7128
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *           minimum: -180
 *           maximum: 180
 *         description: Longitude coordinate
 *         example: -74.0060
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           format: float
 *           minimum: 0.1
 *           maximum: 100
 *           default: 10
 *         description: Search radius in kilometers
 *         example: 10
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
 *         description: Number of results per page
 *         example: 20
 *     responses:
 *       200:
 *         description: Posts within radius retrieved successfully
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
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/location', searchByLocation);

module.exports = router;

