"use client";

import { LocationPreviewMap } from "@/components/maps/location-preview-map";

type TripLocationMapProps = {
  latitude: number;
  longitude: number;
  label: string;
};

export function TripLocationMap({ latitude, longitude, label }: TripLocationMapProps) {
  return (
    <div>
      <LocationPreviewMap latitude={latitude} longitude={longitude} />
      <div className="mt-3 text-sm">
        <a
          className="font-semibold text-primary hover:underline"
          href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=14/${latitude}/${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open {label} in OpenStreetMap
        </a>
      </div>
    </div>
  );
}
