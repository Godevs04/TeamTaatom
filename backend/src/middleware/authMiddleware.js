const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'No token provided or invalid format' 
      });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'No token provided' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user and check if still exists
    const user = await User.findById(decoded.userId).select('-password -otp -otpExpires');
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'User not found' 
      });
    }

    if (!user.isVerified) {
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
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'Token expired' 
      });
    }

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
