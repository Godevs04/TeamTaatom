"use client";

import * as React from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import {
  Map,
  MapClusterLayer,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerPopup,
} from "@/components/ui/map";
import type { MapLocation } from "@/lib/country-map-utils";
import {
  getDefaultZoom,
  getMapCenter,
  locationsToGeoJSON,
  locationsToLngLat,
} from "@/lib/map-utils";
import { MapFitBounds } from "./map-fit-bounds";

type CountryMapViewProps = {
  countryName: string;
  locations: MapLocation[];
  backHref: string;
  backLabel: string;
};

function ScoreMarker({ score }: { score: number }) {
  return (
    <div className="flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white bg-[#FF5722] px-1.5 text-[11px] font-bold text-white shadow-md">
      {score}
    </div>
  );
}

export function CountryMapView({
  countryName,
  locations,
  backHref,
  backLabel,
}: CountryMapViewProps) {
  const isWorld = countryName.toLowerCase() === "world";
  const useClusters = isWorld && locations.length > 8;
  const points = React.useMemo(
    () => locationsToLngLat(locations, countryName).map((x) => x.coord),
    [locations, countryName]
  );
  const defaultCenter = React.useMemo(() => getMapCenter(countryName), [countryName]);
  const defaultZoom = React.useMemo(() => getDefaultZoom(countryName), [countryName]);
  const clusterData = React.useMemo(
    () => locationsToGeoJSON(locations, countryName),
    [locations, countryName]
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
      >
        ← {backLabel}
      </Link>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800/60">
        <Map
          center={defaultCenter}
          zoom={defaultZoom}
          className="h-[min(70vh,600px)] min-h-[320px] w-full"
        >
          <MapControls position="top-right" showZoom showLocate showFullscreen />
          <MapFitBounds
            points={points}
            defaultCenter={defaultCenter}
            defaultZoom={defaultZoom}
            maxZoom={isWorld ? 8 : 12}
          />

          {useClusters ? (
            <MapClusterLayer
              data={clusterData}
              clusterColors={["#5b6cff", "#3b82f6", "#1d4ed8"]}
              pointColor="#FF5722"
            />
          ) : (
            locationsToLngLat(locations, countryName).map(({ loc, coord, index }) => (
              <MapMarker key={`${loc.name}-${index}`} longitude={coord[0]} latitude={coord[1]}>
                <MarkerContent>
                  <ScoreMarker score={loc.score} />
                </MarkerContent>
                <MarkerPopup closeButton>
                  <div className="min-w-[140px] rounded-xl border bg-card p-3 shadow-lg">
                    <p className="font-semibold text-foreground">{loc.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Score: {loc.score}</p>
                    {loc.caption ? (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{loc.caption}</p>
                    ) : null}
                  </div>
                </MarkerPopup>
              </MapMarker>
            ))
          )}
        </Map>
      </div>

      {locations.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {locations.map((loc, i) => {
            const { coord } = locationsToLngLat(locations, countryName)[i];
            return (
              <li key={`${loc.name}-${i}`}>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${coord[1]}&mlon=${coord[0]}#map=14/${coord[1]}/${coord[0]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{loc.name}</span>
                    <span className="text-sm text-slate-500 dark:text-zinc-400">Score: {loc.score}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
