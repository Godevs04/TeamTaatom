export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends MapCoordinate {
  latitudeDelta: number;
  longitudeDelta: number;
}

const MIN_DELTA = 0.002;
const MAX_LATITUDE_DELTA = 140;
const MAX_LONGITUDE_DELTA = 360;

export const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

export const clamp = (value: number, min: number, max: number) => (
  Math.min(max, Math.max(min, value))
);

export const isValidMapCoordinate = (
  coordinate?: Partial<MapCoordinate> | null
): coordinate is MapCoordinate => (
  !!coordinate &&
  isFiniteNumber(coordinate.latitude) &&
  isFiniteNumber(coordinate.longitude) &&
  coordinate.latitude >= -90 &&
  coordinate.latitude <= 90 &&
  coordinate.longitude >= -180 &&
  coordinate.longitude <= 180
);

export const sanitizeLatitudeDelta = (delta?: number | null, fallback = 0.1) => {
  const nextDelta = isFiniteNumber(delta) && delta > 0 ? delta : fallback;
  return clamp(nextDelta, MIN_DELTA, MAX_LATITUDE_DELTA);
};

export const sanitizeLongitudeDelta = (delta?: number | null, fallback = 0.1) => {
  const nextDelta = isFiniteNumber(delta) && delta > 0 ? delta : fallback;
  return clamp(nextDelta, MIN_DELTA, MAX_LONGITUDE_DELTA);
};

export const sanitizeMapRegion = (
  region?: Partial<MapRegion> | null,
  fallback?: MapRegion
): MapRegion | null => {
  const source = region ?? fallback;
  if (!source || !isFiniteNumber(source.latitude) || !isFiniteNumber(source.longitude)) {
    return fallback ?? null;
  }

  return {
    latitude: clamp(source.latitude, -85, 85),
    longitude: clamp(source.longitude, -180, 180),
    latitudeDelta: sanitizeLatitudeDelta(source.latitudeDelta, fallback?.latitudeDelta ?? 0.1),
    longitudeDelta: sanitizeLongitudeDelta(source.longitudeDelta, fallback?.longitudeDelta ?? 0.1),
  };
};
