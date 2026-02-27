/**
 * Standardized Error Codes for Frontend Error Handling
 * Maps backend error codes to user-friendly messages
 */

export const ERROR_CODES = {
  // Authentication & Authorization (1000-1099)
  AUTH_1001: { code: 'AUTH_1001', message: 'Please sign in to continue', userMessage: 'You need to sign in to access this feature' },
  AUTH_1002: { code: 'AUTH_1002', message: 'Invalid authentication token', userMessage: 'Your session has expired. Please sign in again' },
  AUTH_1003: { code: 'AUTH_1003', message: 'Authentication token expired', userMessage: 'Your session has expired. Please sign in again' },
  AUTH_1004: { code: 'AUTH_1004', message: 'Invalid email or password', userMessage: 'The email or password you entered is incorrect' },
  AUTH_1005: { code: 'AUTH_1005', message: 'Account not verified', userMessage: 'Please verify your email address to continue' },
  AUTH_1006: { code: 'AUTH_1006', message: 'Access forbidden', userMessage: 'You don\'t have permission to perform this action' },

  // Validation Errors (2000-2099)
  VAL_2001: { code: 'VAL_2001', message: 'Validation failed', userMessage: 'Please check your input and try again' },
  VAL_2002: { code: 'VAL_2002', message: 'Required field missing', userMessage: 'Please fill in all required fields' },
  VAL_2003: { code: 'VAL_2003', message: 'Invalid format', userMessage: 'The format you entered is invalid' },
  VAL_2004: { code: 'VAL_2004', message: 'Invalid email format', userMessage: 'Please enter a valid email address' },
  VAL_2005: { code: 'VAL_2005', message: 'Password does not meet requirements', userMessage: 'Password must be at least 8 characters long' },

  // Resource Errors (3000-3099)
  RES_3001: { code: 'RES_3001', message: 'Resource not found', userMessage: 'The item you\'re looking for doesn\'t exist' },
  RES_3002: { code: 'RES_3002', message: 'Resource already exists', userMessage: 'This item already exists' },
  RES_3003: { code: 'RES_3003', message: 'Email already registered', userMessage: 'An account with this email already exists' },
  RES_3004: { code: 'RES_3004', message: 'Username already taken', userMessage: 'This username is already taken. Please choose another' },
  RES_3005: { code: 'RES_3005', message: 'Resource has been deleted', userMessage: 'This item has been deleted' },

  // File Upload Errors (4000-4099)
  FILE_4001: { code: 'FILE_4001', message: 'File is required', userMessage: 'Please select a file to upload' },
  FILE_4002: { code: 'FILE_4002', message: 'File size exceeds limit', userMessage: 'File is too large. Please choose a smaller file' },
  FILE_4003: { code: 'FILE_4003', message: 'Invalid file type', userMessage: 'This file type is not supported' },
  FILE_4004: { code: 'FILE_4004', message: 'File upload failed', userMessage: 'Failed to upload file. Please try again' },

  // Rate Limiting (5000-5099)
  RATE_5001: { code: 'RATE_5001', message: 'Too many requests', userMessage: 'You\'re making requests too quickly. Please wait a moment' },

  // Server Errors (6000-6099)
  SRV_6001: { code: 'SRV_6001', message: 'Internal server error', userMessage: 'Something went wrong. Please try again later' },
  SRV_6002: { code: 'SRV_6002', message: 'Database connection error', userMessage: 'Service temporarily unavailable. Please try again' },
  SRV_6003: { code: 'SRV_6003', message: 'Service temporarily unavailable', userMessage: 'Service is temporarily unavailable. Please try again later' },

  // Business Logic Errors (7000-7099)
  BIZ_7001: { code: 'BIZ_7001', message: 'Invalid operation', userMessage: 'This action is not allowed' },
  BIZ_7002: { code: 'BIZ_7002', message: 'Insufficient permissions', userMessage: 'You don\'t have permission to perform this action' },
  BIZ_7003: { code: 'BIZ_7003', message: 'Operation limit exceeded', userMessage: 'You\'ve reached the limit for this operation' },
};

/**
 * Get user-friendly error message from error code
 * @param {string} errorCode - Error code from backend
 * @param {string} fallbackMessage - Fallback message if code not found
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (errorCode: string, fallbackMessage: string = 'An unexpected error occurred'): string => {
  const error = ERROR_CODES[errorCode as keyof typeof ERROR_CODES];
  return error?.userMessage || fallbackMessage;
};

/**
 * Parse error from API response
 * @param {any} error - Error object from API call
 * @returns {object} Parsed error with code and message
 */
export const parseError = (error: any): { code: string; message: string; userMessage: string } => {
  // Handle Axios errors with standardized error format (error.code)
  if (error?.response?.data?.error?.code) {
    const code = error.response.data.error.code;
    const message = error.response.data.error.message || ERROR_CODES[code as keyof typeof ERROR_CODES]?.message || 'An error occurred';
    const userMessage = getErrorMessage(code, message);
    
    return { code, message, userMessage };
  }

  // Handle validation errors (400 with errors array from express-validator)
  const status = error?.response?.status;
  const data = error?.response?.data;
  if (status === 400 && data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
    const firstError = data.errors[0];
    const msg = firstError?.msg || firstError?.message || data.message || 'Please check your input and try again';
    return {
      code: 'VAL_2001',
      message: data.error || 'Validation failed',
      userMessage: msg,
    };
  }

  // Handle 400 with error message string (validation middleware fallback)
  if (status === 400 && data?.message && typeof data.message === 'string') {
    return {
      code: 'VAL_2001',
      message: data.error || 'Validation failed',
      userMessage: data.message,
    };
  }

  // Handle network errors
  if (error?.message === 'Network Error' || error?.code === 'ERR_NETWORK') {
    return {
      code: 'SRV_6003',
      message: 'Network error',
      userMessage: 'Unable to connect to the server. Please check your internet connection'
    };
  }

  // Handle timeout errors
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
    return {
      code: 'SRV_6003',
      message: 'Request timeout',
      userMessage: 'The request took too long. Please try again'
    };
  }

  // Fallback
  return {
    code: 'SRV_6001',
    message: error?.message || 'An unexpected error occurred',
    userMessage: 'Something went wrong. Please try again later'
  };
};

/**
 * Create standardized error object
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {string} userMessage - User-friendly message
 * @returns {object} Standardized error object
 */
export const createError = (code: string, message?: string, userMessage?: string) => {
  const error = ERROR_CODES[code as keyof typeof ERROR_CODES];
  return {
    code,
    message: message || error?.message || 'An error occurred',
    userMessage: userMessage || error?.userMessage || 'Something went wrong. Please try again'
  };
};

