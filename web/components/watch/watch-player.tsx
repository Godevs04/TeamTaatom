"use client";

import * as React from "react";
import { Maximize2, Minimize2, Pause, Play, RotateCcw } from "lucide-react";
import { AdSenseUnit } from "../ads/adsense-unit";
import {
  getAdSenseWatchBreakSlot,
  shouldShowWatchAdPlaceholder,
} from "../../lib/adsense";
import {
  buildLongVideoAdSchedule,
  type AdSlot,
} from "../../lib/long-video-ad-schedule";
import {
  shouldAttemptWatchAdBreak,
  WATCH_AD_BREAK_TIMEOUT_MS,
} from "../../lib/long-video-ads";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export type WatchPlayerSchedule = { slots?: AdSlot[] } | null | undefined;

type WatchPlayerProps = {
  videoUrl: string;
  posterUrl?: string;
  durationSeconds?: number | null;
  adSchedule?: WatchPlayerSchedule;
  className?: string;
  onRetry?: () => void;
};

type HlsLike = {
  destroy: () => void;
  loadSource: (url: string) => void;
  attachMedia: (media: HTMLMediaElement) => void;
  on: (event: string, cb: (event: unknown, data: { fatal?: boolean }) => void) => void;
};

function formatDuration(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(Number(seconds))) return "0:00";
  const s = Math.max(0, Math.floor(Number(seconds)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function isHlsUrl(url: string): boolean {
  return /hls=master|\.m3u8|ext=\.m3u8/i.test(url);
}

export function WatchPlayer({
  videoUrl,
  posterUrl,
  durationSeconds,
  adSchedule,
  className,
  onRetry,
}: WatchPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const hlsRef = React.useRef<HlsLike | null>(null);
  const firedSlotsRef = React.useRef<Set<number>>(new Set());
  const prerollDoneRef = React.useRef(false);
  const resumeAtRef = React.useRef(0);
  const chromeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const adBusyRef = React.useRef(false);

  const [paused, setPaused] = React.useState(true);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [chromeVisible, setChromeVisible] = React.useState(true);
  const [adBusy, setAdBusy] = React.useState(false);
  const [playbackError, setPlaybackError] = React.useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [playerEpoch, setPlayerEpoch] = React.useState(0);

  const slots = React.useMemo(() => {
    const fromApi = adSchedule?.slots;
    const built =
      Array.isArray(fromApi) && fromApi.length
        ? fromApi
        : buildLongVideoAdSchedule(durationSeconds || 0).slots;
    // Always keep a preroll gate when ads are enabled.
    if (!built.some((s) => s.atSeconds === 0)) {
      return [{ atSeconds: 0 as const, type: "rewarded" as const, preferRewarded: true }, ...built];
    }
    return built;
  }, [adSchedule, durationSeconds]);

  const totalDuration = duration || Number(durationSeconds) || 0;
  const progressPct =
    totalDuration > 0 ? Math.min(100, Math.round((currentTime / totalDuration) * 100)) : 0;

  const bumpChrome = React.useCallback(() => {
    setChromeVisible(true);
    if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
    chromeTimerRef.current = setTimeout(() => {
      if (!paused && !adBusyRef.current) setChromeVisible(false);
    }, 2800);
  }, [paused]);

  const runAdSlot = React.useCallback(async () => {
    if (!shouldAttemptWatchAdBreak()) return "skipped" as const;
    setAdBusy(true);
    adBusyRef.current = true;
    videoRef.current?.pause();
    setPaused(true);
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("taatom-watch-ad-continue", onContinue);
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") done();
      };
      const onContinue = () => done();
      const timer = setTimeout(done, WATCH_AD_BREAK_TIMEOUT_MS);
      window.addEventListener("keydown", onKey);
      window.addEventListener("taatom-watch-ad-continue", onContinue);
    });
    setAdBusy(false);
    adBusyRef.current = false;
    return "completed" as const;
  }, []);

  const finishAdContinue = React.useCallback(() => {
    window.dispatchEvent(new Event("taatom-watch-ad-continue"));
  }, []);

  const runPreroll = React.useCallback(async () => {
    if (prerollDoneRef.current) return;
    const pre = slots.find((s) => s.atSeconds === 0);
    if (!pre) {
      prerollDoneRef.current = true;
      setPaused(false);
      bumpChrome();
      return;
    }
    await runAdSlot();
    firedSlotsRef.current.add(0);
    prerollDoneRef.current = true;
    setPaused(false);
    bumpChrome();
    void videoRef.current?.play().catch(() => setPaused(true));
  }, [slots, runAdSlot, bumpChrome]);

  const maybeFireMidroll = React.useCallback(
    async (t: number) => {
      if (adBusyRef.current || !prerollDoneRef.current) return;
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (slot.atSeconds === 0 || slot.atSeconds === "end") continue;
        if (typeof slot.atSeconds !== "number") continue;
        if (firedSlotsRef.current.has(i)) continue;
        if (t >= slot.atSeconds) {
          firedSlotsRef.current.add(i);
          resumeAtRef.current = t;
          await runAdSlot();
          const el = videoRef.current;
          if (el) {
            try {
              el.currentTime = resumeAtRef.current;
            } catch {
              /* ignore */
            }
            void el.play().catch(() => setPaused(true));
            setPaused(false);
          }
          bumpChrome();
          break;
        }
      }
    },
    [slots, runAdSlot, bumpChrome]
  );

  const onEnded = React.useCallback(async () => {
    const endIdx = slots.findIndex((s) => s.atSeconds === "end");
    if (endIdx >= 0 && !firedSlotsRef.current.has(endIdx)) {
      firedSlotsRef.current.add(endIdx);
      await runAdSlot();
    }
    setPaused(true);
    setChromeVisible(true);
  }, [slots, runAdSlot]);

  // Attach media source (HLS or progressive). Dynamic-import hls.js to avoid
  // Next/webpack CJS interop crashes (TypeError reading 'call').
  React.useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoUrl) return;

    let cancelled = false;
    setPlaybackError(null);
    prerollDoneRef.current = false;
    firedSlotsRef.current = new Set();

    const cleanupHls = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    cleanupHls();

    const setup = async () => {
      if (isHlsUrl(videoUrl)) {
        if (el.canPlayType("application/vnd.apple.mpegurl")) {
          el.src = videoUrl;
        } else {
          try {
            const mod = await import("hls.js");
            if (cancelled) return;
            const HlsCtor = (mod.default || mod) as {
              isSupported: () => boolean;
              Events: { ERROR: string };
              new (config?: { enableWorker?: boolean }): HlsLike;
            };
            if (!HlsCtor.isSupported()) {
              setPlaybackError("HLS is not supported in this browser.");
              return;
            }
            const hls = new HlsCtor({ enableWorker: true });
            hlsRef.current = hls;
            hls.loadSource(videoUrl);
            hls.attachMedia(el);
            hls.on(HlsCtor.Events.ERROR, (_e, data) => {
              if (data?.fatal) {
                setPlaybackError("Couldn’t load this stream. Tap retry.");
                setPaused(true);
              }
            });
          } catch {
            if (!cancelled) {
              setPlaybackError("Couldn’t load this stream. Tap retry.");
              setPaused(true);
            }
            return;
          }
        }
      } else {
        el.src = videoUrl;
      }

      if (!cancelled) void runPreroll();
    };

    void setup();

    return () => {
      cancelled = true;
      cleanupHls();
      el.removeAttribute("src");
      el.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount via playerEpoch
  }, [videoUrl, playerEpoch]);

  React.useEffect(() => {
    return () => {
      if (chromeTimerRef.current) clearTimeout(chromeTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (paused || adBusy) {
      el.pause();
    } else {
      void el.play().catch(() => setPaused(true));
    }
  }, [paused, adBusy]);

  const togglePlay = () => {
    if (adBusy) return;
    setPaused((p) => {
      const next = !p;
      if (!next) bumpChrome();
      else setChromeVisible(true);
      return next;
    });
  };

  const onPlayerClick = () => {
    if (!chromeVisible) {
      bumpChrome();
      return;
    }
    togglePlay();
  };

  const toggleFullscreen = async () => {
    const root = rootRef.current;
    if (!root) return;
    try {
      if (!document.fullscreenElement) {
        await root.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  };

  const handleRetry = () => {
    setPlaybackError(null);
    firedSlotsRef.current = new Set();
    prerollDoneRef.current = true;
    setPaused(false);
    setPlayerEpoch((n) => n + 1);
    onRetry?.();
  };

  const watchSlot = getAdSenseWatchBreakSlot();
  const showPlaceholder = shouldShowWatchAdPlaceholder();

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-slate-200/80 dark:ring-zinc-800",
        className
      )}
    >
      <video
        key={`watch-video-${playerEpoch}`}
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-contain"
        poster={posterUrl}
        playsInline
        preload="metadata"
        onClick={onPlayerClick}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrentTime(t);
          void maybeFireMidroll(t);
        }}
        onEnded={() => void onEnded()}
        onError={() => {
          setPlaybackError("Couldn’t play this video. Tap retry.");
          setPaused(true);
          setChromeVisible(true);
        }}
      />

      {adBusy ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 px-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
            Advertisement
          </p>
          {watchSlot ? (
            <AdSenseUnit
              slot={watchSlot}
              format="fluid"
              layout="in-article"
              className="w-full max-w-md rounded-xl bg-white/5 p-2"
            />
          ) : null}
          {showPlaceholder ? (
            <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-white/15 bg-gradient-to-br from-emerald-500/20 via-slate-900 to-slate-950 px-6 py-8 text-center shadow-lg">
              <p className="text-lg font-semibold tracking-tight text-white">Sponsored break</p>
              <p className="max-w-xs text-sm leading-relaxed text-white/75">
                {watchSlot
                  ? "AdSense is loading (often empty on localhost). Continue to resume the video."
                  : "Dev placeholder — set NEXT_PUBLIC_ADSENSE_WATCH_BREAK_SLOT for live units."}
              </p>
            </div>
          ) : null}
          <Button type="button" variant="secondary" size="sm" onClick={finishAdContinue}>
            Continue watching
          </Button>
        </div>
      ) : null}

      {playbackError && !adBusy ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/75 px-6 text-center">
          <p className="text-sm font-semibold text-white">{playbackError}</p>
          <Button type="button" size="sm" onClick={handleRetry} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      ) : null}

      {!adBusy && chromeVisible ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-10">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25"
              aria-label={paused ? "Play" : "Pause"}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <span className="min-w-[4.5rem] text-xs font-semibold tabular-nums text-white/90">
              {formatDuration(Math.floor(currentTime))}
              {totalDuration ? ` / ${formatDuration(totalDuration)}` : ""}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${Math.max(1.5, progressPct)}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
