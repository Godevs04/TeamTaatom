const { sendError } = require('../utils/errorCodes');
const logger = require('../utils/logger');

/**
 * Request size limit configuration per endpoint type
 */
const REQUEST_SIZE_LIMITS = {
  // Default limits
  default: {
    json: 1 * 1024 * 1024, // 1MB
    urlencoded: 1 * 1024 * 1024, // 1MB
    text: 100 * 1024, // 100KB
  },
  // Auth endpoints (smaller limits)
  auth: {
    json: 50 * 1024, // 50KB
    urlencoded: 50 * 1024, // 50KB
  },
  // Post creation (allow larger for captions)
  post: {
    json: 10 * 1024, // 10KB (caption only, images handled separately)
    urlencoded: 10 * 1024,
  },
  // Comment endpoints
  comment: {
    json: 5 * 1024, // 5KB
    urlencoded: 5 * 1024,
  },
  // Profile updates
  profile: {
    json: 50 * 1024, // 50KB
    urlencoded: 50 * 1024,
  },
  // Settings
  settings: {
    json: 100 * 1024, // 100KB
    urlencoded: 100 * 1024,
  },
};

/**
 * Get size limit for a specific endpoint
 */
const getSizeLimit = (path, contentType) => {
  // Determine endpoint type from path
  let endpointType = 'default';
  
  if (path.includes('/auth/') || path.includes('/signin') || path.includes('/signup')) {
    endpointType = 'auth';
  } else if (path.includes('/posts') && path.includes('/comments')) {
    endpointType = 'comment';
  } else if (path.includes('/posts') && !path.includes('/comments') && !path.includes('/like')) {
    endpointType = 'post';
  } else if (path.includes('/profile') || path.includes('/settings')) {
    endpointType = path.includes('/settings') ? 'settings' : 'profile';
  }

  const limits = REQUEST_SIZE_LIMITS[endpointType] || REQUEST_SIZE_LIMITS.default;
  
  if (contentType?.includes('application/json')) {
    return limits.json;
  } else if (contentType?.includes('application/x-www-form-urlencoded')) {
    return limits.urlencoded;
  } else if (contentType?.includes('text/')) {
    return limits.text || limits.json;
  }
  
  return limits.json; // Default to JSON limit
};

/**
 * Middleware to enforce request size limits per endpoint
 */
const requestSizeLimiter = (req, res, next) => {
  const contentType = req.get('content-type') || '';
  const contentLength = parseInt(req.get('content-length') || '0', 10);
  const limit = getSizeLimit(req.path, contentType);

  // Check content-length header first (fast check)
  if (contentLength > limit) {
    logger.warn('Request size limit exceeded', {
      path: req.path,
      contentLength,
      limit,
      contentType,
      ip: req.ip,
    });
    return sendError(res, 'VAL_2001', `Request body too large. Maximum size: ${(limit / 1024).toFixed(0)}KB`);
  }

  // For streaming requests, we'll check in the body parser
  // This is a pre-check using content-length header
  next();
};

/**
 * Create endpoint-specific size limiters
 */
const createSizeLimiter = (endpointType = 'default') => {
  return (req, res, next) => {
    const contentType = req.get('content-type') || '';
    const contentLength = parseInt(req.get('content-length') || '0', 10);
    const limits = REQUEST_SIZE_LIMITS[endpointType] || REQUEST_SIZE_LIMITS.default;
    const limit = contentType?.includes('application/json') 
      ? limits.json 
      : limits.urlencoded;

    if (contentLength > limit) {
      logger.warn('Request size limit exceeded', {
        path: req.path,
        contentLength,
        limit,
        endpointType,
        ip: req.ip,
      });
      return sendError(res, 'VAL_2001', `Request body too large. Maximum size: ${(limit / 1024).toFixed(0)}KB`);
    }

    next();
  };
};

module.exports = {
  requestSizeLimiter,
  createSizeLimiter,
  REQUEST_SIZE_LIMITS,
};

