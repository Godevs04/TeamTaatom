const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { getSongs, getSongById, uploadSongFile, deleteSongById, toggleSongStatus, updateSong } = require('../controllers/songController');
const { verifySuperAdminToken } = require('../controllers/superAdminController');
const { sendError } = require('../utils/errorCodes');

const router = express.Router();

// Multer configuration for audio and image file uploads
// No file size limits - unlimited uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    // fileSize removed - unlimited file size
  },
  fileFilter: (req, file, cb) => {
    // Allow audio files for 'song' field
    if (file.fieldname === 'song') {
      const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/x-m4a'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed for song field (MP3, WAV, M4A)'), false);
      }
    }
    // Allow image files for 'image' field
    else if (file.fieldname === 'image') {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for image field (JPEG, PNG, WebP, GIF)'), false);
      }
    } else {
      cb(new Error('Invalid field name'), false);
    }
  }
});

// Error handler for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // File size limit errors removed - unlimited uploads
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
 *     description: Retrieve a paginated list of active songs. Supports search by title/artist and filtering by genre. Songs are returned with dynamically generated signed URLs for audio playback and cover images.
 *     tags: [Songs]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search query to filter songs by title or artist (case-insensitive)
 *         example: "summer"
 *       - in: query
 *         name: genre
 *         schema:
 *           type: string
 *         description: Filter songs by genre. Use 'all' to get all genres
 *         example: "Pop"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of songs per page (max 100)
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include inactive songs (SuperAdmin only)
 *     responses:
 *       200:
 *         description: Successfully retrieved songs
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
 *                   example: "Songs fetched successfully"
 *                 songs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Song'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/', getSongs);

