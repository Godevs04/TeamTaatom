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

// Expo Go on Android doesn't bundle react-native-maps — require() hard-crashes.
// Development builds and production builds include the native module.
const isExpoGo = Constants.appOwnership === 'expo';
const skipNativeMaps = Platform.OS === 'android' && isExpoGo;

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
