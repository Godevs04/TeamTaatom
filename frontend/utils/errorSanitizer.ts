/**
 * Error Sanitization Utility
 * 
 * Ensures that technical errors are never shown to users in production.
 * All technical details are logged internally but only user-friendly messages are displayed.
 */

import { parseError } from './errorCodes';
import logger from './logger';

// Detect environment - React Native/Expo uses __DEV__, web uses NODE_ENV
const isProduction = typeof __DEV__ !== 'undefined' ? !__DEV__ : process.env.NODE_ENV === 'production';

/**
 * Check if a string contains technical error information
 */
const isTechnicalError = (message: string): boolean => {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const technicalPatterns = [
    // Stack traces
    /at\s+\w+\.\w+/i,
    /\.(js|ts|tsx|jsx):\d+:\d+/i,
    /Error:\s+/i,
    /TypeError|ReferenceError|SyntaxError|RangeError/i,
    
    // File paths
    /\/[^\s]+\.(js|ts|tsx|jsx)/i,
    /node_modules/i,
    /src\/|app\/|components\//i,
    
    // Transform/Metro errors
    /TransformError/i,
    /Metro/i,
    /Bundling/i,
    /Unable to resolve/i,
    
    // Internal error codes
    /SRV_\d+|AUTH_\d+|VAL_\d+/i,
    
    // Stack trace indicators
    /stack\s+at/i,
    /componentStack/i,
  ];

  return technicalPatterns.some(pattern => pattern.test(message));
};

/**
 * Get user-friendly error message
 */
const getUserFriendlyMessage = (error: any): string => {
  // If it's already a user-friendly message, return it
  if (typeof error === 'string' && !isTechnicalError(error)) {
    return error;
  }

  // Try to parse as API error first
  try {
    const parsed = parseError(error);
    if (parsed.userMessage && !isTechnicalError(parsed.userMessage)) {
      return parsed.userMessage;
    }
  } catch {
    // Continue to fallback
  }

  // Check if error has a userMessage property
  if (error?.userMessage && typeof error.userMessage === 'string' && !isTechnicalError(error.userMessage)) {
    return error.userMessage;
  }

  // Check if error.message exists and is not technical
  if (error?.message && typeof error.message === 'string' && !isTechnicalError(error.message)) {
    // Only use it if it's not technical
    return error.message;
  }

  // Default user-friendly messages
  return 'Something went wrong. Please try again later.';
};

/**
 * Sanitize error for display to users
 * 
 * In production: Returns only user-friendly messages
 * In development: Returns full error details for debugging
 * 
 * @param error - Error object or string
 * @param context - Optional context for logging
 * @returns Sanitized error message safe for UI display
 */
export const sanitizeErrorForDisplay = (error: any, context?: string): string => {
  // Always log the full error internally
  if (context) {
    logger.error(`[${context}] Error occurred:`, error);
  } else {
    logger.error('Error occurred:', error);
  }

  // In development, show full error details for debugging
  if (!isProduction) {
    if (typeof error === 'string') {
      return error;
    }
    if (error?.message) {
      return error.message;
    }
    if (error?.userMessage) {
      return error.userMessage;
    }
    return String(error);
  }

  // In production, only show user-friendly messages
  return getUserFriendlyMessage(error);
};

/**
 * Sanitize error message string
 * 
 * @param message - Error message string
 * @param context - Optional context for logging
 * @returns Sanitized message safe for UI display
 */
export const sanitizeErrorMessage = (message: string, context?: string): string => {
  if (!message || typeof message !== 'string') {
    return 'Something went wrong. Please try again later.';
  }

  // Log technical errors internally
  if (isTechnicalError(message)) {
    if (context) {
      logger.error(`[${context}] Technical error detected:`, message);
    } else {
      logger.error('Technical error detected:', message);
    }
  }

  // In development, show full message
  if (!isProduction) {
    return message;
  }

  // In production, check if it's technical
  if (isTechnicalError(message)) {
    // Try to extract user-friendly part if possible
    const lines = message.split('\n');
    const firstLine = lines[0] || '';
    
    // If first line looks user-friendly, use it
    if (!isTechnicalError(firstLine) && firstLine.length < 200) {
      return firstLine;
    }
    
    // Otherwise return generic message
    return 'Something went wrong. Please try again later.';
  }

  // Message is already user-friendly
  return message;
};

/**
 * Check if current environment is production
 */
export const isProd = (): boolean => {
  return isProduction;
};

/**
 * Check if current environment is development
 */
export const isDev = (): boolean => {
  return !isProduction;
};

