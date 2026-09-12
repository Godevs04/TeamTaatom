const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getCreatorStatus,
  requestCreatorAccess,
} = require('../controllers/videoCreatorController');

const router = express.Router();

router.get('/status', authMiddleware, getCreatorStatus);
router.post('/request', authMiddleware, requestCreatorAccess);

module.exports = router;
