const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { sendOTPEmail, sendWelcomeEmail } = require('../utils/sendOtp');

// Google OAuth client
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register user
// @route   POST /auth/signup
// @access  Public
const signup = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { fullName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({
          error: 'User already exists',
          message: 'An account with this email already exists and is verified'
        });
      } else {
        // User exists but not verified, resend OTP
        const otp = existingUser.generateOTP();
        await existingUser.save();
        
        await sendOTPEmail(email, otp, fullName);
        
        return res.status(200).json({
          message: 'Account exists but not verified. New OTP sent to your email',
          email: email
        });
      }
    }

    // Create new user
    const user = new User({
      fullName,
      email,
      password
    });

    // Generate OTP
    const otp = user.generateOTP();
    await user.save();

    // Send OTP email
    await sendOTPEmail(email, otp, fullName);

    res.status(201).json({
      message: 'Signup successful, please verify OTP sent to your email',
      email: email
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error creating account'
    });
  }
};

// @desc    Verify OTP
// @route   POST /auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, otp } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found with this email'
      });
    }

    // Check if already verified
    if (user.isVerified) {
      return res.status(400).json({
        error: 'Already verified',
        message: 'This account is already verified'
      });
    }

    // Verify OTP
    if (!user.verifyOTP(otp)) {
      return res.status(400).json({
        error: 'Invalid OTP',
        message: 'The OTP is invalid or has expired'
      });
    }

    // Update user as verified and clear OTP
    user.isVerified = true;
    user.clearOTP();
    await user.save();

    // Send welcome email (don't await to avoid delays)
    sendWelcomeEmail(email, user.fullName).catch(err => 
      console.error('Welcome email failed:', err)
    );

    res.status(200).json({
      message: 'OTP verified successfully. You can now sign in.',
      email: email
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error verifying OTP'
    });
  }
};

// @desc    Resend OTP
// @route   POST /auth/resend-otp
// @access  Public
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email required',
        message: 'Email is required to resend OTP'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found with this email'
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        error: 'Already verified',
        message: 'This account is already verified'
      });
    }

    // Generate new OTP
    const otp = user.generateOTP();
    await user.save();

    // Send OTP email
    await sendOTPEmail(email, otp, user.fullName);

    res.status(200).json({
      message: 'New OTP sent to your email',
      email: email
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error resending OTP'
    });
  }
};

// @desc    Authenticate user & get token
// @route   POST /auth/signin
// @access  Public
const signin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password'
      });
    }

    // Check if verified
    if (!user.isVerified) {
      return res.status(401).json({
        error: 'Account not verified',
        message: 'Please verify your account with the OTP sent to your email'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      message: 'Sign in successful',
      token,
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error signing in'
    });
  }
};

// @desc    Get current user
// @route   GET /auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('followers', 'fullName profilePic')
      .populate('following', 'fullName profilePic');

    res.status(200).json({
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching user data'
    });
  }
};

// @desc    Google OAuth sign-in
// @route   POST /auth/google
// @access  Public
const googleSignIn = async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'Authorization code and redirect URI are required'
      });
    }

    // Exchange authorization code for tokens
    const { tokens } = await googleClient.getToken({
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    });

    // Verify the ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Failed to verify Google ID token'
      });
    }

    const { sub: googleId, email, name, picture } = payload;

    // Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
      // User exists, update Google ID if not set
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // Create new user
      user = new User({
        fullName: name || 'Google User',
        email,
        googleId,
        profilePic: picture || '',
        isVerified: true, // Google accounts are pre-verified
        password: 'google_oauth_placeholder', // Placeholder password for Google users
      });
      await user.save();

      // Send welcome email (don't await to avoid delays)
      sendWelcomeEmail(email, user.fullName).catch(err => 
        console.error('Welcome email failed:', err)
      );
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      message: 'Google sign-in successful',
      token,
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('Google sign-in error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error processing Google sign-in'
    });
  }
};

module.exports = {
  signup,
  verifyOTP,
  resendOTP,
  signin,
  getMe,
  googleSignIn
};
