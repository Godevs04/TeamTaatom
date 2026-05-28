import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

interface CloudSkyBackgroundProps {
  heightRatio?: number;
}

export default function CloudSkyBackground({ heightRatio = 0.32 }: CloudSkyBackgroundProps) {
  const { isDark } = useTheme();
  const colors: [string, string, ...string[]] = isDark
    ? ['#000000', '#000000', '#000000']
    : ['#EAEFF4', '#F5F7FA', '#F5F7FA'];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={colors}
        locations={isDark ? undefined : [0, 0.35, 1]}
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
