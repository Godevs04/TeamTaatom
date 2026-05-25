import { colors as darkColors } from './colors';

export const lightColors = {
  ...darkColors,

  // Core brand (restore light-mode values)
  primary: '#121212',
  lightBlue: '#F5F7FA',
  secondary: '#667085',
  accent: '#121212',
  coral: '#FF8F70',
  sun: '#FFD166',
  softGray: '#F5F7FA',
  white: '#FFFFFF',

  // Surfaces
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceSecondary: 'rgba(255, 255, 255, 0.55)',
  surfaceTertiary: 'rgba(255, 255, 255, 0.72)',
  glassBorderHighlight: 'rgba(255, 255, 255, 0.90)',
  glassBorderShadow: 'rgba(0, 0, 0, 0.04)',

  // Content
  text: '#121212',
  textSecondary: '#667085',
  textMuted: '#667085',

  // Lines / hairlines
  border: 'rgba(0, 0, 0, 0.04)',
  hairline: 'rgba(0, 0, 0, 0.02)',

  // Card tint
  card: 'rgba(255, 255, 255, 0.55)',
  shadow: 'rgba(0, 0, 0, 0.04)',
  overlay: 'rgba(0, 0, 0, 0.40)',
  
  // Glass tokens
  glass: {
    background: 'rgba(255, 255, 255, 0.55)',
    border: 'rgba(255, 255, 255, 0.90)',
    highlight: 'rgba(255, 255, 255, 0.90)',
  },
  glassBackground: 'rgba(255, 255, 255, 0.55)',
  frostTint: 'rgba(255, 255, 255, 0.55)',
  frostTintMedium: 'rgba(255, 255, 255, 0.55)',
  frostTintStrong: 'rgba(255, 255, 255, 0.72)',
  /** Day theme: subtle vertical depth (aligned with dark theme’s graded sky) */
  appBackgroundGradient: ['#F5F7FA', '#F5F7FA'],
  screenGradient: ['#F5F7FA', '#F5F7FA'],
  glassSurface: 'rgba(255, 255, 255, 0.55)',
  glassStrong: 'rgba(255, 255, 255, 0.72)',
  glassBorder: 'rgba(255, 255, 255, 0.90)',
  glowBlue: 'rgba(255, 255, 255, 0.55)',
  innerHighlight: 'rgba(255, 255, 255, 0.94)',
  softShadow: 'rgba(0, 0, 0, 0.04)',
  /** Solid tab bar (not translucent) */
  floatingDock: 'rgba(255, 255, 255, 0.60)',
  cloudSurface: '#F5F7FA',
  skyPale: '#F5F7FA',
  blueDeep: '#121212',
  blueMid: '#667085',

  gradient: {
    primary: ['#F5F7FA', '#F5F7FA'],
    secondary: ['#121212', '#667085'],
    dark: ['#F5F7FA', '#F5F7FA'],
    button: ['#121212', '#667085']
  }
};

