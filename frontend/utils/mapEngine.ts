/**
 * Native map engine.
 *
 * 'maplibre' — same MapLibre + CARTO styles as the web app.
 * 'legacy'   — Apple Maps on iOS and Google Maps on Android (react-native-maps).
 *
 * Restore the previous maps without touching screen code:
 *   1. Set MAP_ENGINE to 'legacy' in this file.
 *   2. Reload the app. A native rebuild is not required for the restore.
 *
 * MapLibre itself only draws after a dev-client rebuild
 * (`npx expo run:ios` / `npx expo run:android`). Expo Go, and any binary
 * built before that plugin was added, keeps the legacy maps so existing
 * screens do not go blank.
 */
export const MAP_ENGINE: 'maplibre' | 'legacy' = 'maplibre';

/** Same basemap URLs as web/components/ui/map.tsx */
export const CARTO_STYLE = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
} as const;
