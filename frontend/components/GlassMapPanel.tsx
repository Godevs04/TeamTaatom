import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

interface GlassMapPanelProps {
  children: React.ReactNode;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export default function GlassMapPanel({
  children,
  intensity = 80,
  tint = 'dark',
  style,
  contentStyle,
}: GlassMapPanelProps) {
  const dynamicShellStyle = {
    backgroundColor:
      tint === 'light'
        ? 'rgba(255, 255, 255, 0.85)'
        : tint === 'dark'
        ? 'rgba(20, 24, 33, 0.85)'
        : 'rgba(255, 255, 255, 0.85)',
    borderColor:
      tint === 'light'
        ? 'rgba(0, 0, 0, 0.08)'
        : tint === 'dark'
        ? 'rgba(255, 255, 255, 0.14)'
        : 'rgba(0, 0, 0, 0.08)',
  };

  return (
    <View style={[styles.shell, dynamicShellStyle, style]}>
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 10,
  },
  content: {
    padding: 12,
    flexShrink: 1,
  },
});
