import React, { createContext, useContext, useState, useMemo, useEffect, ReactNode } from 'react';
import { theme as darkTheme } from '../constants/theme';
import { lightTheme } from '../constants/theme.light';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeType = typeof darkTheme;

export type FontSize = 'small' | 'medium' | 'large';

interface ThemeContextProps {
  theme: ThemeType;
  mode: 'dark' | 'light' | 'auto';
  setMode: (m: 'dark' | 'light' | 'auto') => void;
  getScaledFontSize?: (baseSize: number) => number;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

const THEME_KEY = 'themeMode';

// Font size multipliers
export const FONT_SIZE_MULTIPLIERS: Record<FontSize, number> = {
  small: 0.9,
  medium: 1.0,
  large: 1.15,
};

// Helper function to get scaled font size
export const getScaledFontSize = (baseSize: number, fontSize: FontSize = 'medium'): number => {
  return Math.round(baseSize * FONT_SIZE_MULTIPLIERS[fontSize]);
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<'dark' | 'light' | 'auto'>('light');

  useEffect(() => {
    (async () => {
      const storedMode = await AsyncStorage.getItem(THEME_KEY);
      if (storedMode === 'dark' || storedMode === 'light' || storedMode === 'auto') {
        setMode(storedMode);
      } else {
        // No stored theme - default to light for new users
        setMode('light');
        await AsyncStorage.setItem(THEME_KEY, 'light');
      }
    })();
  }, []);

  const setModePersist = (m: 'dark' | 'light' | 'auto') => {
    setMode(m);
    AsyncStorage.setItem(THEME_KEY, m);
  };

  const value = useMemo(
    () => ({
      theme: (mode === 'dark' ? darkTheme : mode === 'light' ? lightTheme : (new Date().getHours() >= 7 && new Date().getHours() <= 19) ? lightTheme : darkTheme),
      mode,
      setMode: setModePersist,
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
