import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import logger from '../utils/logger';

/**
 * Configure Android Notification Channels.
 * Android 8.0+ (API 26+) requires explicit notification channels to display push notifications.
 */
export async function setupAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // 1. Default Channel
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1C73B4',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    // 2. Taatom Custom Channel (used by backend)
    await Notifications.setNotificationChannelAsync('taatom_notifications', {
      name: 'Taatom Alerts & Updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1C73B4',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    logger.info('✅ Android Notification Channels initialized successfully');
  } catch (err: any) {
    logger.error('Failed to setup Android Notification Channels:', err?.message || err);
  }
}

/**
 * Register for Push Notifications (Android & iOS).
 * Returns the Expo push token or null if permission denied, on web, or token unavailable.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    // Always setup Android notification channels first
    if (Platform.OS === 'android') {
      await setupAndroidNotificationChannels();
    }

    // Check existing notification permissions
    const existingPermissions = await Notifications.getPermissionsAsync();
    let isGranted = existingPermissions.granted;

    // Request permissions if not already granted (Android 13+ & iOS)
    if (!isGranted) {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      isGranted = requestedPermissions.granted;
    }

    if (!isGranted) {
      logger.warn('[PushNotifications] User denied push notification permissions');
      return null;
    }

    // Get EAS Project ID if available
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData?.data ?? null;

    if (token) {
      logger.info('✅ Expo Push Token obtained successfully:', token);
    }

    return token;
  } catch (err: any) {
    logger.error('[PushNotifications] Push registration error:', err?.message || err);
    return null;
  }
}
