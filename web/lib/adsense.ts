/**
 * Google AdSense config for Taatom web (Watch / Videos monetization).
 * Publisher matches app-ads.txt: pub-6362359854606661
 */

function envFlag(value: string | undefined, defaultOn = true): boolean {
  if (typeof value !== "string" || !value.trim()) return defaultOn;
  return value.trim().toLowerCase() !== "false";
}

function envString(value: string | undefined, fallback = ""): string {
  const v = typeof value === "string" ? value.trim() : "";
  return v || fallback;
}

function isDevAppEnv(): boolean {
  const app = (process.env.NEXT_PUBLIC_APP_ENV || process.env.APP_ENV || "").trim().toLowerCase();
  return process.env.NODE_ENV === "development" || app === "development";
}

/** Master kill switch. Default on when client id is present. */
export function isAdSenseEnabled(): boolean {
  if (!envFlag(process.env.NEXT_PUBLIC_ADSENSE_ENABLED, true)) return false;
  return !!getAdSenseClientId();
}

export function getAdSenseClientId(): string {
  return envString(process.env.NEXT_PUBLIC_ADSENSE_CLIENT, "ca-pub-6362359854606661");
}

/** Display unit used during Watch preroll / midroll / end breaks. */
export function getAdSenseWatchBreakSlot(): string {
  return envString(process.env.NEXT_PUBLIC_ADSENSE_WATCH_BREAK_SLOT, "");
}

/** In-feed / Videos tab display unit (mirrors mobile native feed ads). */
export function getAdSenseFeedSlot(): string {
  return envString(process.env.NEXT_PUBLIC_ADSENSE_FEED_SLOT, "");
}

/**
 * Whether Watch should pause for an ad break.
 * - With a slot: always (when AdSense is on).
 * - Without a slot: only in development, so localhost can verify the gate
 *   (real AdSense rarely fills on localhost anyway).
 */
export function canShowWatchAdBreak(): boolean {
  if (!isAdSenseEnabled()) return false;
  if (getAdSenseWatchBreakSlot()) return true;
  return isDevAppEnv();
}

/** True when we should render a local placeholder instead of (or under) AdSense. */
export function shouldShowWatchAdPlaceholder(): boolean {
  return canShowWatchAdBreak() && (!getAdSenseWatchBreakSlot() || isDevAppEnv());
}

/**
 * Whether the News Feed / Videos list should insert sponsored units.
 * Production requires a feed slot; development shows placeholders without one.
 */
export function canShowFeedAd(): boolean {
  if (!isAdSenseEnabled()) return false;
  if (getAdSenseFeedSlot()) return true;
  return isDevAppEnv();
}

export function shouldShowFeedAdPlaceholder(): boolean {
  return canShowFeedAd() && (!getAdSenseFeedSlot() || isDevAppEnv());
}

export function isAdSenseTestMode(): boolean {
  return isDevAppEnv();
}
