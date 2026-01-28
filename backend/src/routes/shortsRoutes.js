const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const {
  getShorts,
  createShort,
  getUserShorts
} = require('../controllers/postController');

const router = express.Router();

// Multer configuration for video uploads
// Use memory storage for efficiency, but handle large files gracefully
// For files > 100MB, consider disk storage to avoid memory issues
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    // No file size limit - unlimited uploads
    // Note: For very large files (400MB+), memory storage is acceptable
    // as Node.js can handle buffers up to ~2GB, but monitor memory usage
    fileSize: Infinity, // Explicitly set to unlimited
  },
  fileFilter: (req, file, cb) => {
    const isVideo = file.fieldname === 'video' && file.mimetype.startsWith('video/');
    const isImage = file.fieldname === 'image' && file.mimetype.startsWith('image/');
    if (isVideo || isImage) {
      return cb(null, true);
    }
    return cb(new Error('Invalid file type for field'), false);
  }
});

// Validation rules
const createShortValidation = [
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

// Routes
/**
 * @swagger
 * /api/v1/shorts:
 *   get:
 *     summary: Get feed of short-form videos
 *     description: |
 *       Retrieves a paginated feed of short-form videos. Similar to TikTok/Instagram Reels format.
 *       
 *       **Features:**
 *       - Vertical video format
 *       - Optional background music
 *       - Location tagging
 *       - Hashtags and mentions support
 *       
 *       **Authentication:** Optional (personalized feed if authenticated)
 *     tags: [Shorts]
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
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Number of shorts per page
 *         example: 20
 *     responses:
 *       200:
 *         description: Shorts feed retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 shorts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Short'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/', optionalAuth, getShorts);
/**
 * @swagger
 * /api/v1/shorts/user/{userId}:
 *   get:
 *     summary: Get shorts by user
 *     tags: [Shorts]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User shorts list
 */
router.get('/user/:userId', optionalAuth, getUserShorts);
// Accept video and optional image (thumbnail) fields
/**
 * @swagger
 * /api/v1/shorts:
 *   post:
 *     summary: Upload a new short
 *     description: |
 *       Uploads a new short-form video. Supports video file and optional thumbnail image.
 *       
 *       **File Requirements:**
 *       - Video: MP4, MOV, AVI, or other video formats
 *       - Thumbnail: JPEG, PNG, WebP, GIF (optional)
 *       - No file size limit
 *       
 *       **Optional Features:**
 *       - Location: Add latitude/longitude for geotagging
 *       - Background Music: Select song with start/end time and volume
 *       - Caption: Text with hashtags and mentions support (max 1000 characters)
 *     tags: [Shorts]
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
 *               - video
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Video file (required)
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Optional thumbnail image
 *               caption:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Video caption with hashtags and mentions
 *                 example: "Amazing sunset! #travel #sunset @friend"
 *               latitude:
 *                 type: number
 *                 format: float
 *                 minimum: -90
 *                 maximum: 90
 *                 description: Latitude for geotagging
 *                 example: 40.7128
 *               longitude:
 *                 type: number
 *                 format: float
 *                 minimum: -180
 *                 maximum: 180
 *                 description: Longitude for geotagging
 *                 example: -74.0060
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
 *         description: Short created successfully
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
 *                   example: "Short created successfully"
 *                 short:
 *                   $ref: '#/components/schemas/Short'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/', authMiddleware, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), createShortValidation, createShort);

module.exports = router;
