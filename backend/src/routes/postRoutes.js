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
// No file size limits - unlimited uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    files: 10, // Maximum 10 files
    fieldSize: 10 * 1024 * 1024, // 10MB for field values (captions, etc.)
    // fileSize removed - unlimited file size
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
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Caption must be less than 1000 characters'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('songId')
    .optional()
    .isMongoId()
    .withMessage('Invalid song ID'),
  body('songStartTime')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Song start time must be a positive number'),
  body('songEndTime')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Song end time must be a positive number'),
  body('songVolume')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Song volume must be between 0 and 1')
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
 *     description: |
 *       Retrieves a paginated list of posts for the feed. Supports two pagination methods:
 *       
 *       **Pagination Methods:**
 *       1. **Offset-based**: Use `page` and `limit` parameters (default)
 *       2. **Cursor-based**: Use `useCursor=true` with `cursor` timestamp for better performance with large datasets
 *       
 *       **Authentication:**
 *       - Optional: If authenticated, returns personalized feed with user-specific data (likes, follows, etc.)
 *       - If not authenticated, returns public feed
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for offset-based pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of posts per page (max 100)
 *         example: 20
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Timestamp cursor for cursor-based pagination (ISO 8601 format)
 *         example: "2024-01-15T10:30:00.000Z"
 *       - in: query
 *         name: useCursor
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Enable cursor-based pagination
 *         example: false
 *     responses:
 *       200:
 *         description: Successfully retrieved posts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     posts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Post'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/', optionalAuth, getPosts);
/**
 * @swagger
 * /api/v1/posts/archived:
 *   get:
 *     summary: Get archived posts for authenticated user
 *     description: |
 *       Retrieves all archived posts for the authenticated user.
 *       
 *       **Archive Feature:**
 *       - Archived posts are hidden from public feed
 *       - Only visible to the post owner
 *       - Can be unarchived later
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Archived posts retrieved successfully
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/archived', authMiddleware, getArchivedPosts);
/**
 * @swagger
 * /api/v1/posts/hidden:
 *   get:
 *     summary: Get hidden posts for authenticated user
 *     description: |
 *       Retrieves all posts that the authenticated user has hidden from their feed.
 *       
 *       **Hide Feature:**
 *       - Hidden posts are removed from user's feed
 *       - Post remains visible to others
 *       - Can be unhidden later
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Hidden posts retrieved successfully
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/hidden', authMiddleware, getHiddenPosts);
/**
 * @swagger
 * /api/v1/posts/{id}:
 *   get:
 *     summary: Get post by ID
 *     description: |
 *       Retrieves detailed information about a specific post by its ID.
 *       
 *       **Authentication:**
 *       - Optional: If authenticated, includes user-specific data (isLiked, etc.)
 *       - If not authenticated, returns public post data only
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
 *         description: MongoDB ObjectId of the post
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Post details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 post:
 *                   $ref: '#/components/schemas/Post'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:id', optionalAuth, getPostById);
/**
 * @swagger
 * /api/v1/posts:
 *   post:
 *     summary: Create a new post
 *     description: |
 *       Creates a new post with images, optional location, and optional background music.
 *       
 *       **File Requirements:**
 *       - Images: JPEG, PNG, WebP, GIF (up to 10 images per post)
 *       - No file size limit
 *       
 *       **Optional Features:**
 *       - Location: Add latitude/longitude for geotagging
 *       - Background Music: Select song with start/end time and volume
 *       - Caption: Text with hashtags and mentions support
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
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Image files (1-10 images per post)
 *                 minItems: 1
 *                 maxItems: 10
 *               caption:
 *                 type: string
 *                 maxLength: 2200
 *                 description: Post caption with hashtags and mentions support
 *                 example: "Sunrise over the Alps #travel #mountains @friend"
 *               latitude:
 *                 type: number
 *                 format: float
 *                 minimum: -90
 *                 maximum: 90
 *                 description: Latitude for geotagging
 *                 example: 46.5197
 *               longitude:
 *                 type: number
 *                 format: float
 *                 minimum: -180
 *                 maximum: 180
 *                 description: Longitude for geotagging
 *                 example: 6.6323
 *               songId:
 *                 type: string
 *                 description: Optional song ID for background music
 *                 example: "507f1f77bcf86cd799439011"
 *               songStartTime:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 description: Start time in seconds for background music
 *                 example: 10.5
 *               songEndTime:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 description: End time in seconds for background music
 *                 example: 60.0
 *               songVolume:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 1
 *                 description: Volume level for background music (0.0 to 1.0)
 *                 example: 0.5
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Post created successfully"
 *                 post:
 *                   $ref: '#/components/schemas/Post'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
