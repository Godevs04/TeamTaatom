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

  const sensitiveFields = ['password', 'token', 'otp', 'secret', 'apiKey', 'authorization', 'cookie', 'authToken', 'refreshToken', 'founder_token', 'csrfToken'];
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
    requestId: req.id || undefined,
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
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
// Production default is 'minimal': nothing is logged for normal traffic. Set REQUEST_LOG_MODE=full
// to get the old per-request request/response logging while debugging.
const REQUEST_LOG_MODE = process.env.REQUEST_LOG_MODE || (IS_DEVELOPMENT ? 'full' : 'minimal');
const SLOW_REQUEST_MS = parseInt(process.env.SLOW_REQUEST_MS, 10) || 3000;

/** Production logging: one line for server errors and slow requests only, nothing per normal request. */
const minimalRequestLogger = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  res.on('finish', () => {
    const responseTime = Number(process.hrtime.bigint() - startTime) / 1e6;
    const isServerError = res.statusCode >= 500;
    const isSlow = responseTime >= SLOW_REQUEST_MS;
    if (!isServerError && !isSlow) return;
    if (req.path === '/health' || req.path === '/api/health') return;
    const entry = {
      requestId: req.id || undefined,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTimeMs: Math.round(responseTime),
      platform: req.get('x-platform') || undefined,
      type: isServerError ? 'server_error' : 'slow_request',
    };
    if (isServerError) logger.error('API Response', entry);
    else logger.warn('Slow API request', entry);
  });
  next();
};

const requestLogger = (req, res, next) => {
  if (!ENABLE_REQUEST_LOGGING) {
    return next();
  }
  if (REQUEST_LOG_MODE !== 'full') {
    return minimalRequestLogger(req, res, next);
  }

  const startTime = Date.now();
  const requestInfo = extractRequestInfo(req);

  // Skip logging for health checks and 304 responses (cached)
  const isHealthCheck = req.path === '/health' || req.path === '/api/health';
  const isCachedRequest = req.get('if-none-match') || req.get('if-modified-since');
  
  // Only log request if not a health check
  if (!isHealthCheck) {
    // For cached requests, use debug level instead of info
    if (isCachedRequest) {
      logger.debug('API Request (cached)', {
        method: requestInfo.method,
        path: requestInfo.path,
        type: 'request',
      });
    } else {
      logger.info('API Request', {
        ...requestInfo,
        type: 'request',
      });
    }
  }

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

    // Skip logging for health checks
    const isHealthCheck = req.path === '/health' || req.path === '/api/health';
    
    if (!isHealthCheck) {
      // For 304 (Not Modified) responses, use debug level to reduce log noise
      if (res.statusCode === 304) {
        logger.debug('API Response (304 Not Modified)', {
          method: requestInfo.method,
          path: requestInfo.path,
          statusCode: res.statusCode,
          responseTime: responseInfo.responseTime,
          type: 'response',
        });
      } else {
        // Log response for other status codes
        const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
        logger[logLevel]('API Response', {
          ...requestInfo,
          ...responseInfo,
          type: 'response',
        });
      }
    }

    // Call original end
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

module.exports = requestLogger;

