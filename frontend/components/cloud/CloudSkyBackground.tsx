import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { cloudDesign } from '../../constants/cloudDesign';

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
      {!isDark && (
        <Svg width="100%" height="280" style={styles.clouds} viewBox="0 0 390 280" preserveAspectRatio="xMidYMin slice">
          <Path
            d="M-44 80 C18 36 94 42 142 78 C192 32 278 34 330 86 C372 80 418 98 438 138 L438 140 L-44 140 Z"
            fill="rgba(255,255,255,0.46)"
          />
          <Circle cx="56" cy="56" r="44" fill="rgba(255,255,255,0.38)" />
          <Circle cx="332" cy="120" r="54" fill="rgba(255,255,255,0.34)" />
        </Svg>
      )}
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
  clouds: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
