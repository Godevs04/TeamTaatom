import React, { createContext, useContext, useState, useMemo, useEffect, ReactNode } from 'react';
import { Appearance } from 'react-native';
import { theme as darkTheme } from '../constants/theme';
import { lightTheme } from '../constants/theme.light';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeType = typeof darkTheme;

export type FontSize = 'small' | 'medium' | 'large';

interface ThemeContextProps {
  theme: ThemeType;
  mode: 'dark' | 'light' | 'auto';
  setMode: (m: 'dark' | 'light' | 'auto') => void;
  themeLoaded: boolean;
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
  // Seed the initial mode from the OS color scheme so the first render matches
  // what the user is most likely to expect, instead of always defaulting to
  // 'light'. AsyncStorage still wins once it resolves a tick later, but for
  // the common case (user's app theme matches their OS theme) there's no
  // flash from light → dark on screens like locale where the GlobeMap surface
  // is dark and the white default background is jarring.
  const [mode, setMode] = useState<'dark' | 'light' | 'auto'>(
    () => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'),
  );
  const [themeLoaded, setThemeLoaded] = useState(false);

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
      setThemeLoaded(true);
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
      themeLoaded,
    }),
    [mode, themeLoaded]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
