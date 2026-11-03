"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Car,
  ChevronLeft,
  ChevronRight,
  Compass,
  Loader2,
  Map as MapIcon,
  Navigation,
  Tag,
} from "lucide-react";
import { getLocaleById, searchPlaceUser, type Locale } from "../../../../lib/api";
import { Button } from "../../../../components/ui/button";
import { Skeleton } from "../../../../components/ui/skeleton";
import { LocaleImage } from "../../../../components/locale/locale-card";
import { LocationPreviewMap } from "@/components/maps/location-preview-map";
import { hasValidCoords } from "@/lib/map-utils";
import { cn } from "../../../../lib/utils";
import { useUserLocation } from "../../../../hooks/use-user-location";
import { useDrivingDistances } from "../../../../hooks/use-driving-distances";
import {
  formatDistanceKm,
  isLocaleSaved,
  isUsableDistance,
  straightLineKm,
  toggleSavedLocale,
} from "../../../../lib/locale-utils";

const AUTO_ADVANCE_MS = 3000;
const SWIPE_THRESHOLD_PX = 40;

/** 280px hero carousel: swipe / arrow keys / dots, auto-advance, image contained (mobile [location].tsx). */
function HeroCarousel({ urls, alt }: { urls: string[]; alt: string }) {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const startX = React.useRef<number | null>(null);
  const count = urls.length;
  const key = urls.join("|");

  React.useEffect(() => setIndex(0), [key]);

  const go = React.useCallback((dir: -1 | 1) => setIndex((i) => (i + dir + count) % count), [count]);

  React.useEffect(() => {
    if (count <= 1 || paused) return;
    const t = window.setInterval(() => go(1), AUTO_ADVANCE_MS);
    return () => window.clearInterval(t);
  }, [count, go, paused]);

  if (count === 0) {
    return <LocaleImage alt={alt} className="h-[280px] w-full rounded-2xl" />;
  }

  return (
    <div
      className="relative h-[280px] w-full overflow-hidden rounded-2xl bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${alt} photos`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
      onPointerDown={(e) => {
        startX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (startX.current == null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > SWIPE_THRESHOLD_PX) go(dx < 0 ? 1 : -1);
      }}
    >
      <LocaleImage src={urls[index]} alt={alt} fit="contain" className="h-full w-full bg-slate-900" />
      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white hover:bg-black/65"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white hover:bg-black/65"
            aria-label="Next photo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {urls.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Photo ${i + 1} of ${count}`}
                aria-current={i === index}
                className={cn("h-2 rounded-full transition-all", i === index ? "w-5 bg-white" : "w-2 bg-white/50")}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-zinc-800/80 dark:bg-zinc-900/90">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-taatom-ocean to-taatom-emerald text-white">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">{label}</p>
        {loading ? (
          <span className="mt-1 block h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
        ) : (
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-50">{value}</p>
        )}
        {hint ? <p className="text-xs text-slate-500 dark:text-zinc-400">{hint}</p> : null}
      </div>
    </div>
  );
}

function geocodeQuery(locale: Locale): string {
  return [locale.name, locale.city, locale.stateProvince, locale.country || locale.countryCode].filter(Boolean).join(", ");
}

