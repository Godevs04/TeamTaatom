"use client";

/**
 * Shared video-source attach for every web player (Shorts feed, post card,
 * post detail, long-video watch page).
 *
 * Why this exists: shorts and long videos are served as HLS (`.m3u8`). Only
 * Safari plays HLS natively; Chrome/Firefox/Edge need hls.js (MSE). Players
 * that set `<video src>` to an HLS URL directly never play outside Safari.
 *
 * Order follows hls.js guidance: prefer hls.js whenever MSE is supported, fall
 * back to native HLS (iOS Safari without MSE), then progressive `src`.
 * Fatal errors get one recovery attempt each (network → `startLoad`, media →
 * `recoverMediaError`) before `onFatal` is reported.
 */

type HlsErrorData = { fatal?: boolean; type?: string };

export type HlsLike = {
  destroy: () => void;
  loadSource: (url: string) => void;
  attachMedia: (el: HTMLMediaElement) => void;
  stopLoad: () => void;
  startLoad: (startPosition?: number) => void;
  recoverMediaError: () => void;
  on: (event: string, cb: (event: string, data: HlsErrorData) => void) => void;
};

type HlsStatic = {
  isSupported: () => boolean;
  Events: { ERROR: string };
  ErrorTypes: { NETWORK_ERROR: string; MEDIA_ERROR: string };
  new (config?: { enableWorker?: boolean }): HlsLike;
};

export type AttachedVideoSource = {
  /** hls.js instance when one is driving playback, otherwise null (native / progressive). */
  hls: HlsLike | null;
  destroy: () => void;
};

export function isHlsUrl(url: string): boolean {
  return /hls=master|\.m3u8|ext=\.m3u8/i.test(url);
}

/**
 * Attach `url` to `el`. Resolves to null when `isCancelled()` turned true while
 * hls.js was loading (the caller unmounted or switched URL) — nothing is left attached.
 */
export async function attachVideoSource(
  el: HTMLVideoElement,
  url: string,
  { onFatal, isCancelled }: { onFatal: () => void; isCancelled: () => boolean }
): Promise<AttachedVideoSource | null> {
  if (!isHlsUrl(url)) {
    el.src = url;
    return { hls: null, destroy: () => {} };
  }

  let HlsCtor: HlsStatic | null = null;
  try {
    const mod = await import("hls.js");
    HlsCtor = (mod.default || mod) as unknown as HlsStatic;
  } catch {
    HlsCtor = null;
  }
  if (isCancelled()) return null;

  if (HlsCtor?.isSupported()) {
    const hls = new HlsCtor({ enableWorker: true });
    let networkRetried = false;
    let mediaRecovered = false;
    hls.on(HlsCtor.Events.ERROR, (_event, data) => {
      if (!data?.fatal) return;
      if (data.type === HlsCtor?.ErrorTypes.NETWORK_ERROR && !networkRetried) {
        networkRetried = true;
        hls.startLoad();
        return;
      }
      if (data.type === HlsCtor?.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
        mediaRecovered = true;
        hls.recoverMediaError();
        return;
      }
      onFatal();
    });
    hls.loadSource(url);
    hls.attachMedia(el);
    return { hls, destroy: () => hls.destroy() };
  }

  if (el.canPlayType("application/vnd.apple.mpegurl")) {
    el.src = url;
    return { hls: null, destroy: () => {} };
  }

  onFatal();
  return null;
}
