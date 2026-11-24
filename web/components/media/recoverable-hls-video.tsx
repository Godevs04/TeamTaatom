"use client";

import * as React from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { getPostById } from "../../lib/api";
import { isVideoPlaybackReady, isVideoStillProcessing } from "../../lib/shorts-playback";
import { HlsVideo } from "./hls-video";

type RecoverableHlsVideoProps = Omit<
  React.ComponentProps<typeof HlsVideo>,
  "src" | "onPlaybackError"
> & {
  postId: string;
  src: string;
  poster?: string;
  playbackReady?: boolean;
  storageKey?: string | null;
};

/**
 * Feed/trip embed recovery for shorts (and any progressive→HLS post video):
 * soft-fail while processing, refetch fresh URLs, remount when HLS lands.
 */
export function RecoverableHlsVideo({
  postId,
  src,
  poster,
  playbackReady,
  storageKey,
  className,
  ...videoProps
}: RecoverableHlsVideoProps) {
  const [url, setUrl] = React.useState(src);
  const [ready, setReady] = React.useState(playbackReady);
  const [key, setKey] = React.useState(storageKey ?? null);
  const [failed, setFailed] = React.useState(false);
  const [processing, setProcessing] = React.useState(
    () =>
      isVideoStillProcessing({
        playbackReady,
        storageKey,
        videoUrl: src,
      })
  );
  const [epoch, setEpoch] = React.useState(0);
  const retriedRef = React.useRef(false);

  React.useEffect(() => {
    setUrl(src);
    setReady(playbackReady);
    setKey(storageKey ?? null);
    setProcessing(
      isVideoStillProcessing({
        playbackReady,
        storageKey,
        videoUrl: src,
      })
    );
  }, [src, playbackReady, storageKey]);

  const refresh = React.useCallback(async () => {
    try {
      const fresh = await getPostById(postId);
      const nextUrl = fresh.videoUrl || fresh.mediaUrl || url;
      setUrl(nextUrl);
      setReady(fresh.playbackReady);
      setKey(fresh.storageKey ?? null);
      if (isVideoPlaybackReady(fresh)) {
        setProcessing(false);
        setFailed(false);
        setEpoch((n) => n + 1);
        return true;
      }
      if (fresh.playbackReady === false || isVideoStillProcessing(fresh)) {
        setProcessing(true);
        setFailed(false);
        return false;
      }
      setEpoch((n) => n + 1);
      return true;
    } catch {
      return false;
    }
  }, [postId, url]);

  React.useEffect(() => {
    if (!processing) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt > 120000) {
        setProcessing(false);
        setFailed(true);
        return;
      }
      void refresh();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [processing, refresh]);

  const onError = () => {
    if (
      isVideoStillProcessing({ playbackReady: ready, storageKey: key, videoUrl: url }) ||
      ready === false
    ) {
      setProcessing(true);
      setFailed(false);
      void refresh();
      return;
    }
    if (!retriedRef.current) {
      retriedRef.current = true;
      void refresh().then((ok) => {
        if (!ok) setFailed(true);
      });
      return;
    }
    setFailed(true);
  };

  if (failed && !processing) {
    return (
      <div className={`relative flex items-center justify-center bg-black ${className || ""}`}>
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        ) : null}
        <button
          type="button"
          className="relative z-10 flex flex-col items-center gap-2 text-white"
          onClick={() => {
            retriedRef.current = false;
            setFailed(false);
            void refresh();
          }}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/35 bg-black/50">
            <RotateCcw className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium">Couldn’t play. Tap to retry</span>
        </button>
      </div>
    );
  }

  if (processing) {
    return (
      <div className={`relative flex items-center justify-center bg-black ${className || ""}`}>
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        ) : null}
        <div className="relative z-10 flex flex-col items-center gap-2 text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm font-medium">Processing video…</span>
        </div>
      </div>
    );
  }

  return (
    <HlsVideo
      key={`${postId}-${epoch}`}
      src={url}
      poster={poster}
      className={className}
      onPlaybackError={onError}
      {...videoProps}
    />
  );
}
