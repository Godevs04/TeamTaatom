const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getFeatureFlags,
  createFeatureFlag,
  getAllFeatureFlags,
} = require('../controllers/featureFlagsController');

const router = express.Router();

// Routes
router.get('/', authMiddleware, getFeatureFlags);
router.post('/', authMiddleware, createFeatureFlag); // Admin check can be added
router.get('/all', authMiddleware, getAllFeatureFlags); // Admin check can be added

module.exports = router;

