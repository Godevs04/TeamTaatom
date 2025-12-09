const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { getLocales, getLocaleById, uploadLocale, deleteLocaleById, toggleLocaleStatus, updateLocale } = require('../controllers/localeController');
const { verifySuperAdminToken } = require('../controllers/superAdminController');
const { sendError } = require('../utils/errorCodes');

const router = express.Router();

// Multer configuration for image file uploads
// No file size limits - unlimited uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    // fileSize removed - unlimited file size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, PNG, WebP, GIF)'), false);
    }
  }
});

// Error handler for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // File size limit errors removed - unlimited uploads
    return sendError(res, 'FILE_4001', 'File upload error: ' + err.message);
  }
  if (err) {
    return sendError(res, 'FILE_4003', err.message || 'Invalid file type');
  }
  next();
};

// Validation rules for locale upload
const uploadLocaleValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters'),
  body('country')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Country must be between 1 and 200 characters'),
  body('countryCode')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Country code must be between 1 and 10 characters'),
  body('stateProvince')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('State/Province must be less than 200 characters'),
  body('stateCode')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('State code must be less than 50 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a positive number')
];

// Public routes
/**
 * @swagger
 * /api/v1/locales:
 *   get:
 *     summary: Get all active locales
 *     tags: [Locales]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: countryCode
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of active locales
 */
router.get('/', getLocales);

/**
 * @swagger
 * /api/v1/locales/{id}:
 *   get:
 *     summary: Get locale by ID
 *     tags: [Locales]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Locale details
 */
router.get('/:id', getLocaleById);

// Protected routes (SuperAdmin only)
/**
 * @swagger
 * /api/v1/locales/upload:
 *   post:
 *     summary: Upload a new locale (SuperAdmin only)
 *     tags: [Locales]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *               - name
 *               - country
 *               - countryCode
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               name:
 *                 type: string
 *               country:
 *                 type: string
 *               countryCode:
 *                 type: string
 *               stateProvince:
 *                 type: string
 *               stateCode:
 *                 type: string
 *               description:
 *                 type: string
 *               displayOrder:
 *                 type: number
 *     responses:
 *       201:
 *         description: Locale uploaded successfully
 */
// Upload route with proper middleware order
router.post('/upload', 
  verifySuperAdminToken, 
  upload.single('image'), 
  handleMulterError,
  ...uploadLocaleValidation,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors: errors.array() });
    }
    next();
  },
  uploadLocale
);

/**
 * @swagger
 * /api/v1/locales/{id}:
 *   delete:
 *     summary: Delete a locale (SuperAdmin only)
 *     tags: [Locales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Locale deleted successfully
 */
router.delete('/:id', verifySuperAdminToken, deleteLocaleById);

/**
 * @swagger
 * /api/v1/locales/{id}/toggle:
 *   patch:
 *     summary: Toggle locale active/inactive status (SuperAdmin only)
 *     tags: [Locales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Locale status toggled successfully
 */
router.patch('/:id/toggle', verifySuperAdminToken, toggleLocaleStatus);

// Validation rules for locale update
const updateLocaleValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters'),
  body('country')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Country must be between 1 and 200 characters'),
  body('countryCode')
    .optional()
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Country code must be between 1 and 10 characters'),
  body('stateProvince')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('State/Province must be less than 200 characters'),
  body('stateCode')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('State code must be less than 50 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a positive number')
];

/**
 * @swagger
 * /api/v1/locales/{id}:
 *   put:
 *     summary: Update locale details (SuperAdmin only)
 *     tags: [Locales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               country:
 *                 type: string
 *               countryCode:
 *                 type: string
 *               stateProvince:
 *                 type: string
 *               stateCode:
 *                 type: string
 *               description:
 *                 type: string
 *               displayOrder:
 *                 type: number
 *     responses:
 *       200:
 *         description: Locale updated successfully
 */
router.put('/:id', 
  verifySuperAdminToken,
  ...updateLocaleValidation,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors: errors.array() });
    }
    next();
  },
  updateLocale
);

module.exports = router;

