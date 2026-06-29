import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { ensureBackgroundLocationDisclosure } from '../services/backgroundLocationDisclosure';
import logger from './logger';

/**
 * Requests background location only after the Google Play–required prominent disclosure.
 * Safe to call on iOS and Android; no-op on web.
 */
export async function requestBackgroundLocationWithDisclosure(): Promise<Location.PermissionResponse> {
  if (Platform.OS === 'web') {
    return {
      status: Location.PermissionStatus.DENIED,
      granted: false,
      canAskAgain: false,
      expires: 'never',
    };
  }

  try {
    const existing = await Location.getBackgroundPermissionsAsync();
    if (existing.granted) {
      return existing;
    }

    const consented = await ensureBackgroundLocationDisclosure();
    if (!consented) {
      logger.info('[Location] User declined background location disclosure; skipping OS prompt');
      return {
        status: Location.PermissionStatus.DENIED,
        granted: false,
        canAskAgain: true,
        expires: 'never',
      };
    }

    return await Location.requestBackgroundPermissionsAsync();
  } catch (error) {
    logger.warn('[Location] Background permission request failed:', error);
    return {
      status: Location.PermissionStatus.DENIED,
      granted: false,
      canAskAgain: true,
      expires: 'never',
    };
  }
}
