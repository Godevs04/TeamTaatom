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
    multipart: 10 * 1024 * 1024, // 10MB for multipart (default)
  },
  // Auth endpoints (smaller limits)
  auth: {
    json: 50 * 1024, // 50KB
    urlencoded: 50 * 1024, // 50KB
    multipart: 5 * 1024 * 1024, // 5MB for profile picture uploads
  },
  // Post creation (allow much larger for high-quality images)
  post: {
    json: 10 * 1024, // 10KB (caption only, images handled separately)
    urlencoded: 10 * 1024,
    multipart: 50 * 1024 * 1024, // 50MB for high-quality image uploads (supports multiple images)
  },
  // Shorts creation (allow even larger for videos)
  shorts: {
    json: 10 * 1024, // 10KB
    urlencoded: 10 * 1024,
    multipart: 100 * 1024 * 1024, // 100MB for video uploads
  },
  // Comment endpoints
  comment: {
    json: 5 * 1024, // 5KB
    urlencoded: 5 * 1024,
    multipart: 5 * 1024 * 1024, // 5MB for image comments
  },
  // Profile updates
  profile: {
    json: 50 * 1024, // 50KB
    urlencoded: 50 * 1024,
    multipart: 10 * 1024 * 1024, // 10MB for profile picture uploads
  },
  // Settings
  settings: {
    json: 100 * 1024, // 100KB
    urlencoded: 100 * 1024,
    multipart: 5 * 1024 * 1024, // 5MB
  },
  // Songs upload (allow larger for audio files)
  songs: {
    json: 10 * 1024, // 10KB
    urlencoded: 10 * 1024,
    multipart: 20 * 1024 * 1024, // 20MB for audio file uploads
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
  } else if (path.includes('/songs')) {
    endpointType = 'songs';
  } else if (path.includes('/shorts')) {
    endpointType = 'shorts';
  } else if (path.includes('/posts') && path.includes('/comments')) {
    endpointType = 'comment';
  } else if (path.includes('/posts') && !path.includes('/comments') && !path.includes('/like')) {
    endpointType = 'post';
  } else if (path.includes('/profile') || path.includes('/settings')) {
    endpointType = path.includes('/settings') ? 'settings' : 'profile';
  }

  const limits = REQUEST_SIZE_LIMITS[endpointType] || REQUEST_SIZE_LIMITS.default;
  
  // Check for multipart/form-data first (for file uploads)
  if (contentType?.includes('multipart/form-data')) {
    return limits.multipart || REQUEST_SIZE_LIMITS.default.multipart;
  } else if (contentType?.includes('application/json')) {
    return limits.json;
  } else if (contentType?.includes('application/x-www-form-urlencoded')) {
    return limits.urlencoded;
  } else if (contentType?.includes('text/')) {
    return limits.text || limits.json;
  }
  
  // Default: if content-type is not set but path suggests file upload, use multipart limit
  if (path.includes('/posts') || path.includes('/shorts') || path.includes('/profile') || path.includes('/songs')) {
    return limits.multipart || REQUEST_SIZE_LIMITS.default.multipart;
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
    // Format error message based on limit size (MB for large limits, KB for small)
    const limitMB = limit / (1024 * 1024);
    const errorMessage = limitMB >= 1 
      ? `Request body too large. Maximum size: ${limitMB.toFixed(0)}MB`
      : `Request body too large. Maximum size: ${(limit / 1024).toFixed(0)}KB`;
    return sendError(res, 'VAL_2001', errorMessage);
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
    
    // Determine limit based on content type
    let limit;
    if (contentType?.includes('multipart/form-data')) {
      limit = limits.multipart || REQUEST_SIZE_LIMITS.default.multipart;
    } else if (contentType?.includes('application/json')) {
      limit = limits.json;
    } else {
      limit = limits.urlencoded;
    }

    if (contentLength > limit) {
      logger.warn('Request size limit exceeded', {
        path: req.path,
        contentLength,
        limit,
        endpointType,
        contentType,
        ip: req.ip,
      });
      return sendError(res, 'VAL_2001', `Request body too large. Maximum size: ${(limit / (1024 * 1024)).toFixed(0)}MB`);
    }

    next();
  };
};

module.exports = {
  requestSizeLimiter,
  createSizeLimiter,
  REQUEST_SIZE_LIMITS,
};

