const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { getSongs, getSongById, uploadSongFile, deleteSongById, toggleSongStatus } = require('../controllers/songController');
const { verifySuperAdminToken } = require('../controllers/superAdminController');
const { sendError } = require('../utils/errorCodes');

const router = express.Router();

// Multer configuration for audio file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/x-m4a'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed (MP3, WAV, M4A)'), false);
    }
  }
});

// Error handler for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'FILE_4002', 'File size exceeds 20MB limit');
    }
    return sendError(res, 'FILE_4001', 'File upload error: ' + err.message);
  }
  if (err) {
    return sendError(res, 'FILE_4003', err.message || 'Invalid file type');
  }
  next();
};

// Validation rules for song upload
const uploadSongValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('artist')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Artist must be between 1 and 200 characters'),
  body('duration')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Duration must be a positive number'),
  body('genre')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Genre must be less than 50 characters')
];

// Public routes
/**
 * @swagger
 * /api/v1/songs:
 *   get:
 *     summary: Get all active songs for selection
 *     tags: [Songs]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: genre
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
 *         description: List of active songs
 */
router.get('/', getSongs);

/**
 * @swagger
 * /api/v1/songs/{id}:
 *   get:
 *     summary: Get song by ID
 *     tags: [Songs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Song details
 */
router.get('/:id', getSongById);

// Protected routes (SuperAdmin only)
/**
 * @swagger
 * /api/v1/songs/upload:
 *   post:
 *     summary: Upload a new song (SuperAdmin only)
 *     tags: [Songs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - song
 *               - title
 *               - artist
 *             properties:
 *               song:
 *                 type: string
 *                 format: binary
 *               title:
 *                 type: string
 *               artist:
 *                 type: string
 *               genre:
 *                 type: string
 *               duration:
 *                 type: number
 *     responses:
 *       201:
 *         description: Song uploaded successfully
 */
// Upload route with proper middleware order
router.post('/upload', 
  verifySuperAdminToken, 
  upload.single('song'), 
  handleMulterError,
  ...uploadSongValidation,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors: errors.array() });
    }
    next();
  },
  uploadSongFile
);

/**
 * @swagger
 * /api/v1/songs/{id}:
 *   delete:
 *     summary: Delete a song (SuperAdmin only)
 *     tags: [Songs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Song deleted successfully
 */
router.delete('/:id', verifySuperAdminToken, deleteSongById);

/**
 * @swagger
 * /api/v1/songs/{id}/toggle:
 *   patch:
 *     summary: Toggle song active/inactive status (SuperAdmin only)
 *     tags: [Songs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Song status toggled successfully
 */
router.patch('/:id/toggle', verifySuperAdminToken, toggleSongStatus);

module.exports = router;

