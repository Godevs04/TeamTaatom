const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getCreatorStatus,
  getApplicationForm,
  requestCreatorAccess,
} = require('../controllers/videoCreatorController');

const router = express.Router();

router.get('/status', authMiddleware, getCreatorStatus);
router.get('/application-form', authMiddleware, getApplicationForm);
router.post('/request', authMiddleware, requestCreatorAccess);

module.exports = router;
