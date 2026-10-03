// Native map entry.
// Metro uses mapsWrapper.web.ts for web builds.
//
// MAP_ENGINE in mapEngine.ts selects MapLibre (web parity) or the previous
// Apple/Google maps. Expo Go cannot load MapLibre, so those sessions stay on
// the legacy engine and existing map screens keep working.

import { Platform, TurboModuleRegistry } from 'react-native';
import Constants from 'expo-constants';
import { MAP_ENGINE } from './mapEngine';
import * as legacy from './mapsWrapper.legacy';
import logger from './logger';

function mapLibreReady(): boolean {
  if (MAP_ENGINE !== 'maplibre') return false;
  if (Platform.OS === 'web') return false;
  if (Constants.expoGoConfig) return false;
  try {
    return TurboModuleRegistry.get('MLRNLocationModule') != null;
  } catch {
    return false;
  }
}

const usingMapLibre = mapLibreReady();

if (MAP_ENGINE === 'maplibre' && !usingMapLibre && Platform.OS !== 'web') {
  logger.warn(
    'MapLibre is selected but this binary does not include it yet. Maps stay on Apple/Google until you rebuild with npx expo run:ios or npx expo run:android. Set MAP_ENGINE to "legacy" in utils/mapEngine.ts to restore the old engine permanently.'
  );
}

const engine = usingMapLibre ? require('./maplibre/MapLibreMap') : legacy;

export const MapView = engine.MapView;
export const Marker = engine.Marker;
export const Polyline = engine.Polyline;
export const PROVIDER_GOOGLE = legacy.PROVIDER_GOOGLE;
export const getMapProvider = legacy.getMapProvider;
export const useWebViewFallback = legacy.useWebViewFallback;
export const AnimatedRegion = legacy.AnimatedRegion;
