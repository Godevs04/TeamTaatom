"use client";

import * as React from "react";
import { AdSenseUnit } from "./adsense-unit";
import {
  getAdSenseFeedSlot,
  shouldShowFeedAdPlaceholder,
} from "../../lib/adsense";
import { cn } from "../../lib/utils";

type FeedAdCardProps = {
  adIndex: number;
  className?: string;
  /** Compact variant for denser grids / shorts. */
  compact?: boolean;
};

/**
 * In-feed sponsored unit — AdSense when slot is configured, otherwise a clear
 * sponsored placeholder (dev / until slot IDs are set). Matches mobile native
 * ad card placement cadence, not AdMob UI.
 */
export function FeedAdCard({ adIndex, className, compact }: FeedAdCardProps) {
  const slot = getAdSenseFeedSlot();
  const showPlaceholder = shouldShowFeedAdPlaceholder();

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/70 bg-white/95 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.22)] dark:border-zinc-700/80 dark:bg-zinc-900/90",
        className
      )}
      aria-label={`Sponsored placement ${adIndex + 1}`}
      data-ad-index={adIndex}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-zinc-800">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
          Sponsored
        </p>
        <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500">
          Ad
        </span>
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-3 px-4",
          compact ? "py-6" : "min-h-[220px] py-8"
        )}
      >
        {slot ? (
          <AdSenseUnit
            slot={slot}
            className="w-full max-w-md rounded-xl bg-slate-50/80 p-2 dark:bg-zinc-950/50"
          />
        ) : null}

        {showPlaceholder ? (
          <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-2xl border border-dashed border-emerald-400/35 bg-gradient-to-br from-emerald-500/10 via-slate-50 to-white px-5 py-8 text-center dark:from-emerald-500/15 dark:via-zinc-900 dark:to-zinc-950">
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
              Sponsored on Taatom
            </p>
            <p className="max-w-xs text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
              {slot
                ? "AdSense is loading (often empty on localhost)."
                : "Set NEXT_PUBLIC_ADSENSE_FEED_SLOT for live AdSense units. Shown every 5 posts like mobile."}
            </p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
