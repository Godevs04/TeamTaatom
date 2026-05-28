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
export function simplifyPolyline<T extends { latitude: number; longitude: number }>(
  coords: T[],
  minDistanceMeters: number = 5
): T[] {
  if (coords.length <= 1) return coords;

  const simplified: T[] = [coords[0]];

  for (let i = 1; i < coords.length; i++) {
    if ((coords[i] as any).segmentBreak) {
      simplified.push(coords[i]);
      continue;
    }

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

/**
 * Deduplicate coordinates that fall within a strict radius of the last kept coordinate.
 *
 * @param coords Array of coordinates
 * @param radiusMeters Radius in meters to deduplicate points (default: 2)
 * @returns Deduplicated coordinates
 */
export function deduplicateCoords<T extends { latitude: number; longitude: number }>(
  coords: T[],
  radiusMeters: number = 2
): T[] {
  if (coords.length <= 1) return coords;

  const deduplicated: T[] = [coords[0]];

  for (let i = 1; i < coords.length; i++) {
    if ((coords[i] as any).segmentBreak) {
      deduplicated.push(coords[i]);
      continue;
    }

    const lastKept = deduplicated[deduplicated.length - 1];
    const distance = calculateCoordinateDistance(
      lastKept.latitude,
      lastKept.longitude,
      coords[i].latitude,
      coords[i].longitude
    );

    if (distance >= radiusMeters) {
      deduplicated.push(coords[i]);
    }
  }

  return deduplicated;
}

interface PolylineRendererProps {
  coordinates: Array<{ latitude: number; longitude: number; timestamp?: number; segmentBreak?: boolean }>;
  color?: string;
  glowColor?: string;
  strokeWidth?: number;
  simplifyDistance?: number; // Minimum distance in meters to keep points
  applyKalman?: boolean; // Whether to apply Kalman filter for smoothing
  onPress?: () => void;
}

/**
 * PolylineRenderer
 *
 * Renders a polyline path on react-native-maps
 * - Default color: Growth Green (#22C55E)
 * - Default stroke width: 4
 * - Applies sorting and deduplication to prevent crisscrossing and jagged lines
 * - Applies simplification to skip closely-spaced points
 * - Works with native MapView (react-native-maps Polyline component)
 * - For WebView maps, pass coordinates as props to a custom HTML renderer
 */
export default function PolylineRenderer({
  coordinates,
  color = '#22C55E', // Growth Green
  glowColor,
  strokeWidth = 4,
  simplifyDistance = 5,
  applyKalman = false,
  onPress,
}: PolylineRendererProps) {
  if (coordinates.length < 2) {
    return null;
  }

  // 1. Sort by timestamp to prevent jagged/crisscrossing paths from out-of-order data
  let processedCoords = [...coordinates];
  if (processedCoords.some(c => c.timestamp !== undefined)) {
    processedCoords.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  // 2. Deduplicate coordinates within a strict 2-meter radius to smooth out path
  processedCoords = deduplicateCoords(processedCoords, 2);

  // 3. Simplify to remove closely-spaced points
  if (processedCoords.length > 1) {
    processedCoords = simplifyPolyline(processedCoords, simplifyDistance);
  }

  // 4. Apply Kalman filter if requested
  if (applyKalman && processedCoords.length > 1) {
    const segmentBreaks = processedCoords.map((coord) => coord.segmentBreak);
    processedCoords = kalmanFilter(processedCoords).map((coord, index) => ({
      ...coord,
      timestamp: processedCoords[index]?.timestamp,
      segmentBreak: segmentBreaks[index],
    }));
  }

  // Skip rendering if we don't have enough points left
  if (processedCoords.length < 2) {
    return null;
  }

  // Check if Polyline component is available (not available in WebView mode)
  // Native MapView provides a Polyline component
  if (!MapView || Platform.OS === 'web') {
    // For WebView, return null - caller should handle polylines via injected JavaScript
    return null;
  }

  // 5. Split coordinates into segments based on a time gap of > 60 seconds (indicating a pause/break)
  const segments: Array<Array<{ latitude: number; longitude: number; timestamp?: number; segmentBreak?: boolean }>> = [];
  let currentSegment: Array<{ latitude: number; longitude: number; timestamp?: number; segmentBreak?: boolean }> = [];

  for (let i = 0; i < processedCoords.length; i++) {
    const coord = processedCoords[i];
    if (currentSegment.length === 0) {
      currentSegment.push(coord);
    } else {
      const prevCoord = currentSegment[currentSegment.length - 1];
      const timeDiff = coord.timestamp && prevCoord.timestamp
        ? (coord.timestamp - prevCoord.timestamp) / 1000
        : 0;

      if (coord.segmentBreak || timeDiff > 60) { // 60 seconds gap or explicit pause/resume break
        segments.push(currentSegment);
        currentSegment = [coord];
      } else {
        currentSegment.push(coord);
      }
    }
  }
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  // Try to import and render Polyline for native MapView
  try {
    // Dynamically import Polyline only if available
    const { Polyline } = require('react-native-maps');

    return (
      <>
        {segments.map((segment, index) => {
          if (segment.length < 2) return null;
          return (
            <React.Fragment key={`segment-${index}`}>
              {glowColor ? (
                <Polyline
                  coordinates={segment}
                  strokeColor={glowColor}
                  strokeWidth={Math.max(strokeWidth + 8, 10)}
                  lineCap="round"
                  lineJoin="round"
                  geodesic={true}
                  tappable={!!onPress}
                  onPress={onPress}
                />
              ) : null}
              <Polyline
                coordinates={segment}
                strokeColor={color}
                strokeWidth={strokeWidth}
                lineCap="round"
                lineJoin="round"
                geodesic={true} // Follow Earth's curvature for long distances
                tappable={!!onPress}
                onPress={onPress}
              />
            </React.Fragment>
          );
        })}
      </>
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
 */
export function generatePolylineJS(
  coordinates: Array<{ latitude: number; longitude: number; timestamp?: number; segmentBreak?: boolean }>,
  color: string = '#22C55E',
  strokeWidth: number = 4,
  simplifyDistance: number = 5
): string {
  if (coordinates.length < 2) return '';

  let processed = [...coordinates];

  // Sort by timestamp
  if (processed.some(c => c.timestamp !== undefined)) {
    processed.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  // Deduplicate
  processed = deduplicateCoords(processed, 2);

  // Simplify coordinates
  const simplified = simplifyPolyline(processed, simplifyDistance);
  if (simplified.length < 2) return '';

  // Split into segments based on 60 seconds timestamp gap
  const segments: Array<Array<{ latitude: number; longitude: number; timestamp?: number; segmentBreak?: boolean }>> = [];
  let currentSegment: Array<{ latitude: number; longitude: number; timestamp?: number; segmentBreak?: boolean }> = [];

  for (let i = 0; i < simplified.length; i++) {
    const coord = simplified[i];
    if (currentSegment.length === 0) {
      currentSegment.push(coord);
    } else {
      const prevCoord = currentSegment[currentSegment.length - 1];
      const timeDiff = coord.timestamp && prevCoord.timestamp
        ? (coord.timestamp - prevCoord.timestamp) / 1000
        : 0;

      if (coord.segmentBreak || timeDiff > 60) {
        segments.push(currentSegment);
        currentSegment = [coord];
      } else {
        currentSegment.push(coord);
      }
    }
  }
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments
    .map((seg, idx) => {
      if (seg.length < 2) return '';
      const pathArray = seg
        .map(coord => `{ lat: ${coord.latitude}, lng: ${coord.longitude} }`)
        .join(', ');

      return `
        const polylinePath_${idx} = [${pathArray}];
        new google.maps.Polyline({
          path: polylinePath_${idx},
          geodesic: true,
          strokeColor: '${color}',
          strokeOpacity: 1.0,
          strokeWeight: ${strokeWidth},
          map: map
        });
      `;
    })
    .join('\n');
}
