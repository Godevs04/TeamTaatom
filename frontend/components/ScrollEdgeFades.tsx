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
  hideTop?: boolean;
  hideBottom?: boolean;
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
  hideTop = false,
  hideBottom = true,
}: Props) {
  return null;
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
