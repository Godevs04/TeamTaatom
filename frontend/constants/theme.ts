import { colors } from './colors';

export const theme = {
  colors,
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 10,
    md: 14,
    lg: 16,
    xl: 22,
    full: 9999,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 16,
    xl: 22,
    full: 9999,
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: '800' as const,
      letterSpacing: 0.3,
    },
    h2: {
      fontSize: 24,
      fontWeight: '700' as const,
      letterSpacing: 0.25,
    },
    h3: {
      fontSize: 18,
      fontWeight: '700' as const,
      letterSpacing: 0.2,
    },
    body: {
      fontSize: 15,
      fontWeight: '400' as const,
      letterSpacing: 0.1,
    },
    caption: {
      fontSize: 13,
      fontWeight: '400' as const,
      letterSpacing: 0.1,
    },
    small: {
      fontSize: 12,
      fontWeight: '400' as const,
      letterSpacing: 0.1,
    },
  },
  shadows: {
    small: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 3,
    },
    medium: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    large: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      elevation: 10,
    },
  },
  animation: {
    spring: {
      stiffness: 250,
      damping: 20,
      mass: 1,
    },
    timing: {
      duration: 300,
    }
  },
  glass: {
    blurIntensity: 50,
    blurTint: 'dark' as 'dark' | 'light' | 'default',
    border: {
      width: 1,
      color: colors.glass.border,
    },
    blur: {
      light: 20,
      medium: 50,
    }
  },
  premium: {
    screenGradient: colors.screenGradient,
    glassSurface: colors.glassSurface,
    glassStrong: colors.glassStrong,
    glassBorder: colors.glassBorder,
    glowBlue: colors.glowBlue,
    innerHighlight: colors.innerHighlight,
    softShadow: colors.softShadow,
    floatingDock: colors.floatingDock,
    cardRadius: 22,
    pillRadius: 9999,
    iconWell: 48,
  }
};
