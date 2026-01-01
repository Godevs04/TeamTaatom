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
/**
 * @swagger
 * /api/v1/settings:
 *   get:
 *     summary: Get authenticated user's settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Settings document
 */
router.get('/', getSettings);
/**
 * @swagger
 * /api/v1/settings:
 *   put:
 *     summary: Update settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.put('/', updateSettings);
/**
 * @swagger
 * /api/v1/settings/reset:
 *   post:
 *     summary: Reset settings to defaults
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Settings reset
 */
router.post('/reset', resetSettings);
/**
 * @swagger
 * /api/v1/settings/{category}:
 *   put:
 *     summary: Update a settings category
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Category updated
 */
router.put('/:category', updateSettingCategory);

module.exports = router;
