"use client";

import { useEffect } from "react";
import maplibregl from "maplibre-gl";
import { useMap } from "@/components/ui/map";
import type { LngLat } from "@/lib/map-utils";

type MapFitBoundsProps = {
  points: LngLat[];
  padding?: number;
  maxZoom?: number;
  defaultCenter?: LngLat;
  defaultZoom?: number;
};

export function MapFitBounds({
  points,
  padding = 48,
  maxZoom = 12,
  defaultCenter,
  defaultZoom = 4,
}: MapFitBoundsProps) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!isLoaded || !map) return;

    if (points.length === 0) {
      if (defaultCenter) {
        map.setCenter(defaultCenter);
        map.setZoom(defaultZoom);
      }
      return;
    }

    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(Math.min(maxZoom, 11));
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, { padding, maxZoom, duration: 0 });
  }, [isLoaded, map, points, padding, maxZoom, defaultCenter, defaultZoom]);

  return null;
}
