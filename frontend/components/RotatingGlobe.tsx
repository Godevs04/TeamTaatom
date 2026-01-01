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
  onLocationPress?: (location: Location) => void;
}

export default function RotatingGlobe({ locations, size = 24, onLocationPress }: RotatingGlobeProps) {
  const { theme } = useTheme();
  const router = useRouter();
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

  const handlePress = () => {
    if (locations.length > 0 && onLocationPress) {
      // If user has posted locations, use the callback
      onLocationPress(locations[0]);
    } else {
      // If no posted locations, navigate to current location map
      router.push('/map/current-location');
    }
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={handlePress}
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
