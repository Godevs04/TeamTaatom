import { colors as darkColors } from './colors';

export const lightColors = {
  ...darkColors,

  // Core brand (restore light-mode values)
  primary: '#2B7FD4',
  lightBlue: '#A8DAFC',
  secondary: '#5BBCF8',
  accent: '#43B89C',
  coral: '#FF8F70',
  sun: '#FFD166',
  softGray: '#EDF7FF',
  white: '#FFFFFF',

  // Surfaces
  background: '#E8F4FF',
  surface: '#FFFFFF',
  surfaceSecondary: '#D9EFFF',

  // Content
  text: '#1A2B3C',
  textSecondary: '#4A6274',
  textMuted: '#8FAABB',

  // Lines / hairlines
  border: 'rgba(91, 188, 248, 0.16)',
  hairline: 'rgba(91, 188, 248, 0.10)',

  // Card tint
  card: '#FFFFFF',
  shadow: 'rgba(43, 127, 212, 0.14)',
  overlay: 'rgba(26, 43, 60, 0.36)',
  
  // Glass tokens
  glass: {
    background: 'rgba(255, 255, 255, 0.76)',
    border: 'rgba(255, 255, 255, 0.72)',
    highlight: 'rgba(255, 255, 255, 0.9)',
  },
  glassBackground: 'rgba(255, 255, 255, 0.58)',
  frostTint: 'rgba(255, 255, 255, 0.55)',
  frostTintMedium: 'rgba(255, 255, 255, 0.68)',
  frostTintStrong: 'rgba(255, 255, 255, 0.86)',
  appBackgroundGradient: ['#E8F4FF', '#F5FAFF', '#FFFFFF'],
  screenGradient: ['#E8F4FF', '#F5FAFF', '#FFFFFF'],
  glassSurface: 'rgba(255, 255, 255, 0.76)',
  glassStrong: 'rgba(255, 255, 255, 0.92)',
  glassBorder: 'rgba(255, 255, 255, 0.76)',
  glowBlue: 'rgba(91, 188, 248, 0.34)',
  innerHighlight: 'rgba(255, 255, 255, 0.94)',
  softShadow: 'rgba(43, 127, 212, 0.18)',
  floatingDock: 'rgba(255, 255, 255, 0.86)',
  cloudSurface: '#EDF7FF',
  skyPale: '#D9EFFF',
  blueDeep: '#2B7FD4',
  blueMid: '#4BA3E8',

  gradient: {
    primary: ['#E8F4FF', '#F5FAFF', '#FFFFFF'],
    secondary: ['#5BBCF8', '#2B7FD4'],
    dark: ['#E8F4FF', '#F5FAFF', '#FFFFFF'],
    button: ['#5BBCF8', '#2B7FD4']
  }
};
