const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    console.log('Auth header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No token provided or invalid format');
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'No token provided or invalid format' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      console.log('No token provided after Bearer');
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'No token provided' 
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.log('Token verification failed:', err);
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: 'Access denied',
          message: 'Invalid token' 
        });
      }
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Access denied',
          message: 'Token expired' 
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
      console.log('User not found for token:', decoded.userId);
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'User not found' 
      });
    }

    if (!user.isVerified) {
      console.log('Account not verified for user:', user._id);
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'Account not verified' 
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Error verifying token' 
    });
  }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
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
