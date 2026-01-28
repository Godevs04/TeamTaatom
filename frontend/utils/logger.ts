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

// Re-entrancy guard to prevent concurrent sanitization
let isSanitizing = false;

/**
 * Sanitize data to remove sensitive information
 * Uses a visited set to prevent infinite recursion on circular references
 * Adds depth limit to prevent stack overflow on deeply nested structures
 */
const sanitizeData = (data: any, visited: WeakSet<object> = new WeakSet(), depth: number = 0): any => {
  // Re-entrancy check - if already sanitizing at top level, return immediately
  if (depth === 0 && isSanitizing) {
    return '[Sanitization in progress]';
  }
  
  if (depth === 0) {
    isSanitizing = true;
  }
  
  try {
    // Maximum depth to prevent stack overflow (safety limit)
    const MAX_DEPTH = 10; // Reduced from 20 to be more conservative
    
    // Early return for depth limit
    if (depth > MAX_DEPTH) {
      return '[Max Depth Reached]';
    }

    // Handle null/undefined
    if (data === null || data === undefined) {
      return data;
    }

    // Handle primitives
    if (typeof data !== 'object') {
      return data;
    }

    // Handle Error instances FIRST - before any object processing
    if (data instanceof Error) {
      // Check visited set first
      if (visited.has(data)) {
        return '[Circular Error Reference]';
      }
      
      // Add to visited set immediately
      try {
        visited.add(data);
      } catch (err) {
        // If we can't add to visited set, just return simple representation
      }
      
      // Return a simple object representation - NEVER recurse into Error properties
      try {
        const errorObj = {
          message: String(data.message || ''),
          name: String(data.name || 'Error'),
        };
        
        // Only add stack in dev mode and if it exists
        if (isDev && data.stack) {
          (errorObj as any).stack = String(data.stack).substring(0, 500); // Limit stack length
        }
        
        return errorObj;
      } catch (err) {
        return '[Error Object]';
      }
    }

    // Check for circular references BEFORE processing
    if (visited.has(data)) {
      return '[Circular Reference]';
    }

    // Add to visited set BEFORE any processing
    try {
      visited.add(data);
    } catch (err) {
      // If we can't add to visited set, return placeholder to prevent recursion
      return '[Unable to track object]';
    }

    // Handle arrays
    if (Array.isArray(data)) {
      // Limit array size to prevent excessive processing
      const MAX_ARRAY_LENGTH = 50;
      const limitedArray = data.slice(0, MAX_ARRAY_LENGTH);
      return limitedArray.map(item => sanitizeData(item, visited, depth + 1));
    }

    // Handle objects
    const sanitized: any = {};
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie', 'authToken'];
    
    // Get keys and limit processing
    let keys: string[] = [];
    try {
      keys = Object.keys(data);
    } catch (err) {
      return '[Unable to get keys]';
    }
    
    const MAX_KEYS = 50; // Reduced from 100 to be more conservative
    
    for (let i = 0; i < Math.min(keys.length, MAX_KEYS); i++) {
      const key = keys[i];
      
      // Skip certain problematic keys that might cause recursion
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      
      try {
        const value = data[key];
        
        // Handle null/undefined
        if (value === null || value === undefined) {
          sanitized[key] = value;
          continue;
        }
        
        // Redact sensitive fields
        if (sensitiveFields.includes(key)) {
          sanitized[key] = '[REDACTED]';
          continue;
        }
        
        // Handle primitives
        if (typeof value !== 'object') {
          sanitized[key] = value;
          continue;
        }
        
        // Handle Error instances
        if (value instanceof Error) {
          if (visited.has(value)) {
            sanitized[key] = '[Circular Error Reference]';
          } else {
            try {
              visited.add(value);
              sanitized[key] = {
                message: String(value.message || ''),
                name: String(value.name || 'Error'),
                stack: isDev ? String(value.stack || '').substring(0, 500) : undefined,
              };
            } catch (err) {
              sanitized[key] = '[Error Object]';
            }
          }
          continue;
        }
        
        // Check for circular reference
        if (visited.has(value)) {
          sanitized[key] = '[Circular Reference]';
          continue;
        }
        
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeData(value, visited, depth + 1);
        
      } catch (err) {
        // If we can't process a key, skip it
        sanitized[key] = '[Error processing field]';
      }
    }
    
    if (keys.length > MAX_KEYS) {
      sanitized['_truncated'] = `[${keys.length - MAX_KEYS} more keys]`;
    }

    return sanitized;
  } catch (err) {
    // If sanitization fails completely, return a safe placeholder
    return '[Sanitization Error]';
  } finally {
    // Reset re-entrancy flag when done
    if (depth === 0) {
      isSanitizing = false;
    }
  }
};

/**
 * Create structured log entry
 */
