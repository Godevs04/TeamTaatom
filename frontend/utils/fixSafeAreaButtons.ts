/**
 * Utility constants and helpers for fixing SafeAreaView and button positioning
 * across all screens for Android/iOS/Web compatibility
 */

import { Platform, Dimensions } from 'react-native';

export const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const isTablet = SCREEN_WIDTH >= 768;
export const isAndroid = Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';
export const isWeb = Platform.OS === 'web';

// Minimum touch targets per platform
export const MIN_TOUCH_TARGET = {
  ios: 44,
  android: 48,
  web: 44,
};

export const getMinTouchTarget = () => {
  if (isAndroid) return MIN_TOUCH_TARGET.android;
  if (isIOS) return MIN_TOUCH_TARGET.ios;
  return MIN_TOUCH_TARGET.web;
};

// SafeAreaView edges configuration
export const SAFE_AREA_EDGES = ['top'] as const;

// Header padding adjustments for Android
export const getHeaderPadding = (basePadding: number) => {
  if (isAndroid) {
    return isTablet ? basePadding + 8 : basePadding + 8;
  }
  return basePadding;
};

// Button style helpers
export const getButtonStyle = (basePadding: number = 8) => ({
  minWidth: getMinTouchTarget(),
  minHeight: getMinTouchTarget(),
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  padding: isTablet ? basePadding + 2 : (isAndroid ? basePadding + 2 : basePadding),
  ...(isWeb && {
    cursor: 'pointer' as const,
    transition: 'all 0.2s ease' as const,
  }),
});

// Hit slop for better touch area
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

