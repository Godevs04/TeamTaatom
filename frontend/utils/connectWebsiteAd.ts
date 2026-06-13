/**
 * Connect website ad decision logic.
 *
 * One native ad slot is rendered per website screen visit (preview).
 */

export type ConnectWebsiteAdKind = 'google' | 'taatom' | 'none';

export function resolveConnectWebsiteAdKind(
  pageId: string | undefined | null,
  options?: { skipAds?: boolean },
): ConnectWebsiteAdKind {
  if (!pageId || options?.skipAds) return 'none';
  return 'google';
}
