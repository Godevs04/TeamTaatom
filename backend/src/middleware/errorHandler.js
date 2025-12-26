const logger = require('../utils/logger');
const { sendError, ERROR_CODES } = require('../utils/errorCodes');
const Sentry = require('../instrument');

/**
 * Sanitize error details to prevent sensitive information leakage
 * @param {object} details - Error details object
 * @returns {object} Sanitized details
 */
const sanitizeErrorDetails = (details) => {
  const sanitized = { ...details };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      delete sanitized[field];
    }
  });

  // Remove stack traces unless in development
  if (process.env.NODE_ENV !== 'development' && sanitized.stack) {
    delete sanitized.stack;
  }

  // Sanitize nested objects
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeErrorDetails(sanitized[key]);
    }
  });

  return sanitized;
};

const errorHandler = async (err, req, res, next) => {
  logger.error('Error:', err);
  
  // Note: Sentry's setupExpressErrorHandler already captures the error
  // We need to ensure it's flushed BEFORE sending response
  if (Sentry && process.env.SENTRY_DSN) {
    // Add comprehensive context to the already-captured error
    Sentry.setContext('error_details', {
      errorCode: err.errorCode || 'SRV_6001',
      path: req.path,
      method: req.method,
      query: req.query,
      body: sanitizeErrorDetails(req.body), // Sanitize to remove sensitive data
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    // Add user context if available
    if (req.user) {
      Sentry.setUser({
        id: req.user._id?.toString() || req.user.id,
        username: req.user.username,
        email: req.user.email,
      });
    } else {
      // Clear user context if not authenticated
      Sentry.setUser(null);
    }

    // Add tags for better filtering
    Sentry.setTag('error_code', err.errorCode || 'SRV_6001');
    Sentry.setTag('http_method', req.method);
    Sentry.setTag('http_path', req.path);
    Sentry.setTag('authenticated', !!req.user);
    
    // Note: Sentry's Express error handler already captures the error
    // We're just adding context here. The level is set automatically by Sentry
    // based on the error severity. No need to call setLevel or captureException again.
    
    // CRITICAL: Flush Sentry BEFORE sending response (await to ensure it's sent)
    try {
      await Sentry.flush(5000);
      if (process.env.NODE_ENV === 'development') {
        logger.log('✅ Sentry error flushed successfully');
      }
    } catch (flushError) {
      logger.error('Failed to flush Sentry:', flushError);
    }
  }

  let errorCode = 'SRV_6001'; // Default server error
  let customMessage = null;
  let details = {};

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    errorCode = 'RES_3001';
    customMessage = 'The requested resource was not found. Please check the ID and try again.';
  }

  // Mongoose duplicate key
  else if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    if (field === 'email') {
      errorCode = 'RES_3003';
      customMessage = 'An account with this email already exists. Please sign in or use a different email.';
    } else if (field === 'username') {
      errorCode = 'RES_3004';
      customMessage = 'This username is already taken. Please choose a different username.';
    } else if (field === 'googleId') {
      errorCode = 'RES_3002';
      customMessage = 'This Google account is already linked to another user.';
    } else {
      errorCode = 'RES_3002';
      customMessage = 'This value already exists. Please use a different one.';
    }
    details.field = field;
  }

  // Mongoose validation error
  else if (err.name === 'ValidationError') {
    errorCode = 'VAL_2001';
    const messages = Object.values(err.errors).map(val => val.message);
    customMessage = messages.length === 1 
      ? messages[0] 
      : `Validation failed: ${messages.join('; ')}`;
    details.validationErrors = messages;
  }

  // JWT errors
  else if (err.name === 'JsonWebTokenError') {
    errorCode = 'AUTH_1002';
    customMessage = 'Your session is invalid. Please sign in again.';
  }

  else if (err.name === 'TokenExpiredError') {
    errorCode = 'AUTH_1003';
    customMessage = 'Your session has expired. Please sign in again.';
  }

  // Multer errors (file upload)
  else if (err.code === 'LIMIT_FILE_SIZE') {
    errorCode = 'FILE_4002';
    customMessage = 'The file is too large. Please upload a file smaller than 10MB.';
  }

  else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    errorCode = 'FILE_4003';
    customMessage = 'Unexpected file field. Please check your upload and try again.';
  }

  // Rate limiting errors
  else if (err.statusCode === 429) {
    errorCode = 'RATE_5001';
    customMessage = 'Too many requests. Please wait a moment and try again.';
  }

  // Network/Database errors
  else if (err.name === 'MongoNetworkError' || err.name === 'MongoServerError') {
    errorCode = 'SRV_6002';
    customMessage = 'Unable to connect to the server. Please try again later.';
  }

  // If error already has a code, use it
  else if (err.errorCode) {
    errorCode = err.errorCode;
    customMessage = err.message;
    details = err.details || {};
  }

  // Default error response
  else {
    customMessage = err.message || 'An unexpected error occurred. Please try again later.';
    // NEVER include stack traces in production - only in development
    if (process.env.NODE_ENV === 'development') {
      details.stack = err.stack;
    }
  }

  // Sanitize details to prevent sensitive information leakage
  const sanitizedDetails = sanitizeErrorDetails(details);

  // Send response to client
  return sendError(res, errorCode, customMessage, sanitizedDetails);
};

module.exports = errorHandler;
