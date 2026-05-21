import React from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';

interface CloudGlassSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Frosted blur — use sparingly in long lists (perf on Android) */
  blur?: boolean;
  borderRadius?: number;
}

export function useCloudGlassTokens() {
  const { theme, mode } = useTheme();
  const isDark =
    mode === 'dark' ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#000000' ||
    theme.colors.background === '#111114';

  return {
    isDark,
    fill: isDark ? 'rgba(18, 34, 54, 0.62)' : 'rgba(255, 255, 255, 0.55)',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.72)',
    textPrimary: isDark ? theme.colors.text : '#1A2B3C',
    textSecondary: isDark ? theme.colors.textSecondary : '#4A6274',
    textMuted: isDark ? theme.colors.textSecondary : '#8FAABB',
    blurIntensity: isDark ? 42 : 28,
  };
}

export default function CloudGlassSurface({
  children,
  style,
  contentStyle,
  blur = true,
  borderRadius = 20,
}: CloudGlassSurfaceProps) {
  const glass = useCloudGlassTokens();

  return (
    <View
      style={[
        styles.wrap,
        {
          borderRadius,
          borderColor: glass.border,
          backgroundColor: glass.fill,
        },
        style,
      ]}
    >
      {blur ? (
        <BlurView
          intensity={glass.blurIntensity}
          tint={glass.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    zIndex: 1,
  },
});
