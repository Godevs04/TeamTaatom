import { colors as darkColors } from './colors';

export const lightColors = {
  ...darkColors,
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F0F2F5',
  text: '#181A20',
  textSecondary: '#5A5F6B',
  border: 'rgba(0,0,0,0.08)',
  hairline: 'rgba(0,0,0,0.10)',
  card: '#FFFFFF',
  shadow: 'rgba(0, 0, 0, 0.08)',
  overlay: 'rgba(0,0,0,0.04)',
  gradient: {
    primary: ['#F5F7FA', '#E3E8EF'],
    secondary: ['#0A84FF', '#7F5AF0'],
    dark: ['#E3E8EF', '#F5F7FA']
  }
};
