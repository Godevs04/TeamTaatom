"use client";

import { Map, MapArc, MapMarker, MarkerContent } from "@/components/ui/map";
import { MapFitBounds } from "./map-fit-bounds";
import { MapPlacesShell } from "./map-places-shell";
import { MAP_ROUTE_COLORS } from "@/lib/osrm-routing";
import { buildSequentialArcs, placesCenter, placesToLngLat } from "@/lib/locale-map-places";
import { useLocaleMapPlaces } from "@/hooks/useLocaleMapPlaces";

const FEATURE_STOP_COUNT = 3;

export function FeatureRouteMap({ className }: { className?: string }) {
  const { data: places = [], isLoading } = useLocaleMapPlaces("feature", FEATURE_STOP_COUNT);
  const arcs = buildSequentialArcs(places);
  const center = placesCenter(places);

  return (
    <MapPlacesShell className={className} roundedClassName="rounded-[1.5rem]" loading={isLoading} empty={!isLoading && places.length === 0}>
      <div className={className}>
        <Map
          center={center}
          zoom={1.5}
          className="h-full w-full rounded-[1.5rem]"
          interactive={false}
          scrollZoom={false}
          dragPan={false}
          dragRotate={false}
          doubleClickZoom={false}
          touchZoomRotate={false}
        >
          <MapFitBounds
            points={placesToLngLat(places)}
            maxZoom={3}
            padding={40}
            defaultCenter={center}
            defaultZoom={1.5}
          />
          {arcs.length > 0 && (
            <MapArc
              data={arcs}
              curvature={0.35}
              paint={{
                "line-color": MAP_ROUTE_COLORS.landing,
                "line-width": 3,
                "line-opacity": 0.85,
                "line-dasharray": [6, 8],
              }}
              interactive={false}
            />
          )}
          {places.map((stop) => (
            <MapMarker key={stop.id} longitude={stop.lng} latitude={stop.lat}>
              <MarkerContent>
                <span className="whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--landing-ink)] shadow-md">
                  {stop.label}
                </span>
              </MarkerContent>
            </MapMarker>
          ))}
        </Map>
      </div>
    </MapPlacesShell>
  );
}
