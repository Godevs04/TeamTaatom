"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { JourneyRouteMap } from "@/components/maps/journey-route-map";
import { journeyGetDetail } from "@/lib/journey-api";
import { createJourneyShortUrl } from "@/lib/api";
import { getDefaultJourneyShareUrl } from "@/lib/post-share-chat";

export default function JourneyDetailClient({ id }: { id: string }) {
  const { data: journey, isLoading, isError } = useQuery({
    queryKey: ["journey-detail", id],
    queryFn: () => journeyGetDetail(id),
    enabled: !!id,
  });
  const [sharing, setSharing] = React.useState(false);

  const start = journey?.startCoords;
  const polyLen = journey?.polyline?.length ?? 0;

  const handleShare = async () => {
    setSharing(true);
    try {
      const shortUrl = await createJourneyShortUrl(id);
      await navigator.clipboard.writeText(shortUrl ?? getDefaultJourneyShareUrl(id));
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-24 lg:pb-10">
      <Link href="/journeys" className="text-sm font-medium text-primary hover:underline">
        ← All journeys
      </Link>
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
        </div>
      )}
      {isError && <p className="text-destructive">Unable to load this journey.</p>}
      {journey && (
        <>
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              {journey.title || "Journey"}
            </h1>
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              aria-label="Copy journey share link"
              title="Copy share link"
              className="mt-1 flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200/80 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{journey.status ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Distance</dt>
                <dd className="font-medium text-slate-900 dark:text-white">
                  {typeof journey.distanceTraveled === "number"
                    ? `${(journey.distanceTraveled / 1000).toFixed(2)} km`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">GPS points</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{polyLen}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Started</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{journey.startedAt ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Completed</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{journey.completedAt ?? "—"}</dd>
              </div>
            </dl>
          </div>
          <JourneyRouteMap
            polyline={journey.polyline}
            startCoords={start ?? null}
          />
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Full route replay works best in the mobile app. On web, tracking runs while this tab stays open with location permission.
          </p>
        </>
      )}
    </div>
  );
}
