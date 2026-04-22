import React from 'react';
import { Platform } from 'react-native';
import { MapView } from '../utils/mapsWrapper';

/**
 * Kalman filter for GPS coordinate smoothing
 * Reduces jitter from GPS noise while preserving path accuracy
 *
 * @param rawCoords Array of raw GPS coordinates
 * @param processNoise Process noise parameter (higher = less smooth, default 0.01)
 * @param measurementNoise Measurement noise parameter (higher = less filtering, default 0.1)
 * @returns Smoothed coordinates
 */
export function kalmanFilter(
  rawCoords: Array<{ latitude: number; longitude: number }>,
  processNoise: number = 0.01,
  measurementNoise: number = 0.1
): Array<{ latitude: number; longitude: number }> {
  if (rawCoords.length === 0) return [];
  if (rawCoords.length === 1) return rawCoords;

  const smoothed: Array<{ latitude: number; longitude: number }> = [];
  let prevLat = rawCoords[0].latitude;
  let prevLng = rawCoords[0].longitude;
  let prevLatVar = 1;
  let prevLngVar = 1;

  for (const coord of rawCoords) {
    // Prediction step
    const predLat = prevLat;
    const predLng = prevLng;
    const predLatVar = prevLatVar + processNoise;
    const predLngVar = prevLngVar + processNoise;

    // Update step
    const kalmanGainLat = predLatVar / (predLatVar + measurementNoise);
    const kalmanGainLng = predLngVar / (predLngVar + measurementNoise);

    const updatedLat = predLat + kalmanGainLat * (coord.latitude - predLat);
    const updatedLng = predLng + kalmanGainLng * (coord.longitude - predLng);

    const updatedLatVar = (1 - kalmanGainLat) * predLatVar;
    const updatedLngVar = (1 - kalmanGainLng) * predLngVar;

    smoothed.push({
      latitude: updatedLat,
      longitude: updatedLng,
    });

    prevLat = updatedLat;
    prevLng = updatedLng;
    prevLatVar = updatedLatVar;
    prevLngVar = updatedLngVar;
  }

  return smoothed;
}

/**
 * Calculate distance between two coordinates in meters (Haversine)
 *
 * @param lat1 First latitude
 * @param lng1 First longitude
 * @param lat2 Second latitude
 * @param lng2 Second longitude
 * @returns Distance in meters
 */
export function calculateCoordinateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Simple polyline simplification (removes points that are too close together)
 * Reduces visual clutter on the map for dense GPS traces
 *
 * @param coords Raw coordinates
 * @param minDistanceMeters Minimum distance between kept points (default 5m)
 * @returns Simplified coordinates
 */
export function simplifyPolyline(
  coords: Array<{ latitude: number; longitude: number }>,
  minDistanceMeters: number = 5
): Array<{ latitude: number; longitude: number }> {
  if (coords.length <= 1) return coords;

  const simplified: Array<{ latitude: number; longitude: number }> = [coords[0]];

  for (let i = 1; i < coords.length; i++) {
    const lastKept = simplified[simplified.length - 1];
    const distance = calculateCoordinateDistance(
      lastKept.latitude,
      lastKept.longitude,
      coords[i].latitude,
      coords[i].longitude
    );

    if (distance >= minDistanceMeters) {
      simplified.push(coords[i]);
    }
  }

  return simplified;
}

interface PolylineRendererProps {
  coordinates: Array<{ latitude: number; longitude: number }>;
  color?: string;
  strokeWidth?: number;
  simplifyDistance?: number; // Minimum distance in meters to keep points
  applyKalman?: boolean; // Whether to apply Kalman filter for smoothing
}

/**
 * PolylineRenderer
 *
 * Renders a polyline path on react-native-maps
 * - Default color: Growth Green (#22C55E)
 * - Default stroke width: 4
 * - Applies simplification to skip closely-spaced points
 * - Works with native MapView (react-native-maps Polyline component)
 * - For WebView maps, pass coordinates as props to a custom HTML renderer
 *
 * Note: On WebView-based maps, this component doesn't render directly.
 * Instead, extract the processed coordinates and pass them to your WebView's initMap function.
 */
export default function PolylineRenderer({
  coordinates,
  color = '#22C55E', // Growth Green
  strokeWidth = 4,
  simplifyDistance = 5,
  applyKalman = false,
}: PolylineRendererProps) {
  // Process coordinates: simplify and optionally smooth with Kalman
  let processedCoords = coordinates;

  // Simplify to remove closely-spaced points
  if (processedCoords.length > 1) {
    processedCoords = simplifyPolyline(processedCoords, simplifyDistance);
  }

  // Apply Kalman filter if requested
  if (applyKalman && processedCoords.length > 1) {
    processedCoords = kalmanFilter(processedCoords);
  }

  // Skip rendering if we don't have enough points
  if (processedCoords.length < 2) {
    return null;
  }

  // Check if Polyline component is available (not available in WebView mode)
  // Native MapView provides a Polyline component
  if (!MapView || Platform.OS === 'web') {
    // For WebView, return null - caller should handle polylines via injected JavaScript
    return null;
  }

  // Try to import and render Polyline for native MapView
  try {
    // Dynamically import Polyline only if available
    const { Polyline } = require('react-native-maps');

    return (
      <Polyline
        coordinates={processedCoords}
        strokeColor={color}
        strokeWidth={strokeWidth}
        lineDashPattern={[]} // Solid line (empty array means no dashing)
        geodesic={true} // Follow Earth's curvature for long distances
      />
    );
  } catch (error) {
    // Polyline component not available, return null
    return null;
  }
}

/**
 * Helper function to generate polyline HTML for WebView maps
 *
 * Use this when rendering polylines in WebView-based maps (e.g., Google Maps JavaScript API)
 *
 * @param coordinates Array of lat/lng coordinates
 * @param color Polyline color (default: #22C55E)
 * @param strokeWidth Stroke width (default: 4)
 * @param simplifyDistance Minimum distance in meters to keep points (default: 5)
 * @returns JavaScript code string to inject into WebView initMap function
 *
 * @example
 * const jsCode = generatePolylineJS([
 *   { latitude: 10.5, longitude: 20.5 },
 *   { latitude: 10.6, longitude: 20.6 }
 * ]);
 * // Returns: `const path = [{lat: 10.5, lng: 20.5}, ...]; new google.maps.Polyline({...})`
 */
export function generatePolylineJS(
  coordinates: Array<{ latitude: number; longitude: number }>,
  color: string = '#22C55E',
  strokeWidth: number = 4,
  simplifyDistance: number = 5
): string {
  if (coordinates.length < 2) return '';

  // Simplify coordinates
  const simplified = simplifyPolyline(coordinates, simplifyDistance);
  if (simplified.length < 2) return '';

  // Build path array for Google Maps
  const pathArray = simplified
    .map(coord => `{ lat: ${coord.latitude}, lng: ${coord.longitude} }`)
    .join(', ');

  return `
    const polylinePath = [${pathArray}];
    new google.maps.Polyline({
      path: polylinePath,
      geodesic: true,
      strokeColor: '${color}',
      strokeOpacity: 1.0,
      strokeWeight: ${strokeWidth},
      map: map
    });
  `;
}
