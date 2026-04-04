const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/authMiddleware');
const { passwordStrengthValidator } = require('../utils/passwordValidator');
const { authValidations } = require('../middleware/validation');
const { endpointLimiters } = require('../middleware/rateLimit');
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
  refreshToken,
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
  passwordStrengthValidator, // Additional strength validation
  body('termsAccepted')
    .custom((val) => val === true || val === 'true')
    .withMessage('You must accept the Terms & Conditions to create an account')
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

// Routes with validation and rate limiting
/**
 * @swagger
 * /api/v1/auth/signup:
 *   post:
 *     summary: Register a new user account
 *     description: |
 *       Creates a new user account and sends a 6-digit verification OTP to the provided email address.
 *       
 *       **Password Requirements:**
 *       - Minimum 8 characters
 *       - At least one uppercase letter
 *       - At least one lowercase letter
 *       - At least one number
 *       - At least one special character
 *       
 *       **Username Requirements:**
 *       - 3-20 characters
 *       - Lowercase letters, numbers, and underscores only
 *       - Must be unique
 *       
 *       After signup, verify the OTP using `/api/v1/auth/verify-otp` to activate the account.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - username
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 description: User's full name
 *                 example: "Jane Traveler"
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 20
 *                 pattern: '^[a-z0-9_.]+$'
 *                 description: Unique username (lowercase, numbers, underscores only)
 *                 example: "janetravels"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Valid email address (must be unique)
 *                 example: "jane@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: Strong password meeting all requirements
 *                 example: "P@ssw0rd!"
 *     responses:
 *       201:
 *         description: Signup successful and OTP sent to email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Account created. Please verify your email with the OTP sent."
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     isVerified:
 *                       type: boolean
 *                       example: false
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: Email or username already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "AUTH_1005"
 *                 message: "Email already registered"
 */
router.post('/signup', authValidations.signup, endpointLimiters.signup, signup);
/**
 * @swagger
 * /api/v1/auth/verify-otp:
 *   post:
 *     summary: Verify OTP for account activation
 *     description: |
 *       Verifies the 6-digit OTP sent to the user's email during signup.
 *       
 *       **OTP Details:**
 *       - 6-digit numeric code
 *       - Expires after 10 minutes
 *       - Can be resent using `/api/v1/auth/resend-otp`
 *       
 *       Upon successful verification, the account is activated and the user can sign in.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address used during signup
 *                 example: "jane@example.com"
 *               otp:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 description: 6-digit OTP code sent to email
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully, account activated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Account verified successfully"
 *                 token:
 *                   type: string
 *                   description: JWT token for authenticated requests
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         description: User not found or OTP expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "AUTH_1004"
 *                 message: "Invalid or expired OTP"
 */
router.post('/verify-otp', authValidations.verifyOtp, endpointLimiters.otp, verifyOTP);
/**
 * @swagger
 * /api/v1/auth/check-username:
 *   get:
 *     summary: Check username availability
 *     description: |
 *       Checks if a username is available for registration. Useful for real-time validation in signup forms.
 *       
 *       **Username Rules:**
 *       - 3-20 characters
 *       - Lowercase letters, numbers, and underscores only
 *       - Must be unique
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *           minLength: 3
 *           maxLength: 20
 *           pattern: '^[a-z0-9_.]+$'
 *         required: true
 *         description: Username to check for availability
 *         example: "janetravels"
 *     responses:
 *       200:
 *         description: Username availability status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                   example: true
 *                   description: true if username is available, false if taken
 *                 message:
 *                   type: string
 *                   example: "Username is available"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
// Check username availability - no validation middleware to avoid blocking requests
// Validation is handled in the controller
router.get('/check-username', checkUsernameAvailability);
/**
 * @swagger
 * /api/v1/auth/resend-otp:
 *   post:
 *     summary: Resend verification OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/resend-otp', authValidations.verifyOtp, endpointLimiters.otp, resendOTP);
/**
 * @swagger
 * /api/v1/auth/signin:
 *   post:
 *     summary: User sign in
 *     description: |
 *       Authenticates a user with email and password. Returns a JWT token for API clients and sets an HttpOnly cookie for web clients.
 *       
 *       **Authentication Methods:**
 *       - **Mobile/API**: Use the `token` from response in `Authorization: Bearer <token>` header
 *       - **Web**: Cookie is automatically set, no manual handling needed
 *       
 *       **Note:** Account must be verified (OTP verified) before signin.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Registered email address
 *                 example: "jane@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User password
 *                 example: "P@ssw0rd!"
 *     responses:
 *       200:
 *         description: Sign in successful
 *         headers:
 *           Set-Cookie:
 *             description: HttpOnly auth cookie for web clients (automatically sent)
 *             schema:
 *               type: string
 *               example: "authToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; HttpOnly; Secure; SameSite=Strict"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Sign in successful"
 *                 token:
 *                   type: string
 *                   description: JWT token for API clients (use in Authorization header)
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Account not verified
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error:
 *                 code: "AUTH_1006"
 *                 message: "Please verify your email address first"
 */
router.post('/signin', authValidations.signin, endpointLimiters.signin, signin);
/**
 * @swagger
 * /api/v1/auth/google:
 *   post:
 *     summary: Google OAuth sign in
 *     description: Exchanges Google ID token for a Taatom session.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Google ID token
 *     responses:
 *       200:
 *         description: Google sign in successful
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/google', endpointLimiters.signin, googleSignIn);
/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get authenticated user profile
 *     description: |
 *       Returns the current authenticated user's profile information.
 *       
 *       **Use Cases:**
 *       - Check if user is logged in
 *       - Get user profile data
 *       - Verify authentication status
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user info retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/me', authMiddleware, getMe);
/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh JWT token
 *     description: |
 *       Generates a new JWT token using the current valid token. Useful for extending session without re-authentication.
 *       
 *       **Token Expiry:**
 *       - Tokens expire after 24 hours
 *       - Refresh before expiry to maintain session
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: New token issued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Token refreshed successfully"
 *                 token:
 *                   type: string
 *                   description: New JWT token
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/refresh', authMiddleware, refreshToken);
/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       404:
 *         description: User not found
 */
router.post('/forgot-password', authValidations.forgotPassword, endpointLimiters.passwordReset, forgotPassword);
/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password with OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: Invalid token or user not found
 */
router.post('/reset-password', authValidations.resetPassword, endpointLimiters.passwordReset, resetPassword);
/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Log out the current user
 *     description: |
 *       Invalidates the current session and clears authentication cookies.
 *       
 *       **What happens:**
 *       - JWT token is invalidated
 *       - HttpOnly cookie is cleared
 *       - User must sign in again to access protected routes
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Logged out successfully"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/logout', authMiddleware, logout);

module.exports = router;
