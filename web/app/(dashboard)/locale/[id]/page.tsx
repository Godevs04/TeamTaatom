"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getLocaleById, type Locale } from "../../../../lib/api";
import { STORAGE_KEYS } from "../../../../lib/constants";
import { Button } from "../../../../components/ui/button";
import { MapPin, ArrowLeft, Navigation, Bookmark, BookmarkCheck } from "lucide-react";
import { Skeleton } from "../../../../components/ui/skeleton";

function getSavedLocales(): Locale[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.savedLocaleIds);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setSavedLocales(list: Locale[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.savedLocaleIds, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function getMapsUrl(locale: {
  name: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  stateProvince?: string;
  countryCode?: string;
}): string {
  const hasCoords =
    typeof locale.latitude === "number" &&
    typeof locale.longitude === "number" &&
    locale.latitude !== 0 &&
    locale.longitude !== 0;
  if (hasCoords) {
    return `https://www.google.com/maps?q=${locale.latitude},${locale.longitude}`;
  }
  const query = [locale.name, locale.city, locale.stateProvince, locale.countryCode]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function LocaleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [isBookmarked, setIsBookmarked] = React.useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["locale", id],
    queryFn: () => getLocaleById(id),
    enabled: !!id,
  });

  const locale = data?.locale;

  React.useEffect(() => {
    if (!locale?._id) return;
    const saved = getSavedLocales();
    setIsBookmarked(saved.some((l) => l._id === locale._id));
  }, [locale?._id]);

  const toggleBookmark = React.useCallback(() => {
    if (!locale) return;
    const list = getSavedLocales();
    const idx = list.findIndex((l) => l._id === locale._id);
    if (idx >= 0) {
      list.splice(idx, 1);
      setIsBookmarked(false);
    } else {
      list.push(locale);
      setIsBookmarked(true);
    }
    setSavedLocales(list);
  }, [locale]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !locale) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium">
        <p className="text-slate-600">Locale not found.</p>
        <Button asChild variant="outline" className="mt-4 rounded-xl">
          <Link href="/locale">Back to Locales</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link href="/locale">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="flex-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{locale.name}</h1>
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl"
          onClick={toggleBookmark}
          aria-label={isBookmarked ? "Remove from saved" : "Save locale"}
        >
          {isBookmarked ? (
            <BookmarkCheck className="h-5 w-5 text-primary" />
          ) : (
            <Bookmark className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-premium">
        <div className="aspect-[4/3] w-full bg-slate-100">
          {locale.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={locale.imageUrl} alt={locale.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <MapPin className="h-16 w-16" />
            </div>
          )}
        </div>
        <div className="p-6">
          <p className="text-sm font-medium text-slate-500">
            {[locale.stateProvince, locale.stateCode, locale.countryCode].filter(Boolean).join(" · ") || locale.countryCode}
            {locale.city ? ` · ${locale.city}` : ""}
          </p>
          {locale.description && <p className="mt-3 text-[15px] leading-6 text-slate-700">{locale.description}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" className="rounded-xl" asChild>
              <a
                href={getMapsUrl(locale)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                <Navigation className="h-4 w-4" />
                Navigate
              </a>
            </Button>
            <Button className="rounded-xl" asChild>
              <Link href={`/search?q=${encodeURIComponent(locale.name)}`}>
                Find posts at this place
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
