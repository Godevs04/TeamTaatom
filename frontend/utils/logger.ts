/**
 * Logger utility for frontend
 * Conditional logging based on environment
 */

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log('[LOG]', ...args);
    }
  },
  
  error: (...args: any[]) => {
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
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug('[DEBUG]', ...args);
    }
  }
};

export default logger;