/**
 * @swagger
 * /api/v1/songs/{id}:
 *   get:
 *     summary: Get song by ID
 *     description: Retrieve detailed information about a specific song by its ID. Returns song metadata with signed URLs for audio playback and cover image.
 *     tags: [Songs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the song
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Successfully retrieved song
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
 *                   example: "Song fetched successfully"
 *                 song:
 *                   $ref: '#/components/schemas/Song'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:id', getSongById);

// Protected routes (SuperAdmin only)
/**
 * @swagger
 * /api/v1/songs/upload:
 *   post:
 *     summary: Upload a new song with optional cover image (SuperAdmin only)
 *     description: |
 *       Upload a new song to the music library. Supports both audio file and optional cover image upload.
 *       
 *       **File Requirements:**
 *       - Audio: MP3, WAV, M4A (max 100MB)
 *       - Image: JPEG, PNG, WebP, GIF (max 10MB, recommended 1000x1000px square)
 *       
 *       **Metadata:**
 *       - Title and Artist are required
 *       - Genre defaults to "General" if not provided
 *       - Duration can be auto-detected or provided in seconds
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
 *                 description: Audio file (MP3, WAV, M4A)
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Optional cover image (JPEG, PNG, WebP, GIF) - Recommended 1000x1000px
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Song title
 *                 example: "Summer Vibes"
 *               artist:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Artist name
 *                 example: "John Doe"
 *               genre:
 *                 type: string
 *                 maxLength: 50
 *                 description: Song genre (defaults to "General")
 *                 example: "Pop"
 *               duration:
 *                 type: integer
 *                 minimum: 0
 *                 description: Duration in seconds (optional, can be auto-detected)
 *                 example: 240
 *     responses:
 *       201:
 *         description: Song uploaded successfully
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
 *                   example: "Song uploaded successfully"
 *                 song:
 *                   $ref: '#/components/schemas/Song'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// Upload route with proper middleware order - accepts both song and image files
router.post('/upload', 
  verifySuperAdminToken, 
  upload.fields([
    { name: 'song', maxCount: 1 },
    { name: 'image', maxCount: 1 }
  ]), 
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
 *     description: |
 *       Permanently delete a song from the library. 
 *       
 *       **Important:** Songs that are used in posts or shorts cannot be deleted. 
 *       Use the toggle status endpoint to deactivate them instead.
 *       
 *       This will also delete the associated audio file and cover image from storage.
 *     tags: [Songs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the song to delete
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Song deleted successfully
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
 *                   example: "Song deleted successfully"
 *       400:
 *         description: Cannot delete song - it is used in posts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "VAL_2001"
 *                 message: "Cannot delete song: It is used in 5 posts. Deactivate it instead."
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/:id', verifySuperAdminToken, deleteSongById);

/**
 * @swagger
 * /api/v1/songs/{id}/toggle:
 *   patch:
 *     summary: Toggle song active/inactive status (SuperAdmin only)
 *     description: |
 *       Activate or deactivate a song. Inactive songs are hidden from the public song selection 
 *       but remain in the database and can be reactivated later.
 *       
 *       This is the recommended way to remove songs from public access without deleting them.
 *     tags: [Songs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the song
 *         example: "507f1f77bcf86cd799439011"
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
 *                 description: Set to true to activate, false to deactivate
 *                 example: false
 *     responses:
 *       200:
 *         description: Song status toggled successfully
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
 *                   example: "Song deactivated successfully"
 *                 song:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     title:
 *                       type: string
 *                     artist:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch('/:id/toggle', verifySuperAdminToken, toggleSongStatus);

// Validation rules for song update
const updateSongValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('artist')
    .optional()
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

/**
 * @swagger
 * /api/v1/songs/{id}:
 *   put:
 *     summary: Update song details and/or cover image (SuperAdmin only)
 *     description: |
 *       Update song metadata (title, artist, genre, duration) and/or replace the cover image.
 *       
 *       **Two Request Types:**
 *       1. **JSON** - Update metadata only (title, artist, genre, duration)
 *       2. **multipart/form-data** - Update metadata AND upload new cover image
 *       
 *       **Note:** The audio file cannot be changed. To replace the audio, delete and re-upload the song.
 *       
 *       **Image Requirements:**
 *       - Formats: JPEG, PNG, WebP, GIF
 *       - Max size: 10MB
 *       - Recommended: 1000x1000px (square)
 *       - Old image is automatically deleted when new one is uploaded
 *     tags: [Songs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the song to update
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Update metadata only (all fields optional)
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Song title
 *                 example: "Updated Song Title"
 *               artist:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Artist name
 *                 example: "Updated Artist"
 *               genre:
 *                 type: string
 *                 maxLength: 50
 *                 description: Song genre
 *                 example: "Rock"
 *               duration:
 *                 type: integer
 *                 minimum: 0
 *                 description: Duration in seconds
 *                 example: 180
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             description: Update metadata and upload new cover image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: New cover image (JPEG, PNG, WebP, GIF) - Recommended 1000x1000px
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Song title
 *                 example: "Updated Song Title"
 *               artist:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Artist name
 *                 example: "Updated Artist"
 *               genre:
 *                 type: string
 *                 maxLength: 50
 *                 description: Song genre
 *                 example: "Rock"
 *               duration:
 *                 type: integer
 *                 minimum: 0
 *                 description: Duration in seconds
 *                 example: 180
 *     responses:
 *       200:
 *         description: Song updated successfully
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
 *                   example: "Song updated successfully"
 *                 song:
 *                   $ref: '#/components/schemas/Song'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// Update route - can accept either JSON or multipart/form-data (for image upload)
// Create a conditional multer middleware
const conditionalImageUpload = (req, res, next) => {
  // Check if request is multipart/form-data
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    // Apply multer middleware for image upload
    upload.single('image')(req, res, (err) => {
      if (err) {
        return handleMulterError(err, req, res, next);
      }
      next();
    });
  } else {
    // For JSON requests, skip multer and go to validation
    next();
  }
};

router.put('/:id', 
  verifySuperAdminToken,
  conditionalImageUpload,
  ...updateSongValidation,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors: errors.array() });
    }
    next();
  },
  updateSong
);

module.exports = router;

