import { colors as darkColors } from './colors';

export const lightColors = {
  ...darkColors,
  background: '#F7FAFF', // Premium soft white-blue
  surface: '#FFFFFF',
  surfaceSecondary: '#EEF5FF',
  text: '#0B1020', // Elegant deep navy text
  textSecondary: '#5A6E85', // Soft atmospheric slate secondary text
  border: 'rgba(11, 16, 32, 0.08)',
  hairline: 'rgba(11, 16, 32, 0.12)',
  card: '#FFFFFF',
  shadow: 'rgba(11, 16, 32, 0.06)',
  overlay: 'rgba(11, 16, 32, 0.4)',
  
  // Glass tokens
  glass: {
    background: 'rgba(255, 255, 255, 0.75)',
    border: 'rgba(11, 16, 32, 0.06)',
    highlight: 'rgba(255, 255, 255, 0.6)',
  },
  glassBackground: 'rgba(255, 255, 255, 0.4)',
  frostTint: 'rgba(255, 255, 255, 0.5)',
  frostTintMedium: 'rgba(255, 255, 255, 0.6)',
  frostTintStrong: 'rgba(255, 255, 255, 0.7)',
  appBackgroundGradient: ['#F4F4F4', '#E8F2FF', '#FFFFFF'],
  screenGradient: ['#F7FAFF', '#EDF5FF', '#FFFFFF'],
  glassSurface: 'rgba(255, 255, 255, 0.78)',
  glassStrong: 'rgba(255, 255, 255, 0.90)',
  glassBorder: 'rgba(51, 111, 203, 0.12)',
  glowBlue: 'rgba(44, 158, 232, 0.28)',
  innerHighlight: 'rgba(255, 255, 255, 0.92)',
  softShadow: 'rgba(28, 68, 128, 0.13)',
  floatingDock: 'rgba(255, 255, 255, 0.84)',

  gradient: {
    primary: ['#FFFFFF', '#F4F4F4'],
    secondary: ['#2C9EE8', '#93D4FE'],
    dark: ['#EAEAEA', '#F4F4F4'],
    button: ['#2C9EE8', '#93D4FE']
  }
};
