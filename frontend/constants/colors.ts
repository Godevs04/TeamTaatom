export const colors = {
  // Core brand
  primary: '#FFFFFF',
  lightBlue: '#000000',
  secondary: '#38BDF8',
  accent: '#50C878', // Emerald Green
  coral: '#38BDF8', // Remapped from coral to Sky Blue to obey palette restriction
  sun: '#50C878', // Remapped from sun to Emerald Green
  softGray: '#000000',
  white: '#FFFFFF',
  pinActive: '#38BDF8', // Sky Blue
  pinInactive: '#38BDF8',
  mapPolyline: '#1C73B4', // Ocean Blue
  link: '#38BDF8', // Sky Blue (Dark)

  // System
  success: '#50C878', // Emerald Green
  warning: '#38BDF8', // Sky Blue
  error: '#FF453A',

  // Surfaces (dark)
  background: '#000000',
  surface: '#000000',
  surfaceSecondary: 'rgba(0, 0, 0, 0.75)',
  surfaceTertiary: 'rgba(0, 0, 0, 0.85)',
  glassBorderHighlight: 'rgba(28, 115, 180, 0.15)',
  glassBorderShadow: 'rgba(28, 115, 180, 0.05)',

  // Day Theme counterparts (contradict and suit)
  lightBackground: '#FFFFFF',
  lightSurfaceSecondary: 'rgba(255, 255, 255, 0.85)',
  lightSurfaceTertiary: 'rgba(255, 255, 255, 0.90)',
  lightGlassBorderHighlight: 'rgba(28, 115, 180, 0.15)',
  lightGlassBorderShadow: 'rgba(28, 115, 180, 0.05)',

  // Content
  text: '#FFFFFF',
  textSecondary: '#38BDF8',
  textMuted: '#38BDF8',
  textPassive: '#38BDF8',
  iconPassive: '#38BDF8',

  // Lines / hairlines
  border: 'rgba(28, 115, 180, 0.15)',
  hairline: 'rgba(28, 115, 180, 0.15)',
  borderTint: 'rgba(28, 115, 180, 0.15)',

  // Card tint
  card: 'rgba(0, 0, 0, 0.75)',
  shadow: 'rgba(0, 0, 0, 0.55)',
  overlay: 'rgba(0, 0, 0, 0.55)',

  // Glass tokens
  glass: {
    background: 'rgba(0, 0, 0, 0.75)',
    border: 'rgba(28, 115, 180, 0.15)',
    highlight: 'rgba(28, 115, 180, 0.15)',
  },
  glassBackground: 'rgba(0, 0, 0, 0.75)',
  frostTint: 'rgba(0, 0, 0, 0.75)',
  frostTintMedium: 'rgba(0, 0, 0, 0.75)',
  frostTintStrong: 'rgba(0, 0, 0, 0.85)',
  appBackgroundGradient: ['#000000', '#000000'],

  // Premium glass theme tokens
  screenGradient: ['#000000', '#000000'],
  glassSurface: 'rgba(0, 0, 0, 0.75)',
  glassStrong: 'rgba(0, 0, 0, 0.85)',
  glassBorder: 'rgba(28, 115, 180, 0.15)',
  glowBlue: 'rgba(28, 115, 180, 0.15)',
  innerHighlight: 'rgba(28, 115, 180, 0.15)',
  softShadow: 'rgba(0, 0, 0, 0.55)',
  /** Solid tab bar (not translucent) */
  floatingDock: '#000000',
  cloudSurface: '#000000',
  skyPale: '#000000',
  blueDeep: '#FFFFFF',
  blueMid: '#38BDF8',

  gradient: {
    primary: ['#000000', '#000000'] as [string, string],
    secondary: ['#1C73B4', '#50C878'] as [string, string],
    dark: ['#000000', '#000000'] as [string, string],
    button: ['#1C73B4', '#50C878'] as [string, string]
  }
};
