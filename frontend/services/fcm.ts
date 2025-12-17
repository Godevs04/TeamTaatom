import { Platform } from 'react-native';
import logger from '../utils/logger';

// Dynamically import FCM to handle cases where native module isn't available (Expo Go)
let messaging: any = null;
try {
  messaging = require('@react-native-firebase/messaging').default;
} catch (error) {
  logger.warn('@react-native-firebase/messaging not available. Use a development build for FCM support.');
}

/**
 * Firebase Cloud Messaging (FCM) Service
 * Handles FCM token registration and notification handling
 */

class FCMService {
  private fcmToken: string | null = null;
  private initialized = false;

  /**
   * Initialize FCM service
   * Call this once when app starts
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('FCM already initialized');
      return;
    }

    // Check if FCM is available
    if (!messaging) {
      logger.warn('FCM native module not available. Use a development build for FCM support.');
      return;
    }

    // Skip on web platform
    if (Platform.OS === 'web') {
      logger.debug('FCM skipped on web platform');
      return;
    }

    try {
      // Request permission for push notifications
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        logger.warn('User has not granted notification permission');
        return;
      }

      // Get FCM token
      const token = await messaging().getToken();
      if (token) {
        this.fcmToken = token;
        logger.debug('FCM token obtained:', token.substring(0, 20) + '...');
      }

      // Set up foreground message handler
      this.setupForegroundHandler();

      // Handle token refresh
      messaging().onTokenRefresh((token: string) => {
        logger.debug('FCM token refreshed:', token.substring(0, 20) + '...');
        this.fcmToken = token;
        // Token will be updated when user logs in or app comes to foreground
      });

      this.initialized = true;
      logger.info('✅ FCM initialized successfully');
    } catch (error: any) {
      logger.error('FCM initialization error:', error);
      // Don't throw - allow app to continue without FCM
      if (error.message?.includes('Native module') || error.message?.includes('not found')) {
        logger.warn('FCM native module not available. Use a development build for FCM support.');
      }
    }
  }

  /**
   * Get current FCM token
   */
  async getToken(): Promise<string | null> {
    if (!messaging) {
      return null;
    }
    
    try {
      if (!this.fcmToken) {
        this.fcmToken = await messaging().getToken();
      }
      return this.fcmToken;
    } catch (error: any) {
      logger.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Set up foreground message handler
   * Called when app is in foreground and receives a notification
   */
  private setupForegroundHandler(): void {
    if (!messaging) {
      return;
    }
    
    messaging().onMessage(async (remoteMessage: any) => {
      logger.debug('Foreground FCM message received:', remoteMessage);
      
      // Handle notification display
      // You can use a notification library like react-native-push-notification
      // or show an in-app notification
      
      if (remoteMessage.notification) {
        const { title, body } = remoteMessage.notification;
        logger.info(`FCM Notification: ${title} - ${body}`);
        
        // Trigger any in-app notification handlers here
        // For example, show a toast or update notification badge
      }
    });
  }

  /**
   * Set up background/quit state message handler
   * This must be called outside of React component lifecycle
   * Call this in index.js at the root level
   */
  setupBackgroundHandler(): void {
    if (!messaging) {
      return;
    }
    
    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      logger.debug('Background FCM message received:', remoteMessage);
      
      // Handle background notification
      // This runs when app is in background or quit state
      
      if (remoteMessage.notification) {
        const { title, body } = remoteMessage.notification;
        logger.info(`Background FCM Notification: ${title} - ${body}`);
      }
    });
  }

  /**
   * Handle notification tap (when user taps notification)
   * Call this in your root component or navigation handler
   */
  setupNotificationOpenedHandler(onNotificationOpened: (data: any) => void): void {
    if (!messaging) {
      return;
    }
    
    // Check if app was opened from a notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage: any) => {
        if (remoteMessage) {
          logger.debug('App opened from notification:', remoteMessage);
          onNotificationOpened(remoteMessage.data);
        }
      });

    // Listen for notification opened while app is running
    messaging().onNotificationOpenedApp((remoteMessage: any) => {
      logger.debug('Notification opened app:', remoteMessage);
      onNotificationOpened(remoteMessage.data);
    });
  }

  /**
   * Delete FCM token (e.g., on logout)
   */
  async deleteToken(): Promise<void> {
    if (!messaging) {
      return;
    }
    
    try {
      await messaging().deleteToken();
      this.fcmToken = null;
      logger.debug('FCM token deleted');
    } catch (error: any) {
      logger.error('Error deleting FCM token:', error);
    }
  }

  /**
   * Check if FCM is available
   */
  isAvailable(): boolean {
    return Platform.OS !== 'web' && messaging !== null;
  }
}

// Export singleton instance
export const fcmService = new FCMService();

// Export background message handler function (must be called in index.js)
export const registerBackgroundHandler = () => {
  if (!messaging) {
    return;
  }
  
  messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
    logger.debug('Background FCM message received:', remoteMessage);
    
    if (remoteMessage.notification) {
      const { title, body } = remoteMessage.notification;
      logger.info(`Background FCM Notification: ${title} - ${body}`);
    }
  });
};

