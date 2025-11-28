/**
 * Standardized Error Codes for SuperAdmin Error Handling
 * Maps backend error codes to admin-friendly messages
 */

export const ERROR_CODES = {
  // Authentication & Authorization (1000-1099)
  AUTH_1001: { code: 'AUTH_1001', message: 'Authentication required', adminMessage: 'Please sign in to continue' },
  AUTH_1002: { code: 'AUTH_1002', message: 'Invalid authentication token', adminMessage: 'Your session is invalid. Please sign in again' },
  AUTH_1003: { code: 'AUTH_1003', message: 'Authentication token expired', adminMessage: 'Your session has expired. Please sign in again' },
  AUTH_1004: { code: 'AUTH_1004', message: 'Invalid email or password', adminMessage: 'Invalid credentials. Please check your email and password' },
  AUTH_1005: { code: 'AUTH_1005', message: 'Account not verified', adminMessage: 'Account verification required' },
  AUTH_1006: { code: 'AUTH_1006', message: 'Access forbidden', adminMessage: 'You don\'t have permission to access this resource' },

  // Validation Errors (2000-2099)
  VAL_2001: { code: 'VAL_2001', message: 'Validation failed', adminMessage: 'Please check the input data and try again' },
  VAL_2002: { code: 'VAL_2002', message: 'Required field missing', adminMessage: 'Required fields are missing' },
  VAL_2003: { code: 'VAL_2003', message: 'Invalid format', adminMessage: 'Invalid data format' },
  VAL_2004: { code: 'VAL_2004', message: 'Invalid email format', adminMessage: 'Invalid email address format' },
  VAL_2005: { code: 'VAL_2005', message: 'Password does not meet requirements', adminMessage: 'Password does not meet security requirements' },

  // Resource Errors (3000-3099)
  RES_3001: { code: 'RES_3001', message: 'Resource not found', adminMessage: 'The requested resource was not found' },
  RES_3002: { code: 'RES_3002', message: 'Resource already exists', adminMessage: 'This resource already exists' },
  RES_3003: { code: 'RES_3003', message: 'Email already registered', adminMessage: 'An account with this email already exists' },
  RES_3004: { code: 'RES_3004', message: 'Username already taken', adminMessage: 'This username is already in use' },
  RES_3005: { code: 'RES_3005', message: 'Resource has been deleted', adminMessage: 'This resource has been deleted' },

  // File Upload Errors (4000-4099)
  FILE_4001: { code: 'FILE_4001', message: 'File is required', adminMessage: 'Please select a file to upload' },
  FILE_4002: { code: 'FILE_4002', message: 'File size exceeds limit', adminMessage: 'File size exceeds the maximum allowed limit' },
  FILE_4003: { code: 'FILE_4003', message: 'Invalid file type', adminMessage: 'This file type is not supported' },
  FILE_4004: { code: 'FILE_4004', message: 'File upload failed', adminMessage: 'File upload failed. Please try again' },

  // Rate Limiting (5000-5099)
  RATE_5001: { code: 'RATE_5001', message: 'Too many requests', adminMessage: 'Rate limit exceeded. Please wait before making more requests' },

  // Server Errors (6000-6099)
  SRV_6001: { code: 'SRV_6001', message: 'Internal server error', adminMessage: 'An internal server error occurred. Please contact support if this persists' },
  SRV_6002: { code: 'SRV_6002', message: 'Database connection error', adminMessage: 'Database connection error. Service may be temporarily unavailable' },
  SRV_6003: { code: 'SRV_6003', message: 'Service temporarily unavailable', adminMessage: 'Service is temporarily unavailable. Please try again later' },

  // Business Logic Errors (7000-7099)
  BIZ_7001: { code: 'BIZ_7001', message: 'Invalid operation', adminMessage: 'This operation is not allowed' },
  BIZ_7002: { code: 'BIZ_7002', message: 'Insufficient permissions', adminMessage: 'You don\'t have sufficient permissions for this operation' },
  BIZ_7003: { code: 'BIZ_7003', message: 'Operation limit exceeded', adminMessage: 'Operation limit has been exceeded' },
};

/**
 * Get admin-friendly error message from error code
 * @param {string} errorCode - Error code from backend
 * @param {string} fallbackMessage - Fallback message if code not found
 * @returns {string} Admin-friendly error message
 */
export const getErrorMessage = (errorCode, fallbackMessage = 'An unexpected error occurred') => {
  const error = ERROR_CODES[errorCode];
  return error?.adminMessage || fallbackMessage;
};

/**
 * Parse error from API response
 * @param {any} error - Error object from API call
 * @returns {object} Parsed error with code and message
 */
export const parseError = (error) => {
  // Handle Axios errors
  if (error?.response?.data?.error?.code) {
    const code = error.response.data.error.code;
    const message = error.response.data.error.message || ERROR_CODES[code]?.message || 'An error occurred';
    const adminMessage = getErrorMessage(code, message);
    
    return { code, message, adminMessage };
  }

  // Handle canceled requests (AbortController) - don't treat as error
  if (error?.code === 'ERR_CANCELED' || 
      error?.message?.toLowerCase().includes('canceled') || 
      error?.message?.toLowerCase() === 'canceled' ||
      error?.name === 'CanceledError' ||
      error?.name === 'AbortError') {
    // Return a special code that indicates cancellation (not an error)
    return {
      code: 'CANCELED',
      message: 'Request canceled',
      adminMessage: 'Request was canceled'
    };
  }

  // Handle network errors
  if (error?.message === 'Network Error' || error?.code === 'ERR_NETWORK') {
    return {
      code: 'SRV_6003',
      message: 'Network error',
      adminMessage: 'Unable to connect to the server. Please check your connection'
    };
  }

  // Handle timeout errors
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
    return {
      code: 'SRV_6003',
      message: 'Request timeout',
      adminMessage: 'The request took too long. Please try again'
    };
  }

  // Fallback
  return {
    code: 'SRV_6001',
    message: error?.message || 'An unexpected error occurred',
    adminMessage: 'An unexpected error occurred. Please try again or contact support'
  };
};

/**
 * Create standardized error object
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {string} adminMessage - Admin-friendly message
 * @returns {object} Standardized error object
 */
export const createError = (code, message, adminMessage) => {
  const error = ERROR_CODES[code];
  return {
    code,
    message: message || error?.message || 'An error occurred',
    adminMessage: adminMessage || error?.adminMessage || 'An error occurred. Please try again'
  };
};

/**
 * Handle error and show toast notification
 * @param {any} error - Error object from API call
 * @param {Function} toast - Toast function from react-hot-toast
 * @param {string} fallbackMessage - Fallback message if error parsing fails
 * @returns {object} Parsed error object
 */
export const handleError = (error, toast, fallbackMessage = 'An unexpected error occurred') => {
  const parsedError = parseError(error);
  const message = parsedError.adminMessage || fallbackMessage;
  
  if (toast) {
    toast.error(message);
  }
  
  return parsedError;
};

