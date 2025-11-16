/**
 * Logger utility for conditional logging based on environment
 * Only logs in development mode to prevent information leakage in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log('[LOG]', ...args);
    }
  },
  
  error: (...args) => {
    // Always log errors, but format them appropriately
    if (isDevelopment) {
      console.error('[ERROR]', ...args);
    } else {
      // In production, log errors without sensitive data
      console.error('[ERROR]', args.map(arg => {
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
      console.warn('[WARN]', ...args);
    }
  },
  
  info: (...args) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  },
  
  debug: (...args) => {
    if (isDevelopment) {
      console.debug('[DEBUG]', ...args);
    }
  }
};

module.exports = logger;

