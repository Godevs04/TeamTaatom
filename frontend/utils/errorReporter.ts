/**
 * Centralized Error Reporter for Sentry
 * 
 * This utility ensures all errors are sent to Sentry with:
 * - Proper stack traces (automatically generated if missing)
 * - Full context (user, request, application state)
 * - Sanitized sensitive data (passwords, tokens, etc.)
 * - Clear error codes and types for easy identification
 * 
 * USAGE EXAMPLES:
 * 
 * 1. Report API errors:
 *    import { reportApiError } from '../utils/errorReporter';
 *    try {
 *      await api.post('/endpoint', data);
 *    } catch (error) {
 *      reportApiError(error, {
 *        url: '/api/endpoint',
 *        method: 'POST',
 *        statusCode: error.response?.status,
 *        requestData: data,
 *        responseData: error.response?.data,
 *        errorCode: 'API_ERROR',
 *      });
 *    }
 * 
 * 2. Report component errors:
 *    import { reportComponentError } from '../utils/errorReporter';
 *    try {
 *      // Component logic
 *    } catch (error) {
 *      reportComponentError(error, {
 *        screen: 'HomeScreen',
 *        component: 'PostCard',
 *        action: 'likePost',
 *        metadata: { postId: '123' },
 *      });
 *    }
 * 
 * 3. Report service errors:
 *    import { reportServiceError } from '../utils/errorReporter';
 *    try {
 *      // Service logic
 *    } catch (error) {
 *      reportServiceError(error, {
 *        service: 'AuthService',
 *        functionName: 'signIn',
 *        action: 'user_login',
 *        metadata: { email: 'user@example.com' },
 *      });
 *    }
 * 
 * 4. Report generic errors:
 *    import { reportError } from '../utils/errorReporter';
 *    try {
 *      // Any logic
 *    } catch (error) {
 *      reportError(error, {
 *        userId: user.id,
 *        screen: 'ProfileScreen',
 *        action: 'updateProfile',
 *        errorCode: 'PROFILE_UPDATE_ERROR',
 *        metadata: { field: 'username' },
 *      });
 *    }
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import logger from './logger';

interface ErrorContext {
  // User context
  userId?: string;
  username?: string;
  email?: string;
  
  // Request context
  url?: string;
  method?: string;
  statusCode?: number;
  requestData?: any;
  responseData?: any;
  
  // Application context
  screen?: string;
  action?: string;
  component?: string;
  functionName?: string;
  
  // Error context
  errorCode?: string;
  errorType?: string;
  originalError?: any;
  
  // Additional metadata
  metadata?: Record<string, any>;
}

/**
 * Sanitize sensitive data from error context
 */
const sanitizeContext = (context: ErrorContext): ErrorContext => {
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie', 'authToken', 'csrfToken'];
  
  const sanitizeObject = (obj: any, visited: WeakSet<object> = new WeakSet()): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (visited.has(obj)) return '[Circular Reference]';
    visited.add(obj);
    
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item, visited));
    }
    
    const sanitized: any = {};
    Object.keys(obj).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeObject(obj[key], visited);
      }
    });
    return sanitized;
  };
  
  return {
    ...context,
    requestData: context.requestData ? sanitizeObject(context.requestData) : undefined,
    responseData: context.responseData ? sanitizeObject(context.responseData) : undefined,
    metadata: context.metadata ? sanitizeObject(context.metadata) : undefined,
  };
};

/**
 * Ensure error has a proper stack trace
 */
const ensureStackTrace = (error: any): Error => {
  if (error instanceof Error) {
    // Error already has stack trace
    if (!error.stack && error.message) {
      // Try to generate stack trace
      try {
        throw error;
      } catch (e) {
        // Stack trace should be generated now
        return e as Error;
      }
    }
    return error;
  }
  
  // Convert non-Error to Error with stack trace
  const errorMessage = error?.message || 
                       error?.toString() || 
                       (typeof error === 'string' ? error : 'Unknown error');
  const errorObj = new Error(errorMessage);
  
  // Preserve original error properties
  if (error && typeof error === 'object') {
    Object.keys(error).forEach(key => {
      if (!['message', 'name', 'stack'].includes(key)) {
        (errorObj as any)[key] = error[key];
      }
    });
  }
  
  // Generate stack trace
  if (!errorObj.stack) {
    try {
      throw errorObj;
    } catch (e) {
      // Stack trace generated
      return e as Error;
    }
  }
  
  return errorObj;
};

/**
 * Report error to Sentry with full context
 */
