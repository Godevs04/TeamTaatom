import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Register for Expo Push Notifications (iOS / EAS builds).
 * Returns the Expo push token or null if permission denied, on web, or token unavailable (e.g. simulator).
 * Does not use expo-device to avoid "Cannot find native module 'ExpoDevice'" in some runtimes.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData?.data ?? null;

    if (token && process.env.NODE_ENV === 'development') {
      console.log('Expo Push Token:', token);
    }

    return token;
  } catch {
    // Simulator or runtime may throw; fail silently and return null
    return null;
  }
}
