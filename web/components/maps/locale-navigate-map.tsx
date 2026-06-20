"use client";

import * as React from "react";
import { Clock, Loader2, Plane, Route, Waves } from "lucide-react";
import { Map, MapControls, MapMarker, MapRoute, MarkerContent } from "@/components/ui/map";
import { MapFitBounds } from "./map-fit-bounds";
import type { LngLat } from "@/lib/map-utils";
import {
  fetchNavigationOptions,
  formatRouteDistance,
  formatRouteDuration,
  fastestOptionId,
  MAP_ROUTE_COLORS,
  routeFitPoints,
  type NavigationOption,
} from "@/lib/osrm-routing";
import { cn } from "@/lib/utils";

type LocaleNavigateMapProps = {
  destination: { lat: number; lng: number; label: string };
  userPosition?: { lat: number; lng: number } | null;
  className?: string;
};

export function LocaleNavigateMap({
  destination,
  userPosition,
  className = "h-[min(60vh,480px)] w-full",
}: LocaleNavigateMapProps) {
  const dest: LngLat = [destination.lng, destination.lat];
  const user: LngLat | null = userPosition
    ? [userPosition.lng, userPosition.lat]
    : null;

  const [options, setOptions] = React.useState<NavigationOption[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [loadingRoutes, setLoadingRoutes] = React.useState(false);

  const routeKey = userPosition
    ? `${userPosition.lat},${userPosition.lng};${destination.lat},${destination.lng}`
    : null;

  React.useEffect(() => {
    if (!userPosition || !routeKey) {
      setOptions([]);
      setSelectedId("");
      return;
    }

    let cancelled = false;
    setLoadingRoutes(true);

    fetchNavigationOptions(userPosition, destination)
      .then((fetched) => {
        if (cancelled) return;
        setOptions(fetched);
        setSelectedId(fastestOptionId(fetched));
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
          setSelectedId("");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRoutes(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userPosition, routeKey, destination]);

  const selected = options.find((o) => o.id === selectedId) ?? options[0];
  const fastestId = fastestOptionId(options);
  const fitPoints: LngLat[] = selected
    ? routeFitPoints(selected, dest)
    : user
      ? [user, dest]
      : [dest];

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-muted ${className}`}>
      <Map center={dest} zoom={11} className="h-full w-full">
        <MapControls position="bottom-right" showZoom showLocate />
        <MapFitBounds
          points={fitPoints}
          maxZoom={selected?.mode === "air" ? 6 : 12}
          padding={72}
          defaultCenter={dest}
          defaultZoom={11}
        />

        {options.map((option) => {
          const isSelected = option.id === (selected?.id ?? "");
          if (option.mode === "air") {
            return (
              <MapRoute
                key={option.id}
                id={`locale-route-air-${option.id}`}
                coordinates={option.coordinates}
                color={isSelected ? MAP_ROUTE_COLORS.air : MAP_ROUTE_COLORS.airAlt}
                width={isSelected ? 4 : 3}
                opacity={isSelected ? 0.9 : 0.45}
                dashArray={[12, 8]}
                interactive={options.length > 1}
                onClick={() => setSelectedId(option.id)}
              />
            );
          }

          return (
            <React.Fragment key={option.id}>
              <MapRoute
                id={`locale-route-land-${option.id}`}
                coordinates={option.coordinates}
                color={isSelected ? MAP_ROUTE_COLORS.drive : MAP_ROUTE_COLORS.driveAlt}
                width={isSelected ? 5 : 3}
                opacity={isSelected ? 0.95 : 0.45}
                interactive={options.length > 1}
                onClick={() => setSelectedId(option.id)}
              />
              {option.seaCoordinates && option.seaCoordinates.length >= 2 && (
                <MapRoute
                  id={`locale-route-sea-${option.id}`}
                  coordinates={option.seaCoordinates}
                  color={isSelected ? MAP_ROUTE_COLORS.sea : MAP_ROUTE_COLORS.seaAlt}
                  width={isSelected ? 4 : 3}
                  opacity={isSelected ? 0.9 : 0.4}
                  dashArray={[10, 6]}
                  interactive={false}
                />
              )}
            </React.Fragment>
          );
        })}

        {user && (
          <MapMarker longitude={user[0]} latitude={user[1]}>
            <MarkerContent>
              <div className="h-4 w-4 rounded-full border-[3px] border-white bg-emerald-500 shadow-md ring-2 ring-emerald-500/30" />
            </MarkerContent>
          </MapMarker>
        )}

        <MapMarker longitude={dest[0]} latitude={dest[1]}>
          <MarkerContent>
            <div className="flex flex-col items-center gap-1">
              <div className="h-4 w-4 rounded-full border-[3px] border-white bg-red-500 shadow-md ring-2 ring-red-500/30" />
              <span className="max-w-[120px] truncate rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-slate-800 shadow-sm">
                {destination.label}
              </span>
            </div>
          </MarkerContent>
        </MapMarker>
      </Map>

      {loadingRoutes && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px] dark:bg-zinc-900/40">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      )}

      {options.length > 0 && (
        <div className="absolute left-3 top-3 z-10 flex max-w-[260px] flex-col gap-2">
          {options.map((option) => {
            const isSelected = option.id === (selected?.id ?? "");
            const isFastest = option.id === fastestId;
            const hasSea = option.seaDistanceMeters > 0;
            const isAir = option.mode === "air";

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedId(option.id)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left shadow-md transition-colors",
                  isSelected
                    ? "border-slate-200 bg-white text-slate-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
                    : "border-transparent bg-slate-800/75 text-white hover:bg-slate-800/90"
                )}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {isAir ? (
                    <Plane className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  ) : (
                    <Route className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    {formatRouteDuration(option.durationSeconds)}
                  </span>
                  <span>{formatRouteDistance(option.distanceMeters)}</span>
                </div>
                <p className="mt-1 text-[11px] font-medium opacity-80">
                  {isAir ? "By air" : hasSea ? "Drive + sea" : "By road"}
                </p>
                {hasSea && !isAir && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-600 dark:text-cyan-400">
                    <Waves className="h-3 w-3" />
                    +{formatRouteDistance(option.seaDistanceMeters)} sea
                  </span>
                )}
                {isFastest && isSelected && (
                  <span className="mt-1.5 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    Fastest
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
