/**
 * Web feed ad injection — mirrors mobile HOME_AD_EVERY_N_POSTS / SHORTS cadence.
 */

export const FEED_AD_EVERY_N_POSTS = 5;
export const SHORTS_AD_EVERY_N_REELS = 5;
/** Soft session cap (no AsyncStorage on web); prevents endless units on infinite scroll. */
export const WEB_FEED_AD_SESSION_CAP = 10;

export type FeedAdSlot = {
  type: "ad";
  adIndex: number;
  afterCount: number;
};

export type FeedListItem<T> = T | FeedAdSlot;

export function isFeedAdSlot<T>(item: FeedListItem<T>): item is FeedAdSlot {
  return (
    typeof item === "object" &&
    item !== null &&
    "type" in item &&
    (item as FeedAdSlot).type === "ad"
  );
}

/**
 * Insert an ad marker after every `everyN` content items (not after the last item).
 * Caps total ads at `maxAds` for the current list slice.
 */
export function injectFeedAds<T>(
  items: T[],
  options?: { everyN?: number; maxAds?: number }
): FeedListItem<T>[] {
  const everyN = options?.everyN ?? FEED_AD_EVERY_N_POSTS;
  const maxAds = options?.maxAds ?? WEB_FEED_AD_SESSION_CAP;
  if (!items.length || everyN < 1 || maxAds < 1) return items;

  const result: FeedListItem<T>[] = [];
  let contentCount = 0;
  let adIndex = 0;

  for (const item of items) {
    result.push(item);
    contentCount += 1;
    if (
      adIndex < maxAds &&
      contentCount % everyN === 0 &&
      contentCount < items.length
    ) {
      result.push({ type: "ad", adIndex, afterCount: contentCount });
      adIndex += 1;
    }
  }

  return result;
}
