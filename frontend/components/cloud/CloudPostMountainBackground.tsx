import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

/** Full-screen backdrop for Create Post — clean, minimal solid gradient designed for premium liquid glass UI aesthetics */
export default function CloudPostMountainBackground() {
  const { mode, theme } = useTheme();
  const isDark =
    mode === 'dark' ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#06121F';

  // Subtle colors:
  // Light: soft white with ice blue and mint hints
  // Dark: deep charcoal with muted teal-blue undertones
  const gradientColors: [string, string, ...string[]] = isDark
    ? ['#141718', '#0F1E22', '#121415']
    : ['#FAFBFB', '#F2F6F8', '#EEF7F5'];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

