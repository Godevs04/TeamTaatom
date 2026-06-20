"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import { getLocaleById } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LocaleNavigateMap } from "@/components/maps/locale-navigate-map";
import { hasValidCoords } from "@/lib/map-utils";

export default function LocaleNavigatePage() {
  const params = useParams();
  const id = params.id as string;
  const [userPosition, setUserPosition] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locating, setLocating] = React.useState(true);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["locale", id],
    queryFn: () => getLocaleById(id),
    enabled: !!id,
  });

  const locale = data?.locale;

  React.useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        toast.message("Enable location to see your position on the map.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[min(60vh,480px)] w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !locale) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <p className="text-slate-600 dark:text-zinc-400">Locale not found.</p>
        <Button asChild variant="outline" className="mt-4 rounded-xl">
          <Link href="/locale">Back to Locales</Link>
        </Button>
      </div>
    );
  }

  if (!hasValidCoords(locale.latitude, locale.longitude)) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl" asChild>
            <Link href={`/locale/${id}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-50">{locale.name}</h1>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Map unavailable</p>
          <p className="mt-1 text-sm">This place does not have coordinates yet.</p>
        </div>
      </div>
    );
  }

  const destLat = locale.latitude as number;
  const destLng = locale.longitude as number;

  return (
    <div className="space-y-4 pb-28 lg:pb-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link href={`/locale/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-slate-900 dark:text-zinc-50 md:text-2xl">
            {locale.name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {[locale.city, locale.stateProvince, locale.countryCode].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {locating ? (
        <div className="flex h-[min(60vh,480px)] items-center justify-center rounded-2xl border bg-muted">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <LocaleNavigateMap
          destination={{ lat: destLat, lng: destLng, label: locale.name }}
          userPosition={userPosition}
        />
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-zinc-300">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-primary" />
          {destLat.toFixed(5)}, {destLng.toFixed(5)}
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button className="rounded-xl" asChild>
          <Link href="/navigate" className="inline-flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            Start journey tracking
          </Link>
        </Button>
        <Button variant="outline" className="rounded-xl" asChild>
          <Link href={`/locale/${id}`}>Back to place</Link>
        </Button>
      </div>
    </div>
  );
}
