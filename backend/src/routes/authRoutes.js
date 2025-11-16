const express = require('express');
const { body, param, query } = require('express-validator');
const { authMiddleware } = require('../middleware/authMiddleware');
const { passwordStrengthValidator } = require('../utils/passwordValidator');
const {
  signup,
  checkUsernameAvailability,
  verifyOTP,
  resendOTP,
  signin,
  getMe,
  googleSignIn,  
  forgotPassword,
  resetPassword,
  logout
} = require('../controllers/authController');

const router = express.Router();

// Validation rules
const signupValidation = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters'),
  body('username')
    .trim()
    .toLowerCase()
    .matches(/^[a-z0-9_.]+$/)
    .withMessage('Username can only contain lowercase letters, numbers, and underscores')
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be 3-20 characters long'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
    .withMessage('Password must contain at least one special character'),
  passwordStrengthValidator // Additional strength validation
];

const verifyOTPValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be 6 digits')
];

const signinValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Routes
router.post('/signup', signupValidation, signup);
router.post('/verify-otp', verifyOTPValidation, verifyOTP);
router.get('/check-username', [query('username').trim().toLowerCase().notEmpty()], checkUsernameAvailability);
router.post('/resend-otp', resendOTP);
router.post('/signin', signinValidation, signin);
router.post('/google', googleSignIn);
router.get('/me', authMiddleware, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', authMiddleware, logout);

module.exports = router;
