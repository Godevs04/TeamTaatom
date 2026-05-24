import { getGoogleMapsApiKey } from '../utils/maps';
import logger from '../utils/logger';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface DirectionStep {
  instruction: string;
  distanceText: string;
  durationText: string;
  maneuver: string;
  endLocation: MapCoordinate;
}

export interface DirectionsRoute {
  coordinates: MapCoordinate[];
  steps: DirectionStep[];
  distanceText: string;
  durationText: string;
  distanceValue?: number; // distance in meters
}

const directionsCache = new Map<string, DirectionsRoute>();

export function decodeGooglePolyline(encoded: string): MapCoordinate[] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: MapCoordinate[] = [];

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coordinates;
}

export function stripHtmlInstruction(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchDirectionsRoute(
  origin: MapCoordinate,
  destination: MapCoordinate,
  mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving'
): Promise<DirectionsRoute | null> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return null;

  const cacheKey = [
    mode,
    origin.latitude.toFixed(5),
    origin.longitude.toFixed(5),
    destination.latitude.toFixed(5),
    destination.longitude.toFixed(5),
  ].join(':');

  const cached = directionsCache.get(cacheKey);
  if (cached) return cached;

  try {
    const url =
      `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}` +
      `&destination=${destination.latitude},${destination.longitude}&mode=${mode}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.routes?.[0]) {
      logger.warn('[Directions] Unable to fetch route', { status: data.status, message: data.error_message });
      return null;
    }

    const route = data.routes[0];
    const leg = route.legs?.[0];
    const coordinates = route.overview_polyline?.points
      ? decodeGooglePolyline(route.overview_polyline.points)
      : [];

    const steps: DirectionStep[] = (leg?.steps || []).map((step: any) => ({
      instruction: stripHtmlInstruction(step.html_instructions || ''),
      distanceText: step.distance?.text || '',
      durationText: step.duration?.text || '',
      maneuver: step.maneuver || 'straight',
      endLocation: {
        latitude: step.end_location?.lat || destination.latitude,
        longitude: step.end_location?.lng || destination.longitude,
      },
    }));

    const parsed: DirectionsRoute = {
      coordinates,
      steps,
      distanceText: leg?.distance?.text || '',
      durationText: leg?.duration?.text || '',
      distanceValue: leg?.distance?.value || 0,
    };

    directionsCache.set(cacheKey, parsed);
    return parsed;
  } catch (error) {
    logger.warn('[Directions] Request failed', error);
    return null;
  }
}

export function getManeuverIcon(maneuver?: string): ComponentProps<typeof Ionicons>['name'] {
  if (!maneuver) return 'arrow-up';
  if (maneuver.includes('left')) return 'arrow-back';
  if (maneuver.includes('right')) return 'arrow-forward';
  if (maneuver.includes('merge')) return 'git-merge';
  if (maneuver.includes('roundabout')) return 'refresh';
  if (maneuver.includes('uturn')) return 'return-up-back';
  return 'arrow-up';
}
