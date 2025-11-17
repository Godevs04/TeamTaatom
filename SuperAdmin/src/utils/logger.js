/**
 * Logger utility for SuperAdmin
 * Conditional logging based on environment
 * Only logs in development mode to prevent information leakage in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log('[SuperAdmin LOG]', ...args);
    }
  },
  
  error: (...args) => {
    // Always log errors, but format them appropriately
    if (isDevelopment) {
      console.error('[SuperAdmin ERROR]', ...args);
    } else {
      // In production, log errors without sensitive data
      console.error('[SuperAdmin ERROR]', args.map(arg => {
        if (arg instanceof Error) {
          return {
            message: arg.message,
            stack: arg.stack
          };
        }
        return arg;
      }));
    }
  },
  
  warn: (...args) => {
    if (isDevelopment) {
      console.warn('[SuperAdmin WARN]', ...args);
    }
  },
  
  info: (...args) => {
    if (isDevelopment) {
      console.info('[SuperAdmin INFO]', ...args);
    }
  },
  
  debug: (...args) => {
    if (isDevelopment) {
      console.debug('[SuperAdmin DEBUG]', ...args);
    }
  }
};

export default logger;

