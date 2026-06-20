"use client";

import { Map, MapControls, MapMarker, MarkerContent } from "@/components/ui/map";
import { MapFitBounds } from "./map-fit-bounds";

type LocationPreviewMapProps = {
  latitude: number;
  longitude: number;
  className?: string;
  zoom?: number;
};

export function LocationPreviewMap({
  latitude,
  longitude,
  className = "h-64 w-full",
  zoom = 13,
}: LocationPreviewMapProps) {
  const center: [number, number] = [longitude, latitude];

  return (
    <div className={`overflow-hidden rounded-2xl border bg-muted ${className}`}>
      <Map center={center} zoom={zoom} className="h-full w-full">
        <MapControls position="bottom-right" showZoom showLocate />
        <MapFitBounds points={[center]} maxZoom={zoom} />
        <MapMarker longitude={longitude} latitude={latitude}>
          <MarkerContent>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary shadow-lg">
              <span className="h-2.5 w-2.5 rounded-full bg-white" />
            </div>
          </MarkerContent>
        </MapMarker>
      </Map>
    </div>
  );
}
