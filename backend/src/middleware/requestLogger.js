const logger = require('../utils/logger');

// Configuration
const ENABLE_REQUEST_LOGGING = process.env.ENABLE_REQUEST_LOGGING !== 'false'; // Default to true
const LOG_REQUEST_BODY = process.env.LOG_REQUEST_BODY === 'true'; // Default to false for security
const LOG_RESPONSE_BODY = process.env.LOG_RESPONSE_BODY === 'true'; // Default to false for security
const MAX_BODY_LOG_LENGTH = 500; // Maximum characters to log from request/response body

/**
 * Sanitize sensitive data from objects
 */
const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = ['password', 'token', 'otp', 'secret', 'apiKey', 'authorization', 'cookie'];
  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  for (const key in sanitized) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
};

/**
 * Truncate long strings for logging
 */
const truncateString = (str, maxLength = MAX_BODY_LOG_LENGTH) => {
  if (!str || typeof str !== 'string') return str;
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '... [truncated]';
};

/**
 * Extract relevant request information
 */
const extractRequestInfo = (req) => {
  const info = {
    method: req.method,
    path: req.path,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    platform: req.get('x-platform') || 'unknown',
    contentType: req.get('content-type') || 'unknown',
    contentLength: req.get('content-length') || '0',
    timestamp: new Date().toISOString(),
  };

  // Add query parameters (sanitized)
  if (req.query && Object.keys(req.query).length > 0) {
    info.query = sanitizeData(req.query);
  }

  // Add body if enabled and not too large
  if (LOG_REQUEST_BODY && req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = sanitizeData(req.body);
    const bodyStr = JSON.stringify(sanitizedBody);
    info.body = truncateString(bodyStr);
  }

  // Add user info if authenticated
  if (req.user) {
    info.userId = req.user._id || req.user.id || req.user.userId;
    info.userEmail = req.user.email ? '[REDACTED]' : undefined; // Never log full email
  }

  return info;
};

/**
 * Extract relevant response information
 */
const extractResponseInfo = (res, responseTime) => {
  const info = {
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    contentLength: res.get('content-length') || '0',
  };

  // Add response body if enabled (for errors only, to help debugging)
  if (LOG_RESPONSE_BODY && res.statusCode >= 400 && res.locals?.responseData) {
    const sanitizedBody = sanitizeData(res.locals.responseData);
    const bodyStr = JSON.stringify(sanitizedBody);
    info.body = truncateString(bodyStr);
  }

  return info;
};

/**
 * Request/Response logging middleware
 */
const requestLogger = (req, res, next) => {
  if (!ENABLE_REQUEST_LOGGING) {
    return next();
  }

  const startTime = Date.now();
  const requestInfo = extractRequestInfo(req);

  // Log request
  logger.info('API Request', {
    ...requestInfo,
    type: 'request',
  });

  // Store original end function
  const originalEnd = res.end;
  const originalJson = res.json;

  // Override res.json to capture response data
  res.json = function(data) {
    res.locals.responseData = data;
    return originalJson.call(this, data);
  };

  // Override res.end to log response
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;
    const responseInfo = extractResponseInfo(res, responseTime);

    // Log response
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[logLevel]('API Response', {
      ...requestInfo,
      ...responseInfo,
      type: 'response',
    });

    // Call original end
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

module.exports = requestLogger;

