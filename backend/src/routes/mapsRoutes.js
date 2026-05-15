const express = require('express');
const { body, validationResult } = require('express-validator');
const {
  searchPlace,
  geocodeAddress,
  reverseGeocode,
  tourismOsmInBounds,
  reverseAddressForImport,
} = require('../controllers/mapsController');
const { verifySuperAdminToken } = require('../controllers/superAdminController');
const { authMiddleware } = require('../middleware/authMiddleware');
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

const reverseGeocodeValidation = [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
];

const bboxValidation = [
  body('south').isFloat({ min: -90, max: 90 }).withMessage('south invalid'),
  body('west').isFloat({ min: -180, max: 180 }).withMessage('west invalid'),
  body('north').isFloat({ min: -90, max: 90 }).withMessage('north invalid'),
  body('east').isFloat({ min: -180, max: 180 }).withMessage('east invalid'),
];

const reverseAddressImportValidation = [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('preferredName').optional({ values: 'null' }).trim().isLength({ max: 200 }).withMessage('preferredName too long'),
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

/**
 * Reverse-geocode coordinates and detect tourist-oriented POIs (SuperAdmin).
 */
router.post('/reverse-geocode', verifySuperAdminToken, reverseGeocodeValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors: errors.array() });
  }
  next();
}, reverseGeocode);

/** OSM tourism POIs in map bounds (SuperAdmin world map). */
router.post('/tourism-osm', verifySuperAdminToken, bboxValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors: errors.array() });
  }
  next();
}, tourismOsmInBounds);

/** Reverse geocode for import form (preferredName optional). */
router.post('/reverse-address', verifySuperAdminToken, reverseAddressImportValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors: errors.array() });
  }
  next();
}, reverseAddressForImport);

/**
 * User-accessible place search endpoint
 * @route POST /api/v1/maps/search-place-user
 * @access Private (Regular users)
 */
router.post('/search-place-user', authMiddleware, searchPlaceValidation, (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors: errors.array() });
  }
  next();
}, searchPlace);

module.exports = router;

