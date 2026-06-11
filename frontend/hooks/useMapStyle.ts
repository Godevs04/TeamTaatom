import { Platform } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { calmMorningMapStyle, midnightGlassMapStyle } from '../constants/mapStyles';

export function useMapStyle() {
  const { isDark } = useTheme();

  return useMemo(() => {
    // ALWAYS use calmMorningMapStyle (light/day theme) for map base layer as requested
    const customMapStyle = calmMorningMapStyle;
    const userInterfaceStyle = 'light';

    return {
      customMapStyle,
      glassTint: isDark ? 'dark' as const : 'light' as const,
      mapType: 'standard' as const,
      routeColor: '#06B6D4', // Vibrant Cyan (matching blue-green gradient)
      routeGlowColor: 'rgba(6, 182, 212, 0.22)',
      userInterfaceStyle,
      nativeMapProps: { customMapStyle },
    };
  }, [isDark]);
}

