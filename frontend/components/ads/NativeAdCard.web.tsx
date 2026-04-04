/**
 * Web stub for NativeAdCard. Native ads are not supported on web;
 * this keeps the same API so home.tsx can import one component.
 * The native NativeAdCard.tsx uses react-native-google-mobile-ads and must
 * not be bundled for web (it imports codegenNativeComponent and other native-only modules).
 */

import React, { memo } from 'react';

export type NativeAdCardProps = {
  adIndex: number;
};

function NativeAdCardComponent(_props: NativeAdCardProps) {
  return null;
}

export const NativeAdCard = memo(NativeAdCardComponent);
export default NativeAdCard;
