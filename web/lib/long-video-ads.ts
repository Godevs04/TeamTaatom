/**
 * Web long-video ad breaks via AdSense display units (AdMob equivalent on mobile).
 */
import { canShowWatchAdBreak } from "./adsense";

/** Max time to wait for an ad break UI before resuming playback. */
export const WATCH_AD_BREAK_TIMEOUT_MS = 8000;

/**
 * Whether a Watch ad break should pause playback and show the break UI.
 * Dev allows a placeholder when no AdSense slot is configured yet.
 */
export function shouldAttemptWatchAdBreak(): boolean {
  return canShowWatchAdBreak();
}
