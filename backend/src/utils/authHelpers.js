/**
 * Authentication helper utilities
 * Handles token storage based on platform (web vs mobile)
 */

const logger = require('./logger');

/**
 * Set authentication token in response
 * Uses httpOnly cookies for web, returns token in response for mobile
 * @param {Object} res - Express response object
 * @param {string} token - JWT token
 * @param {Object} req - Express request object (to detect platform)
 * @returns {Object} - Response data with token (for mobile) or without (for web)
 */
const setAuthToken = (res, token, req) => {
  // Check platform header first (more reliable)
  const platform = req.headers['x-platform'];
  const userAgent = req.headers['user-agent'] || '';
  const isWeb = platform === 'web' || (userAgent.includes('Mozilla') && !userAgent.includes('Mobile') && !userAgent.includes('Android') && !userAgent.includes('iPhone'));
  
  // For web, set httpOnly cookie
  if (isWeb) {
    const isProduction = process.env.NODE_ENV === 'production';
    const origin = req.headers.origin || '';
    
    // Check if frontend and backend are on same origin (for cookie to work)
    const backendHost = req.get('host') || '';
    const isSameOrigin = origin.includes(backendHost.split(':')[0]) || 
                         origin.includes('localhost') && backendHost.includes('localhost');
    
    // For cross-origin in development, return token in response
    // Browser won't accept sameSite: 'none' without secure: true (HTTPS)
    if (!isProduction && !isSameOrigin) {
      // Cross-origin in development - return token in response as fallback
      // Frontend will store it in sessionStorage
      logger.debug('Cross-origin request detected, returning token in response');
      return { token };
    }
    
    // Same origin or production - use httpOnly cookie
    res.cookie('authToken', token, {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: isProduction, // HTTPS only in production
      sameSite: isProduction ? 'strict' : 'lax', // Use 'lax' for same-origin development
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/'
    });
    
    // Don't send token in response body for web (same origin)
    return {};
  }
  
  // For mobile, return token in response (will be stored in AsyncStorage)
  return { token };
};

/**
 * Clear authentication token
 * @param {Object} res - Express response object
 */
const clearAuthToken = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/'
  });
};

/**
 * Get token from request (cookie for web, header for mobile)
 * @param {Object} req - Express request object
 * @returns {string|null} - Token or null
 */
const getAuthToken = (req) => {
  // Check cookie first (web)
  if (req.cookies && req.cookies.authToken) {
    return req.cookies.authToken;
  }
  
  // Check Authorization header (mobile)
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }
  
  return null;
};

/**
 * Debug function to log cookie information
 */
const debugCookies = (req) => {
  const logger = require('./logger');
  logger.debug('Cookies received:', req.cookies);
  logger.debug('Cookie header:', req.headers.cookie);
  logger.debug('Platform:', req.headers['x-platform']);
  logger.debug('User-Agent:', req.headers['user-agent']);
};

module.exports = {
  setAuthToken,
  clearAuthToken,
  getAuthToken
};

