import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

interface RotatingGlobeProps {
  locations: Location[];
  size?: number;
  onPress?: () => void;
  onLocationPress?: (location: Location) => void;
}

export default function RotatingGlobe({ locations, size = 24, onPress, onLocationPress }: RotatingGlobeProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const hasLocations = locations.length > 0;

  useEffect(() => {
    if (!hasLocations) return;
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
  }, [rotateAnim, hasLocations]);

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

  const handlePress = () => {
    if (!hasLocations) return;
    if (onPress) {
      onPress();
      return;
    }
    if (onLocationPress) {
      onLocationPress(locations[0]);
      return;
    }
    router.push('/map/current-location');
  };

  if (!hasLocations) {
    return (
      <View style={styles.container}>
        <Ionicons name="globe-outline" size={size} color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Animated.View style={{ transform: [{ rotate: rotation }] }}>
        <Ionicons name="earth" size={size} color={theme.colors.primary} />
      </Animated.View>
    </TouchableOpacity>
  );
}
