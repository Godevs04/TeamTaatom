// Web / default stub for AdMob services.
// Native implementations live in admob.native.ts.

import logger from '../utils/logger';

export async function initializeAds(): Promise<void> {
  // No-op on web; ads are native-only.
  logger.debug('[AdMob] initializeAds noop (web/default build)');
}

export async function showConsentForm(): Promise<void> {
  // No-op on web; consent form is native-only.
  logger.debug('[AdMob] showConsentForm noop (web/default build)');
}
