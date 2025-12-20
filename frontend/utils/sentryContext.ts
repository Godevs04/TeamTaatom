/**
 * Sentry Context Utilities
 * Helper functions to add context to Sentry errors for better debugging
 */

import * as Sentry from '@sentry/react-native';
import { crashReportingService } from '../services/crashReporting';

/**
 * Set the current screen/route for error context
 * Call this when navigating to a new screen
 * @param screenName - Name of the current screen (e.g., 'home', 'profile', 'post/[id]')
 */
export const setScreenContext = (screenName: string) => {
  if (Sentry) {
    Sentry.setTag('screen', screenName);
    Sentry.setContext('navigation', {
      screen: screenName,
      timestamp: new Date().toISOString(),
    });
  }
  
  // Also add breadcrumb for navigation tracking
  crashReportingService.addBreadcrumb(`Navigated to ${screenName}`, 'navigation', {
    screen: screenName,
  });
};

/**
 * Set action context for the current operation
 * Call this before performing an action that might fail
 * @param action - Name of the action (e.g., 'create_post', 'like_post', 'follow_user')
 * @param data - Optional data about the action
 */
export const setActionContext = (action: string, data?: Record<string, any>) => {
  if (Sentry) {
    Sentry.setTag('action', action);
    Sentry.setContext('action', {
      action,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
  
  // Add breadcrumb
  crashReportingService.addBreadcrumb(`Action: ${action}`, 'action', data);
};

/**
 * Clear action context after action completes
 */
export const clearActionContext = () => {
  if (Sentry) {
    Sentry.setTag('action', undefined);
    Sentry.setContext('action', null);
  }
};

/**
 * Add breadcrumb for debugging
 * @param message - Breadcrumb message
 * @param category - Breadcrumb category
 * @param data - Optional data
 */
export const addBreadcrumb = (message: string, category: string, data?: Record<string, any>) => {
  crashReportingService.addBreadcrumb(message, category, data);
};

/**
 * Set user context in Sentry
 * @param userId - User ID
 * @param userData - Optional user data (username, email)
 */
export const setUserContext = (userId: string, userData?: { username?: string; email?: string }) => {
  crashReportingService.setUser(userId, userData);
};

/**
 * Clear user context (e.g., on logout)
 */
export const clearUserContext = () => {
  if (Sentry) {
    Sentry.setUser(null);
  }
  crashReportingService.setUser('', {});
};

