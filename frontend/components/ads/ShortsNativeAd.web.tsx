/**
 * Web stub for ShortsNativeAd. Native ads are not supported on web.
 */

import React, { memo } from 'react';

export type ShortsNativeAdProps = {
  adIndex: number;
  height?: number;
  fillParent?: boolean;
  onImpression?: () => void;
};

function ShortsNativeAdComponent(_props: ShortsNativeAdProps) {
  return null;
}

export const ShortsNativeAd = memo(ShortsNativeAdComponent);
export default ShortsNativeAd;
