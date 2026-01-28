const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { createShortUrl, redirectShortUrl } = require('../controllers/shortUrlController');

const router = express.Router();

/**
 * @swagger
 * /api/v1/short-url/create:
 *   post:
 *     summary: Create a short URL for a post
 *     tags: [Short URLs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *             properties:
 *               postId:
 *                 type: string
 *                 description: The ID of the post to create a short URL for
 *     responses:
 *       201:
 *         description: Short URL created successfully
 *       400:
 *         description: Invalid request
 */
router.post('/create', authMiddleware, createShortUrl);

// Create redirect router with the route
const redirectRouter = express.Router();
redirectRouter.get('/:shortCode', redirectShortUrl);

// Add a test route to verify the router is working
redirectRouter.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Short URL redirect route is working',
    timestamp: new Date().toISOString()
  });
});

module.exports = {
  createRoute: router, // For mounting at /api/v1/short-url
  redirectRoute: redirectRouter // For mounting at /s
};

