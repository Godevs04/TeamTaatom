"use client";

import * as React from "react";
import { Heart, Pause, Play, RotateCcw } from "lucide-react";
import { ShortsSlideMedia } from "./shorts-slide-media";

/** Matches mobile ShortsCellFeed double-tap window. */
const DOUBLE_TAP_MS = 280;

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Video area of one Short (mirrors mobile ShortsCellFeed):
 * - single tap pauses / resumes, double tap likes with a heart burst
 * - scrubbable progress bar for the active slide
 * - "Tap to retry" overlay once playback could not recover
 *
 * Progress state lives here so only the active slide re-renders on timeupdate.
 */
export function ShortVideoStage({
  url,
  poster,
  caption,
  shouldLoad,
  isActive,
  isPaused,
  muted,
  failed,
  onTogglePause,
  onDoubleTapLike,
  onError,
  onRetry,
  onMediaTime,
}: {
  url: string;
  poster: string;
  caption?: string;
  shouldLoad: boolean;
  isActive: boolean;
  isPaused: boolean;
  muted: boolean;
  failed: boolean;
  onTogglePause: () => void;
  onDoubleTapLike: () => void;
  onError: () => void;
  onRetry: () => void;
  onMediaTime?: (currentTime: number) => void;
}) {
  const videoElRef = React.useRef<HTMLVideoElement | null>(null);
  const tapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [feedback, setFeedback] = React.useState<"pause" | "heart" | null>(null);
  const [progress, setProgress] = React.useState({ time: 0, duration: 0 });
  const [scrubbing, setScrubbing] = React.useState(false);

  React.useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), feedback === "heart" ? 700 : 220);
    return () => clearTimeout(timer);
  }, [feedback]);

  // Track progress of the active slide only.
  React.useEffect(() => {
    const el = videoElRef.current;
    if (!el || !isActive) return;
    const sync = () => {
      if (scrubbing) return;
      setProgress({ time: el.currentTime || 0, duration: Number.isFinite(el.duration) ? el.duration : 0 });
    };
    sync();
    el.addEventListener("timeupdate", sync);
    el.addEventListener("loadedmetadata", sync);
    el.addEventListener("durationchange", sync);
    return () => {
      el.removeEventListener("timeupdate", sync);
      el.removeEventListener("loadedmetadata", sync);
      el.removeEventListener("durationchange", sync);
    };
  }, [isActive, scrubbing, url]);

  const handleTap = () => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      onDoubleTapLike();
      setFeedback("heart");
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      onTogglePause();
      setFeedback("pause");
    }, DOUBLE_TAP_MS);
  };

  const seekTo = (value: number) => {
    const el = videoElRef.current;
    setProgress((prev) => ({ ...prev, time: value }));
    if (el && Number.isFinite(value)) el.currentTime = value;
  };

  if (failed) {
    return (
      <div className="relative h-full w-full">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={caption || "Short"} className="h-full w-full object-cover opacity-60" />
        ) : (
          <div className="h-full w-full bg-zinc-800" />
        )}
        <button
          type="button"
          onClick={onRetry}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white"
          aria-label="Retry playing this short"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-black/50 backdrop-blur">
            <RotateCcw className="h-6 w-6" />
          </span>
          <span className="text-sm font-medium">Couldn’t play this short. Tap to retry</span>
        </button>
      </div>
    );
  }

  const duration = progress.duration;

  return (
    <div className="relative h-full w-full">
      <button
        type="button"
        className="relative block h-full w-full cursor-pointer"
        onClick={handleTap}
        aria-label={isPaused ? "Play short (double-click to like)" : "Pause short (double-click to like)"}
      >
        <ShortsSlideMedia
          url={url}
          poster={poster}
          shouldLoad={shouldLoad}
          shouldPlay={isActive && !isPaused}
          muted={muted}
          onMediaTime={onMediaTime}
          onError={onError}
          videoElRef={videoElRef}
        />
        <span
          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
            feedback === "pause" ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/35 bg-black/40 text-white backdrop-blur">
            {isPaused ? <Play className="h-7 w-7" /> : <Pause className="h-7 w-7" />}
          </span>
        </span>
        {feedback === "heart" ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Heart className="h-24 w-24 animate-ping fill-red-500 text-red-500 [animation-iteration-count:1]" />
          </span>
        ) : null}
      </button>

      {isActive && duration > 0 ? (
        <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-1.5">
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={Math.min(progress.time, duration)}
            onPointerDown={() => setScrubbing(true)}
            onPointerUp={() => setScrubbing(false)}
            onChange={(event) => seekTo(Number(event.currentTarget.value))}
            onKeyDown={(event) => event.stopPropagation()}
            aria-label="Seek"
            aria-valuetext={`${formatClock(progress.time)} of ${formatClock(duration)}`}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/30 accent-white"
          />
        </div>
      ) : null}
    </div>
  );
}
