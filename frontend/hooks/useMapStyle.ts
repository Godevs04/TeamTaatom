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
      routeColor: isDark ? '#2DD4BF' : '#3B82F6',
      routeGlowColor: isDark ? 'rgba(45, 212, 191, 0.3)' : 'rgba(59, 130, 246, 0.22)',
      userInterfaceStyle,
      nativeMapProps: Platform.select({
        android: { customMapStyle },
        ios: { userInterfaceStyle },
        default: {},
      }),
    };
  }, [isDark]);
}

