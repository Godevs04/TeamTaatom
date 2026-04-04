const express = require('express');
const { createReport } = require('../controllers/reportController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/v1/reports - Submit report (user or content)
router.post('/', authMiddleware, createReport);

module.exports = router;
