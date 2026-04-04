"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  getLocales,
  getLocaleCountries,
  getLocaleStates,
  getLocaleSpotTypes,
  type Locale,
} from "../../../lib/api";
import { STORAGE_KEYS } from "../../../lib/constants";
import { Skeleton } from "../../../components/ui/skeleton";
import { MapPin, Bookmark, BookmarkCheck, MapPinned } from "lucide-react";

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getSavedLocales(): Locale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.savedLocaleIds);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setSavedLocales(list: Locale[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.savedLocaleIds, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export default function LocalePage() {
  const [countryCode, setCountryCode] = React.useState("");
  const [stateCode, setStateCode] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [spotTypes, setSpotTypes] = React.useState<string[]>([]);
  const [activeTab, setActiveTab] = React.useState<"discover" | "saved">("discover");
  const [userCoords, setUserCoords] = React.useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [sortByNearby, setSortByNearby] = React.useState(true);
  const [savedList, setSavedList] = React.useState<Locale[]>([]);

  const loadSaved = React.useCallback(() => {
    setSavedList(getSavedLocales());
  }, []);

  React.useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const toggleSpotType = (type: string) => {
    setSpotTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const { data: countriesData } = useQuery({
    queryKey: ["locale-countries"],
    queryFn: getLocaleCountries,
  });
  const countries = countriesData?.countries ?? [];

  const { data: spotTypesData } = useQuery({
    queryKey: ["locale-spot-types"],
    queryFn: getLocaleSpotTypes,
  });
  const spotTypeOptions = spotTypesData?.spotTypes ?? [];

  const { data: statesData } = useQuery({
    queryKey: ["locale-states", countryCode],
    // Be defensive: only call API when we have a non-empty countryCode.
    // If the backend still returns 400 (e.g. race conditions), swallow it and fall back to manual text input.
    queryFn: async () => {
      if (!countryCode || !countryCode.trim()) {
        return { states: [] };
      }
      try {
        return await getLocaleStates(countryCode);
      } catch {
        return { states: [] };
      }
    },
    enabled: Boolean(countryCode?.trim()),
  });
  const stateOptions = statesData?.states ?? [];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["locales", search, countryCode, stateCode, spotTypes],
    queryFn: () =>
      getLocales({
        search: search || undefined,
        countryCode: countryCode || undefined,
        stateCode: stateCode || undefined,
        spotTypes: spotTypes.length ? spotTypes : undefined,
        page: 1,
        limit: 50,
      }),
    enabled: activeTab === "discover",
  });

  const locales = React.useMemo(() => {
    const raw = data?.locales ?? [];
    if (activeTab === "saved") return savedList;
    if (!userCoords || !sortByNearby) return raw;
    const withDistance = raw
      .filter(
        (l) =>
          typeof l.latitude === "number" &&
          typeof l.longitude === "number" &&
          l.latitude !== 0 &&
          l.longitude !== 0
      )
      .map((l) => ({
        ...l,
        distanceKm: haversineKm(
          userCoords.latitude,
          userCoords.longitude,
          l.latitude!,
          l.longitude!
        ),
      }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    const withoutCoords = raw.filter(
      (l) =>
        !l.latitude ||
        !l.longitude ||
        l.latitude === 0 ||
        l.longitude === 0
    );
    return [...withDistance, ...withoutCoords];
  }, [activeTab, savedList, data?.locales, userCoords, sortByNearby]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    Boolean(countryCode.trim()) ||
    Boolean(stateCode.trim()) ||
    spotTypes.length > 0;

  React.useEffect(() => {
    if (activeTab !== "discover" || userCoords) return;
    let cancelled = false;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled)
          setUserCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
    return () => {
      cancelled = true;
    };
  }, [activeTab, userCoords]);

  const toggleBookmark = React.useCallback(
    (e: React.MouseEvent, locale: Locale) => {
      e.preventDefault();
      e.stopPropagation();
      const list = getSavedLocales();
      const idx = list.findIndex((l) => l._id === locale._id);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push(locale);
      }
      setSavedLocales(list);
      setSavedList(list);
    },
    []
  );

  const isSaved = React.useCallback(
    (id: string) => savedList.some((l) => l._id === id),
    [savedList]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Locales
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Discover places and destinations.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("discover")}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "discover"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-slate-200 bg-slate-50/50 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-slate-300"
              }`}
            >
              Discover
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("saved")}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "saved"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-slate-200 bg-slate-50/50 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-slate-300"
              }`}
            >
              Saved ({savedList.length})
            </button>
          </div>
        </div>

        {activeTab === "discover" && (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Search places…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50"
              />
              <select
                value={countryCode}
                onChange={(e) => {
                  setCountryCode(e.target.value);
                  setStateCode("");
                }}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                <option value="">All countries</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name ?? c.code} {c.localeCount != null ? `(${c.localeCount})` : ""}
                  </option>
                ))}
              </select>
              {stateOptions.length > 0 ? (
                <select
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50"
                >
                  <option value="">All states</option>
                  {stateOptions.map((s) => (
                    <option
                      key={s.stateCode || s.stateProvince}
                      value={s.stateCode ?? s.stateProvince ?? ""}
                    >
                      {s.stateProvince || s.stateCode || "—"}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="State (e.g. KA)"
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  className="w-28 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50"
                />
              )}
            </div>
            {spotTypeOptions.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Spot types:
                </span>
                {spotTypeOptions.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleSpotType(type)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      spotTypes.includes(type)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-slate-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
            {userCoords && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSortByNearby((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    sortByNearby
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 text-slate-600 dark:border-zinc-700 dark:text-slate-400"
                  }`}
                >
                  <MapPinned className="h-3.5 w-3.5" />
                  {sortByNearby ? "Nearest first" : "Default order"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {activeTab === "saved" && !savedList.length && (
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/95">
          <Bookmark className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            No saved places. Discover locales and bookmark them.
          </p>
        </div>
      )}

      {activeTab === "discover" && isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
          ))}
        </div>
      )}

      {activeTab === "discover" && !isLoading && isError && (
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/95">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load locales.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 text-sm font-semibold text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {activeTab === "discover" &&
        !isLoading &&
        !isError &&
        locales.length === 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/95">
            <MapPin className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-3 text-slate-500 dark:text-slate-400">
              {hasActiveFilters
                ? "Try adjusting your search or filters"
                : "No locales found."}
            </p>
          </div>
        )}

      {((activeTab === "saved" && savedList.length > 0) ||
        (activeTab === "discover" && !isLoading && !isError && locales.length > 0)) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {locales.map((locale) => {
            const distanceKm = "distanceKm" in locale ? (locale as Locale & { distanceKm?: number }).distanceKm : undefined;
            return (
              <Link
                key={locale._id}
                href={`/locale/${locale._id}`}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-soft transition-shadow hover:shadow-card dark:border-zinc-800 dark:bg-zinc-900/95"
              >
                <button
                  type="button"
                  onClick={(e) => toggleBookmark(e, locale)}
                  className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-2 shadow-sm transition hover:bg-white dark:bg-zinc-800/90 dark:hover:bg-zinc-800"
                  aria-label={isSaved(locale._id) ? "Remove from saved" : "Save locale"}
                >
                  {isSaved(locale._id) ? (
                    <BookmarkCheck className="h-5 w-5 text-primary" />
                  ) : (
                    <Bookmark className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  )}
                </button>
                <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-zinc-800">
                  {locale.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={locale.imageUrl}
                      alt={locale.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <MapPin className="h-12 w-12 text-slate-400" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {locale.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {[locale.stateProvince, locale.stateCode, locale.countryCode]
                      .filter(Boolean)
                      .join(" · ") || locale.countryCode}
                    {distanceKm != null && (
                      <span className="ml-1 text-primary">
                        · {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
                      </span>
                    )}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
