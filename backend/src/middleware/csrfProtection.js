/**
 * CSRF Protection Middleware
 * Uses SameSite cookies and CSRF tokens for protection
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// Store CSRF tokens in memory (in production, use Redis)
const csrfTokens = new Map();
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

/**
 * Generate CSRF token
 */
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Middleware to generate and set CSRF token
 * Only generates new token if one doesn't exist or is expired
 */
const generateCSRF = (req, res, next) => {
  // Check if we already have a valid token for this session
  const existingToken = req.cookies['csrf-token'];
  let token = existingToken;
  
  // Verify existing token is valid
  if (existingToken) {
    const tokenData = csrfTokens.get(existingToken);
    if (tokenData && Date.now() < tokenData.expiry) {
      // Token is valid, reuse it
      res.setHeader('X-CSRF-Token', token);
      return next();
    }
    // Token expired or invalid, generate new one
  }
  
  // Generate new token only if needed
  token = generateCSRFToken();
  const expiry = Date.now() + CSRF_TOKEN_EXPIRY;
  
  csrfTokens.set(token, {
    expiry,
    ip: req.ip || req.connection.remoteAddress
  });

  // Set token in response header
  res.setHeader('X-CSRF-Token', token);
  
  // Also set in cookie with SameSite attribute
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('csrf-token', token, {
    httpOnly: false, // Need to read from JavaScript
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? 'strict' : 'lax', // Use 'lax' for development
    maxAge: CSRF_TOKEN_EXPIRY,
    path: '/'
  });

  next();
};

/**
 * Middleware to verify CSRF token
 */
const verifyCSRF = (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get token from header or cookie
  const token = req.headers['x-csrf-token'] || req.cookies['csrf-token'];
  
  if (!token) {
    logger.warn('CSRF token missing');
    return res.status(403).json({
      error: 'Forbidden',
      message: 'CSRF token missing'
    });
  }

  // Verify token exists and is valid
  const tokenData = csrfTokens.get(token);
  
  if (!tokenData) {
    logger.warn('Invalid CSRF token');
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid CSRF token'
    });
  }

  // Check expiry
  if (Date.now() > tokenData.expiry) {
    csrfTokens.delete(token);
    logger.warn('CSRF token expired');
    return res.status(403).json({
      error: 'Forbidden',
      message: 'CSRF token expired'
    });
  }

  // Clean up expired tokens periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    for (const [t, data] of csrfTokens.entries()) {
      if (Date.now() > data.expiry) {
        csrfTokens.delete(t);
      }
    }
  }

  next();
};

module.exports = {
  generateCSRF,
  verifyCSRF
};

