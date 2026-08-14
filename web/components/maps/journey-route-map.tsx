"use client";

import * as React from "react";
import Link from "next/link";
import { Video } from "lucide-react";
import { Map, MapControls, MapMarker, MapRoute, MarkerContent } from "@/components/ui/map";
import { MapFitBounds } from "./map-fit-bounds";
import type { LngLat } from "@/lib/map-utils";

export type JourneyRouteMapWaypoint = {
  lat: number;
  lng: number;
  postId?: string;
  thumbnailUrl?: string | null;
  contentType?: "photo" | "short" | "video" | string;
};

type JourneyRouteMapProps = {
  polyline?: Array<{ lat: number; lng: number }>;
  startCoords?: { lat: number; lng: number } | null;
  waypoints?: JourneyRouteMapWaypoint[];
  /** Latest known position while actively tracking -- renders a distinct marker. */
  currentPosition?: { lat: number; lng: number } | null;
  /** Whether currentPosition should render as a pulsing "live" indicator vs a static dot (default true). */
  live?: boolean;
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
  waypoints,
  currentPosition,
  live = true,
  className = "h-72 w-full",
}: JourneyRouteMapProps) {
  const route = React.useMemo(() => decodePolylineToLngLat(polyline), [polyline]);
  const start: LngLat | null =
    startCoords && typeof startCoords.lat === "number" && typeof startCoords.lng === "number"
      ? [startCoords.lng, startCoords.lat]
      : route[0] ?? null;
  const end = route.length > 1 ? route[route.length - 1] : null;
  const validWaypoints = React.useMemo(
    () =>
      (waypoints ?? []).filter(
        (w) => typeof w.lat === "number" && typeof w.lng === "number" && !Number.isNaN(w.lat) && !Number.isNaN(w.lng)
      ),
    [waypoints]
  );
  const waypointPoints: LngLat[] = validWaypoints.map((w) => [w.lng, w.lat]);
  const current: LngLat | null =
    currentPosition && typeof currentPosition.lat === "number" && typeof currentPosition.lng === "number"
      ? [currentPosition.lng, currentPosition.lat]
      : null;
  const fitPoints = route.length > 0 || waypointPoints.length > 0 || current
    ? [...route, ...waypointPoints, ...(current ? [current] : [])]
    : start
      ? [start]
      : [];

  if (!start && route.length === 0 && waypointPoints.length === 0 && !current) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border bg-muted text-sm text-muted-foreground ${className}`}>
        No route data for this journey yet.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-2xl border bg-muted ${className}`}>
      <Map center={start ?? waypointPoints[0] ?? current ?? [0, 20]} zoom={12} className="h-full w-full">
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

        {/* Suppress "End" while a live current-position marker is shown --
            the route hasn't actually ended, that marker would be misleading. */}
        {end && route.length > 1 && !current && (
          <MapMarker longitude={end[0]} latitude={end[1]}>
            <MarkerContent>
              <div className="rounded-full border-2 border-white bg-primary px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                End
              </div>
            </MarkerContent>
          </MapMarker>
        )}

        {current && (
          <MapMarker longitude={current[0]} latitude={current[1]}>
            <MarkerContent>
              <div className="relative flex h-5 w-5 items-center justify-center">
                {live && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                )}
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-sky-500 shadow-md" />
              </div>
            </MarkerContent>
          </MapMarker>
        )}

        {validWaypoints.map((wp, i) => (
          <MapMarker key={wp.postId ?? `waypoint-${i}`} longitude={wp.lng} latitude={wp.lat}>
            <MarkerContent>
              <Link
                href={wp.postId ? `/trip/${wp.postId}` : "#"}
                className="block h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-md"
                aria-label="View post from this journey"
              >
                {wp.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={wp.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary/80 text-white">
                    <Video className="h-4 w-4" />
                  </div>
                )}
              </Link>
            </MarkerContent>
          </MapMarker>
        ))}
      </Map>
    </div>
  );
}
