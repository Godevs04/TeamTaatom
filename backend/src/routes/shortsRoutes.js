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
// No file size limits - unlimited uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    // fileSize removed - unlimited file size
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
 *     tags: [Shorts]
 *     parameters:
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
 *         description: Paginated shorts feed
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
 *               - caption
 *             properties:
 *               caption:
 *                 type: string
 *                 maxLength: 1000
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               video:
 *                 type: string
 *                 format: binary
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Short created
 */
router.post('/', authMiddleware, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), createShortValidation, createShort);

module.exports = router;
