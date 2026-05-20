import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  /** Dark vs light theme — picks gradient colors (screen / feed). */
  isDark: boolean;
  /** Vertical: fades at top and bottom of parent. Horizontal: left and right (e.g. paging carousel). */
  variant?: 'vertical' | 'horizontal';
  /** Height of top / bottom fade (vertical) */
  fadeSize?: number;
  /** Width of left / right fade (horizontal) */
  horizontalFadeSize?: number;
  /** Full-screen video (Shorts): black fades instead of theme sky colors */
  edgeColors?: 'screen' | 'video';
  style?: ViewStyle;
};

/**
 * Soft edge gradients so scroll content appears to tuck under headers / tab bar
 * (or under horizontal carousel edges), matching the “content goes into the shadow” look.
 */
export default function ScrollEdgeFades({
  isDark,
  variant = 'vertical',
  fadeSize = 44,
  horizontalFadeSize = 36,
  edgeColors = 'screen',
  style,
}: Props) {
  const topBottomScreen = isDark
    ? (['rgba(6,18,31,0)', 'rgba(6,18,31,0.45)', 'rgba(6,18,31,0.82)'] as const)
    : (['rgba(232,244,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0.94)'] as const);

  const topBottomVideo = ['rgba(0,0,0,0)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.78)'] as const;

  const topBottom = edgeColors === 'video' ? topBottomVideo : topBottomScreen;

  const leftRightScreen = isDark
    ? (['rgba(6,18,31,0)', 'rgba(6,18,31,0.5)', 'rgba(6,18,31,0.88)'] as const)
    : (['rgba(232,244,255,0)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.95)'] as const);

  const leftRightVideo = ['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.82)'] as const;

  const leftRight = edgeColors === 'video' ? leftRightVideo : leftRightScreen;

  if (variant === 'horizontal') {
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, style]}>
        <LinearGradient
          colors={[...leftRight] as [string, string, ...string[]]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.hEdge, { left: 0, width: horizontalFadeSize }]}
        />
        <LinearGradient
          colors={[...leftRight].reverse() as [string, string, ...string[]]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.hEdge, { right: 0, width: horizontalFadeSize }]}
        />
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, style]}>
      <LinearGradient
        colors={[...topBottom] as [string, string, ...string[]]}
        style={[styles.vEdge, { top: 0, height: fadeSize }]}
      />
      <LinearGradient
        colors={[...topBottom].reverse() as [string, string, ...string[]]}
        style={[styles.vEdge, { bottom: 0, height: fadeSize + 8 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  vEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  hEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});
