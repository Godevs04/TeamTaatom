const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getSettings,
  updateSettings,
  resetSettings,
  updateSettingCategory,
} = require('../controllers/settingsController');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Routes
router.get('/', getSettings);
router.put('/', updateSettings);
router.post('/reset', resetSettings);
router.put('/:category', updateSettingCategory);

module.exports = router;
