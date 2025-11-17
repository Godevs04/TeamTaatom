const express = require('express');
const router = express.Router();
const { searchPosts, searchByLocation } = require('../controllers/searchController');

// Advanced search routes
router.get('/posts', searchPosts);
router.get('/location', searchByLocation);

module.exports = router;

