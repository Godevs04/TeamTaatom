/**
 * Service Worker Registration and Management
 * Provides offline support and caching for static assets and API responses
 */

import { Platform } from 'react-native';
import logger from './logger';

// Service worker is only available on web
const isWeb = Platform.OS === 'web';

/**
 * Register service worker for offline support (web only)
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isWeb || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    logger.debug('Service Worker not available on this platform');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    logger.info('Service Worker registered successfully');

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available
            logger.info('New service worker available');
            // Optionally notify user to refresh
          }
        });
      }
    });

    return registration;
  } catch (error) {
    logger.error('Service Worker registration failed:', error);
    return null;
  }
};

/**
 * Unregister service worker
 */
export const unregisterServiceWorker = async (): Promise<boolean> => {
  if (!isWeb || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const unregistered = await registration.unregister();
    logger.info('Service Worker unregistered');
    return unregistered;
  } catch (error) {
    logger.error('Service Worker unregistration failed:', error);
    return false;
  }
};

/**
 * Check if service worker is supported
 */
export const isServiceWorkerSupported = (): boolean => {
  return isWeb && typeof window !== 'undefined' && 'serviceWorker' in navigator;
};

/**
 * Get service worker registration
 */
export const getServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isServiceWorkerSupported()) {
    return null;
  }

  try {
    return await navigator.serviceWorker.ready;
  } catch (error) {
    logger.error('Failed to get service worker registration:', error);
    return null;
  }
};

