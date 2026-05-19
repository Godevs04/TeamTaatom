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
      routeColor: '#5EA2FF',
      routeGlowColor: isDark ? 'rgba(94, 162, 255, 0.28)' : 'rgba(37, 99, 235, 0.22)',
      userInterfaceStyle,
      nativeMapProps: Platform.select({
        android: { customMapStyle },
        ios: { userInterfaceStyle },
        default: {},
      }),
    };
  }, [isDark]);
}

