"use client";

import * as React from "react";
import Link from "next/link";
import { Navigation, Map } from "lucide-react";
import type { ParsedJourneyShare } from "../../lib/post-share-chat";
import { cn } from "../../lib/utils";

type JourneyShareCardProps = {
  share: ParsedJourneyShare;
  /** Message bubble is from current user */
  isSent: boolean;
};

export function JourneyShareCard({ share, isSent }: JourneyShareCardProps) {
  const { journeyId, title, distance, status } = share;
  const journeyHref = `/journeys/${journeyId}`;
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Link
      href={journeyHref}
      className={cn(
        "flex max-w-[min(100%,320px)] items-center gap-3 rounded-2xl border p-3 shadow-md transition-opacity hover:opacity-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-2",
        isSent
          ? "border-white/40 bg-white text-slate-900 shadow-black/10 focus-visible:ring-white dark:border-white/25 dark:bg-zinc-100 dark:text-slate-900"
          : "border-slate-200/90 bg-white text-slate-900 focus-visible:ring-primary dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
      )}
    >
      <div
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15",
          isSent && "bg-slate-200 dark:bg-zinc-700"
        )}
      >
        <Navigation className="h-7 w-7 text-emerald-500" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-50">{title}</p>
        {distance ? (
          <p className="truncate text-xs text-slate-600 dark:text-zinc-400">
            {distance} • {statusLabel}
          </p>
        ) : null}
        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <Map className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
          View Journey
        </span>
      </div>
    </Link>
  );
}
