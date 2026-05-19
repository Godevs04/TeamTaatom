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
  intensity = 60,
  tint = 'dark',
  style,
  contentStyle,
}: GlassMapPanelProps) {
  return (
    <View style={[styles.shell, style]}>
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
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(15, 23, 36, 0.36)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 10,
  },
  content: {
    padding: 16,
  },
});

