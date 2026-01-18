const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Validation error handler middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Invalid request data',
      errors: errors.array(),
    });
  }
  next();
};

// Common validation rules
const commonValidations = {
  mongoId: (field = 'id') => param(field).isMongoId().withMessage(`${field} must be a valid MongoDB ID`),
  email: () => body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  password: () => body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  username: () => body('username')
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  fullName: () => body('fullName')
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Full name must be between 1 and 100 characters'),
  page: () => query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  limit: () => query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
};

// Auth validations
const authValidations = {
  signup: [
    commonValidations.email(),
    commonValidations.password(),
    commonValidations.username(),
    commonValidations.fullName(),
    handleValidationErrors,
  ],
  signin: [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email or username is required')
      .bail()
      .custom((value) => {
        // Accept either email format or username format
        if (!value || typeof value !== 'string') {
          throw new Error('Email or username must be a string');
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const usernameRegex = /^[a-z0-9_.]{3,20}$/;
        const normalizedValue = value.toLowerCase().trim();
        if (emailRegex.test(normalizedValue) || usernameRegex.test(normalizedValue)) {
          return true;
        }
        throw new Error('Please provide a valid email or username');
      }),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors,
  ],
  forgotPassword: [
    commonValidations.email(),
    handleValidationErrors,
  ],
  resetPassword: [
    body('token').notEmpty().withMessage('Reset token is required'),
    commonValidations.email(),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/).withMessage('Password must contain at least one number'),
    handleValidationErrors,
  ],
  verifyOtp: [
    commonValidations.email(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
    handleValidationErrors,
  ],
};

// Post validations
const postValidations = {
  create: [
    body('caption').optional().trim().isLength({ max: 2000 }).withMessage('Caption must be less than 2000 characters'),
    body('imageUrl').notEmpty().isURL().withMessage('Valid image URL is required'),
    body('location').optional().isObject().withMessage('Location must be an object'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().trim().isLength({ max: 50 }).withMessage('Each tag must be less than 50 characters'),
    handleValidationErrors,
  ],
  update: [
    commonValidations.mongoId('id'),
    body('caption').optional().trim().isLength({ max: 2000 }).withMessage('Caption must be less than 2000 characters'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    handleValidationErrors,
  ],
  getById: [
    commonValidations.mongoId('id'),
    handleValidationErrors,
  ],
  list: [
    commonValidations.page(),
    commonValidations.limit(),
    handleValidationErrors,
  ],
};

// Profile validations
const profileValidations = {
  update: [
    body('fullName').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Full name must be between 1 and 100 characters'),
    body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
    body('username').optional().trim().isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters'),
    handleValidationErrors,
  ],
  follow: [
    commonValidations.mongoId('userId'),
    handleValidationErrors,
  ],
  getUserById: [
    commonValidations.mongoId('userId'),
    handleValidationErrors,
  ],
};

// Chat validations
const chatValidations = {
  sendMessage: [
    body('recipientId').isMongoId().withMessage('Recipient ID must be a valid MongoDB ID'),
    body('text').trim().notEmpty().isLength({ max: 1000 }).withMessage('Message must be between 1 and 1000 characters'),
    handleValidationErrors,
  ],
  getChat: [
    commonValidations.mongoId('userId'),
    handleValidationErrors,
  ],
};

// Analytics validations
const analyticsValidations = {
  trackEvents: [
    body('events').isArray().withMessage('Events must be an array'),
    body('events.*.event').notEmpty().withMessage('Event name is required'),
    body('events.*.timestamp').optional().isISO8601().withMessage('Timestamp must be a valid ISO 8601 date'),
    handleValidationErrors,
  ],
  getData: [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    handleValidationErrors,
  ],
};

module.exports = {
  handleValidationErrors,
  commonValidations,
  authValidations,
  postValidations,
  profileValidations,
  chatValidations,
  analyticsValidations,
};

