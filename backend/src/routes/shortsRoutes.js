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
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
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
router.post('/', authMiddleware, upload.single('video'), createShortValidation, createShort);

module.exports = router;
