import { getLocales, type Locale } from "./api";
import { haversineKm, hasValidCoords, type LngLat } from "./map-utils";

export type MapPlace = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  countryCode?: string;
};

export type LocaleMapMode = "connections" | "feature" | "regional";

export type PlaceArc = {
  id: string;
  from: LngLat;
  to: LngLat;
};

export function localeToMapPlace(locale: Locale): MapPlace | null {
  if (!hasValidCoords(locale.latitude, locale.longitude)) return null;
  return {
    id: locale._id,
    label: locale.name,
    lat: locale.latitude!,
    lng: locale.longitude!,
    imageUrl: locale.imageUrl ?? locale.imageUrls?.[0],
    countryCode: locale.countryCode,
  };
}

export function localesToMapPlaces(locales: Locale[]): MapPlace[] {
  return locales.map(localeToMapPlace).filter((p): p is MapPlace => p != null);
}

export function placesToLngLat(places: MapPlace[]): LngLat[] {
  return places.map((p) => [p.lng, p.lat]);
}

export function placesCenter(places: MapPlace[]): LngLat {
  if (places.length === 0) return [0, 20];
  const lng = places.reduce((s, p) => s + p.lng, 0) / places.length;
  const lat = places.reduce((s, p) => s + p.lat, 0) / places.length;
  return [lng, lat];
}

function orderNearestNeighbor(places: MapPlace[]): MapPlace[] {
  if (places.length <= 1) return places;
  const remaining = [...places];
  const ordered = [remaining.shift()!];
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(last.lat, last.lng, remaining[i].lat, remaining[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }
  return ordered;
}

function selectDiversePlaces(places: MapPlace[], count: number): MapPlace[] {
  if (places.length <= count) return [...places];
  const sorted = [...places].sort((a, b) => a.id.localeCompare(b.id));
  const selected: MapPlace[] = [sorted[0]];
  const remaining = sorted.slice(1);

  while (selected.length < count && remaining.length > 0) {
    let bestIdx = 0;
    let bestMinDist = -1;
    for (let i = 0; i < remaining.length; i++) {
      const minDist = Math.min(
        ...selected.map((s) => haversineKm(s.lat, s.lng, remaining[i].lat, remaining[i].lng))
      );
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestIdx = i;
      }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  return selected;
}

function selectRegionalPlaces(locales: Locale[], count: number): MapPlace[] {
  const byCountry = new Map<string, MapPlace[]>();
  for (const locale of locales) {
    const place = localeToMapPlace(locale);
    if (!place) continue;
    const code = locale.countryCode || "XX";
    const list = byCountry.get(code) ?? [];
    list.push(place);
    byCountry.set(code, list);
  }

  let group: MapPlace[] = [];
  for (const g of byCountry.values()) {
    if (g.length > group.length) group = g;
  }
  if (group.length === 0) return [];
  return orderNearestNeighbor(group.slice(0, count));
}

export function selectMapPlaces(locales: Locale[], mode: LocaleMapMode, count: number): MapPlace[] {
  const all = localesToMapPlaces(locales);
  if (all.length === 0) return [];

  switch (mode) {
    case "connections":
      return selectDiversePlaces(all, count);
    case "feature":
      return orderNearestNeighbor(selectDiversePlaces(all, count));
    case "regional":
      return selectRegionalPlaces(locales, count);
  }
}

function pickHub(places: MapPlace[]): MapPlace {
  const [lng, lat] = placesCenter(places);
  return places.reduce((best, p) => {
    const dBest = haversineKm(best.lat, best.lng, lat, lng);
    const dP = haversineKm(p.lat, p.lng, lat, lng);
    return dP < dBest ? p : best;
  });
}

export function buildHubArcs(places: MapPlace[]): PlaceArc[] {
  if (places.length < 2) return [];
  const hub = pickHub(places);
  return places
    .filter((p) => p.id !== hub.id)
    .map((p) => ({
      id: `${hub.id}-${p.id}`,
      from: [hub.lng, hub.lat] as LngLat,
      to: [p.lng, p.lat] as LngLat,
    }));
}

export function buildSequentialArcs(places: MapPlace[]): PlaceArc[] {
  const arcs: PlaceArc[] = [];
  for (let i = 0; i < places.length - 1; i++) {
    arcs.push({
      id: `${places[i].id}-${places[i + 1].id}`,
      from: [places[i].lng, places[i].lat],
      to: [places[i + 1].lng, places[i + 1].lat],
    });
  }
  return arcs;
}

export async function fetchLocaleMapPlaces(mode: LocaleMapMode, count: number): Promise<MapPlace[]> {
  const { locales } = await getLocales({ limit: 50 });
  return selectMapPlaces(locales, mode, count);
}
