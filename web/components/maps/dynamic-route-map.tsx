"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Map, MapControls, MapMarker, MapRoute, MarkerContent } from "@/components/ui/map";
import { MapFitBounds } from "./map-fit-bounds";
import { MAP_ROUTE_COLORS, fetchMultiStopRoute } from "@/lib/osrm-routing";
import { placesCenter, placesToLngLat, type MapPlace } from "@/lib/locale-map-places";
import type { LngLat } from "@/lib/map-utils";

type DynamicRouteMapProps = {
  places: MapPlace[];
  className?: string;
  roundedClassName?: string;
  interactive?: boolean;
  showControls?: boolean;
  routeColor?: string;
  overlayLabel?: string;
  markerStyle?: "dot" | "label";
};

export function DynamicRouteMap({
  places,
  className = "h-full w-full",
  roundedClassName = "rounded-2xl",
  interactive = false,
  showControls = false,
  routeColor = MAP_ROUTE_COLORS.landing,
  overlayLabel,
  markerStyle = "dot",
}: DynamicRouteMapProps) {
  const placeKey = places.map((p) => p.id).join(",");

  const [route, setRoute] = React.useState<LngLat[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (places.length < 2) {
      setRoute(placesToLngLat(places));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchMultiStopRoute(places)
      .then((coords) => {
        if (!cancelled) setRoute(coords);
      })
      .catch(() => {
        if (!cancelled) setRoute(placesToLngLat(places));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [placeKey, places]);

  const center = placesCenter(places);
  const fitPoints = route.length > 0 ? route : placesToLngLat(places);

  if (places.length === 0) return null;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Map
        center={center}
        zoom={8}
        className={`h-full w-full ${roundedClassName}`}
        interactive={interactive}
        scrollZoom={interactive}
        dragPan={interactive}
        dragRotate={false}
        doubleClickZoom={interactive}
        touchZoomRotate={interactive}
      >
        {showControls && <MapControls position="bottom-right" showZoom />}
        <MapFitBounds
          points={fitPoints}
          maxZoom={11}
          padding={48}
          defaultCenter={center}
          defaultZoom={8}
        />

        {route.length >= 2 && (
          <MapRoute
            coordinates={route}
            color={routeColor}
            width={3.5}
            opacity={0.9}
            interactive={false}
          />
        )}

        {places.map((place, i) => (
          <PlaceMarker key={place.id} place={place} index={i} total={places.length} style={markerStyle} />
        ))}
      </Map>

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/30 dark:bg-zinc-900/30">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {overlayLabel ? (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-white/95 px-3 py-2 text-xs shadow-sm backdrop-blur-sm">
          <span className="font-medium text-[var(--landing-ink)]">{overlayLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function PlaceMarker({
  place,
  index,
  total,
  style,
}: {
  place: MapPlace;
  index: number;
  total: number;
  style: "dot" | "label";
}) {
  if (style === "label") {
    return (
      <MapMarker longitude={place.lng} latitude={place.lat}>
        <MarkerContent>
          <span className="whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--landing-ink)] shadow-md">
            {place.label}
          </span>
        </MarkerContent>
      </MapMarker>
    );
  }

  return (
    <MapMarker longitude={place.lng} latitude={place.lat}>
      <MarkerContent>
        <div
          className={`rounded-full border-2 border-white shadow-md ${
            index === 0
              ? "h-3.5 w-3.5 bg-[var(--landing-accent)] ring-4 ring-[var(--landing-accent)]/20"
              : index === total - 1
                ? "h-3 w-3 bg-[var(--landing-accent)]"
                : "h-2.5 w-2.5 bg-[var(--landing-accent-soft)]"
          }`}
        />
      </MarkerContent>
    </MapMarker>
  );
}
