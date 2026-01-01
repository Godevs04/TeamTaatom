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

/**
 * Extract real client IP address from request
 * Handles proxies, load balancers, and CDNs
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
const getClientIP = (req) => {
  // Check various headers in order of priority
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one (original client)
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0] || req.ip || req.connection?.remoteAddress || 'Unknown';
  }
  
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to Express's req.ip or connection remoteAddress
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'Unknown';
};

/**
 * Get location from IP address using ipapi.co
 * Returns formatted location string or 'Unknown Location' on error
 * @param {string} ipAddress - IP address to geolocate
 * @returns {Promise<string>} - Location string
 */
const getLocationFromIP = async (ipAddress) => {
  // Skip geolocation for local/private IPs
  if (!ipAddress || 
      ipAddress === 'Unknown' || 
      ipAddress === '127.0.0.1' || 
      ipAddress === '::1' || 
      ipAddress.startsWith('192.168.') || 
      ipAddress.startsWith('10.') || 
      ipAddress.startsWith('172.16.') ||
      ipAddress.startsWith('172.17.') ||
      ipAddress.startsWith('172.18.') ||
      ipAddress.startsWith('172.19.') ||
      ipAddress.startsWith('172.20.') ||
      ipAddress.startsWith('172.21.') ||
      ipAddress.startsWith('172.22.') ||
      ipAddress.startsWith('172.23.') ||
      ipAddress.startsWith('172.24.') ||
      ipAddress.startsWith('172.25.') ||
      ipAddress.startsWith('172.26.') ||
      ipAddress.startsWith('172.27.') ||
      ipAddress.startsWith('172.28.') ||
      ipAddress.startsWith('172.29.') ||
      ipAddress.startsWith('172.30.') ||
      ipAddress.startsWith('172.31.')) {
    return 'Local Network';
  }
  
  try {
    const fetch = (...args) => import("node-fetch").then(m => m.default(...args));
    const geoRes = await fetch(`https://ipapi.co/${ipAddress}/json/`);
    
    if (geoRes.ok) {
      const geo = await geoRes.json();
      
      // Handle API errors
      if (geo.error) {
        logger.warn(`IP geolocation error for ${ipAddress}:`, geo.reason);
        return 'Unknown Location';
      }
      
      // Build location string
      const parts = [];
      if (geo.city) parts.push(geo.city);
      if (geo.region) parts.push(geo.region);
      if (geo.country_name) parts.push(geo.country_name);
      
      const location = parts.length > 0 ? parts.join(', ') : 'Unknown Location';
      return location;
    } else {
      logger.warn(`IP geolocation API returned status ${geoRes.status} for ${ipAddress}`);
      return 'Unknown Location';
    }
  } catch (error) {
    logger.warn(`Failed to get location for IP ${ipAddress}:`, error.message);
    return 'Unknown Location';
  }
};

module.exports = {
  setAuthToken,
  clearAuthToken,
  getAuthToken,
  getClientIP,
  getLocationFromIP
};

