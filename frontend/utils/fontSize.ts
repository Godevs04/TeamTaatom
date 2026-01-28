import { FontSize, getScaledFontSize } from '../context/ThemeContext';

/**
 * Get the current font size setting from settings context
 * This utility can be used in components that have access to SettingsContext
 */
export const getFontSizeMultiplier = (fontSize: FontSize = 'medium'): number => {
  const multipliers: Record<FontSize, number> = {
    small: 0.9,
    medium: 1.0,
    large: 1.15,
  };
  return multipliers[fontSize];
};

/**
 * Get scaled font size based on user preference
 * @param baseSize - The base font size
 * @param fontSize - The font size preference ('small', 'medium', 'large')
 * @returns The scaled font size
 */
export const scaleFontSize = (baseSize: number, fontSize: FontSize = 'medium'): number => {
  return getScaledFontSize(baseSize, fontSize);
};
