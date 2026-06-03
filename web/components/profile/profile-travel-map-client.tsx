"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getTravelMapData } from "@/lib/api";
import { CountryMapClient } from "@/components/profile/CountryMapClient";
import type { MapLocation } from "@/lib/country-map-utils";

type Props = {
  userId: string;
  backHref: string;
  backLabel: string;
};

function toMapLocations(
  locations: Array<{
    latitude: number;
    longitude: number;
    address?: string;
    date?: string;
    number?: number;
  }>
): MapLocation[] {
  return locations.map((loc, idx) => ({
    name: loc.address || `Place ${loc.number ?? idx + 1}`,
    score: 1,
    date: loc.date || "",
    coordinates: { latitude: loc.latitude, longitude: loc.longitude },
  }));
}

export function ProfileTravelMapClient({ userId, backHref, backLabel }: Props) {
  const q = useQuery({
    queryKey: ["travel-map", userId],
    queryFn: () => getTravelMapData(userId),
  });

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const locations = toMapLocations(q.data?.locations ?? []);
  const stats = q.data?.statistics;

  if (locations.length === 0) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-slate-500 dark:text-zinc-400">No verified places on the travel map yet.</p>
        <Link href={backHref} className="text-sm font-medium text-primary hover:underline">
          {backLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats && stats.totalLocations > 0 && (
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          {stats.totalLocations} places
          {stats.totalDistance > 0 ? ` · ~${stats.totalDistance.toLocaleString()} km traveled` : ""}
        </p>
      )}
      <CountryMapClient
        countryName="World"
        locations={locations}
        backHref={backHref}
        backLabel={backLabel}
      />
    </div>
  );
}
