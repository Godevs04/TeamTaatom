const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const {
  getProfile,
  updateProfile,
  toggleFollow,
  searchUsers
} = require('../controllers/profileController');

const router = express.Router();

// Multer configuration for profile picture uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile pictures
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
const updateProfileValidation = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters')
];

// Routes
router.get('/search', optionalAuth, searchUsers);
router.get('/:id', optionalAuth, getProfile);
router.put('/:id', authMiddleware, upload.single('profilePic'), updateProfileValidation, updateProfile);
router.post('/:id/follow', authMiddleware, toggleFollow);

module.exports = router;
