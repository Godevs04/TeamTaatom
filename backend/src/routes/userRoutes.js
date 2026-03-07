const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const User = require('../models/User');

const router = express.Router();

/**
 * POST /save-push-token
 * Save Expo push token for the authenticated user (iOS / EAS).
 * Body: { token: string }
 */
router.post('/save-push-token', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token is required' });
    }
    const userId = req.user._id.toString();
    await User.findByIdAndUpdate(userId, { expoPushToken: token });
    return res.status(200).json({ message: 'Push token saved' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save push token' });
  }
});

module.exports = router;
