import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface LoadingGlobeProps {
  size?: 'small' | 'large' | number;
  color?: string;
  speed?: number;
  style?: StyleProp<ViewStyle>;
}

export default function LoadingGlobe({ size = 'large', color, speed = 2000, style }: LoadingGlobeProps) {
  const { isDark, theme } = useTheme();
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startRotation = () => {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: speed,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    };
    startRotation();
  }, [rotateAnim, speed]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const numericSize = typeof size === 'number'
    ? size
    : size === 'small'
      ? 20
      : 36; // 'large' or default

  const globeColor = color || (isDark ? '#38BDF8' : '#1C73B4');

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={{ transform: [{ rotate: rotation }] }}>
        <Ionicons name="earth" size={numericSize} color={globeColor} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
