const express = require('express');
const router = express.Router();
const { query, param } = require('express-validator');
const {
  searchHashtags,
  getTrendingHashtags,
  getHashtagPosts,
  getHashtagDetails,
} = require('../controllers/hashtagController');
const { optionalAuth } = require('../middleware/authMiddleware');

// Validation rules
const searchValidation = [
  query('q')
    .trim()
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Query must be between 1 and 100 characters'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

const trendingValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('timeRange')
    .optional()
    .isIn(['1h', '24h', '7d', '30d'])
    .withMessage('Time range must be one of: 1h, 24h, 7d, 30d'),
];

const hashtagParamValidation = [
  param('hashtag')
    .trim()
    .notEmpty()
    .withMessage('Hashtag is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Hashtag must be between 1 and 100 characters'),
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
];

// Routes
router.get('/search', searchValidation, searchHashtags);
router.get('/trending', trendingValidation, getTrendingHashtags);
router.get('/:hashtag', hashtagParamValidation, getHashtagDetails);
router.get('/:hashtag/posts', hashtagParamValidation, paginationValidation, optionalAuth, getHashtagPosts);

module.exports = router;

