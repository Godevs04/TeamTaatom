import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { useMemo } from 'react';
import { getScaledFontSize, FontSize } from '../context/ThemeContext';

/**
 * Hook that provides theme with scaled typography based on user's font size preference
 * Use this hook instead of useTheme when you want font sizes to respect user preferences
 */
export const useScaledTheme = () => {
  const { theme, mode, setMode } = useTheme();
  const { settings } = useSettings();
  
  // Get font size preference, default to 'medium'
  const fontSize: FontSize = (settings?.account?.fontSize as FontSize) || 'medium';
  
  // Create scaled typography
  const scaledTypography = useMemo(() => {
    return {
      h1: {
        ...theme.typography.h1,
        fontSize: getScaledFontSize(theme.typography.h1.fontSize, fontSize),
      },
      h2: {
        ...theme.typography.h2,
        fontSize: getScaledFontSize(theme.typography.h2.fontSize, fontSize),
      },
      h3: {
        ...theme.typography.h3,
        fontSize: getScaledFontSize(theme.typography.h3.fontSize, fontSize),
      },
      body: {
        ...theme.typography.body,
        fontSize: getScaledFontSize(theme.typography.body.fontSize, fontSize),
      },
      caption: {
        ...theme.typography.caption,
        fontSize: getScaledFontSize(theme.typography.caption.fontSize, fontSize),
      },
      small: {
        ...theme.typography.small,
        fontSize: getScaledFontSize(theme.typography.small.fontSize, fontSize),
      },
    };
  }, [theme.typography, fontSize]);
  
  // Helper function to scale any font size
  const scaleFontSize = useMemo(() => {
    return (baseSize: number) => getScaledFontSize(baseSize, fontSize);
  }, [fontSize]);
  
  return {
    ...theme,
    typography: scaledTypography,
    mode,
    setMode,
    fontSize, // Also expose the current fontSize setting
    scaleFontSize, // Helper to scale any font size
  };
};
