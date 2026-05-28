/**
 * Web stub for NativeAdCard. Native ads are not supported on web;
 * this keeps the same API so home.tsx can import one component.
 * The native NativeAdCard.tsx uses react-native-google-mobile-ads and must
 * not be bundled for web (it imports codegenNativeComponent and other native-only modules).
 */

import React, { memo, useEffect } from 'react';

export type NativeAdCardProps = {
  adIndex: number;
  onImpression?: () => void;
  onLoadFailed?: () => void;
};

function NativeAdCardComponent({ onLoadFailed }: NativeAdCardProps) {
  useEffect(() => {
    onLoadFailed?.();
  }, [onLoadFailed]);

  return null;
}

export const NativeAdCard = memo(NativeAdCardComponent);
export default NativeAdCard;
