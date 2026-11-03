"use client";

import * as React from "react";
import Link from "next/link";
import { BookmarkMinus, ImageOff, MapPin } from "lucide-react";
import type { Locale } from "../../lib/api";
import { formatDistanceKm } from "../../lib/locale-utils";
import { cn } from "../../lib/utils";

/** Locale image with loading shimmer and broken-image fallback (mobile locale.tsx image states). */
export function LocaleImage({ src, alt, className, fit = "cover" }: { src?: string; alt: string; className?: string; fit?: "cover" | "contain" }) {
  const [state, setState] = React.useState<"loading" | "loaded" | "error">(src ? "loading" : "error");
  React.useEffect(() => setState(src ? "loading" : "error"), [src]);
  return (
    <div className={cn("relative overflow-hidden bg-slate-200 dark:bg-zinc-800", className)}>
      {state === "loading" ? <div className="absolute inset-0 animate-pulse bg-slate-300/60 dark:bg-zinc-700/60" /> : null}
      {state === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500">
          {src ? <ImageOff className="h-10 w-10" /> : <MapPin className="h-10 w-10" />}
        </div>
      ) : null}
      {src && state !== "error" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          className={cn("h-full w-full transition-opacity", fit === "contain" ? "object-contain" : "object-cover", state === "loaded" ? "opacity-100" : "opacity-0")}
        />
      ) : null}
    </div>
  );
}

/**
 * Full-width 16:10 locale card (mobile locale.tsx LocaleCard): image with a dark
 * translucent bar — name + country code on the left, distance pill on the right.
 */
export function LocaleCard({
  locale,
  distanceKm,
  distanceLoading,
  showDescription,
  onUnsave,
}: {
  locale: Locale;
  distanceKm: number | null;
  distanceLoading?: boolean;
  /** Saved tab shows the description line. */
  showDescription?: boolean;
  onUnsave?: () => void;
}) {
  return (
    <Link
      href={`/locale/${locale._id}`}
      className="group relative block overflow-hidden rounded-2xl shadow-soft transition-shadow hover:shadow-card"
    >
      <LocaleImage
        src={locale.imageUrl || locale.imageUrls?.[0]}
        alt={locale.name}
        className="aspect-[16/10] w-full [&_img]:transition-transform [&_img]:duration-700 group-hover:[&_img]:scale-105"
      />
      {onUnsave ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onUnsave();
          }}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/55 p-2 text-white backdrop-blur hover:bg-black/75"
          aria-label={`Remove ${locale.name} from saved`}
        >
          <BookmarkMinus className="h-4 w-4" />
        </button>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-black/55 px-4 py-3 backdrop-blur-sm">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-white">{locale.name}</h3>
          <p className="truncate text-xs font-medium text-white/80">{locale.countryCode}</p>
          {showDescription && locale.description ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-white/70">{locale.description}</p>
          ) : null}
        </div>
        {distanceLoading ? (
          <span className="h-6 w-20 shrink-0 animate-pulse rounded-full bg-white/25" aria-label="Calculating distance" />
        ) : distanceKm != null ? (
          <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">
            {formatDistanceKm(distanceKm)}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
