// Native platform wrapper for react-native-maps
// Metro will automatically use mapsWrapper.web.ts for web builds

import { Platform } from 'react-native';
import logger from './logger';

let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;
let PROVIDER_DEFAULT: any = null;

if (Platform.OS !== 'web') {
  try {
    const mapsModule = require('react-native-maps');
    MapView = mapsModule.default || mapsModule;
    Marker = mapsModule.Marker;
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

export { MapView, Marker, PROVIDER_GOOGLE, getMapProvider };

