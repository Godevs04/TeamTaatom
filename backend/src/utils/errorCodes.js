/**
 * Standardized Error Codes for API Responses
 * Each error code maps to a specific error type and HTTP status code
 */

const ERROR_CODES = {
  // Authentication & Authorization (1000-1099)
  AUTH_REQUIRED: { code: 'AUTH_1001', status: 401, message: 'Authentication required' },
  AUTH_INVALID_TOKEN: { code: 'AUTH_1002', status: 401, message: 'Invalid authentication token' },
  AUTH_TOKEN_EXPIRED: { code: 'AUTH_1003', status: 401, message: 'Authentication token expired' },
  AUTH_INVALID_CREDENTIALS: { code: 'AUTH_1004', status: 401, message: 'Invalid email or password' },
  AUTH_ACCOUNT_NOT_VERIFIED: { code: 'AUTH_1005', status: 401, message: 'Account not verified' },
  AUTH_FORBIDDEN: { code: 'AUTH_1006', status: 403, message: 'Access forbidden' },

  // Validation Errors (2000-2099)
  VALIDATION_FAILED: { code: 'VAL_2001', status: 400, message: 'Validation failed' },
  VALIDATION_REQUIRED_FIELD: { code: 'VAL_2002', status: 400, message: 'Required field missing' },
  VALIDATION_INVALID_FORMAT: { code: 'VAL_2003', status: 400, message: 'Invalid format' },
  VALIDATION_INVALID_EMAIL: { code: 'VAL_2004', status: 400, message: 'Invalid email format' },
  VALIDATION_INVALID_PASSWORD: { code: 'VAL_2005', status: 400, message: 'Password does not meet requirements' },

  // Resource Errors (3000-3099)
  RESOURCE_NOT_FOUND: { code: 'RES_3001', status: 404, message: 'Resource not found' },
  RESOURCE_ALREADY_EXISTS: { code: 'RES_3002', status: 409, message: 'Resource already exists' },
  RESOURCE_DUPLICATE_EMAIL: { code: 'RES_3003', status: 409, message: 'Email already registered' },
  RESOURCE_DUPLICATE_USERNAME: { code: 'RES_3004', status: 409, message: 'Username already taken' },
  RESOURCE_DELETED: { code: 'RES_3005', status: 410, message: 'Resource has been deleted' },

  // File Upload Errors (4000-4099)
  FILE_REQUIRED: { code: 'FILE_4001', status: 400, message: 'File is required' },
  FILE_TOO_LARGE: { code: 'FILE_4002', status: 400, message: 'File size exceeds limit' },
  FILE_INVALID_TYPE: { code: 'FILE_4003', status: 400, message: 'Invalid file type' },
  FILE_UPLOAD_FAILED: { code: 'FILE_4004', status: 500, message: 'File upload failed' },

  // Rate Limiting (5000-5099)
  RATE_LIMIT_EXCEEDED: { code: 'RATE_5001', status: 429, message: 'Too many requests' },

  // Server Errors (6000-6099)
  SERVER_ERROR: { code: 'SRV_6001', status: 500, message: 'Internal server error' },
  SERVER_DATABASE_ERROR: { code: 'SRV_6002', status: 503, message: 'Database connection error' },
  SERVER_UNAVAILABLE: { code: 'SRV_6003', status: 503, message: 'Service temporarily unavailable' },

  // Business Logic Errors (7000-7099)
  BUSINESS_INVALID_OPERATION: { code: 'BIZ_7001', status: 400, message: 'Invalid operation' },
  BUSINESS_INSUFFICIENT_PERMISSIONS: { code: 'BIZ_7002', status: 403, message: 'Insufficient permissions' },
  BUSINESS_LIMIT_EXCEEDED: { code: 'BIZ_7003', status: 400, message: 'Operation limit exceeded' },
};

/**
 * Create a standardized error response
 * @param {string} errorCode - Error code from ERROR_CODES (key or code string like 'VAL_2001')
 * @param {string} customMessage - Optional custom message to override default
 * @param {object} details - Optional additional error details
 * @returns {object} Standardized error response object
 */
const createError = (errorCode, customMessage = null, details = {}) => {
  // First try to find by key (e.g., 'VALIDATION_FAILED')
  let error = ERROR_CODES[errorCode];
  
  // If not found by key, try to find by code string (e.g., 'VAL_2001')
  if (!error) {
    const errorEntry = Object.values(ERROR_CODES).find(entry => entry.code === errorCode);
    if (errorEntry) {
      error = errorEntry;
    }
  }
  
  if (!error) {
    // Fallback to generic server error if code not found
    return {
      code: 'SRV_6001',
      status: 500,
      message: customMessage || 'An unexpected error occurred',
      ...details
    };
  }

  return {
    code: error.code,
    status: error.status,
    message: customMessage || error.message,
    ...details
  };
};

/**
 * Send standardized error response
 * @param {object} res - Express response object
 * @param {string} errorCode - Error code from ERROR_CODES
 * @param {string} customMessage - Optional custom message
 * @param {object} details - Optional additional details
 */
const sendError = (res, errorCode, customMessage = null, details = {}) => {
  const error = createError(errorCode, customMessage, details);
  
  // Ensure NODE_ENV is explicitly checked (default to production for safety)
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Build response object
  const response = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
    }
  };

  // Only include details if they exist and are safe
  if (Object.keys(details).length > 0) {
    // Remove stack traces in production
    const safeDetails = { ...details };
    if (!isDevelopment && safeDetails.stack) {
      delete safeDetails.stack;
    }
    response.error.details = safeDetails;
  }

  // NEVER include stack traces in production response
  if (isDevelopment && details.stack) {
    response.stack = details.stack;
  }

  return res.status(error.status).json(response);
};

/**
 * Send success response
 * @param {object} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} message - Success message
 * @param {object} data - Response data
 */
const sendSuccess = (res, status = 200, message = 'Success', data = {}) => {
  return res.status(status).json({
    success: true,
    message,
    ...data
  });
};

module.exports = {
  ERROR_CODES,
  createError,
  sendError,
  sendSuccess
};

