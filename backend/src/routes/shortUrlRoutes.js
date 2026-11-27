const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { createShortUrl, redirectShortUrl, resolveShortUrl } = require('../controllers/shortUrlController');

const router = express.Router();

/**
 * @swagger
 * /api/v1/short-url/create:
 *   post:
 *     summary: Create or get a shareable short URL
 *     description: |
 *       Provide **exactly one** of postId, journeyId, or connectPageId.
 *       Returns `https://www.taatom.com/s/{code}` (reuses existing code if already created).
 *       Public `/s/:code` serves Open Graph HTML for WhatsApp/iMessage previews.
 *     tags: [Short URLs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               postId:
 *                 type: string
 *                 description: Photo, short, or long video post ID
 *               journeyId:
 *                 type: string
 *               connectPageId:
 *                 type: string
 *                 description: Community / Connect page ID
 *           examples:
 *             post:
 *               value: { postId: "665f0a1b2c3d4e5f67890123" }
 *             journey:
 *               value: { journeyId: "665f0a1b2c3d4e5f67890124" }
 *             community:
 *               value: { connectPageId: "665f0a1b2c3d4e5f67890125" }
 *     responses:
 *       200:
 *         description: Existing short URL returned
 *       201:
 *         description: Short URL created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     shortUrl:
 *                       type: string
 *                       example: https://www.taatom.com/s/Ab12Cd34
 *                     shortCode:
 *                       type: string
 *                     postId:
 *                       type: string
 *                     journeyId:
 *                       type: string
 *                     connectPageId:
 *                       type: string
 *       400:
 *         description: Provide exactly one of postId, journeyId, or connectPageId
 *       404:
 *         description: Target resource not found
 */
router.post('/create', authMiddleware, createShortUrl);

/**
 * @swagger
 * /api/v1/short-url/resolve/{shortCode}:
 *   get:
 *     summary: Resolve short code to an in-app path
 *     description: |
 *       Used by the mobile Universal Link landing (`/s/:code`) to open the correct screen:
 *       - **short** → `/(tabs)/shorts?shortId=…` (scrollable feed)
 *       - **long_video** → `/watch/{id}`
 *       - **post** → `/post/{id}`
 *       - **journey** → `/navigate/detail?journeyId=…`
 *       - **connect_page** → `/connect/page/{id}`
 *     tags: [Short URLs]
 *     parameters:
 *       - in: path
 *         name: shortCode
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Za-z0-9]{4,16}$'
 *     responses:
 *       200:
 *         description: Resolved path
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [post, short, long_video, journey, connect_page]
 *                     path:
 *                       type: string
 *                       example: "/(tabs)/shorts?shortId=665f0a1b2c3d4e5f67890123"
 *                     postId:
 *                       type: string
 *                     postType:
 *                       type: string
 *                     journeyId:
 *                       type: string
 *                     connectPageId:
 *                       type: string
 *       404:
 *         description: Short URL or target not found
 */
router.get('/resolve/:shortCode', resolveShortUrl);

/**
 * @swagger
 * /s/{shortCode}:
 *   get:
 *     summary: Public short-link landing (HTML + Open Graph)
 *     description: |
 *       Returns HTML with `og:title`, `og:description`, `og:image` for rich previews
 *       (WhatsApp, iMessage, etc.) and deep-link handoff into the Taatom app.
 *       Not under `/api/v1` — mounted at `/s`.
 *     tags: [Short URLs]
 *     parameters:
 *       - in: path
 *         name: shortCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: HTML page with OG meta tags
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       404:
 *         description: Link not found or target inactive
 */

// Create redirect router with the route
const redirectRouter = express.Router();
redirectRouter.get('/:shortCode', redirectShortUrl);

// Add a test route to verify the router is working
redirectRouter.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Short URL redirect route is working',
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  createRoute: router, // For mounting at /api/v1/short-url
  redirectRoute: redirectRouter, // For mounting at /s
};
