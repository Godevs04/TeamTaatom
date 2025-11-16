import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getUserFromStorage } from './auth';

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

    // Get Sentry DSN from environment or config
    // For now, we'll use a simple error logging service
    // In production, replace with actual Sentry initialization
    
    const user = await getUserFromStorage();
    this.userId = user?._id || null;

    // Set up global error handlers
    this.setupErrorHandlers();

    this.isInitialized = true;
  }

  private setupErrorHandlers() {
    // Handle unhandled promise rejections
    if (typeof global !== 'undefined') {
      const originalHandler = global.ErrorUtils?.getGlobalHandler?.();
      
      global.ErrorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
        this.captureException(error, {
          isFatal,
          type: 'unhandled_error',
        });
        
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }

    // Handle console errors
    const originalError = console.error;
    console.error = (...args: any[]) => {
      if (args[0] instanceof Error) {
        this.captureException(args[0], {
          type: 'console_error',
        });
      }
      originalError(...args);
    };
  }

  async captureException(error: Error, context?: ErrorContext) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const errorReport = {
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
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[Crash Report]', errorReport);
    }

    // Send to backend for logging/storage
    try {
      await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/v1/analytics/errors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorReport),
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

    const report = {
      message,
      level,
      platform: Platform.OS,
      userId: this.userId,
      timestamp: new Date().toISOString(),
      context: {
        ...context,
        appVersion: Constants.expoConfig?.version || '1.0.0',
      },
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Crash Report ${level.toUpperCase()}]`, report);
    }

    try {
      await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/v1/analytics/errors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report),
      }).catch(() => {});
    } catch (err) {
      // Silently fail
    }
  }

  setUser(userId: string) {
    this.userId = userId;
  }

  addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
    // For now, just log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Breadcrumb] ${category}: ${message}`, data);
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

