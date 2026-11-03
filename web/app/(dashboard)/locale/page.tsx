"use client";

import * as React from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bookmark, Loader2, LocateFixed, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { getLocaleById, getLocales, type Locale } from "../../../lib/api";
import { Skeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/ui/button";
import { LocaleCard } from "../../../components/locale/locale-card";
import {
  countActiveFilters,
  EMPTY_LOCALE_FILTERS,
  LocaleFilterModal,
  type LocaleFilters,
} from "../../../components/locale/locale-filter-modal";
import { useUserLocation, type UserCoords } from "../../../hooks/use-user-location";
import { useDrivingDistances } from "../../../hooks/use-driving-distances";
import {
  getSavedLocales,
  isUsableDistance,
  setSavedLocales,
  straightLineKm,
  toStoredLocale,
} from "../../../lib/locale-utils";
import { cn } from "../../../lib/utils";

/** Mobile locale.tsx pages 20 at a time with a "Load More Places" button. */
const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [delayMs, value]);
  return debounced;
}

/** Locale matches the client-side parts of the filters (Saved tab filters everything locally). */
function matchesLocalFilters(locale: Locale, search: string, filters: LocaleFilters): boolean {
  const q = search.trim().toLowerCase();
  if (q) {
    const haystack = [locale.name, locale.city, locale.stateProvince, locale.countryCode, locale.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (filters.countryCode && locale.countryCode?.toUpperCase() !== filters.countryCode.toUpperCase()) return false;
  const stateKey = (filters.stateCode || filters.stateProvince).trim().toLowerCase();
  if (stateKey) {
    const candidates = [locale.stateCode, locale.stateProvince].map((v) => (v || "").trim().toLowerCase());
    if (!candidates.includes(stateKey)) return false;
  }
  if (filters.spotTypes.length) {
    const spots = (locale.spotTypes || []).map((s) => s.toLowerCase());
    if (!filters.spotTypes.some((s) => spots.includes(s.toLowerCase()))) return false;
  }
  return true;
}

function parseRadius(raw: string): number | null {
  const km = parseFloat(raw.trim());
  return Number.isFinite(km) && km > 0 ? km : null;
}

export default function LocalePage() {
  const [activeTab, setActiveTab] = React.useState<"locale" | "saved">("locale");
  const [searchInput, setSearchInput] = React.useState("");
  const [filters, setFilters] = React.useState<LocaleFilters>(EMPTY_LOCALE_FILTERS);
  const [savedSearch, setSavedSearch] = React.useState("");
  const [savedFilters, setSavedFilters] = React.useState<LocaleFilters>(EMPTY_LOCALE_FILTERS);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [savedList, setSavedList] = React.useState<Locale[]>([]);
  const [refreshingSaved, setRefreshingSaved] = React.useState(false);
  const search = useDebounced(searchInput, SEARCH_DEBOUNCE_MS);
  const { coords, permission, locating, request: requestLocation } = useUserLocation();

  // Round to ~1 km so small GPS jitter doesn't create new queries.
  const queryCoords = React.useMemo<UserCoords | null>(
    () => (coords ? { latitude: Number(coords.latitude.toFixed(2)), longitude: Number(coords.longitude.toFixed(2)) } : null),
    [coords]
  );

  React.useEffect(() => {
    setSavedList(getSavedLocales());
  }, []);

  const localesQ = useInfiniteQuery({
    queryKey: [
      "locales",
      search.trim(),
      filters.countryCode,
      filters.stateCode,
      filters.stateProvince,
      filters.spotTypes.slice().sort().join(","),
      queryCoords?.latitude ?? null,
      queryCoords?.longitude ?? null,
    ],
    queryFn: ({ pageParam }) =>
      getLocales({
        search: search.trim() || undefined,
        countryCode: filters.countryCode || undefined,
        stateCode: filters.stateCode || undefined,
        stateProvince: filters.stateProvince || undefined,
        spotTypes: filters.spotTypes.length ? filters.spotTypes : undefined,
        ...(queryCoords ? { lat: queryCoords.latitude, long: queryCoords.longitude, sort: "nearest" as const } : {}),
        cursor: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.pagination?.hasMore && last.pagination.nextCursor ? last.pagination.nextCursor : undefined),
    enabled: activeTab === "locale",
    placeholderData: keepPreviousData,
  });

  const locales = React.useMemo(() => localesQ.data?.pages.flatMap((p) => p.locales ?? []) ?? [], [localesQ.data]);

  // Saved tab: show stored copies immediately, then refresh each from the API so
  // signed image URLs (5 min TTL) are fresh — mirrors mobile locale.tsx.
  React.useEffect(() => {
    if (activeTab !== "saved") return;
    const stored = getSavedLocales();
    setSavedList(stored);
    if (stored.length === 0) return;
    let cancelled = false;
    setRefreshingSaved(true);
    void Promise.allSettled(stored.map((l) => getLocaleById(l._id))).then((results) => {
      if (cancelled) return;
      const fresh = stored.map((old, i) => {
        const r = results[i];
        return r.status === "fulfilled" && r.value?.locale ? toStoredLocale(r.value.locale) : old;
      });
      setSavedLocales(fresh);
      setSavedList(fresh);
      setRefreshingSaved(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const visibleSource = activeTab === "locale" ? locales : savedList;
  const { distances: driving, pending: drivingPending } = useDrivingDistances(coords, visibleSource);

  const distanceFor = React.useCallback(
    (locale: Locale): number | null => {
      const road = driving[locale._id];
      if (isUsableDistance(road)) return road;
      if (isUsableDistance(locale.distanceKm)) return locale.distanceKm;
      return straightLineKm(coords, locale);
    },
    [coords, driving]
  );

  const activeFilters = activeTab === "locale" ? filters : savedFilters;
  const radiusKm = parseRadius(activeFilters.searchRadius);
  const radiusNeedsLocation = radiusKm != null && !coords;

  const applyRadius = React.useCallback(
    (list: Locale[]) => {
      if (radiusKm == null) return list;
      if (!coords) return [];
      return list.filter((l) => {
        const d = distanceFor(l);
        return d != null && d <= radiusKm;
      });
    },
    [coords, distanceFor, radiusKm]
  );

  const visibleLocales = React.useMemo(() => applyRadius(locales), [applyRadius, locales]);

  const visibleSaved = React.useMemo(() => {
    const filtered = applyRadius(savedList.filter((l) => matchesLocalFilters(l, savedSearch, savedFilters)));
    if (!coords) return filtered;
    return filtered
      .map((l) => ({ l, d: distanceFor(l) }))
      .sort((a, b) => (a.d ?? Number.POSITIVE_INFINITY) - (b.d ?? Number.POSITIVE_INFINITY))
      .map(({ l }) => l);
  }, [applyRadius, coords, distanceFor, savedFilters, savedList, savedSearch]);

  // With a radius and nearest-first paging, stop offering more once the last loaded locale is outside it.
  const lastLoaded = locales[locales.length - 1];
  const lastDistance = lastLoaded ? distanceFor(lastLoaded) : null;
  const canLoadMore =
    !!localesQ.hasNextPage && !(radiusKm != null && coords && lastDistance != null && lastDistance > radiusKm);

  const unsave = (locale: Locale) => {
    const next = getSavedLocales().filter((l) => l._id !== locale._id);
    setSavedLocales(next);
    setSavedList(next);
    toast.success(`${locale.name} removed from saved`);
  };

  const enableLocation = () =>
    requestLocation(() => toast.error("Location permission denied. Enable it in your browser settings to sort by distance."));

  const filterCount = countActiveFilters(activeFilters);
  const currentSearch = activeTab === "locale" ? searchInput : savedSearch;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="flex gap-2" role="tablist">
        {(["locale", "saved"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors",
              activeTab === tab
                ? "bg-gradient-to-r from-taatom-ocean to-taatom-emerald text-white"
                : "border border-slate-200 bg-white/70 text-slate-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
            )}
          >
            {tab === "locale" ? "Locale" : `Saved${savedList.length ? ` (${savedList.length})` : ""}`}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={currentSearch}
            onChange={(e) => (activeTab === "locale" ? setSearchInput(e.target.value) : setSavedSearch(e.target.value))}
            placeholder="Search destinations"
            aria-label="Search destinations"
            className="w-full rounded-full border border-slate-200 bg-white/90 py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary/40 dark:border-zinc-700 dark:bg-zinc-900/80"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="relative rounded-full px-4"
          onClick={() => setFilterOpen(true)}
          aria-label={`Filters${filterCount ? ` (${filterCount} active)` : ""}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {filterCount ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">
              {filterCount}
            </span>
          ) : null}
        </Button>
      </div>

      {!coords && permission !== "unsupported" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm text-slate-600 dark:text-zinc-300">
            {permission === "denied"
              ? "Location is blocked. Allow it in your browser settings to see distances."
              : "We use your location only to show how far each place is and sort nearest first."}
          </p>
          {permission !== "denied" ? (
            <Button size="sm" className="gap-1.5 rounded-full" onClick={enableLocation} disabled={locating}>
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              Sort by Distance (Enable Location)
            </Button>
          ) : null}
        </div>
      ) : null}

      <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50">
        {activeTab === "locale" ? "Featured Locales" : "Saved Locales 🔖"}
        {activeTab === "saved" && refreshingSaved ? <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-slate-400" /> : null}
      </h2>

      {radiusNeedsLocation ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          Enable location to use the search radius filter.
        </div>
      ) : activeTab === "locale" ? (
        localesQ.isPending ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[16/10] w-full rounded-2xl" />
            ))}
          </div>
        ) : localesQ.isError ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/95">
            <p className="text-sm text-red-600 dark:text-red-400">Failed to load locales.</p>
            <Button variant="outline" className="mt-3 rounded-xl" onClick={() => void localesQ.refetch()}>
              Try again
            </Button>
          </div>
        ) : visibleLocales.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/95">
            <MapPin className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-3 font-semibold text-slate-700 dark:text-zinc-200">No Locales Found</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Try adjusting your filters or search radius.</p>
          </div>
        ) : (
          <div className={cn("space-y-4 transition-opacity", localesQ.isPlaceholderData && "opacity-60")}>
            {visibleLocales.map((locale) => (
              <LocaleCard
                key={locale._id}
                locale={locale}
                distanceKm={distanceFor(locale)}
                distanceLoading={drivingPending.has(locale._id) && !isUsableDistance(locale.distanceKm)}
              />
            ))}
            {canLoadMore ? (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  className="gap-2 rounded-full"
                  onClick={() => void localesQ.fetchNextPage()}
                  disabled={localesQ.isFetchingNextPage}
                >
                  {localesQ.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Load More Places
                </Button>
              </div>
            ) : null}
          </div>
        )
      ) : savedList.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/95">
          <Bookmark className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-3 text-slate-500 dark:text-zinc-400">No saved places yet. Open a locale and bookmark it.</p>
        </div>
      ) : visibleSaved.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/95">
          <MapPin className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-3 font-semibold text-slate-700 dark:text-zinc-200">No Locales Found</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Try adjusting your filters or search radius.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleSaved.map((locale) => (
            <LocaleCard
              key={locale._id}
              locale={locale}
              distanceKm={distanceFor(locale)}
              distanceLoading={drivingPending.has(locale._id)}
              showDescription
              onUnsave={() => unsave(locale)}
            />
          ))}
        </div>
      )}

      <LocaleFilterModal
        open={filterOpen}
        initial={activeFilters}
        hasLocation={!!coords}
        onClose={() => setFilterOpen(false)}
        onApply={(next) => {
          if (activeTab === "locale") setFilters(next);
          else setSavedFilters(next);
          setFilterOpen(false);
        }}
      />
    </div>
  );
}
