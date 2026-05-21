/**
 * Connect website ad decision logic.
 *
 * Per website (Connect pageId):
 *   - First visit in the 8h window with global cap remaining → Google AdMob (counts toward 3/8h).
 *   - Revisit to the same website in the window → TAATOM private ad (no Google count).
 *   - After global cap (posts + reels + websites) → TAATOM only everywhere.
 *
 * One native ad slot is rendered per website screen visit (preview).
 */

import {
  canShowGoogleAd,
  wasWebsiteShown,
} from '../services/adCap';

export type ConnectWebsiteAdKind = 'google' | 'taatom' | 'none';

export function resolveConnectWebsiteAdKind(
  pageId: string | undefined | null,
  options?: { skipAds?: boolean },
): ConnectWebsiteAdKind {
  if (!pageId || options?.skipAds) return 'none';
  if (wasWebsiteShown(pageId)) return 'taatom';
  if (!canShowGoogleAd()) return 'taatom';
  return 'google';
}
