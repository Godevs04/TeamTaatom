import { Dimensions, Platform } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Responsive utility functions for cross-platform design
 */

export const isWeb = Platform.OS === 'web';
export const isMobile = Platform.OS !== 'web' && screenWidth < 768;
export const isTablet = screenWidth >= 768 && screenWidth < 1024;
export const isDesktop = isWeb && screenWidth >= 1024;

/**
 * Get responsive value based on screen size
 */
export function getResponsiveValue<T>(
  mobile: T,
  tablet?: T,
  desktop?: T
): T {
  if (isDesktop && desktop !== undefined) return desktop;
  if (isTablet && tablet !== undefined) return tablet;
  return mobile;
}

/**
 * Get responsive padding
 */
export function getResponsivePadding() {
  return getResponsiveValue(16, 24, 32);
}

/**
 * Get responsive font size multiplier
 */
export function getResponsiveFontSize(baseSize: number): number {
  if (isDesktop) return baseSize * 1.1;
  if (isTablet) return baseSize * 1.05;
  return baseSize;
}

/**
 * Get max content width for web
 */
export function getMaxContentWidth(): number {
  if (isDesktop) return 1200;
  if (isTablet) return 900;
  return screenWidth;
}

/**
 * Check if device is in landscape mode
 */
export function isLandscape(): boolean {
  return screenWidth > screenHeight;
}

