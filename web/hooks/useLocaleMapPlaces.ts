"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchLocaleMapPlaces, type LocaleMapMode } from "@/lib/locale-map-places";

const STALE_MS = 5 * 60 * 1000;

export function useLocaleMapPlaces(mode: LocaleMapMode, count: number) {
  return useQuery({
    queryKey: ["locale-map-places", mode, count],
    queryFn: () => fetchLocaleMapPlaces(mode, count),
    staleTime: STALE_MS,
    gcTime: 30 * 60 * 1000,
  });
}
