// Native platform wrapper for react-native-maps
// Metro will automatically use mapsWrapper.web.ts for web builds
//
// Strategy:
//   iOS ........................ native MapView (Apple Maps)
//   Android dev/prod build .... native MapView (Google Maps)
//   Android Expo Go ........... WebView fallback (react-native-maps not bundled)
//   Web ....................... handled by mapsWrapper.web.ts

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import logger from './logger';

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;
let PROVIDER_DEFAULT: any = null;

// On Android, we always use the WebView fallback to ensure:
// 1. Consistent premium HTML glassmorphic marker card designs (native react-native-maps custom markers on Android have resizing/clipping bugs)
// 2. Maximum reliability (no Google Play Services / API key build configuration failures on Android devices)
const skipNativeMaps = Platform.OS === 'android';

/**
 * True when native MapView is NOT available and screens should
 * render a WebView-based Google Map instead.
 */
const useWebViewFallback: boolean = skipNativeMaps || Platform.OS === 'web';

if (Platform.OS !== 'web' && !skipNativeMaps) {
  try {
    const mapsModule = require('react-native-maps');
    MapView = mapsModule.default || mapsModule;
    Marker = mapsModule.Marker;
    Polyline = mapsModule.Polyline;
    PROVIDER_GOOGLE = mapsModule.PROVIDER_GOOGLE;
    PROVIDER_DEFAULT = mapsModule.PROVIDER_DEFAULT;
  } catch (error) {
    logger.warn('react-native-maps not available:', error);
  }
}

/**
 * Platform-aware map provider
 * - iOS: Uses default provider (Apple Maps) to avoid AirGoogleMaps configuration requirement
 * - Android: Uses Google Maps provider
 * - Web: Returns null (handled separately)
 */
const getMapProvider = () => {
  if (Platform.OS === 'android' && PROVIDER_GOOGLE) {
    return PROVIDER_GOOGLE;
  }
  // iOS uses default provider (Apple Maps) - no native Google Maps SDK setup required
  // This prevents the "AirGoogleMaps dir must be added" error
  return PROVIDER_DEFAULT || undefined;
};

export { MapView, Marker, Polyline, PROVIDER_GOOGLE, getMapProvider, useWebViewFallback };
