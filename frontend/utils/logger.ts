/**
 * Production-safe structured logger utility
 * Only logs in development mode, sends errors to tracking in production
 * Supports structured logging for better debugging and monitoring
 */

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';
const LOG_LEVEL = (process.env.EXPO_PUBLIC_LOG_LEVEL || (isDev ? 'debug' : 'info')) as 'debug' | 'info' | 'warn' | 'error';

// Intercept console.warn to filter out empty warnings (prevents spam from React Native or libraries)
if (typeof console !== 'undefined' && console.warn) {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    // Filter out empty warnings
    const hasValidMessage = args.some(arg => {
      if (typeof arg === 'string') {
        return arg.trim().length > 0;
      }
      if (arg && typeof arg === 'object') {
        // Check if it's our logger entry with a message
        if (arg.message && typeof arg.message === 'string' && arg.message.trim().length > 0) {
          return true;
        }
        // Check if object has any meaningful content
        return Object.keys(arg).length > 0;
      }
      return arg !== undefined && arg !== null && arg !== '';
    });
    
    // Only call original warn if there's a valid message
    if (hasValidMessage) {
      originalWarn.apply(console, args);
    }
    // Silently ignore empty warnings
  };
}

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
 * Uses a visited set to prevent infinite recursion on circular references
 */
const sanitizeData = (data: any, visited: WeakSet<object> = new WeakSet()): any => {
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

  // Check for circular references - if we've seen this object before, return a placeholder
  if (visited.has(data)) {
    return '[Circular Reference]';
  }

  // Add current object to visited set BEFORE recursing
  visited.add(data);

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, visited));
  }

  const sanitized: any = {};
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie', 'authToken'];
  
  // Copy and sanitize fields
  Object.keys(data).forEach(key => {
    // Redact sensitive fields
    if (sensitiveFields.includes(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof data[key] === 'object' && data[key] !== null) {
      // Recursively sanitize nested objects (visited set prevents circular refs)
      sanitized[key] = sanitizeData(data[key], visited);
    } else {
      // Copy primitive values as-is
      sanitized[key] = data[key];
    }
  });

  return sanitized;
};

/**
 * Create structured log entry
 */
const createLogEntry = (level: string, message: string, data: any = {}) => {
  // Ensure message is never empty
  const safeMessage = message && typeof message === 'string' && message.trim()
    ? message
    : `${level.toUpperCase()}: No message provided`;
  
  return {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message: safeMessage,
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
      // Dynamically import Sentry to avoid circular dependencies
      // Use lazy require to prevent circular dependency issues
      if (typeof require !== 'undefined') {
        const Sentry = require('@sentry/react-native');
        if (!Sentry) return;

        // Determine if this is a warning context (for warnings, we use captureMessage)
        const isWarning = context === 'warning';

        if (error instanceof Error) {
          // For actual Error instances, use captureException
          if (typeof Sentry.captureException === 'function') {
            Sentry.captureException(error, {
              tags: { context },
              extra: { args: sanitizeData(args) },
              level: isWarning ? 'warning' : 'error',
            });
          }
        } else if (error && typeof error === 'object') {
          // For plain objects (like from logger.warn), convert to Error or use captureMessage
          const errorMessage = error.message || JSON.stringify(sanitizeData(error));
          
          if (isWarning && typeof Sentry.captureMessage === 'function') {
            // Use captureMessage for warnings with plain objects
            Sentry.captureMessage(errorMessage, {
              level: 'warning',
              tags: { context },
              extra: { 
                originalData: sanitizeData(error),
                args: sanitizeData(args) 
              },
            });
          } else {
            // For errors with plain objects, convert to Error instance
            const errorObj = new Error(errorMessage);
            if (typeof Sentry.captureException === 'function') {
              Sentry.captureException(errorObj, {
                tags: { context },
                extra: { 
                  originalData: sanitizeData(error),
                  args: sanitizeData(args) 
                },
              });
            }
          }
        } else if (error) {
          // For primitive values or other types, convert to string
          const errorMessage = String(error);
          const errorObj = new Error(errorMessage);
          if (typeof Sentry.captureException === 'function') {
            Sentry.captureException(errorObj, {
              tags: { context },
              extra: { args: sanitizeData(args) },
              level: isWarning ? 'warning' : 'error',
            });
          }
        }
      }
    } catch (sentryError) {
      // Sentry not available or not initialized - silently fail
      // This prevents errors in logger from breaking the app
      // Do not log this error to avoid circular dependencies
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
        logger.debug('[DEBUG]', entry);
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
        logger.debug('[INFO]', entry);
      }
    }
  },

  /**
   * Warn level - warning messages for potentially harmful situations
   */
  warn: (message: string, data: any = {}) => {
    if (shouldLog('warn')) {
      // Ensure message is not empty or undefined
      const safeMessage = message && typeof message === 'string' && message.trim() 
        ? message 
        : 'Warning (no message provided)';
      
      const entry = createLogEntry('warn', safeMessage, data);
      if (isDev) {
        // Only log if entry has a valid message (prevent empty warnings)
        if (entry.message && entry.message.trim() && entry.message !== 'WARN: No message provided') {
          console.warn('[WARN]', entry);
        }
      } else {
        // Warnings should be tracked in production
        if (safeMessage && safeMessage.trim() && safeMessage !== 'Warning (no message provided)') {
          trackError('warning', { message: safeMessage, ...data }, []);
        }
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
        logger.error(`[${context}]`, entry);
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
        logger.error('[Error]', entry);
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
      // Ensure message is not empty
      const message = messageOrData.trim() || 'Warning';
      logger.warn(`[${context}] ${message}`, data);
    } else {
      // Legacy: logger.warn(data)
      // If messageOrData is provided, include it in the data
      const safeData = messageOrData !== undefined && messageOrData !== null 
        ? messageOrData 
        : {};
      logger.warn(`[${context}] Warning`, safeData);
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
