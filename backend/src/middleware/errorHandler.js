const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Error:', err);

  let error = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'The requested resource was not found. Please check the ID and try again.';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    let message = 'This value already exists. Please use a different one.';
    
    // Extract field name from error
    const field = Object.keys(err.keyValue)[0];
    if (field === 'email') {
      message = 'An account with this email already exists. Please sign in or use a different email.';
    } else if (field === 'username') {
      message = 'This username is already taken. Please choose a different username.';
    } else if (field === 'googleId') {
      message = 'This Google account is already linked to another user.';
    }
    
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    const message = messages.length === 1 
      ? messages[0] 
      : `Validation failed: ${messages.join('; ')}`;
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Your session is invalid. Please sign in again.';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Your session has expired. Please sign in again.';
    error = { message, statusCode: 401 };
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'The file is too large. Please upload a file smaller than 10MB.';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field. Please check your upload and try again.';
    error = { message, statusCode: 400 };
  }

  // Rate limiting errors
  if (err.statusCode === 429) {
    const message = 'Too many requests. Please wait a moment and try again.';
    error = { message, statusCode: 429 };
  }

  // Network/Database errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongoServerError') {
    const message = 'Unable to connect to the server. Please try again later.';
    error = { message, statusCode: 503 };
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = error.message || 'An unexpected error occurred. Please try again later.';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err.message 
    })
  });
};

module.exports = errorHandler;
