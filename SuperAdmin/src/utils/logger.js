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
      
      // Filter out expected errors before sending to Sentry
      const firstArg = args.length > 0 ? args[0] : null;
      const errorMessage = typeof firstArg === 'string' ? firstArg : 
                          (firstArg?.message || String(firstArg || ''));
      const errorCode = firstArg?.code || '';
      const errorName = firstArg?.name || '';
      
      // Check if this is an expected error that shouldn't be sent to Sentry
      const isNetworkError = errorMessage.includes('Network Error') || 
                            errorMessage.includes('Network error') ||
                            errorCode === 'ERR_NETWORK' ||
                            errorCode === 'SRV_6003';
      const isAuthError = errorMessage.includes('401') || 
                         errorMessage.includes('expired') ||
                         errorMessage.includes('Token expired') ||
                         errorMessage.includes('unauthorized');
      const isModuleError = errorMessage.includes('Importing a module script failed') ||
                           errorMessage.includes('dynamically imported module') ||
                           errorMessage.includes('Loading chunk') ||
                           errorName === 'ChunkLoadError';
      const isSocketError = errorMessage.includes('Socket disconnected') ||
                           errorMessage.includes('socket');
      
      const isExpectedError = isNetworkError || isAuthError || isModuleError || isSocketError;
      
      // Send to Sentry in production only if not an expected error
      if (!isDevelopment && !isExpectedError) {
        // Find Error instance in args, or create one from first arg
        let errorToSend = args.find(arg => arg instanceof Error);
        if (!errorToSend && args.length > 0) {
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
      } else if (isExpectedError && !isDevelopment) {
        // Log expected errors as debug (don't send to Sentry)
        console.debug('[SuperAdmin DEBUG] Expected error (not sent to Sentry):', sanitizedArgs);
      }
    }
  },
  
  warn: (...args) => {
    if (isDevelopment) {
      console.warn('[SuperAdmin WARN]', ...args);
    } else {
      // In production, log warnings but filter out expected ones before Sentry
      console.warn('[SuperAdmin WARN]', ...args);
      
      // Filter out expected warnings before sending to Sentry
      const firstArg = args.length > 0 ? args[0] : null;
      const warningMessage = typeof firstArg === 'string' ? firstArg : 
                            (firstArg?.message || String(firstArg || ''));
      
      // Check if this is an expected warning that shouldn't be sent to Sentry
      const isSocketWarning = warningMessage.includes('Socket disconnected') ||
                             warningMessage.includes('socket') ||
                             warningMessage.includes('⚠️ Socket disconnected');
      const isExpectedWarning = isSocketWarning;
      
      if (!isDevelopment && !isExpectedWarning && args.length > 0) {
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
      } else if (isExpectedWarning && !isDevelopment) {
        // Log expected warnings as debug (don't send to Sentry)
        console.debug('[SuperAdmin DEBUG] Expected warning (not sent to Sentry):', args);
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

