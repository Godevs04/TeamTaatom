"use client";

import * as React from "react";
import { Map, MapControls, MapMarker, MapRoute, MarkerContent } from "@/components/ui/map";
import { MapFitBounds } from "./map-fit-bounds";
import type { LngLat } from "@/lib/map-utils";

type JourneyRouteMapProps = {
  polyline?: Array<{ lat: number; lng: number }>;
  startCoords?: { lat: number; lng: number } | null;
  className?: string;
};

function decodePolylineToLngLat(
  polyline?: Array<{ lat: number; lng: number }>
): LngLat[] {
  if (!polyline?.length) return [];
  return polyline
    .filter((p) => typeof p.lat === "number" && typeof p.lng === "number")
    .map((p) => [p.lng, p.lat] as LngLat);
}

export function JourneyRouteMap({
  polyline,
  startCoords,
  className = "h-72 w-full",
}: JourneyRouteMapProps) {
  const route = React.useMemo(() => decodePolylineToLngLat(polyline), [polyline]);
  const start: LngLat | null =
    startCoords && typeof startCoords.lat === "number" && typeof startCoords.lng === "number"
      ? [startCoords.lng, startCoords.lat]
      : route[0] ?? null;
  const end = route.length > 1 ? route[route.length - 1] : null;
  const fitPoints = route.length > 0 ? route : start ? [start] : [];

  if (!start && route.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border bg-muted text-sm text-muted-foreground ${className}`}>
        No route data for this journey yet.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-2xl border bg-muted ${className}`}>
      <Map center={start ?? [0, 20]} zoom={12} className="h-full w-full">
        <MapControls position="bottom-right" showZoom showLocate />
        <MapFitBounds points={fitPoints} maxZoom={14} padding={40} />

        {route.length >= 2 && (
          <MapRoute
            coordinates={route}
            color="#3b82f6"
            width={4}
            opacity={0.9}
            interactive={false}
          />
        )}

        {start && (
          <MapMarker longitude={start[0]} latitude={start[1]}>
            <MarkerContent>
              <div className="rounded-full border-2 border-white bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                Start
              </div>
            </MarkerContent>
          </MapMarker>
        )}

        {end && route.length > 1 && (
          <MapMarker longitude={end[0]} latitude={end[1]}>
            <MarkerContent>
              <div className="rounded-full border-2 border-white bg-primary px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                End
              </div>
            </MarkerContent>
          </MapMarker>
        )}
      </Map>
    </div>
  );
}
