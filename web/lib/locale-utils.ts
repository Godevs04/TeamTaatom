import type { Locale } from "./api";
import { STORAGE_KEYS } from "./constants";
import { haversineKm } from "./map-utils";

/** Backend marks locales without coordinates with Number.MAX_VALUE in nearest sort. */
export function isUsableDistance(km: number | null | undefined): km is number {
  return typeof km === "number" && Number.isFinite(km) && km >= 0 && km < 1e9;
}

export function hasLocaleCoords(locale: Pick<Locale, "latitude" | "longitude">): boolean {
  return (
    typeof locale.latitude === "number" &&
    typeof locale.longitude === "number" &&
    locale.latitude !== 0 &&
    locale.longitude !== 0
  );
}

export function straightLineKm(
  from: { latitude: number; longitude: number } | null,
  locale: Pick<Locale, "latitude" | "longitude">
): number | null {
  if (!from || !hasLocaleCoords(locale)) return null;
  return haversineKm(from.latitude, from.longitude, locale.latitude as number, locale.longitude as number);
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

/** Saved locales are stored as full objects (mirrors mobile AsyncStorage `savedLocales`). */
export function getSavedLocales(): Locale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.savedLocaleIds);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as Locale[]).filter((l) => l && typeof l._id === "string") : [];
  } catch {
    return [];
  }
}

export function setSavedLocales(list: Locale[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.savedLocaleIds, JSON.stringify(list));
  } catch {
    // storage full / disabled — saved list just won't persist
  }
}

/** Never persist per-viewer, time-sensitive fields (mobile strips distanceKm before saving). */
export function toStoredLocale(locale: Locale): Locale {
  const { distanceKm: _distance, ...rest } = locale;
  void _distance;
  return rest;
}

export function isLocaleSaved(id: string): boolean {
  return getSavedLocales().some((l) => l._id === id);
}

/** Toggle a locale in the saved list. Returns the new saved state. */
export function toggleSavedLocale(locale: Locale): boolean {
  const list = getSavedLocales();
  const idx = list.findIndex((l) => l._id === locale._id);
  if (idx >= 0) {
    list.splice(idx, 1);
    setSavedLocales(list);
    return false;
  }
  list.push(toStoredLocale(locale));
  setSavedLocales(list);
  return true;
}
