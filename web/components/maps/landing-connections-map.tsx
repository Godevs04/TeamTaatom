"use client";

import Image from "next/image";
import { MapPin } from "lucide-react";
import { Map, MapArc, MapMarker, MarkerContent } from "@/components/ui/map";
import { MapFitBounds } from "./map-fit-bounds";
import { MapPlacesShell } from "./map-places-shell";
import { MAP_ROUTE_COLORS } from "@/lib/osrm-routing";
import { buildHubArcs, placesCenter, placesToLngLat } from "@/lib/locale-map-places";
import { useLocaleMapPlaces } from "@/hooks/useLocaleMapPlaces";

const CONNECTIONS_STOP_COUNT = 4;

type LandingConnectionsMapProps = {
  className?: string;
};

export function LandingConnectionsMap({ className }: LandingConnectionsMapProps) {
  const { data: places = [], isLoading } = useLocaleMapPlaces("connections", CONNECTIONS_STOP_COUNT);
  const arcs = buildHubArcs(places);
  const center = placesCenter(places);

  return (
    <MapPlacesShell className={className} roundedClassName="rounded-[28px]" loading={isLoading} empty={!isLoading && places.length === 0}>
      <div className={className}>
        <Map
          center={center}
          zoom={1.2}
          projection={{ type: "globe" }}
          className="h-full w-full rounded-[28px]"
          theme="dark"
          interactive={false}
          scrollZoom={false}
          dragPan={false}
          dragRotate={false}
          doubleClickZoom={false}
          touchZoomRotate={false}
        >
          <MapFitBounds
            points={placesToLngLat(places)}
            maxZoom={2}
            padding={32}
            defaultCenter={center}
            defaultZoom={1.2}
          />
          {arcs.length > 0 && (
            <MapArc
              data={arcs}
              curvature={0.35}
              paint={{
                "line-color": MAP_ROUTE_COLORS.drive,
                "line-width": 2,
                "line-opacity": 0.75,
                "line-dasharray": [4, 6],
              }}
              interactive={false}
            />
          )}
          {places.map((place) => (
            <MapMarker key={place.id} longitude={place.lng} latitude={place.lat}>
              <MarkerContent>
                <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#1e293b] ring-2 ring-white/80 shadow-lg">
                  {place.imageUrl ? (
                    <Image src={place.imageUrl} alt={place.label} fill className="object-cover" sizes="36px" />
                  ) : (
                    <MapPin className="h-4 w-4 text-white/80" aria-hidden />
                  )}
                </div>
              </MarkerContent>
            </MapMarker>
          ))}
        </Map>
      </div>
    </MapPlacesShell>
  );
}
