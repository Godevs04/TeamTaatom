const logger = require('../utils/logger');
const { sendError, ERROR_CODES } = require('../utils/errorCodes');

const errorHandler = (err, req, res, next) => {
  logger.error('Error:', err);

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
    if (process.env.NODE_ENV === 'development') {
      details.stack = err.stack;
    }
  }

  return sendError(res, errorCode, customMessage, details);
};

module.exports = errorHandler;
