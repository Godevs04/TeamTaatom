/**
 * Shorts (and some long videos) start as progressive raw MP4 until transcode
 * finishes. Prefer API `playbackReady`; only infer from shorts/raw keys.
 */

type VideoPlaybackFields = {
  playbackReady?: boolean;
  storageKey?: string | null;
  videoUrl?: string | null;
  mediaUrl?: string | null;
};

function urlLooksLikeHls(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();
  return lower.includes("hls=master") || lower.includes(".m3u8") || lower.includes("ext=.m3u8");
}

export function isShortPlaybackReady(item: VideoPlaybackFields | null | undefined): boolean {
  if (!item) return false;
  if (item.playbackReady === true) return true;
  if (item.playbackReady === false) return false;
  const key = item.storageKey || "";
  if (typeof key === "string" && key.endsWith("index.m3u8")) return true;
  return urlLooksLikeHls(item.videoUrl) || urlLooksLikeHls(item.mediaUrl);
}

export function isShortStillProcessing(item: VideoPlaybackFields | null | undefined): boolean {
  if (!item) return false;
  if (item.playbackReady === true) return false;
  if (item.playbackReady === false) return true;
  if (isShortPlaybackReady(item)) return false;
  const key = item.storageKey || "";
  return typeof key === "string" && (key.includes("shorts/raw") || key.startsWith("shorts/raw"));
}

export const isVideoPlaybackReady = isShortPlaybackReady;
export const isVideoStillProcessing = isShortStillProcessing;
