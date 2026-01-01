const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const { getAuthToken } = require('../utils/authHelpers');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from cookie (web) or Authorization header (mobile)
    const token = getAuthToken(req);
    
    if (!token) {
      logger.warn('No token provided for path:', req.path);
      // Use generic message to avoid revealing authentication flow
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'Authentication required' 
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      logger.warn('Token verification failed:', err.name);
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: 'Access denied',
          message: 'Your session is invalid. Please sign in again.' 
        });
      }
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Access denied',
          message: 'Your session has expired. Please sign in again.' 
        });
      }
      return res.status(500).json({ 
        error: 'Internal server error',
        message: 'Error verifying token' 
      });
    }
    
    // Find user and check if still exists
    const user = await User.findById(decoded.userId).select('-password -otp -otpExpires');
    if (!user) {
      logger.warn('User not found for token:', decoded.userId);
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'User not found' 
      });
    }

    if (!user.isVerified) {
      logger.warn('Account not verified for user:', user._id);
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'Account not verified' 
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Error verifying token' 
    });
  }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    // Try to get token from cookie (web) or header (mobile)
    const token = getAuthToken(req);
    
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password -otp -otpExpires');
    
    if (user && user.isVerified) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Silently continue without user for optional auth
    next();
  }
};

module.exports = { authMiddleware, optionalAuth };