export const reportError = (error: any, context: ErrorContext = {}): void => {
  try {
    // Filter out -1102 (operation cancelled) errors - these are expected and shouldn't be reported
    const errorCode = error?.code;
    const errorDomain = error?.domain;
    const errorMessage = error?.message || String(error || '');
    
    // -1102 NSURLErrorCancelled is expected when operation is cancelled (navigation, unmount, etc.)
    if (errorCode === -1102 || (errorDomain === 'NSURLErrorDomain' && errorCode === -1102) ||
        errorMessage.includes('-1102') || errorMessage.includes('NSURLErrorCancelled') ||
        errorMessage.includes('AVPlayerItem') && errorMessage.includes('-1102') ||
        errorMessage.includes('operation was cancelled') || errorMessage.includes('operation cancelled')) {
      // Silently ignore cancelled operations - they're expected behavior
      logger.debug('Error reporter: Ignoring cancelled operation (-1102)');
      return; // Don't send to Sentry
    }
    
    // Dynamically import Sentry to avoid circular dependencies
    if (typeof require === 'undefined') {
      logger.debug('Sentry not available (require not available)');
      return;
    }
    
    const Sentry = require('@sentry/react-native');
    if (!Sentry || !Sentry.captureException) {
      logger.debug('Sentry not initialized');
      return;
    }
    
    // Ensure error has stack trace
    const errorWithStack = ensureStackTrace(error);
    
    // Sanitize context to remove sensitive data
    const sanitizedContext = sanitizeContext(context);
    
    // Set user context if available
    if (sanitizedContext.userId || sanitizedContext.email) {
      Sentry.setUser({
        id: sanitizedContext.userId,
        username: sanitizedContext.username,
        email: sanitizedContext.email,
      });
    }
    
    // Set tags for better filtering
    const tags: Record<string, string> = {
      platform: Platform.OS,
      error_code: sanitizedContext.errorCode || 'UNKNOWN',
      error_type: sanitizedContext.errorType || 'unknown',
    };
    
    if (sanitizedContext.screen) tags.screen = sanitizedContext.screen;
    if (sanitizedContext.action) tags.action = sanitizedContext.action;
    if (sanitizedContext.component) tags.component = sanitizedContext.component;
    if (sanitizedContext.method) tags.http_method = sanitizedContext.method;
    if (sanitizedContext.statusCode) tags.http_status = String(sanitizedContext.statusCode);
    
    Sentry.setTags(tags);
    
    // Set additional context
    Sentry.setContext('error_details', {
      // Application info
      appVersion: Constants.expoConfig?.version || '1.0.0',
      buildNumber: Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || 'unknown',
      platform: Platform.OS,
      platformVersion: Platform.Version,
      
      // Request context
      url: sanitizedContext.url,
      method: sanitizedContext.method,
      statusCode: sanitizedContext.statusCode,
      requestData: sanitizedContext.requestData,
      responseData: sanitizedContext.responseData,
      
      // Application context
      screen: sanitizedContext.screen,
      action: sanitizedContext.action,
      component: sanitizedContext.component,
      functionName: sanitizedContext.functionName,
      
      // Error context
      errorCode: sanitizedContext.errorCode,
      errorType: sanitizedContext.errorType,
      originalError: sanitizedContext.originalError,
      
      // Additional metadata
      ...sanitizedContext.metadata,
    });
    
    // Capture exception with all context
    Sentry.captureException(errorWithStack, {
      level: 'error',
      tags,
      extra: {
        ...sanitizedContext,
        // Ensure stack trace is included
        stack: errorWithStack.stack,
        // Include original error if it was converted
        originalError: error instanceof Error ? undefined : error,
      },
    });
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('[ErrorReporter] Error reported to Sentry:', {
        message: errorWithStack.message,
        errorCode: sanitizedContext.errorCode,
        screen: sanitizedContext.screen,
        action: sanitizedContext.action,
      });
    }
  } catch (reportError) {
    // Silently fail - don't break the app if Sentry fails
    if (process.env.NODE_ENV === 'development') {
      logger.debug('[ErrorReporter] Failed to report error to Sentry:', reportError);
    }
  }
};

/**
 * Report API error with request/response context
 */
export const reportApiError = (
  error: any,
  config?: {
    url?: string;
    method?: string;
    requestData?: any;
    responseData?: any;
    statusCode?: number;
    errorCode?: string;
  }
): void => {
  const context: ErrorContext = {
    errorType: 'api_error',
    url: config?.url,
    method: config?.method,
    statusCode: config?.statusCode,
    requestData: config?.requestData,
    responseData: config?.responseData,
    errorCode: config?.errorCode,
    originalError: error,
  };
  
  reportError(error, context);
};

/**
 * Report component error with screen/component context
 */
export const reportComponentError = (
  error: any,
  config?: {
    screen?: string;
    component?: string;
    action?: string;
    metadata?: Record<string, any>;
  }
): void => {
  const context: ErrorContext = {
    errorType: 'component_error',
    screen: config?.screen,
    component: config?.component,
    action: config?.action,
    metadata: config?.metadata,
    originalError: error,
  };
  
  reportError(error, context);
};

/**
 * Report service error with function context
 */
export const reportServiceError = (
  error: any,
  config?: {
    service?: string;
    functionName?: string;
    action?: string;
    metadata?: Record<string, any>;
  }
): void => {
  const context: ErrorContext = {
    errorType: 'service_error',
    component: config?.service,
    functionName: config?.functionName,
    action: config?.action,
    metadata: config?.metadata,
    originalError: error,
  };
  
  reportError(error, context);
};

export default {
  reportError,
  reportApiError,
  reportComponentError,
  reportServiceError,
};

