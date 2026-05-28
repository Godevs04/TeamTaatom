/**
 * Web stub for ShortsNativeAd. Native ads are not supported on web.
 */

import React, { memo, useEffect } from 'react';

export type ShortsNativeAdProps = {
  adIndex: number;
  height?: number;
  fillParent?: boolean;
  onImpression?: () => void;
  onLoadFailed?: () => void;
};

function ShortsNativeAdComponent({ onLoadFailed }: ShortsNativeAdProps) {
  useEffect(() => {
    onLoadFailed?.();
  }, [onLoadFailed]);

  return null;
}

export const ShortsNativeAd = memo(ShortsNativeAdComponent);
export default ShortsNativeAd;
