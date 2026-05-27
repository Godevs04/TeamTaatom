import { Platform } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { calmMorningMapStyle, midnightGlassMapStyle } from '../constants/mapStyles';

export function useMapStyle() {
  const { isDark } = useTheme();

  return useMemo(() => {
    const customMapStyle = isDark ? midnightGlassMapStyle : calmMorningMapStyle;
    const userInterfaceStyle = isDark ? 'dark' : 'light';

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

