/**
 * Production-safe logger utility
 * Only logs in development mode, sends errors to tracking in production
 */

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';

interface Logger {
  log: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

// Error tracking function (to be implemented with actual service)
const trackError = (context: string, error: any, args?: any[]) => {
  if (!isDev) {
    // In production, send to error tracking service
    // Example: Sentry.captureException(error, { extra: { context, args } });
    // For now, we'll just ensure errors are logged
    console.error(`[${context}]`, error, args);
  }
};

export const logger: Logger = {
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    } else {
      // Warnings should be tracked in production
      trackError('warning', args);
    }
  },
  error: (contextOrError: string | any, errorOrArgs?: any, ...args: any[]) => {
    // Flexible error handling: can be called as error(context, error) or error(message, error)
    if (typeof contextOrError === 'string' && errorOrArgs !== undefined) {
      // Called as: logger.error('context', error, ...args)
      const context = contextOrError;
      const error = errorOrArgs;
      console.error(`[${context}]`, error, ...args);
      if (!isDev) {
        trackError(context, error, args);
      }
    } else {
      // Called as: logger.error(error) or logger.error(error, ...args)
      const error = contextOrError;
      console.error('[Error]', error, errorOrArgs !== undefined ? [errorOrArgs, ...args] : args);
      if (!isDev) {
        trackError('unknown', error, errorOrArgs !== undefined ? [errorOrArgs, ...args] : args);
      }
    }
  },
};

// Create context-specific loggers
export const createLogger = (context: string) => ({
  log: (...args: any[]) => logger.log(`[${context}]`, ...args),
  debug: (...args: any[]) => logger.debug(`[${context}]`, ...args),
  info: (...args: any[]) => logger.info(`[${context}]`, ...args),
  warn: (...args: any[]) => logger.warn(`[${context}]`, ...args),
  error: (error: any, ...args: any[]) => logger.error(context, error, ...args),
});

// Default export for backward compatibility
export default logger;
