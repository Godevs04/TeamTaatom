import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

interface CloudSkyBackgroundProps {
  heightRatio?: number;
}

export default function CloudSkyBackground({ heightRatio = 0.32 }: CloudSkyBackgroundProps) {
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const colors: [string, string, ...string[]] = isDark
    ? ['#06121F', '#102236', '#07111C']
    : ['#A8DAFC', '#C8E8FF', '#EDF7FF', '#FFFFFF'];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={colors}
        locations={isDark ? undefined : [0, 0.35, 0.65, 1]}
        style={[styles.skyBand, { height: `${Math.round(heightRatio * 100)}%` }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  skyBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
