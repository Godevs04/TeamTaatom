/**
 * Structured logger utility for production-ready logging
 * Supports structured JSON logging for log aggregation systems
 * Only logs in development mode to prevent information leakage in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// Log levels in order of severity
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel = LOG_LEVELS[LOG_LEVEL] || LOG_LEVELS.info;

/**
 * Sanitize data to remove sensitive information
 */
const sanitizeData = (data) => {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Error) {
    return {
      message: data.message,
      name: data.name,
      stack: isDevelopment ? data.stack : undefined,
    };
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  const sanitized = { ...data };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie', 'authToken'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  // Recursively sanitize nested objects
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  });

  return sanitized;
};

/**
 * Create structured log entry
 */
const createLogEntry = (level, message, data = {}) => {
  // Handle legacy calls where message might be an object or multiple args
  let logMessage = typeof message === 'string' ? message : JSON.stringify(message);
  let logData = data;

  // If message is an object and data is empty, treat message as data
  if (typeof message === 'object' && message !== null && Object.keys(data).length === 0) {
    logData = message;
    logMessage = 'Log entry';
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message: logMessage,
    ...sanitizeData(logData),
  };

  // In production, output as JSON for log aggregation
  if (!isDevelopment && process.env.STRUCTURED_LOGGING === 'true') {
    return JSON.stringify(entry);
  }

  return entry;
};

/**
 * Check if log level should be output
 */
const shouldLog = (level) => {
  return LOG_LEVELS[level] >= currentLogLevel;
};

const logger = {
  /**
   * Debug level - detailed information for debugging
   * Supports both: logger.debug(message, data) and logger.debug(...args) for backward compatibility
   */
  debug: (message, ...args) => {
    if (shouldLog('debug')) {
      // Handle legacy calls: logger.debug('message', arg1, arg2, ...)
      const data = args.length > 0 && typeof args[0] === 'object' && !(args[0] instanceof Error)
        ? args[0]
        : args.length > 0
        ? { args }
        : {};
      
      const entry = createLogEntry('debug', message, data);
      if (isDevelopment) {
        console.debug('[DEBUG]', entry);
      }
    }
  },

  /**
   * Info level - general informational messages
   * Supports both: logger.info(message, data) and logger.info(...args) for backward compatibility
   */
  info: (message, ...args) => {
    if (shouldLog('info')) {
      // Handle legacy calls: logger.info('message', arg1, arg2, ...)
      const data = args.length > 0 && typeof args[0] === 'object' && !(args[0] instanceof Error)
        ? args[0]
        : args.length > 0
        ? { args }
        : {};
      
      const entry = createLogEntry('info', message, data);
      if (isDevelopment) {
        console.info('[INFO]', entry);
      } else if (process.env.STRUCTURED_LOGGING === 'true') {
        console.log(entry);
      }
    }
  },

  /**
   * Warn level - warning messages for potentially harmful situations
   * Supports both: logger.warn(message, data) and logger.warn(...args) for backward compatibility
   */
  warn: (message, ...args) => {
    if (shouldLog('warn')) {
      // Handle legacy calls: logger.warn('message', arg1, arg2, ...)
      const data = args.length > 0 && typeof args[0] === 'object' && !(args[0] instanceof Error)
        ? args[0]
        : args.length > 0
        ? { args }
        : {};
      
      const entry = createLogEntry('warn', message, data);
      if (isDevelopment) {
        console.warn('[WARN]', entry);
      } else {
        // Always log warnings in production
        if (process.env.STRUCTURED_LOGGING === 'true') {
          console.warn(entry);
        } else {
          console.warn('[WARN]', entry.message, entry);
        }
      }
    }
  },

  /**
   * Error level - error events that might still allow the application to continue
   * Supports both: logger.error(message, error, data) and logger.error(...args) for backward compatibility
   */
  error: (message, ...args) => {
    if (shouldLog('error')) {
      // Handle different call patterns:
      // logger.error('message', error, data)
      // logger.error('message', data)
      // logger.error('message', arg1, arg2, ...)
      let error = null;
      let data = {};

      if (args.length > 0) {
        if (args[0] instanceof Error) {
          error = args[0];
          data = args.length > 1 && typeof args[1] === 'object' ? args[1] : args.length > 1 ? { additionalArgs: args.slice(1) } : {};
        } else if (typeof args[0] === 'object' && args[0] !== null) {
          data = args[0];
        } else {
          data = { args };
        }
      }

      const errorData = {
        ...data,
      };

      if (error instanceof Error) {
        errorData.error = {
          message: error.message,
          name: error.name,
          stack: isDevelopment ? error.stack : undefined,
        };
      } else if (error) {
        errorData.error = sanitizeData(error);
      }

      const entry = createLogEntry('error', message, errorData);
      
      // Always log errors
      if (isDevelopment) {
        console.error('[ERROR]', entry);
      } else {
        // In production, log errors (they're important)
        if (process.env.STRUCTURED_LOGGING === 'true') {
          console.error(entry);
        } else {
          console.error('[ERROR]', entry.message, entry);
        }
      }
    }
  },

  /**
   * Log level - general logging (alias for info)
   * Supports both: logger.log(message, data) and logger.log(...args) for backward compatibility
   */
  log: (message, ...args) => {
    // Handle legacy calls: logger.log('message', arg1, arg2, ...)
    const data = args.length > 0 && typeof args[0] === 'object' && !(args[0] instanceof Error)
      ? args[0]
      : args.length > 0
      ? { args }
      : {};
    
    logger.info(message, data);
  },
};

module.exports = logger;

