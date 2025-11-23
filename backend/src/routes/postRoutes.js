const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const {
  getPosts,
  getPostById,
  createPost,
  getUserPosts,
  toggleLike,
  addComment,
  deleteComment,
  deletePost,
  archivePost,
  unarchivePost,
  hidePost,
  unhidePost,
  toggleComments,
  updatePost,
  getArchivedPosts,
  getHiddenPosts
} = require('../controllers/postController');

const router = express.Router();

// Health check endpoint
/**
 * @swagger
 * /api/v1/posts/health:
 *   get:
 *     summary: Posts service health check
 *     tags: [Posts]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Multer configuration for image uploads
// Increased limits for high-quality images
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per image (increased for excellent quality)
    files: 10, // Maximum 10 files
    fieldSize: 10 * 1024 * 1024, // 10MB for field values (captions, etc.)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Validation rules
const createPostValidation = [
  body('caption')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Caption must be between 1 and 1000 characters'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
];

const addCommentValidation = [
  body('text')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment must be between 1 and 500 characters')
];

// Routes
/**
 * @swagger
 * /api/v1/posts:
 *   get:
 *     summary: Fetch posts for the feed
 *     description: Supports offset or cursor-based pagination. Pass `useCursor=true` with `cursor` timestamp for cursor pagination.
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: useCursor
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Paginated list of posts
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
 *                     posts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Post'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 */
router.get('/', optionalAuth, getPosts);
/**
 * @swagger
 * /api/v1/posts/archived:
 *   get:
 *     summary: Get archived posts for authenticated user
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Archived posts list
 */
router.get('/archived', authMiddleware, getArchivedPosts);
/**
 * @swagger
 * /api/v1/posts/hidden:
 *   get:
 *     summary: Get hidden posts for authenticated user
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Hidden posts list
 */
router.get('/hidden', authMiddleware, getHiddenPosts);
/**
 * @swagger
 * /api/v1/posts/{id}:
 *   get:
 *     summary: Get post by ID
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Post details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', optionalAuth, getPostById);
/**
 * @swagger
 * /api/v1/posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - images
 *               - caption
 *             properties:
 *               caption:
 *                 type: string
 *                 example: Sunrise over the Alps #travel
 *               latitude:
 *                 type: number
 *                 format: float
 *               longitude:
 *                 type: number
 *                 format: float
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', authMiddleware, upload.fields([{ name: 'images', maxCount: 10 }]), createPostValidation, createPost);
/**
 * @swagger
 * /api/v1/posts/user/{userId}:
 *   get:
 *     summary: Get posts created by a specific user
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: User posts list
 */
router.get('/user/:userId', optionalAuth, getUserPosts);
/**
 * @swagger
 * /api/v1/posts/{id}/like:
 *   post:
 *     summary: Toggle like on a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns updated like status/count
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/:id/like', authMiddleware, toggleLike);
/**
 * @swagger
 * /api/v1/posts/{id}/comments:
 *   post:
 *     summary: Add a comment to a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 example: Amazing view!
 *     responses:
 *       201:
 *         description: Comment added
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/:id/comments', authMiddleware, addCommentValidation, addComment);
/**
 * @swagger
 * /api/v1/posts/{id}/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment from a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/:id/comments/:commentId', authMiddleware, deleteComment);
/**
 * @swagger
 * /api/v1/posts/{id}:
 *   delete:
 *     summary: Delete a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post deleted
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/:id', authMiddleware, deletePost);
/**
 * @swagger
 * /api/v1/posts/{id}/archive:
 *   patch:
 *     summary: Archive a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post archived
 */
router.patch('/:id/archive', authMiddleware, archivePost);
/**
 * @swagger
 * /api/v1/posts/{id}/unarchive:
 *   patch:
 *     summary: Unarchive a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
router.patch('/:id/unarchive', authMiddleware, unarchivePost);
/**
 * @swagger
 * /api/v1/posts/{id}/hide:
 *   patch:
 *     summary: Hide a post from profile
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
router.patch('/:id/hide', authMiddleware, hidePost);
/**
 * @swagger
 * /api/v1/posts/{id}/unhide:
 *   patch:
 *     summary: Unhide a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
router.patch('/:id/unhide', authMiddleware, unhidePost);
/**
 * @swagger
 * /api/v1/posts/{id}/toggle-comments:
 *   patch:
 *     summary: Toggle comments on a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Updated post comment settings
 */
router.patch('/:id/toggle-comments', authMiddleware, toggleComments);
/**
 * @swagger
 * /api/v1/posts/{id}:
 *   patch:
 *     summary: Update post metadata
 *     tags: [Posts]
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
 *               caption:
 *                 type: string
 *               location:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: Post updated
 */
router.patch('/:id', authMiddleware, updatePost);

module.exports = router;
