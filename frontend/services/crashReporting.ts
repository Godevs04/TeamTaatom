import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getUserFromStorage } from './auth';
import { getApiUrl } from '../utils/config';
import logger from '../utils/logger';
import * as Sentry from '@sentry/react-native';

interface ErrorContext {
  userId?: string;
  screen?: string;
  action?: string;
  [key: string]: any;
}

class CrashReportingService {
  private isInitialized = false;
  private userId: string | null = null;
  private sentryDsn: string | null = null;

  async initialize() {
    if (this.isInitialized) return;

    // Get Sentry DSN from environment
    const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
    this.sentryDsn = sentryDsn || null;
    
    const user = await getUserFromStorage();
    this.userId = user?._id || null;

    // Set user context in Sentry if available
    if (this.userId && Sentry) {
      Sentry.setUser({
        id: this.userId,
        username: (user as any)?.username,
        email: (user as any)?.email,
      });
    }

    // Set up global error handlers
    this.setupErrorHandlers();

    this.isInitialized = true;
  }

  private setupErrorHandlers() {
    // Handle unhandled promise rejections
    if (typeof global !== 'undefined') {
      const ErrorUtils = (global as any).ErrorUtils;
      if (ErrorUtils) {
        const originalHandler = ErrorUtils.getGlobalHandler?.();
        
        ErrorUtils.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
          this.captureException(error, {
            isFatal,
            type: 'unhandled_error',
            level: isFatal ? 'fatal' : 'error',
          });
          
          if (originalHandler) {
            originalHandler(error, isFatal);
          }
        });
      }
    }

    // Handle console errors - only in development to avoid performance impact
    // Note: In production, logger.error already handles Sentry integration
    if (process.env.NODE_ENV === 'development' || __DEV__) {
      const originalError = console.error;
      console.error = (...args: any[]) => {
        if (args[0] instanceof Error) {
          this.captureException(args[0], {
            type: 'console_error',
            level: 'error',
          });
        }
        originalError(...args);
      };
    }
  }

  async captureException(error: Error, context?: ErrorContext) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Add context to Sentry
    if (Sentry && this.sentryDsn) {
      try {
        // Set additional context
        Sentry.setContext('error_details', {
          platform: Platform.OS,
          appVersion: Constants.expoConfig?.version || '1.0.0',
          ...context,
        });

        // Set tags for better filtering
        if (context?.screen) {
          Sentry.setTag('screen', context.screen);
        }
        if (context?.action) {
          Sentry.setTag('action', context.action);
        }
        if (context?.type) {
          Sentry.setTag('error_type', context.type);
        }
        if (context?.level) {
          Sentry.setTag('level', context.level);
        }

        // Capture exception with Sentry
        Sentry.captureException(error, {
          level: (context?.level as any) || 'error',
          tags: {
            platform: Platform.OS,
            ...(context?.screen && { screen: context.screen }),
            ...(context?.action && { action: context.action }),
          },
        });
      } catch (sentryError) {
        // Sentry failed - log but don't break the app
        logger.error('Failed to send error to Sentry', sentryError);
      }
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      logger.error('[Crash Report]', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        platform: Platform.OS,
        userId: this.userId,
        context,
      });
    }

    // Also send to backend for logging/storage (fallback)
    try {
      await fetch(getApiUrl('/api/v1/analytics/errors'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          name: error.name,
          platform: Platform.OS,
          userId: this.userId,
          timestamp: new Date().toISOString(),
          context: {
            ...context,
            appVersion: Constants.expoConfig?.version || '1.0.0',
          },
        }),
      }).catch(() => {
        // Silently fail - don't break the app
      });
    } catch (err) {
      // Silently fail
    }
  }

  async captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Send to Sentry
    if (Sentry && this.sentryDsn) {
      try {
        // Set context
        if (context) {
          Sentry.setContext('message_details', {
            platform: Platform.OS,
            appVersion: Constants.expoConfig?.version || '1.0.0',
            ...context,
          });

          // Set tags
          if (context.screen) {
            Sentry.setTag('screen', context.screen);
          }
          if (context.action) {
            Sentry.setTag('action', context.action);
          }
        }

        // Capture message with Sentry
        Sentry.captureMessage(message, {
          level: level as any,
          tags: {
            platform: Platform.OS,
            ...(context?.screen && { screen: context.screen }),
            ...(context?.action && { action: context.action }),
          },
        });
      } catch (sentryError) {
        logger.error('Failed to send message to Sentry', sentryError);
      }
    }

    if (process.env.NODE_ENV === 'development') {
      logger.debug(`[Crash Report ${level.toUpperCase()}]`, {
        message,
        level,
        platform: Platform.OS,
        userId: this.userId,
        context,
      });
    }

    // Also send to backend (fallback)
    try {
      await fetch(getApiUrl('/api/v1/analytics/errors'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          level,
          platform: Platform.OS,
          userId: this.userId,
          timestamp: new Date().toISOString(),
          context: {
            ...context,
            appVersion: Constants.expoConfig?.version || '1.0.0',
          },
        }),
      }).catch(() => {});
    } catch (err) {
      // Silently fail
    }
  }

  setUser(userId: string, userData?: { username?: string; email?: string }) {
    this.userId = userId;
    
    // Update Sentry user context
    if (Sentry && this.sentryDsn) {
      Sentry.setUser({
        id: userId,
        username: userData?.username,
        email: userData?.email,
      });
    }
  }

  addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
    // Add breadcrumb to Sentry for better error context
    if (Sentry && this.sentryDsn) {
      Sentry.addBreadcrumb({
        message,
        category,
        level: 'info',
        data,
        timestamp: Date.now() / 1000, // Sentry expects seconds
      });
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`[Breadcrumb] ${category}: ${message}`, data);
    }
  }
}

export const crashReportingService = new CrashReportingService();

// Convenience functions
export const captureException = (error: Error, context?: ErrorContext) => {
  crashReportingService.captureException(error, context);
};

export const captureMessage = (message: string, level?: 'info' | 'warning' | 'error', context?: ErrorContext) => {
  crashReportingService.captureMessage(message, level, context);
};

