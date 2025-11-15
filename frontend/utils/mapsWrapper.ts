// Native platform wrapper for react-native-maps
// Metro will automatically use mapsWrapper.web.ts for web builds

import { Platform } from 'react-native';

let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  try {
    const mapsModule = require('react-native-maps');
    MapView = mapsModule.default || mapsModule;
    Marker = mapsModule.Marker;
    PROVIDER_GOOGLE = mapsModule.PROVIDER_GOOGLE;
  } catch (error) {
    console.warn('react-native-maps not available:', error);
  }
}

export { MapView, Marker, PROVIDER_GOOGLE };

