"use client";

import Script from "next/script";
import { useRef, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getCountryCenter,
  getCountryDelta,
  getMarkerCoordinates,
  type MapLocation,
} from "../../lib/country-map-utils";

const SCRIPT_ID = "google-maps-tripscore";

type GeocodePlace = {
  center: { lat: number; lng: number };
  viewport: { ne: { lat: number; lng: number }; sw: { lat: number; lng: number } };
};

type CountryMapClientProps = {
  countryName: string;
  locations: MapLocation[];
  backHref: string;
  backLabel: string;
};

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (el: HTMLElement, opts: unknown) => { fitBounds: (b: unknown) => void };
        LatLngBounds: new () => {
          extend: (p: { lat: number; lng: number }) => void;
          getNorthEast: () => { lat: () => number; lng: () => number };
          getSouthWest: () => { lat: () => number; lng: () => number };
        };
        InfoWindow: new () => { setContent: (c: string) => void; open: (map: unknown, marker: unknown) => void };
        Marker: new (opts: unknown) => { addListener: (event: string, fn: () => void) => void };
        Size: new (w: number, h: number) => unknown;
      };
    };
  }
}

type GeocodeResponse = {
  results?: Array<{
    geometry?: {
      location?: { lat: number; lng: number };
      viewport?: {
        northeast: { lat: number; lng: number };
        southwest: { lat: number; lng: number };
      };
    };
  }>;
};

function fetchPlaceFromEnv(
  apiKey: string,
  countryName: string
): Promise<GeocodePlace | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(countryName)}&key=${apiKey}`;
  return fetch(url)
    .then((r) => r.json())
    .then((data: GeocodeResponse) => {
      const first = data.results?.[0]?.geometry;
      if (!first?.location) return null;
      const viewport = first.viewport;
      if (!viewport?.northeast || !viewport?.southwest) return null;
      return {
        center: { lat: first.location.lat, lng: first.location.lng },
        viewport: {
          ne: { lat: viewport.northeast.lat, lng: viewport.northeast.lng },
          sw: { lat: viewport.southwest.lat, lng: viewport.southwest.lng },
        },
      };
    })
    .catch(() => null);
}

export function CountryMapClient({
  countryName,
  locations,
  backHref,
  backLabel,
}: CountryMapClientProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const initRanRef = useRef(false);
  const initMapRef = useRef<() => void>(() => {});
  const geocodeRef = useRef<GeocodePlace | null | undefined>(undefined);

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [geocodeDone, setGeocodeDone] = useState(false);

  const apiKey =
    typeof process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === "string"
      ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      : "";

  useEffect(() => {
    if (!apiKey || !countryName) {
      setGeocodeDone(true);
      return;
    }
    let cancelled = false;
    fetchPlaceFromEnv(apiKey, countryName).then((place) => {
      if (cancelled) return;
      geocodeRef.current = place;
      setGeocodeDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, [apiKey, countryName]);

  const initMap = useCallback(() => {
    const g = window.google;
    if (initRanRef.current || !mapRef.current || !g) return;
    initRanRef.current = true;

    const place = geocodeRef.current;
    let center: { lat: number; lng: number };
    let useViewport = false;
    let viewport: GeocodePlace["viewport"] | null = null;
    const delta = getCountryDelta(countryName);
    const defaultZoom = Math.max(4, Math.min(10, Math.log2(360 / delta.latitudeDelta)));

    if (place) {
      center = place.center;
      viewport = place.viewport;
      useViewport = true;
    } else {
      const staticCenter = getCountryCenter(countryName);
      center = { lat: staticCenter.latitude, lng: staticCenter.longitude };
    }

    const map = new g.maps.Map(mapRef.current, {
      center,
      zoom: useViewport ? 4 : Math.round(defaultZoom),
      mapTypeId: "terrain",
    });

    if (useViewport && viewport) {
      const bounds = new g.maps.LatLngBounds();
      bounds.extend(viewport.sw);
      bounds.extend(viewport.ne);
      map.fitBounds(bounds);
    }

    const bounds = new g.maps.LatLngBounds();
    const infoWindow = new g.maps.InfoWindow();

    locations.forEach((loc, i) => {
      const coords = getMarkerCoordinates(loc, countryName, i);
      const position = { lat: coords.latitude, lng: coords.longitude };

      const marker = new g.maps.Marker({
        position,
        map,
        title: loc.name,
        icon: {
          url: "data:image/svg+xml;utf-8,<svg width=\"30\" height=\"30\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"15\" cy=\"15\" r=\"12\" fill=\"white\" stroke=\"%23FF5722\" stroke-width=\"2\"/><text x=\"15\" y=\"20\" font-size=\"16\" text-anchor=\"middle\" fill=\"%23FF5722\">🏳</text></svg>",
          scaledSize: new g.maps.Size(30, 30),
        },
      });

      marker.addListener("click", () => {
        infoWindow.setContent(
          `<div style="padding:8px;min-width:120px;"><strong>${escapeHtml(loc.name)}</strong><br/>Score: ${loc.score}</div>`
        );
        infoWindow.open(map, marker);
      });

      bounds.extend(position);
    });

    if (locations.length > 1) {
      map.fitBounds(bounds);
    }
  }, [countryName, locations]);

  initMapRef.current = initMap;

  useEffect(() => {
    if (scriptLoaded && geocodeDone) {
      initMapRef.current();
    }
  }, [scriptLoaded, geocodeDone]);

  if (!apiKey) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center text-sm font-medium text-sky-600 hover:underline"
        >
          ← {backLabel}
        </Link>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <p className="font-medium">Map unavailable</p>
          <p className="mt-1 text-sm">
            Configure <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to view the map.
          </p>
        </div>
        {locations.length > 0 && (
          <ul className="space-y-2">
            {locations.map((loc, i) => {
              const coords = getMarkerCoordinates(loc, countryName, i);
              const mapsUrl = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
              return (
                <li key={`${loc.name}-${i}`}>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-slate-200 bg-white p-3 text-slate-700 hover:bg-slate-50"
                  >
                    <span className="font-medium">{loc.name}</span>
                    <span className="ml-2 text-sm text-slate-500">
                      Score: {loc.score}
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

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center text-sm font-medium text-sky-600 hover:underline"
      >
        ← {backLabel}
      </Link>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        <div
          ref={mapRef}
          className="h-[min(70vh,600px)] w-full"
          style={{ minHeight: 320 }}
        />
      </div>
      <Script
        id={SCRIPT_ID}
        src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}`}
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
    </div>
  );
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
