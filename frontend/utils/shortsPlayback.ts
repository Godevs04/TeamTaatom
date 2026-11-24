/**
 * Shorts (and some long videos) start as progressive raw MP4 until transcode
 * finishes. iOS AVPlayer often fails on that raw file (-11819). Prefer the
 * API `playbackReady` flag; only infer processing from shorts/raw keys (long
 * videos may stay on long_videos/raw after a compliant passthrough).
 */

type VideoPlaybackFields = {
  playbackReady?: boolean;
  storageKey?: string | null;
  videoUrl?: string | null;
  mediaUrl?: string | null;
};

function urlLooksLikeHls(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return lower.includes('hls=master') || lower.includes('.m3u8') || lower.includes('ext=.m3u8');
}

export function isShortPlaybackReady(item: VideoPlaybackFields | null | undefined): boolean {
  if (!item) return false;
  if (item.playbackReady === true) return true;
  if (item.playbackReady === false) return false;
  const key = item.storageKey || '';
  if (typeof key === 'string' && key.endsWith('index.m3u8')) return true;
  return urlLooksLikeHls(item.videoUrl) || urlLooksLikeHls(item.mediaUrl);
}

export function isShortStillProcessing(item: VideoPlaybackFields | null | undefined): boolean {
  if (!item) return false;
  if (item.playbackReady === true) return false;
  if (item.playbackReady === false) return true;
  if (isShortPlaybackReady(item)) return false;
  const key = item.storageKey || '';
  // Shorts always need HLS. Do not treat long_videos/raw as processing — that
  // path can be the final progressive file after a compliant passthrough.
  return typeof key === 'string' && (key.includes('shorts/raw') || key.startsWith('shorts/raw'));
}

export function shortPlayableSourceKey(item: VideoPlaybackFields | null | undefined): string {
  if (!item) return '';
  return [
    item.playbackReady === true ? '1' : item.playbackReady === false ? '0' : 'x',
    item.storageKey || '',
    (item.videoUrl || '').split('?')[0],
    (item.mediaUrl || '').split('?')[0],
  ].join('|');
}

/** Aliases for long-video / shared watch surfaces. */
export const isVideoPlaybackReady = isShortPlaybackReady;
export const isVideoStillProcessing = isShortStillProcessing;
export const videoPlayableSourceKey = shortPlayableSourceKey;
