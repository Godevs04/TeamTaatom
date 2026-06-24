import React from 'react';
import { Platform } from 'react-native';
import { MapView } from '../utils/mapsWrapper';
import { isValidMapCoordinate } from '../utils/mapSafety';

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
 * Calculates the perpendicular distance from a point to a line segment in meters
 * using flat-earth projection.
 */
function getPerpendicularDistance(
  p: { latitude: number; longitude: number },
  p0: { latitude: number; longitude: number },
  p1: { latitude: number; longitude: number }
): number {
  const latRad = (p0.latitude * Math.PI) / 180;
  const kx = 111320 * Math.cos(latRad);
  const ky = 111320;

  const dx = (p1.longitude - p0.longitude) * kx;
  const dy = (p1.latitude - p0.latitude) * ky;

  const x = (p.longitude - p0.longitude) * kx;
  const y = (p.latitude - p0.latitude) * ky;

  const mag2 = dx * dx + dy * dy;
  if (mag2 === 0) {
    return Math.sqrt(x * x + y * y);
  }

  const t = Math.max(0, Math.min(1, (x * dx + y * dy) / mag2));
  const px = t * dx;
  const py = t * dy;

  const rx = x - px;
  const ry = y - py;

  return Math.sqrt(rx * rx + ry * ry);
}

/**
 * Ramer-Douglas-Peucker (RDP) algorithm for coordinate simplification.
 */
export function douglasPeucker<T extends { latitude: number; longitude: number }>(
  points: T[],
  epsilon: number
): T[] {
  if (points.length <= 2) {
    return points;
  }

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const dist = getPerpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const results1 = douglasPeucker(points.slice(0, index + 1), epsilon);
    const results2 = douglasPeucker(points.slice(index), epsilon);
    return results1.slice(0, results1.length - 1).concat(results2);
  } else {
    return [points[0], points[end]];
  }
}

/**
 * Helper to compute epsilon in meters based on map zoom level (latitudeDelta).
 */
export function getEpsilonForDelta(latitudeDelta?: number, simplifyDistance: number = 5): number {
  if (latitudeDelta === undefined || isNaN(latitudeDelta) || latitudeDelta <= 0) {
    return simplifyDistance;
  }
  // 1 degree latitude is approx 111,320 meters.
  // We want epsilon to be roughly 2 pixels of screen resolution.
  // Assuming a screen height of 1000 pixels:
  // metersPerPixel = (latitudeDelta * 111320) / 1000
  // epsilon = metersPerPixel * 2
  const computed = latitudeDelta * 222.64;
  return Math.max(2, Math.min(2000, computed));
}

/**
 * Simple polyline simplification (delegates to Douglas-Peucker)
 *
 * @param coords Raw coordinates
 * @param minDistanceMeters Minimum distance between kept points (default 5m)
 * @returns Simplified coordinates
 */
export function simplifyPolyline<T extends { latitude: number; longitude: number }>(
  coords: T[],
  minDistanceMeters: number = 5
): T[] {
  return douglasPeucker(coords, minDistanceMeters);
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
  simplifyDistance?: number; // Minimum distance in meters to keep points (fallback epsilon)
  applyKalman?: boolean; // Whether to apply Kalman filter for smoothing
  onPress?: () => void;
  latitudeDelta?: number; // Zoom-dynamic latitude span for epsilon calculation
}

/**
 * PolylineRenderer
 *
 * Renders a polyline path on react-native-maps
 * - Default color: Growth Green (#22C55E)
 * - Default stroke width: 4
 * - Applies sorting and deduplication to prevent crisscrossing and jagged lines
 * - Applies Douglas-Peucker simplification using dynamic zoom-level epsilon
 * - Works with native MapView (react-native-maps Polyline component)
 */
