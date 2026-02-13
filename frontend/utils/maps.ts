/**
 * Maps Configuration Utility
 * Provides Google Maps API keys with fallback support (similar to OSRM pattern)
 * 
 * REQUIRED ENVIRONMENT VARIABLES:
 * - EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY - iOS Google Maps API key
 * - EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY - Android Google Maps API key
 * 
 * Fallback order:
 * 1. Platform-specific env var (EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY / EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY)
 * 2. app.json configuration (ios.googleMapsApiKey / android.config.googleMaps.apiKey)
 * 3. Legacy EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (for backward compatibility)
 * 4. null (will trigger fallback behavior in components)
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import logger from './logger';

/**
 * Get Google Maps API key for the current platform
 * @returns API key string or null if not available
 */
export function getGoogleMapsApiKey(): string | null {
  try {
    if (Platform.OS === 'ios') {
      // iOS: Try iOS-specific key first
      // Note: googleMapsApiKey is not in the ExpoConfig type but is supported by Expo
      const iosConfig = Constants.expoConfig?.ios as any;
      const iosKey = 
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY ||
        iosConfig?.googleMapsApiKey ||
        null;
      
      if (iosKey) {
        if (__DEV__) {
          logger.debug(`[Maps] Using iOS API key: ${iosKey.substring(0, 20)}...`);
        }
        return iosKey;
      }
      
      // Fallback to legacy key for backward compatibility
      const legacyKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 
                        Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;
      if (legacyKey) {
        logger.warn('[Maps] Using legacy GOOGLE_MAPS_API_KEY for iOS. Consider using EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY');
        return legacyKey;
      }
    } else if (Platform.OS === 'android') {
      // Android: Try Android-specific key first
      const androidKey = 
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ||
        Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
        null;
      
      if (androidKey) {
        if (__DEV__) {
          logger.debug(`[Maps] Using Android API key: ${androidKey.substring(0, 20)}...`);
        }
        return androidKey;
      }
      
      // Fallback to legacy key for backward compatibility
      const legacyKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 
                        Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;
      if (legacyKey) {
        logger.warn('[Maps] Using legacy GOOGLE_MAPS_API_KEY for Android. Consider using EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY');
        return legacyKey;
      }
    }
    
    // Web or other platforms - use legacy key
    const legacyKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 
                      Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;
    return legacyKey || null;
  } catch (error) {
    logger.error('[Maps] Error getting Google Maps API key:', error);
    return null;
  }
}

/**
 * Map configuration with provider and API key
 */
export interface MapConfig {
  provider: 'google' | 'fallback';
  apiKey: string | null;
  platform: 'ios' | 'android' | 'web';
}

/**
 * Get map configuration with fallback support
 * Similar to OSRM fallback pattern - tries Google Maps first, falls back gracefully
 * @param lat Optional latitude (for future use)
 * @param lng Optional longitude (for future use)
 * @returns MapConfig object with provider and API key
 */
export async function getMapConfig(
  lat?: number,
  lng?: number
): Promise<MapConfig> {
  try {
    const apiKey = getGoogleMapsApiKey();
    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    
    if (apiKey) {
      return {
        provider: 'google',
        apiKey,
        platform,
      };
    }
    
    // Fallback: no API key available
    logger.warn('[Maps] Google Maps API key not available, using fallback mode');
    return {
      provider: 'fallback',
      apiKey: null,
      platform,
    };
  } catch (error) {
    logger.error('[Maps] Error getting map config:', error);
    return {
      provider: 'fallback',
      apiKey: null,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    };
  }
}

/**
 * Get API key for WebView/Google Maps JavaScript API
 * Prefers extra.GOOGLE_MAPS_API_KEY (typically has Maps JavaScript API enabled)
 * Falls back to platform-specific key
 */
export function getGoogleMapsApiKeyForWebView(): string | null {
  const extraKey = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;
  if (extraKey) return extraKey;
  return getGoogleMapsApiKey();
}

/**
 * Check if Google Maps is available (has API key)
 * @returns true if API key is available, false otherwise
 */
export function isGoogleMapsAvailable(): boolean {
  const apiKey = getGoogleMapsApiKey();
  return apiKey !== null && apiKey !== '';
}

/**
 * Open map fallback (similar to OSRM pattern)
 * Attempts to use Google Maps, falls back gracefully if not available
 * @param lat Latitude
 * @param lng Longitude
 * @returns MapConfig with provider and API key info
 */
export async function openMapFallback(
  lat: number,
  lng: number
): Promise<MapConfig> {
  try {
    const config = await getMapConfig(lat, lng);
    
    if (config.provider === 'google' && config.apiKey) {
      return config;
    }
    
    // Fallback mode - log warning but don't throw
    logger.warn('[Maps] Google Maps unavailable, using fallback mode', { lat, lng });
    return config;
  } catch (error) {
    logger.error('[Maps] Error in openMapFallback:', error);
    // Return fallback config on error (graceful degradation)
    return {
      provider: 'fallback',
      apiKey: null,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    };
  }
}

