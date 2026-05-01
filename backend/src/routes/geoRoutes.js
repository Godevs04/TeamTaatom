const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/authMiddleware');
const connectController = require('../controllers/connectController');

router.get('/countries', optionalAuth, connectController.getCountries);
router.get('/languages', optionalAuth, connectController.getLanguages);

module.exports = router;
