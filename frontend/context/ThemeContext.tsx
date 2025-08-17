import React, { createContext, useContext, useState, useMemo, useEffect, ReactNode } from 'react';
import { theme as darkTheme } from '../constants/theme';
import { lightTheme } from '../constants/theme.light';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeType = typeof darkTheme;

interface ThemeContextProps {
  theme: ThemeType;
  mode: 'dark' | 'light';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

const THEME_KEY = 'themeMode';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    (async () => {
      const storedMode = await AsyncStorage.getItem(THEME_KEY);
      if (storedMode === 'dark' || storedMode === 'light') {
        setMode(storedMode);
      }
    })();
  }, []);

  const toggleTheme = () => {
    setMode((m) => {
      const newMode = m === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(THEME_KEY, newMode);
      return newMode;
    });
  };

  const value = useMemo(
    () => ({
      theme: mode === 'dark' ? darkTheme : lightTheme,
      mode,
      toggleTheme,
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
