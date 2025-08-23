const express = require('express');
const { body } = require('express-validator');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  signup,
  verifyOTP,
  resendOTP,
  signin,
  getMe,
  googleSignIn,  
  forgotPassword,
  resetPassword
} = require('../controllers/authController');

const router = express.Router();

// Validation rules
const signupValidation = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
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
router.post('/resend-otp', resendOTP);
router.post('/signin', signinValidation, signin);
router.post('/google', googleSignIn);
router.get('/me', authMiddleware, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
