/**
 * Web / default stub — ATT is iOS-native only.
 */

export type AttStatus = 'unavailable' | 'undetermined' | 'granted' | 'denied' | 'restricted';

/** Resolve ATT before AdMob on native; no-op on web. */
export async function ensureAttResolvedBeforeAds(): Promise<boolean> {
  return false;
}

export function getCanServePersonalizedAds(): boolean {
  return false;
}

export async function getAttStatus(): Promise<AttStatus> {
  return 'unavailable';
}

export async function requestAttPermission(): Promise<AttStatus> {
  return 'unavailable';
}
