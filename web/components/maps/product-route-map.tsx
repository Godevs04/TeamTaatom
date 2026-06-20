"use client";

import { DynamicRouteMap } from "./dynamic-route-map";
import { MapPlacesShell } from "./map-places-shell";
import { useLocaleMapPlaces } from "@/hooks/useLocaleMapPlaces";

type ProductRouteMapProps = {
  className?: string;
  stopCount?: number;
  overlayLabel?: string;
  roundedClassName?: string;
};

export function ProductRouteMap({
  className = "h-full w-full",
  stopCount = 5,
  overlayLabel,
  roundedClassName = "rounded-2xl",
}: ProductRouteMapProps) {
  const { data: places = [], isLoading } = useLocaleMapPlaces("regional", stopCount);
  const label = overlayLabel ?? (places.length > 0 ? `Your route · ${places.length} stops` : undefined);

  return (
    <MapPlacesShell className={className} roundedClassName={roundedClassName} loading={isLoading} empty={!isLoading && places.length === 0}>
      <DynamicRouteMap
        places={places}
        className={className}
        roundedClassName={roundedClassName}
        overlayLabel={label}
        markerStyle="dot"
      />
    </MapPlacesShell>
  );
}
