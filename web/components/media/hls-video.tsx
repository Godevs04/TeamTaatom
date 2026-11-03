"use client";

import * as React from "react";
import { attachVideoSource, type AttachedVideoSource } from "../../lib/hls-attach";

type HlsVideoProps = Omit<React.VideoHTMLAttributes<HTMLVideoElement>, "src" | "onError"> & {
  src: string;
  /** Called once playback can't recover (after the built-in hls.js retry). */
  onPlaybackError?: () => void;
};

/**
 * Drop-in `<video>` that plays HLS (`.m3u8`) in every browser via hls.js and
 * progressive URLs natively. Use instead of `<video src>` for shorts/videos.
 */
export function HlsVideo({ src, onPlaybackError, ...videoProps }: HlsVideoProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const onErrorRef = React.useRef(onPlaybackError);
  onErrorRef.current = onPlaybackError;

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el || !src) return;
    let cancelled = false;
    let attached: AttachedVideoSource | null = null;

    void attachVideoSource(el, src, {
      onFatal: () => onErrorRef.current?.(),
      isCancelled: () => cancelled,
    }).then((result) => {
      if (cancelled) {
        result?.destroy();
        return;
      }
      attached = result;
    });

    return () => {
      cancelled = true;
      attached?.destroy();
      el.removeAttribute("src");
      el.load();
    };
  }, [src]);

  return <video ref={videoRef} {...videoProps} onError={() => onErrorRef.current?.()} />;
}
