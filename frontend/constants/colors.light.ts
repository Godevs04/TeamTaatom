import { colors as darkColors } from './colors';

export const lightColors = {
  ...darkColors,

  // Core brand (restore light-mode values)
  primary: '#000000',
  lightBlue: '#FFFFFF',
  secondary: '#1C73B4',
  accent: '#1C73B4', // Ocean Blue
  coral: '#1C73B4',
  sun: '#50C878', // Emerald Green
  softGray: '#FFFFFF',
  white: '#FFFFFF',
  pinActive: '#1C73B4',
  pinInactive: '#1C73B4',
  mapPolyline: '#1C73B4',
  link: '#1C73B4', // Ocean Blue (Light)

  // Surfaces
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSecondary: 'rgba(255, 255, 255, 0.85)',
  surfaceTertiary: 'rgba(255, 255, 255, 0.90)',
  glassBorderHighlight: 'rgba(28, 115, 180, 0.15)',
  glassBorderShadow: 'rgba(28, 115, 180, 0.05)',

  // Content
  text: '#000000',
  textSecondary: '#64748B', // Slate Gray Light
  textMuted: '#94A3B8',
  textPassive: '#CBD5E1',
  iconPassive: '#CBD5E1',

  // Lines / hairlines
  border: 'rgba(28, 115, 180, 0.15)',
  hairline: 'rgba(28, 115, 180, 0.15)',
  borderTint: 'rgba(28, 115, 180, 0.15)',

  // Card tint
  card: 'rgba(255, 255, 255, 0.85)',
  shadow: 'rgba(0, 0, 0, 0.15)',
  overlay: 'rgba(0, 0, 0, 0.35)',
  
  // Glass tokens
  glass: {
    background: 'rgba(255, 255, 255, 0.85)',
    border: 'rgba(28, 115, 180, 0.15)',
    highlight: 'rgba(28, 115, 180, 0.15)',
  },
  glassBackground: 'rgba(255, 255, 255, 0.85)',
  frostTint: 'rgba(255, 255, 255, 0.85)',
  frostTintMedium: 'rgba(255, 255, 255, 0.85)',
  frostTintStrong: 'rgba(255, 255, 255, 0.90)',
  appBackgroundGradient: ['#FFFFFF', '#FFFFFF'],
  screenGradient: ['#FFFFFF', '#FFFFFF'],
  glassSurface: 'rgba(255, 255, 255, 0.85)',
  glassStrong: 'rgba(255, 255, 255, 0.90)',
  glassBorder: 'rgba(28, 115, 180, 0.15)',
  glowBlue: 'rgba(28, 115, 180, 0.15)',
  innerHighlight: 'rgba(28, 115, 180, 0.15)',
  softShadow: 'rgba(0, 0, 0, 0.15)',
  /** Solid tab bar (not translucent) */
  floatingDock: 'rgba(255, 255, 255, 0.85)',
  cloudSurface: '#FFFFFF',
  skyPale: '#FFFFFF',
  blueDeep: '#000000',
  blueMid: '#1C73B4',

  gradient: {
    primary: ['#FFFFFF', '#FFFFFF'] as [string, string],
    secondary: ['#1C73B4', '#50C878'] as [string, string],
    dark: ['#FFFFFF', '#FFFFFF'] as [string, string],
    button: ['#1C73B4', '#50C878'] as [string, string]
  }
};
