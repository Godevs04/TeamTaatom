/**
 * Country center and zoom deltas for map view (mirrors frontend tripscore map).
 */
const COUNTRY_CENTERS: Record<string, { latitude: number; longitude: number }> = {
  brazil: { latitude: -14.235, longitude: -51.9253 },
  australia: { latitude: -25.2744, longitude: 133.7751 },
  india: { latitude: 20.5937, longitude: 78.9629 },
  "united states": { latitude: 39.8283, longitude: -98.5795 },
  usa: { latitude: 39.8283, longitude: -98.5795 },
  canada: { latitude: 56.1304, longitude: -106.3468 },
  china: { latitude: 35.8617, longitude: 104.1954 },
  russia: { latitude: 61.524, longitude: 105.3188 },
  argentina: { latitude: -38.4161, longitude: -63.6167 },
  chile: { latitude: -35.6751, longitude: -71.543 },
  peru: { latitude: -9.19, longitude: -75.0152 },
  colombia: { latitude: 4.5709, longitude: -74.2973 },
  mexico: { latitude: 23.6345, longitude: -102.5528 },
  france: { latitude: 46.2276, longitude: 2.2137 },
  germany: { latitude: 51.1657, longitude: 10.4515 },
  italy: { latitude: 41.8719, longitude: 12.5674 },
  spain: { latitude: 40.4637, longitude: -3.7492 },
  "united kingdom": { latitude: 55.3781, longitude: -3.436 },
  uk: { latitude: 55.3781, longitude: -3.436 },
  japan: { latitude: 36.2048, longitude: 138.2529 },
  "south korea": { latitude: 35.9078, longitude: 127.7669 },
  thailand: { latitude: 15.87, longitude: 100.9925 },
  vietnam: { latitude: 14.0583, longitude: 108.2772 },
  indonesia: { latitude: -0.7893, longitude: 113.9213 },
  philippines: { latitude: 12.8797, longitude: 121.774 },
  malaysia: { latitude: 4.2105, longitude: 101.9758 },
  singapore: { latitude: 1.3521, longitude: 103.8198 },
  egypt: { latitude: 26.0975, longitude: 30.0444 },
  "south africa": { latitude: -30.5595, longitude: 22.9375 },
  nigeria: { latitude: 9.082, longitude: 8.6753 },
  kenya: { latitude: -0.0236, longitude: 37.9062 },
  morocco: { latitude: 31.6295, longitude: -7.9811 },
  ethiopia: { latitude: 9.145, longitude: 40.4897 },
  ghana: { latitude: 7.9465, longitude: -1.0232 },
};

const COUNTRY_DELTAS: Record<
  string,
  { latitudeDelta: number; longitudeDelta: number }
> = {
  brazil: { latitudeDelta: 20, longitudeDelta: 20 },
  australia: { latitudeDelta: 15, longitudeDelta: 15 },
  india: { latitudeDelta: 15, longitudeDelta: 15 },
  "united states": { latitudeDelta: 25, longitudeDelta: 25 },
  usa: { latitudeDelta: 25, longitudeDelta: 25 },
  canada: { latitudeDelta: 30, longitudeDelta: 30 },
  china: { latitudeDelta: 20, longitudeDelta: 20 },
  russia: { latitudeDelta: 30, longitudeDelta: 30 },
  argentina: { latitudeDelta: 15, longitudeDelta: 15 },
  chile: { latitudeDelta: 10, longitudeDelta: 10 },
  peru: { latitudeDelta: 10, longitudeDelta: 10 },
  colombia: { latitudeDelta: 8, longitudeDelta: 8 },
  mexico: { latitudeDelta: 10, longitudeDelta: 10 },
  france: { latitudeDelta: 8, longitudeDelta: 8 },
  germany: { latitudeDelta: 6, longitudeDelta: 6 },
  italy: { latitudeDelta: 6, longitudeDelta: 6 },
  spain: { latitudeDelta: 6, longitudeDelta: 6 },
  "united kingdom": { latitudeDelta: 4, longitudeDelta: 4 },
  uk: { latitudeDelta: 4, longitudeDelta: 4 },
  japan: { latitudeDelta: 6, longitudeDelta: 6 },
  "south korea": { latitudeDelta: 3, longitudeDelta: 3 },
  thailand: { latitudeDelta: 8, longitudeDelta: 8 },
  vietnam: { latitudeDelta: 6, longitudeDelta: 6 },
  indonesia: { latitudeDelta: 12, longitudeDelta: 12 },
  philippines: { latitudeDelta: 8, longitudeDelta: 8 },
  malaysia: { latitudeDelta: 6, longitudeDelta: 6 },
  singapore: { latitudeDelta: 0.5, longitudeDelta: 0.5 },
  egypt: { latitudeDelta: 8, longitudeDelta: 8 },
  "south africa": { latitudeDelta: 10, longitudeDelta: 10 },
  nigeria: { latitudeDelta: 8, longitudeDelta: 8 },
  kenya: { latitudeDelta: 6, longitudeDelta: 6 },
  morocco: { latitudeDelta: 6, longitudeDelta: 6 },
  ethiopia: { latitudeDelta: 8, longitudeDelta: 8 },
  ghana: { latitudeDelta: 4, longitudeDelta: 4 },
};

export function getCountryCenter(countryName: string): {
  latitude: number;
  longitude: number;
} {
  const key = countryName.toLowerCase();
  return COUNTRY_CENTERS[key] ?? { latitude: 0, longitude: 0 };
}

export function getCountryDelta(countryName: string): {
  latitudeDelta: number;
  longitudeDelta: number;
} {
  const key = countryName.toLowerCase();
  return COUNTRY_DELTAS[key] ?? { latitudeDelta: 10, longitudeDelta: 10 };
}

export type MapLocation = {
  name: string;
  score: number;
  date: string;
  caption?: string;
  coordinates?: { latitude: number; longitude: number };
};

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic fallback coordinates for locations without coords (mirrors frontend). */
export function getStableFallbackCoordinates(
  countryDisplayName: string,
  locName: string,
  idx: number
): { latitude: number; longitude: number } {
  const center = getCountryCenter(countryDisplayName);
  const delta = getCountryDelta(countryDisplayName);
  const seed = hashString(`${countryDisplayName}|${locName}|${idx}`);
  const rand1 = ((seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const rand2 = (((seed ^ 0x9e3779b9) * 1664525 + 1013904223) >>> 0) / 4294967296;
  const latOffset = (rand1 - 0.5) * delta.latitudeDelta * 0.25;
  const lngOffset = (rand2 - 0.5) * delta.longitudeDelta * 0.25;
  return {
    latitude: center.latitude + latOffset,
    longitude: center.longitude + lngOffset,
  };
}

export function hasValidCoordinates(loc: MapLocation): boolean {
  const c = loc.coordinates;
  return (
    typeof c?.latitude === "number" &&
    typeof c?.longitude === "number" &&
    !Number.isNaN(c.latitude) &&
    !Number.isNaN(c.longitude) &&
    c.latitude !== 0 &&
    c.longitude !== 0 &&
    c.latitude >= -90 &&
    c.latitude <= 90 &&
    c.longitude >= -180 &&
    c.longitude <= 180
  );
}

export function getMarkerCoordinates(
  loc: MapLocation,
  countryName: string,
  index: number
): { latitude: number; longitude: number } {
  if (hasValidCoordinates(loc) && loc.coordinates) {
    return loc.coordinates;
  }
  return getStableFallbackCoordinates(
    countryName,
    loc.name || `Location ${index + 1}`,
    index
  );
}
