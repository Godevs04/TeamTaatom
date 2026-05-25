import React from 'react';
import { StyleSheet, ViewStyle, StyleProp, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect, Path, Pattern } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

export interface GradientBackgroundProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const GradientBackground = ({ children, style }: GradientBackgroundProps) => {
  const { theme, isDark } = useTheme();

  // Atmospheric gradient configuration
  const backgroundColors = theme.colors.appBackgroundGradient as [string, string, ...string[]];

  return (
    <View style={[styles.container, style]}>
      {/* 1. Base solid gradient layer */}
      <LinearGradient
        colors={backgroundColors}
        style={StyleSheet.absoluteFillObject}
      />

      {/* 2. Advanced atmospheric SVG overlay */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Svg height="100%" width="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            {/* Top Right Vibrant Cobalt Glow */}
            <RadialGradient id="glowTopRight" cx="85%" cy="15%" rx="55%" ry="45%" fx="85%" fy="15%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.08 : 0.04} />
              <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.03 : 0.01} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>

            {/* Mid Left Smooth Indigo/Royal Glow */}
            <RadialGradient id="glowMidLeft" cx="10%" cy="50%" rx="50%" ry="40%" fx="10%" fy="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.06 : 0.03} />
              <Stop offset="60%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.02 : 0.01} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>

            {/* Bottom Right Soft Cyan/Sky Glow */}
            <RadialGradient id="glowBottomRight" cx="90%" cy="85%" rx="48%" ry="40%" fx="90%" fy="85%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={isDark ? 0.04 : 0.02} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>

            {/* Premium structural matrix grid */}
            <Pattern id="techGrid" width="6" height="6" patternUnits="userSpaceOnUse">
              <Path 
                d="M 6 0 L 0 0 0 6" 
                fill="none" 
                stroke={isDark ? "rgba(255, 255, 255, 0.008)" : "rgba(0, 102, 255, 0.015)"} 
                strokeWidth="0.04" 
              />
            </Pattern>
          </Defs>

          {/* Render the ambient glows */}
          <Rect x="0" y="0" width="100" height="100" fill="url(#glowTopRight)" />
          <Rect x="0" y="0" width="100" height="100" fill="url(#glowMidLeft)" />
          <Rect x="0" y="0" width="100" height="100" fill="url(#glowBottomRight)" />

          {/* Render the matrix structural layer */}
          <Rect x="0" y="0" width="100" height="100" fill="url(#techGrid)" />

          {/* Premium flowing abstract connection contours (representing travel nodes) */}
          <Path 
            d="M -10,25 C 25,5 65,45 110,20 M -10,27 C 25,7 65,47 110,22" 
            fill="none" 
            stroke={isDark ? "rgba(255, 255, 255, 0.012)" : "rgba(0, 102, 255, 0.025)"} 
            strokeWidth="0.06" 
          />
          <Path 
            d="M -5,65 C 35,85 70,40 105,55 M -5,67 C 35,87 70,42 105,57" 
            fill="none" 
            stroke={isDark ? "rgba(255, 255, 255, 0.008)" : "rgba(0, 102, 255, 0.018)"} 
            strokeWidth="0.05" 
          />
        </Svg>
      </View>

      {/* 3. Screen Content */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

