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
  deletePost
} = require('../controllers/postController');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Multer configuration for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per image
    files: 10 // Maximum 10 files
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
router.get('/', optionalAuth, getPosts);
router.get('/:id', optionalAuth, getPostById);
router.post('/', authMiddleware, upload.fields([{ name: 'images', maxCount: 10 }]), createPostValidation, createPost);
router.get('/user/:userId', optionalAuth, getUserPosts);
router.post('/:id/like', authMiddleware, toggleLike);
router.post('/:id/comments', authMiddleware, addCommentValidation, addComment);
router.delete('/:id/comments/:commentId', authMiddleware, deleteComment);
router.delete('/:id', authMiddleware, deletePost);

module.exports = router;
