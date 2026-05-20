import { lightColors } from './colors.light';

export const lightTheme = {
  colors: lightColors,
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    full: 9999,
  },
  radius: {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
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
      shadowColor: lightColors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 3,
    },
    medium: {
      shadowColor: lightColors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 20,
      elevation: 6,
    },
    large: {
      shadowColor: lightColors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 32,
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
    blurIntensity: 70,
    blurTint: 'light' as 'dark' | 'light' | 'default',
    border: {
      width: 1,
      color: lightColors.glass.border,
    },
    blur: {
      light: 30,
      medium: 70,
    }
  },
  premium: {
    screenGradient: lightColors.screenGradient,
    glassSurface: lightColors.glassSurface,
    glassStrong: lightColors.glassStrong,
    glassBorder: lightColors.glassBorder,
    glowBlue: lightColors.glowBlue,
    innerHighlight: lightColors.innerHighlight,
    softShadow: lightColors.softShadow,
    floatingDock: lightColors.floatingDock,
    cardRadius: 24,
    pillRadius: 9999,
    iconWell: 48,
  }
};
