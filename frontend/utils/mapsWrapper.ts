// Native platform wrapper for react-native-maps
// Metro will automatically use mapsWrapper.web.ts for web builds
//
// Strategy:
//   iOS / Android .............. WebView fallback (stable under zoom with custom markers)
//   Web ....................... handled by mapsWrapper.web.ts

import React from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import logger from './logger';

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;
let PROVIDER_DEFAULT: any = null;

// Enable native MapView by default on iOS and Android for 60fps native performance (moving, zooming, panning)
const skipNativeMaps = false;

/**
 * True when native MapView is NOT available and screens should
 * render a WebView-based Google Map instead.
 */
let useWebViewFallback: boolean = Platform.OS === 'web';

if (Platform.OS !== 'web' && !skipNativeMaps) {
  try {
    const mapsModule = require('react-native-maps');
    MapView = mapsModule.default || mapsModule;
    Marker = mapsModule.Marker;
    Polyline = mapsModule.Polyline;
    PROVIDER_GOOGLE = mapsModule.PROVIDER_GOOGLE;
    PROVIDER_DEFAULT = mapsModule.PROVIDER_DEFAULT;
    
    if (!MapView) {
      useWebViewFallback = true;
    }
  } catch (error) {
    logger.warn('react-native-maps not available, falling back to WebView:', error);
    useWebViewFallback = true;
  }
} else if (Platform.OS === 'web') {
  useWebViewFallback = true;
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

// Safe wrapper for MapView to filter out null/boolean children and recursively flatten Fragments.
// This prevents the native AIRMap / AIRGoogleMap component from crashing on iOS when receiving nil subviews.
const SafeMapView = React.forwardRef((props: any, ref: any) => {
  if (!MapView) return null;

  const sanitizeChildren = (childrenToSanitize: any): any[] => {
    const flattened: any[] = [];
    
    React.Children.forEach(childrenToSanitize, (child) => {
      if (child === null || child === undefined || typeof child === 'boolean') {
        return;
      }
      
      if (child.type === React.Fragment) {
        if (child.props && child.props.children) {
          flattened.push(...sanitizeChildren(child.props.children));
        }
      } else {
        flattened.push(child);
      }
    });
    
    return flattened;
  };

  const cleanChildren = props.children ? sanitizeChildren(props.children) : [];

  return React.createElement(MapView, { ...props, ref }, ...cleanChildren);
});

// Copy static properties of original MapView if any (e.g. Marker, Polyline, etc.)
if (MapView) {
  Object.keys(MapView).forEach((key) => {
    (SafeMapView as any)[key] = MapView[key];
  });
}

export { SafeMapView as MapView, Marker, Polyline, PROVIDER_GOOGLE, getMapProvider, useWebViewFallback };

