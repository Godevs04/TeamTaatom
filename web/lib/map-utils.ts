import type { MapLocation } from "./country-map-utils";
import { getCountryCenter, getCountryDelta, getMarkerCoordinates } from "./country-map-utils";

export type LngLat = [number, number];

export function toLngLat(lat: number, lng: number): LngLat {
  return [lng, lat];
}

export function locationsToLngLat(
  locations: MapLocation[],
  countryName: string
): Array<{ loc: MapLocation; coord: LngLat; index: number }> {
  return locations.map((loc, index) => {
    const { latitude, longitude } = getMarkerCoordinates(loc, countryName, index);
    return { loc, coord: [longitude, latitude] as LngLat, index };
  });
}

export function getMapCenter(countryName: string): LngLat {
  const c = getCountryCenter(countryName);
  return [c.longitude, c.latitude];
}

export function getDefaultZoom(countryName: string): number {
  const delta = getCountryDelta(countryName);
  return Math.max(3, Math.min(10, Math.log2(360 / delta.latitudeDelta)));
}

import type { FeatureCollection, Point } from "geojson";

export function locationsToGeoJSON(
  locations: MapLocation[],
  countryName: string
): FeatureCollection<Point> {
  const features = locations.map((loc, index) => {
    const { latitude, longitude } = getMarkerCoordinates(loc, countryName, index);
    return {
      type: "Feature" as const,
      properties: {
        name: loc.name,
        score: loc.score,
        index,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [longitude, latitude] as [number, number],
      },
    };
  });
  return { type: "FeatureCollection", features };
}

/** Great-circle distance in kilometres between two WGS84 points. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `~${Math.round(km * 1000)} m`;
  if (km < 10) return `~${km.toFixed(1)} km`;
  return `~${Math.round(km)} km`;
}

export function hasValidCoords(latitude?: number, longitude?: number): boolean {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    latitude !== 0 &&
    longitude !== 0 &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  );
}
