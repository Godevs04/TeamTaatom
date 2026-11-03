"use client";

import * as React from "react";
import type { Locale } from "../lib/api";
import { fetchDrivingDistancesKm } from "../lib/osrm-routing";
import { hasLocaleCoords } from "../lib/locale-utils";
import type { UserCoords } from "./use-user-location";

/** Session cache keyed by rounded origin + locale id (origin ≈ 1 km precision). */
const cache = new Map<string, number | null>();
const originKey = (o: UserCoords) => `${o.latitude.toFixed(2)},${o.longitude.toFixed(2)}`;

/**
 * Road distance (km) per locale id for the given locales, mirroring mobile's
 * Google Distance Matrix lookup with an OSRM table request. `pending` holds ids
 * still being calculated; a null value means "no road route" (use straight line).
 */
export function useDrivingDistances(origin: UserCoords | null, locales: Locale[]) {
  const [distances, setDistances] = React.useState<Record<string, number | null>>({});
  const [pending, setPending] = React.useState<Set<string>>(() => new Set());
  const idsKey = locales.map((l) => l._id).join(",");

  React.useEffect(() => {
    if (!origin) return;
    const oKey = originKey(origin);
    const known: Record<string, number | null> = {};
    const missing: Locale[] = [];
    for (const locale of locales) {
      if (!hasLocaleCoords(locale)) continue;
      const key = `${oKey}|${locale._id}`;
      if (cache.has(key)) known[locale._id] = cache.get(key) ?? null;
      else missing.push(locale);
    }
    if (Object.keys(known).length) setDistances((prev) => ({ ...prev, ...known }));
    if (missing.length === 0) return;

    let cancelled = false;
    setPending((prev) => new Set([...Array.from(prev), ...missing.map((l) => l._id)]));
    void fetchDrivingDistancesKm(
      { lat: origin.latitude, lng: origin.longitude },
      missing.map((l) => ({ lat: l.latitude as number, lng: l.longitude as number }))
    ).then((results) => {
      const next: Record<string, number | null> = {};
      missing.forEach((locale, i) => {
        next[locale._id] = results[i] ?? null;
        cache.set(`${oKey}|${locale._id}`, results[i] ?? null);
      });
      if (cancelled) return;
      setDistances((prev) => ({ ...prev, ...next }));
      setPending((prev) => {
        const copy = new Set(prev);
        missing.forEach((l) => copy.delete(l._id));
        return copy;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on ids + origin
  }, [idsKey, origin?.latitude, origin?.longitude]);

  return { distances, pending };
}
