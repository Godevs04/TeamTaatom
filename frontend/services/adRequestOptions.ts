/**
 * Per-request AdMob options derived from ATT consent.
 * When the user denies tracking on iOS, all ad units must request non-personalized ads.
 */

import type { RequestOptions } from 'react-native-google-mobile-ads';
import { getCanServePersonalizedAds } from './attPermission';

export function getAdRequestOptions(): Pick<RequestOptions, 'requestNonPersonalizedAdsOnly'> {
  const personalized = getCanServePersonalizedAds();
  return {
    // Non-personalized ads do not use IDFA — required after ATT denial per Apple policy.
    requestNonPersonalizedAdsOnly: !personalized,
  };
}