export default function PolylineRenderer({
  coordinates,
  color = '#22C55E', // Growth Green
  glowColor,
  strokeWidth = 4,
  simplifyDistance = 5,
  applyKalman = false,
  onPress,
  latitudeDelta,
}: PolylineRendererProps) {
  // Filter out any invalid coordinates at the beginning
  let processedCoords = coordinates.filter(isValidMapCoordinate) as typeof coordinates;

  if (processedCoords.length < 2) {
    return null;
  }

  // 1. Sort by timestamp to prevent jagged/crisscrossing paths from out-of-order data
  if (processedCoords.some(c => c.timestamp !== undefined)) {
    processedCoords.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  // 2. Deduplicate coordinates within a strict 2-meter radius to smooth out path
  processedCoords = deduplicateCoords(processedCoords, 2);

  if (processedCoords.length < 2) {
    return null;
  }

  // 3. Split coordinates into segments based on a time gap of > 60 seconds (indicating a pause/break)
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

  // 4. Compute epsilon and simplify/smooth each segment independently
  const epsilon = getEpsilonForDelta(latitudeDelta, simplifyDistance);
  const processedSegments = segments.map((segment) => {
    if (segment.length < 2) return segment;

    // Apply Douglas-Peucker simplification
    let simplified = douglasPeucker(segment, epsilon);

    // Apply Kalman filter if requested
    if (applyKalman && simplified.length > 1) {
      const segmentBreaks = simplified.map((coord) => coord.segmentBreak);
      simplified = kalmanFilter(simplified).map((coord, index) => ({
        ...coord,
        timestamp: simplified[index]?.timestamp,
        segmentBreak: segmentBreaks[index],
      }));
    }

    return simplified;
  }).filter((seg) => seg.length >= 2);

  // Skip rendering if we don't have enough points left
  if (processedSegments.length === 0) {
    return null;
  }

  // Check if Polyline component is available (not available in WebView mode)
  if (!MapView || Platform.OS === 'web') {
    return null;
  }

  // Try to import and render Polyline for native MapView
  try {
    const { Polyline } = require('react-native-maps');

    return processedSegments.flatMap((segment, index) => {
      if (segment.length < 2) return [];
      const polylines = [];
      if (glowColor) {
        polylines.push(
          <Polyline
            key={`segment-glow-${index}`}
            coordinates={segment}
            strokeColor={glowColor}
            strokeWidth={Math.max(strokeWidth + 8, 10)}
            lineCap="round"
            lineJoin="round"
            geodesic={true}
            tappable={!!onPress}
            onPress={onPress}
          />
        );
      }
      polylines.push(
        <Polyline
          key={`segment-main-${index}`}
          coordinates={segment}
          strokeColor={color}
          strokeWidth={strokeWidth}
          lineCap="round"
          lineJoin="round"
          geodesic={true}
          tappable={!!onPress}
          onPress={onPress}
        />
      );
      return polylines;
    }) as any;
  } catch (error) {
    return null;
  }
}

/**
 * Helper function to generate polyline HTML for WebView maps
 */
export function generatePolylineJS(
  coordinates: Array<{ latitude: number; longitude: number; timestamp?: number; segmentBreak?: boolean }>,
  color: string = '#22C55E',
  strokeWidth: number = 4,
  simplifyDistance: number = 5,
  latitudeDelta?: number
): string {
  if (coordinates.length < 2) return '';

  let processed = [...coordinates];

  // Sort by timestamp
  if (processed.some(c => c.timestamp !== undefined)) {
    processed.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  // Deduplicate
  processed = deduplicateCoords(processed, 2);

  if (processed.length < 2) return '';

  // Split into segments based on 60 seconds timestamp gap
  const segments: Array<Array<{ latitude: number; longitude: number; timestamp?: number; segmentBreak?: boolean }>> = [];
  let currentSegment: Array<{ latitude: number; longitude: number; timestamp?: number; segmentBreak?: boolean }> = [];

  for (let i = 0; i < processed.length; i++) {
    const coord = processed[i];
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

  const epsilon = getEpsilonForDelta(latitudeDelta, simplifyDistance);

  return segments
    .map((seg, idx) => {
      const simplified = douglasPeucker(seg, epsilon);
      if (simplified.length < 2) return '';
      const pathArray = simplified
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
