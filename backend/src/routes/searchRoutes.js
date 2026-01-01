const express = require('express');
const router = express.Router();
const { searchPosts, searchByLocation } = require('../controllers/searchController');

// Advanced search routes
/**
 * @swagger
 * /api/v1/search/posts:
 *   get:
 *     summary: Advanced search across posts
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated list
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
 *         description: Search results
 */
router.get('/posts', searchPosts);
/**
 * @swagger
 * /api/v1/search/location:
 *   get:
 *     summary: Search posts by geolocation radius
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           description: Radius in kilometers
 *     responses:
 *       200:
 *         description: Posts within radius
 */
router.get('/location', searchByLocation);

module.exports = router;

