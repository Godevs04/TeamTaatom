import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { calmMorningMapStyle } from '../constants/mapStyles';
import { CARTO_STYLE } from '../utils/mapEngine';

export function useMapStyle() {
  const { isDark } = useTheme();

  return useMemo(() => {
    // customMapStyle stays for the legacy Apple/Google engine (restore path).
    // mapStyle is the CARTO vector style used by MapLibre, matching the web map.
    const customMapStyle = calmMorningMapStyle;
    const userInterfaceStyle = 'light';

    return {
      customMapStyle,
      glassTint: isDark ? 'dark' as const : 'light' as const,
      mapType: 'standard' as const,
      routeColor: '#06B6D4', // Vibrant Cyan (matching blue-green gradient)
      routeGlowColor: 'rgba(6, 182, 212, 0.22)',
      userInterfaceStyle,
      nativeMapProps: {
        customMapStyle,
        mapStyle: isDark ? CARTO_STYLE.dark : CARTO_STYLE.light,
      },
    };
  }, [isDark]);
}

