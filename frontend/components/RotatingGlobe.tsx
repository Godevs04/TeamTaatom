import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

interface RotatingGlobeProps {
  locations: Location[];
  size?: number;
  onLocationPress?: (location: Location) => void;
}

export default function RotatingGlobe({ locations, size = 24, onLocationPress }: RotatingGlobeProps) {
  const { theme } = useTheme();
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startRotation = () => {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        })
      ).start();
    };

    startRotation();
  }, [rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const styles = StyleSheet.create({
    container: {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={() => onLocationPress && onLocationPress(locations[0])}
      activeOpacity={0.7}
    >
      <Animated.View style={{ transform: [{ rotate: rotation }] }}>
        <Ionicons 
          name="earth" 
          size={size} 
          color={theme.colors.primary} 
        />
      </Animated.View>
    </TouchableOpacity>
  );
}
