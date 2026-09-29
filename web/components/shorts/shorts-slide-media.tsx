"use client";

import * as React from "react";
import type { Post } from "../../types/post";

type HlsLike = {
  destroy: () => void;
  loadSource: (url: string) => void;
  attachMedia: (el: HTMLMediaElement) => void;
  stopLoad: () => void;
  startLoad: (startPosition?: number) => void;
  on: (event: string, cb: (event: string, data: { fatal?: boolean }) => void) => void;
};

function isHlsUrl(url: string): boolean {
  return /hls=master|\.m3u8|ext=\.m3u8/i.test(url);
}

export function shortHasLibrarySong(short: Post): boolean {
  const songId = short.song?.songId;
  if (!songId) return false;
  if (typeof songId === "string") return songId.length > 0;
  return Boolean(songId._id);
}

export function getLibraryTrack(short: Post): { url: string; start: number; end: number; volume: number } | null {
  const song = short.song;
  if (!song || !shortHasLibrarySong(short)) return null;
  const populated = typeof song.songId === "object" && song.songId ? song.songId : null;
  const url = populated?.s3Url || populated?.cloudinaryUrl || song.s3Url || song.cloudinaryUrl || "";
  if (!url) return null;
  const start = Number.isFinite(song.startTime) ? Math.max(0, Number(song.startTime)) : 0;
  const rawEnd = song.endTime;
  const end = typeof rawEnd === "number" && rawEnd > start ? rawEnd : start + 60;
  const volume = typeof song.volume === "number" ? Math.min(1, Math.max(0, song.volume)) : 0.5;
  return { url, start, end, volume };
}

/**
 * One Short's video. The source is attached only while this slide should load
 * (active or the immediate next Short). Revisiting the same URL calls startLoad
 * on the existing HLS instance instead of opening a second request.
 */
export function ShortsSlideMedia({
  url,
  poster,
  shouldLoad,
  shouldPlay,
  muted,
  onError,
  onMediaTime,
}: {
  url: string;
  poster: string;
  shouldLoad: boolean;
  shouldPlay: boolean;
  muted: boolean;
  onError: () => void;
  onMediaTime?: (currentTime: number) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const hlsRef = React.useRef<HlsLike | null>(null);
  const boundUrlRef = React.useRef<string | null>(null);
  const onErrorRef = React.useRef(onError);
  const shouldPlayRef = React.useRef(shouldPlay);
  const onMediaTimeRef = React.useRef(onMediaTime);
  onErrorRef.current = onError;
  shouldPlayRef.current = shouldPlay;
  onMediaTimeRef.current = onMediaTime;

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el || !url) return;

    if (!shouldLoad && boundUrlRef.current !== url) {
      el.pause();
      return;
    }

    if (!shouldLoad) {
      el.pause();
      hlsRef.current?.stopLoad();
      return;
    }

    if (boundUrlRef.current === url) {
      hlsRef.current?.startLoad();
      if (shouldPlayRef.current) void el.play().catch(() => {});
      return;
    }

    let cancelled = false;

    const attach = async () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (isHlsUrl(url)) {
        if (el.canPlayType("application/vnd.apple.mpegurl")) {
          boundUrlRef.current = url;
          el.src = url;
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
              onErrorRef.current();
              return;
            }
            const hls = new HlsCtor({ enableWorker: true });
            if (cancelled) return;
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(el);
            hls.on(HlsCtor.Events.ERROR, (_event, data) => {
              if (data?.fatal) onErrorRef.current();
            });
            if (cancelled) {
              hls.destroy();
              if (hlsRef.current === hls) hlsRef.current = null;
              return;
            }
            boundUrlRef.current = url;
          } catch {
            if (!cancelled) onErrorRef.current();
            return;
          }
        }
      } else {
        boundUrlRef.current = url;
        el.src = url;
      }

      if (!cancelled && shouldPlayRef.current) {
        void el.play().catch(() => {});
      }
    };

    void attach();
    return () => {
      cancelled = true;
    };
  }, [shouldLoad, url]);

  React.useEffect(() => {
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      boundUrlRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
    if (shouldPlay) {
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [muted, shouldPlay]);

  return (
    <video
        ref={videoRef}
        poster={poster || undefined}
        loop
        muted={muted}
        playsInline
        preload={shouldLoad ? "auto" : "none"}
        className="h-full w-full object-contain"
        onTimeUpdate={(event) => {
          if (!shouldPlay) return;
          onMediaTimeRef.current?.(event.currentTarget.currentTime);
        }}
        onError={() => {
          if (shouldLoad) onErrorRef.current();
        }}
      />
  );
}

export function ShortsSoundtrack({
  short,
  shouldPlay,
  mediaTimeRef,
}: {
  short: Post | null;
  shouldPlay: boolean;
  mediaTimeRef: React.RefObject<number>;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const boundRef = React.useRef<{ id: string; url: string } | null>(null);
  const track = short ? getLibraryTrack(short) : null;
  const trackUrl = track?.url ?? "";
  const trackStart = track?.start ?? 0;
  const trackEnd = track?.end ?? 0;
  const trackVolume = track?.volume ?? 0.5;
  const shortId = short?._id ?? "";

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!shortId || !trackUrl || !shouldPlay) {
      audio.pause();
      return;
    }

    const bound = boundRef.current;
    if (!bound || bound.id !== shortId || bound.url !== trackUrl) {
      if (!bound || bound.url !== trackUrl) audio.src = trackUrl;
      audio.currentTime = trackStart;
      boundRef.current = { id: shortId, url: trackUrl };
    }
    audio.volume = trackVolume;

    const syncToVideo = () => {
      const span = Math.max(0.25, trackEnd - trackStart);
      const videoTime = mediaTimeRef.current ?? 0;
      const target = trackStart + (videoTime % span);
      if (Math.abs(audio.currentTime - target) > 0.45) audio.currentTime = target;
    };

    syncToVideo();
    audio.addEventListener("timeupdate", syncToVideo);
    void audio.play().catch(() => {});
    return () => {
      audio.removeEventListener("timeupdate", syncToVideo);
      audio.pause();
    };
  }, [mediaTimeRef, shortId, shouldPlay, trackEnd, trackStart, trackUrl, trackVolume]);

  return <audio ref={audioRef} preload="none" className="hidden" />;
}
