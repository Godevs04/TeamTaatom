/**
 * Logger utility for SuperAdmin
 * Conditional logging based on environment
 * Sends errors to Sentry in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';

// Helper to send error to Sentry
const sendToSentry = (error, level = 'error', context = {}) => {
  try {
    // Dynamically import Sentry to avoid issues if not initialized
    if (typeof window !== 'undefined' && window.Sentry) {
      const Sentry = window.Sentry;
      
      if (error instanceof Error) {
        // For Error instances, use captureException
        Sentry.captureException(error, {
          level: level,
          tags: context.tags || {},
          extra: context.extra || {},
        });
      } else if (error && typeof error === 'object') {
        // For plain objects, convert to Error instance
        const errorMessage = error.message || JSON.stringify(error);
        const errorObj = new Error(errorMessage);
        Sentry.captureException(errorObj, {
          level: level,
          tags: context.tags || {},
          extra: {
            ...context.extra,
            originalData: error,
          },
        });
      } else {
        // For primitive values, convert to string and create Error
        const errorObj = new Error(String(error));
        Sentry.captureException(errorObj, {
          level: level,
          tags: context.tags || {},
          extra: context.extra || {},
        });
      }
    }
  } catch (sentryError) {
    // Silently fail - don't break logging if Sentry fails
    console.error('Failed to send error to Sentry:', sentryError);
  }
};

const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log('[SuperAdmin LOG]', ...args);
    }
  },
  
  error: (...args) => {
    // Always log errors
    if (isDevelopment) {
      console.error('[SuperAdmin ERROR]', ...args);
    } else {
      // In production, log errors and send to Sentry
      const sanitizedArgs = args.map(arg => {
        if (arg instanceof Error) {
          return {
            message: arg.message,
            stack: arg.stack
          };
        }
        return arg;
      });
      console.error('[SuperAdmin ERROR]', sanitizedArgs);
      
      // Send to Sentry in production
      if (!isDevelopment) {
        // Find Error instance in args, or create one from first arg
        let errorToSend = args.find(arg => arg instanceof Error);
        if (!errorToSend && args.length > 0) {
          const firstArg = args[0];
          if (typeof firstArg === 'object' && firstArg !== null) {
            errorToSend = firstArg;
          } else {
            errorToSend = new Error(String(firstArg));
          }
        }
        
        if (errorToSend) {
          sendToSentry(errorToSend, 'error', {
            tags: { source: 'superadmin_logger' },
            extra: { args: args.length > 1 ? args.slice(1) : [] }
          });
        }
      }
    }
  },
  
  warn: (...args) => {
    if (isDevelopment) {
      console.warn('[SuperAdmin WARN]', ...args);
    } else {
      // In production, also send warnings to Sentry
      console.warn('[SuperAdmin WARN]', ...args);
      
      if (!isDevelopment && args.length > 0) {
        const firstArg = args[0];
        let errorToSend = args.find(arg => arg instanceof Error);
        if (!errorToSend) {
          if (typeof firstArg === 'object' && firstArg !== null) {
            errorToSend = firstArg;
          } else {
            errorToSend = new Error(String(firstArg));
          }
        }
        
        if (errorToSend) {
          sendToSentry(errorToSend, 'warning', {
            tags: { source: 'superadmin_logger' },
            extra: { args: args.length > 1 ? args.slice(1) : [] }
          });
        }
      }
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

