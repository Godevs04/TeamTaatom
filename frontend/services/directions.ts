import { getGoogleMapsWebApiKey } from '../utils/maps';
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

// Directions API usage has been removed to conserve quota.
// Routes are now calculated entirely on the client-side within Google Maps JavaScript SDK WebView instances.
export function getManeuverIcon(maneuver?: string): ComponentProps<typeof Ionicons>['name'] {
  if (!maneuver) return 'arrow-up';
  if (maneuver.includes('left')) return 'arrow-back';
  if (maneuver.includes('right')) return 'arrow-forward';
  if (maneuver.includes('merge')) return 'git-merge';
  if (maneuver.includes('roundabout')) return 'refresh';
  if (maneuver.includes('uturn')) return 'return-up-back';
  return 'arrow-up';
}
