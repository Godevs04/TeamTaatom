const express = require('express');
const { body, validationResult } = require('express-validator');
const { searchPlace, geocodeAddress } = require('../controllers/mapsController');
const { verifySuperAdminToken } = require('../controllers/superAdminController');
const { sendError } = require('../utils/errorCodes');

const router = express.Router();

// Validation rules
const searchPlaceValidation = [
  body('placeName')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Place name must be between 1 and 200 characters'),
];

const geocodeValidation = [
  body('address')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Address must be between 1 and 500 characters'),
];

/**
 * @swagger
 * /api/v1/maps/search-place:
 *   post:
 *     summary: Search for a place using Google Places API (SuperAdmin only)
 *     tags: [Maps]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - placeName
 *             properties:
 *               placeName:
 *                 type: string
 *                 example: "Museum of Anthropology"
 *     responses:
 *       200:
 *         description: Place found successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/search-place', verifySuperAdminToken, searchPlaceValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors: errors.array() });
  }
  next();
}, searchPlace);

/**
 * @swagger
 * /api/v1/maps/geocode:
 *   post:
 *     summary: Geocode an address using Google Geocoding API (SuperAdmin only)
 *     tags: [Maps]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - address
 *             properties:
 *               address:
 *                 type: string
 *                 example: "Museum of Anthropology, Vancouver, CA"
 *     responses:
 *       200:
 *         description: Address geocoded successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/geocode', verifySuperAdminToken, geocodeValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors: errors.array() });
  }
  next();
}, geocodeAddress);

module.exports = router;

