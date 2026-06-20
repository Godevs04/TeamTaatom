import { haversineKm, type LngLat } from "./map-utils";

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

export const MAP_ROUTE_COLORS = {
  drive: "#3b82f6",
  driveAlt: "#94a3b8",
  sea: "#06b6d4",
  seaAlt: "#67e8f9",
  air: "#a855f7",
  airAlt: "#c4b5fd",
  landing: "#6366f1",
} as const;

const SEA_GAP_THRESHOLD_M = 800;
const FERRY_SPEED_KMH = 22;
const AIR_MIN_DISTANCE_KM = 100;
const AIR_DIRECT_MIN_KM = 180;
const CRUISE_SPEED_KMH = 700;
const AIRPORT_OVERHEAD_SECONDS = 2.5 * 3600;

export type RouteMode = "drive" | "air";

export type NavigationOption = {
  id: string;
  mode: RouteMode;
  coordinates: LngLat[];
  seaCoordinates: LngLat[] | null;
  distanceMeters: number;
  durationSeconds: number;
  landDistanceMeters: number;
  seaDistanceMeters: number;
};

/** @deprecated Use NavigationOption */
export type DrivingRoute = NavigationOption;

type OsrmRouteResponse = {
  code?: string;
  routes?: Array<{
    geometry?: { coordinates?: LngLat[] };
    distance?: number;
    duration?: number;
  }>;
};

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

function buildConnector(from: LngLat, to: LngLat, segments = 16): LngLat[] {
  const points: LngLat[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
  }
  return points;
}

/** Spherical great-circle arc for air routes. */
export function buildGreatCircleArc(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  segments = 48
): LngLat[] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const lat1 = toRad(from.lat);
  const lng1 = toRad(from.lng);
  const lat2 = toRad(to.lat);
  const lng2 = toRad(to.lng);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2
      )
    );

  if (d < 1e-6) {
    return [[from.lng, from.lat], [to.lng, to.lat]];
  }

  const points: LngLat[] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    points.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return points;
}

function enrichDriveWithSeaLeg(
  route: {
    id: string;
    coordinates: LngLat[];
    distanceMeters: number;
    durationSeconds: number;
  },
  destination: { lat: number; lng: number }
): NavigationOption {
  const last = route.coordinates[route.coordinates.length - 1];
  if (!last) {
    return {
      ...route,
      mode: "drive",
      seaCoordinates: null,
      landDistanceMeters: route.distanceMeters,
      seaDistanceMeters: 0,
    };
  }

  const seaMeters = haversineMeters(last[1], last[0], destination.lat, destination.lng);
  if (seaMeters < SEA_GAP_THRESHOLD_M) {
    return {
      ...route,
      mode: "drive",
      seaCoordinates: null,
      landDistanceMeters: route.distanceMeters,
      seaDistanceMeters: 0,
    };
  }

  const dest: LngLat = [destination.lng, destination.lat];
  const seaCoordinates = buildConnector(last, dest);
  const seaDurationSeconds = (seaMeters / 1000 / FERRY_SPEED_KMH) * 3600;

  return {
    ...route,
    mode: "drive",
    seaCoordinates,
    landDistanceMeters: route.distanceMeters,
    seaDistanceMeters: seaMeters,
    distanceMeters: route.distanceMeters + seaMeters,
    durationSeconds: route.durationSeconds + seaDurationSeconds,
  };
}

function buildAirOption(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): NavigationOption {
  const distanceMeters = haversineMeters(from.lat, from.lng, to.lat, to.lng);
  const flightSeconds = (distanceMeters / 1000 / CRUISE_SPEED_KMH) * 3600;

  return {
    id: "air",
    mode: "air",
    coordinates: buildGreatCircleArc(from, to),
    seaCoordinates: null,
    distanceMeters,
    durationSeconds: flightSeconds + AIRPORT_OVERHEAD_SECONDS,
    landDistanceMeters: 0,
    seaDistanceMeters: 0,
  };
}

function shouldOfferAir(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  directKm: number,
  bestDrive: NavigationOption | undefined
): boolean {
  if (directKm < AIR_MIN_DISTANCE_KM) return false;
  if (bestDrive && bestDrive.seaDistanceMeters >= 20_000) return true;
  if (directKm >= AIR_DIRECT_MIN_KM) return true;
  if (!bestDrive) return directKm >= AIR_MIN_DISTANCE_KM;
  const air = buildAirOption(from, to);
  return air.durationSeconds < bestDrive.durationSeconds * 0.92;
}

async function fetchOsrmRoutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  alternatives = true
): Promise<NavigationOption[]> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson${alternatives ? "&alternatives=true" : ""}`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as OsrmRouteResponse;
  if (data.code !== "Ok" || !data.routes?.length) return [];

  return data.routes
    .map((route, index) => {
      const coordinates = route.geometry?.coordinates;
      if (!coordinates || coordinates.length < 2) return null;
      return enrichDriveWithSeaLeg(
        {
          id: `drive-${index}`,
          coordinates,
          distanceMeters: route.distance ?? 0,
          durationSeconds: route.duration ?? 0,
        },
        to
      );
    })
    .filter((r): r is NavigationOption => r != null);
}

/** Driving (+ sea leg) and air options when distance warrants it. */
export async function fetchNavigationOptions(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<NavigationOption[]> {
  const driveOptions = await fetchOsrmRoutes(from, to, true);
  const directKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const bestDrive = driveOptions[0];

  const options = [...driveOptions];
  if (shouldOfferAir(from, to, directKm, bestDrive)) {
    options.push(buildAirOption(from, to));
  }
  return options;
}

/** @deprecated Use fetchNavigationOptions */
export async function fetchDrivingRoutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<NavigationOption[]> {
  return fetchNavigationOptions(from, to);
}

/** Live multi-stop road route for regional demo maps. */
export async function fetchMultiStopRoute(
  stops: Array<{ lat: number; lng: number }>
): Promise<LngLat[]> {
  if (stops.length < 2) return stops.map((s) => [s.lng, s.lat]);

  const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) return stops.map((s) => [s.lng, s.lat]);

  const data = (await res.json()) as OsrmRouteResponse;
  const line = data.routes?.[0]?.geometry?.coordinates;
  if (data.code !== "Ok" || !line || line.length < 2) {
    return stops.map((s) => [s.lng, s.lat]);
  }
  return line;
}

export function formatRouteDuration(seconds: number): string {
  const totalMin = Math.max(1, Math.round(seconds / 60));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatRouteDistance(meters: number): string {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return `${km.toFixed(1)} km`;
}

export function routeFitPoints(option: NavigationOption, destination: LngLat): LngLat[] {
  const pts = [...option.coordinates];
  if (option.seaCoordinates?.length) {
    pts.push(...option.seaCoordinates);
  }
  if (option.mode === "air") {
    pts.push(destination);
  } else {
    pts.push(destination);
  }
  return pts;
}

export function fastestOptionId(options: NavigationOption[]): string {
  if (options.length === 0) return "";
  return options.reduce((best, opt) =>
    opt.durationSeconds < best.durationSeconds ? opt : best
  ).id;
}