export default function LocaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [isBookmarked, setIsBookmarked] = React.useState(false);
  const [geocoding, setGeocoding] = React.useState(false);
  const { coords, permission, request: requestLocation } = useUserLocation();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["locale", id],
    queryFn: () => getLocaleById(id),
    enabled: !!id,
    retry: (failures, err) => !(isAxiosError(err) && err.response?.status === 404) && failures < 2,
  });
  const locale = data?.locale;

  const galleryUrls = React.useMemo(() => {
    const fromGallery = locale?.imageUrls?.filter((u): u is string => typeof u === "string" && u.length > 0);
    if (fromGallery?.length) return fromGallery;
    return locale?.imageUrl ? [locale.imageUrl] : [];
  }, [locale?.imageUrls, locale?.imageUrl]);

  React.useEffect(() => {
    if (locale?._id) setIsBookmarked(isLocaleSaved(locale._id));
  }, [locale?._id]);

  const distanceList = React.useMemo(() => (locale ? [locale] : []), [locale]);
  const { distances, pending } = useDrivingDistances(coords, distanceList);
  const roadKm = locale ? distances[locale._id] : undefined;
  const distanceKm = locale ? (isUsableDistance(roadKm) ? roadKm : straightLineKm(coords, locale)) : null;

  const toggleBookmark = () => {
    if (!locale) return;
    const saved = toggleSavedLocale(locale);
    setIsBookmarked(saved);
    toast.success(saved ? `${locale.name} saved` : `${locale.name} removed from saved`);
  };

  const navigate = async () => {
    if (!locale) return;
    if (hasValidCoords(locale.latitude, locale.longitude)) {
      router.push(`/locale/${locale._id}/navigate`);
      return;
    }
    // No stored coordinates: geocode from name/city/state/country like mobile does.
    setGeocoding(true);
    try {
      const place = await searchPlaceUser(geocodeQuery(locale));
      if (!place) {
        toast.error("Couldn’t find this place on the map.");
        return;
      }
      router.push(`/locale/${locale._id}/navigate?lat=${place.lat}&lng=${place.lng}`);
    } catch {
      toast.error("Couldn’t find this place on the map.");
    } finally {
      setGeocoding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[280px] w-full rounded-2xl" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !locale) {
    const notFound = !isError || (isAxiosError(error) && error.response?.status === 404);
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <p className="text-slate-600 dark:text-zinc-400">
          {notFound ? "Locale not found." : "Couldn’t load this place. Check your connection and try again."}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          {!notFound ? (
            <Button className="gap-2 rounded-xl" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Retry
            </Button>
          ) : null}
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/locale">Back to Locales</Link>
          </Button>
        </div>
      </div>
    );
  }

  const hasCoords = hasValidCoords(locale.latitude, locale.longitude);
  const spotTypes = locale.spotTypes?.filter(Boolean) ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link href="/locale" aria-label="Back to locales">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">{locale.name}</h1>
          <p className="truncate text-sm text-slate-500 dark:text-zinc-400">
            {[locale.city, locale.stateProvince, locale.country || locale.countryCode].filter(Boolean).join(", ")}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleBookmark}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-taatom-ocean to-taatom-emerald text-white shadow hover:opacity-90"
          aria-label={isBookmarked ? "Remove from saved" : "Save locale"}
          aria-pressed={isBookmarked}
        >
          {isBookmarked ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
        </button>
      </div>

      <HeroCarousel urls={galleryUrls} alt={locale.name} />

      <div className="grid gap-3 sm:grid-cols-3">
        <InfoCard
          icon={Compass}
          label="Distance"
          value={distanceKm != null ? formatDistanceKm(distanceKm) : coords ? "Unavailable" : "Location off"}
          hint="from your location"
          loading={!!coords && pending.has(locale._id)}
        />
        <InfoCard icon={Tag} label="Spot Type" value={spotTypes.length ? spotTypes.join(", ") : "General"} />
        <InfoCard icon={Car} label="Travel Info" value={locale.travelInfo || "Drivable"} hint="FROM YOU" />
      </div>
      {!coords && permission !== "denied" && permission !== "unsupported" ? (
        <button
          type="button"
          onClick={() => requestLocation(() => toast.error("Location permission denied."))}
          className="text-sm font-medium text-primary hover:underline"
        >
          Enable location to see distance
        </button>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MapIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-900 dark:text-zinc-50">Explore on Map</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Routes from your location</p>
            </div>
          </div>
          <Button className="gap-2 rounded-xl" onClick={() => void navigate()} disabled={geocoding}>
            {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            Navigate
          </Button>
        </div>
        {hasCoords ? (
          <LocationPreviewMap latitude={locale.latitude as number} longitude={locale.longitude as number} className="h-56 w-full" />
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">About This Place</h2>
        <p className="mt-2 whitespace-pre-line text-[15px] leading-6 text-slate-700 dark:text-zinc-300">
          {locale.description?.trim() || `${locale.name} is a beautiful destination`}
        </p>
      </section>

      <Button className="w-full rounded-xl" variant="outline" asChild>
        <Link href={`/search?q=${encodeURIComponent(locale.name)}`}>Find posts at this place</Link>
      </Button>
    </div>
  );
}
