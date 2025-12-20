/**
 * Production-safe structured logger utility
 * Only logs in development mode, sends errors to tracking in production
 * Supports structured logging for better debugging and monitoring
 */

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';
const LOG_LEVEL = (process.env.EXPO_PUBLIC_LOG_LEVEL || (isDev ? 'debug' : 'info')) as 'debug' | 'info' | 'warn' | 'error';

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
const sanitizeData = (data: any): any => {
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
      stack: isDev ? data.stack : undefined,
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
const createLogEntry = (level: string, message: string, data: any = {}) => {
  return {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...sanitizeData(data),
  };
};

/**
 * Check if log level should be output
 */
const shouldLog = (level: 'debug' | 'info' | 'warn' | 'error'): boolean => {
  return LOG_LEVELS[level] >= currentLogLevel;
};

// Error tracking function - integrated with Sentry
const trackError = (context: string, error: any, args?: any[]) => {
  if (!isDev) {
    // In production, send to Sentry error tracking service
    // DO NOT use console in production - send to tracking service only
    try {
      // Dynamically import Sentry to avoid issues if not initialized
      const Sentry = require('@sentry/react-native');
      if (Sentry && typeof Sentry.captureException === 'function') {
        Sentry.captureException(error, {
          tags: { context },
          extra: { args: sanitizeData(args) },
        });
      }
    } catch (sentryError) {
      // Sentry not available or not initialized - silently fail
      // This prevents errors in logger from breaking the app
    }
  }
};

interface Logger {
  log: (message: string, data?: any) => void;
  debug: (message: string, data?: any) => void;
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (contextOrError: string | any, errorOrArgs?: any, ...args: any[]) => void;
}

export const logger: Logger = {
  /**
   * Debug level - detailed information for debugging
   */
  debug: (message: string, data: any = {}) => {
    if (shouldLog('debug')) {
      const entry = createLogEntry('debug', message, data);
      if (isDev) {
        console.log('[DEBUG]', entry);
      }
    }
  },

  /**
   * Info level - general informational messages
   */
  info: (message: string, data: any = {}) => {
    if (shouldLog('info')) {
      const entry = createLogEntry('info', message, data);
      if (isDev) {
        console.info('[INFO]', entry);
      }
    }
  },

  /**
   * Warn level - warning messages for potentially harmful situations
   */
  warn: (message: string, data: any = {}) => {
    if (shouldLog('warn')) {
      const entry = createLogEntry('warn', message, data);
      if (isDev) {
        console.warn('[WARN]', entry);
      } else {
        // Warnings should be tracked in production
        trackError('warning', { message, ...data }, []);
      }
    }
  },

  /**
   * Error level - error events that might still allow the application to continue
   */
  error: (contextOrError: string | any, errorOrArgs?: any, ...args: any[]) => {
    if (!shouldLog('error')) {
      return;
    }

    // Flexible error handling: can be called as error(context, error) or error(message, error)
    if (typeof contextOrError === 'string' && errorOrArgs !== undefined) {
      // Called as: logger.error('context', error, ...args)
      const context = contextOrError;
      const error = errorOrArgs;
      const entry = createLogEntry('error', context, {
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: isDev ? error.stack : undefined,
        } : sanitizeData(error),
        ...sanitizeData(args.length > 0 ? { additionalArgs: args } : {}),
      });

      if (isDev) {
        console.error(`[${context}]`, entry);
      } else {
        // In production, only track - no console output
        trackError(context, error, args);
      }
    } else {
      // Called as: logger.error(error) or logger.error(error, ...args)
      const error = contextOrError;
      const entry = createLogEntry('error', 'Error occurred', {
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: isDev ? error.stack : undefined,
        } : sanitizeData(error),
        ...sanitizeData(errorOrArgs !== undefined ? { additionalArgs: [errorOrArgs, ...args] } : {}),
      });

      if (isDev) {
        console.error('[Error]', entry);
      } else {
        // In production, only track - no console output
        trackError('unknown', error, errorOrArgs !== undefined ? [errorOrArgs, ...args] : args);
      }
    }
  },

  /**
   * Log level - general logging (alias for info)
   * @deprecated Use info() instead for consistency
   */
  log: (message: string, data: any = {}) => {
    logger.info(message, data);
  },
};

// Create context-specific loggers
// Supports both structured logging and legacy patterns for backward compatibility
export const createLogger = (context: string) => ({
  log: (messageOrData: string | any, data?: any) => {
    if (typeof messageOrData === 'string') {
      logger.log(`[${context}] ${messageOrData}`, data);
    } else {
      // Legacy: logger.log(data)
      logger.log(`[${context}]`, messageOrData);
    }
  },
  debug: (messageOrData: string | any, data?: any) => {
    if (typeof messageOrData === 'string') {
      logger.debug(`[${context}] ${messageOrData}`, data);
    } else {
      // Legacy: logger.debug(data)
      logger.debug(`[${context}]`, messageOrData);
    }
  },
  info: (messageOrData: string | any, data?: any) => {
    if (typeof messageOrData === 'string') {
      logger.info(`[${context}] ${messageOrData}`, data);
    } else {
      // Legacy: logger.info(data)
      logger.info(`[${context}]`, messageOrData);
    }
  },
  warn: (messageOrData: string | any, data?: any) => {
    if (typeof messageOrData === 'string') {
      logger.warn(`[${context}] ${messageOrData}`, data);
    } else {
      // Legacy: logger.warn(data)
      logger.warn(`[${context}]`, messageOrData);
    }
  },
  error: (contextOrError: string | any, errorOrArgs?: any, ...args: any[]) => {
    // Support both patterns:
    // createLogger('ctx').error('message', error, data)
    // createLogger('ctx').error(error, ...args)
    if (typeof contextOrError === 'string') {
      logger.error(`[${context}] ${contextOrError}`, errorOrArgs, ...args);
    } else {
      logger.error(`[${context}]`, contextOrError, errorOrArgs !== undefined ? [errorOrArgs, ...args] : args);
    }
  },
});

// Default export for backward compatibility
export default logger;