const createLogEntry = (level: string, message: string, data: any = {}) => {
  // Ensure message is never empty
  const safeMessage = message && typeof message === 'string' && message.trim()
    ? message
    : `${level.toUpperCase()}: No message provided`;
  
  // Sanitize data with a fresh visited set to prevent cross-contamination
  let sanitizedData: any = {};
  try {
    const sanitized = sanitizeData(data);
    // If sanitized is an object, spread it; otherwise, wrap it
    if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
      sanitizedData = sanitized;
    } else {
      sanitizedData = { data: sanitized };
    }
  } catch (err) {
    // If sanitization fails, use a safe fallback
    sanitizedData = { _sanitizationError: 'Failed to sanitize data' };
  }
  
  return {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message: safeMessage,
    ...sanitizedData,
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
  // Filter out -1102 (operation cancelled) errors - these are expected and shouldn't be logged
  const errorCode = error?.code;
  const errorDomain = error?.domain;
  const errorMessage = error?.message || String(error || '');
  
  // -1102 NSURLErrorCancelled is expected when operation is cancelled (navigation, unmount, etc.)
  if (errorCode === -1102 || (errorDomain === 'NSURLErrorDomain' && errorCode === -1102) ||
      errorMessage.includes('-1102') || errorMessage.includes('NSURLErrorCancelled') ||
      errorMessage.includes('AVPlayerItem') && errorMessage.includes('-1102') ||
      errorMessage.includes('operation was cancelled') || errorMessage.includes('operation cancelled')) {
    // Silently ignore cancelled operations - they're expected behavior
    // Only log at debug level if needed, never send to Sentry
    if (isDev) {
      console.debug('Logger: Ignoring cancelled operation (-1102):', error);
    }
    return; // Don't send to Sentry
  }

  if (!isDev) {
    // In production, send to Sentry error tracking service
    // DO NOT use console in production - send to tracking service only
    try {
      // Use the centralized error reporter for consistent error reporting
      if (typeof require !== 'undefined') {
        const { reportError } = require('./errorReporter');
        if (reportError) {
          // Extract context from args if provided
          const errorContext: any = {
            component: context,
            metadata: args && args.length > 0 ? sanitizeData(args) : undefined,
          };
          
          // If args contain structured context, use it
          if (args && args.length > 0 && typeof args[0] === 'object' && !Array.isArray(args[0])) {
            Object.assign(errorContext, sanitizeData(args[0]));
          }
          
          reportError(error, errorContext);
          return;
        }
      }
      
      // Fallback to direct Sentry if errorReporter not available
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
      try {
        const entry = createLogEntry('debug', message, data);
        if (isDev) {
          console.debug('[DEBUG]', entry);
        }
      } catch (err) {
        // If logging fails, use console.debug directly to avoid recursion
        if (isDev) {
          console.debug('[DEBUG]', message, data);
        }
      }
    }
  },

  /**
   * Info level - general informational messages
   */
  info: (message: string, data: any = {}) => {
    if (shouldLog('info')) {
      try {
        const entry = createLogEntry('info', message, data);
        if (isDev) {
          console.info('[INFO]', entry);
        }
      } catch (err) {
        // If logging fails, use console.info directly to avoid recursion
        if (isDev) {
          console.info('[INFO]', message, data);
        }
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
        // Convert the data object to an Error instance for proper Sentry tracking
        if (safeMessage && safeMessage.trim() && safeMessage !== 'Warning (no message provided)') {
          const errorObj = new Error(safeMessage);
          trackError('warning', errorObj, [{ ...data }]);
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

    // Prevent infinite recursion - if we're trying to log a sanitization error, just use console.error directly
    const isSanitizationError = 
      (typeof contextOrError === 'string' && contextOrError.includes('Sanitization')) ||
      (contextOrError instanceof Error && contextOrError.message?.includes('Sanitization')) ||
      (typeof errorOrArgs === 'object' && errorOrArgs?.message?.includes('Sanitization'));

    if (isSanitizationError) {
      // Use console.error directly to avoid recursion
      if (isDev) {
        console.error('[Logger] Sanitization error detected, using direct console.error:', contextOrError);
      }
      return;
    }

    try {
      // Flexible error handling: can be called as error(context, error) or error(message, error)
      if (typeof contextOrError === 'string' && errorOrArgs !== undefined) {
        // Called as: logger.error('context', error, ...args)
        const context = contextOrError;
        const error = errorOrArgs;
        
        // Create error object safely without recursion
        let errorData: any = {};
        try {
          if (error instanceof Error) {
            errorData.error = {
              message: String(error.message || ''),
              name: String(error.name || 'Error'),
              stack: isDev ? String(error.stack || '').substring(0, 500) : undefined,
            };
          } else {
            errorData.error = sanitizeData(error);
          }
          
          if (args.length > 0) {
            errorData.additionalArgs = sanitizeData(args);
          }
        } catch (sanitizeErr) {
          // If sanitization fails, use minimal error data
          errorData.error = { message: 'Error occurred (sanitization failed)' };
        }
        
        const entry = createLogEntry('error', context, errorData);

        if (isDev) {
          console.error(`[${context}]`, entry);
        } else {
          // In production, only track - no console output
          trackError(context, error, args);
        }
      } else {
        // Called as: logger.error(error) or logger.error(error, ...args)
        const error = contextOrError;
        
        // Create error object safely without recursion
        let errorData: any = {};
        try {
          if (error instanceof Error) {
            errorData.error = {
              message: String(error.message || ''),
              name: String(error.name || 'Error'),
              stack: isDev ? String(error.stack || '').substring(0, 500) : undefined,
            };
          } else {
            errorData.error = sanitizeData(error);
          }
          
          if (errorOrArgs !== undefined) {
            errorData.additionalArgs = sanitizeData([errorOrArgs, ...args]);
          }
        } catch (sanitizeErr) {
          // If sanitization fails, use minimal error data
          errorData.error = { message: 'Error occurred (sanitization failed)' };
        }
        
        const entry = createLogEntry('error', 'Error occurred', errorData);

        if (isDev) {
          console.error('[Error]', entry);
        } else {
          // In production, only track - no console output
          trackError('unknown', error, errorOrArgs !== undefined ? [errorOrArgs, ...args] : args);
        }
      }
    } catch (err) {
      // If logging itself fails, use console.error as last resort
      if (isDev) {
        console.error('[Logger] Failed to log error:', err);
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
