import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { theme as darkTheme } from '../constants/theme';
import { lightTheme } from '../constants/theme.light';

export type ThemeType = typeof darkTheme;

interface ThemeContextProps {
  theme: ThemeType;
  mode: 'dark' | 'light';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => setMode((m) => (m === 'dark' ? 'light' : 'dark'));

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
