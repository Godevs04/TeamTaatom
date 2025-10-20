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
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
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

// Routes
router.get('/', optionalAuth, getShorts);
router.get('/user/:userId', optionalAuth, getUserShorts);
// Accept video and optional image (thumbnail) fields
router.post('/', authMiddleware, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), createShortValidation, createShort);

module.exports = router;
