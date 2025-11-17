const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { searchUsersForMention } = require('../controllers/mentionController');

router.get('/search', authMiddleware, searchUsersForMention);

module.exports = router;

