import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface PremiumMapMarkerProps {
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  active?: boolean;
}

export default function PremiumMapMarker({
  icon = 'location',
  color = '#5EA2FF',
  active = false,
}: PremiumMapMarkerProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
        -1,
        false
      );
    } else {
      pulse.value = 0;
    }
  }, [active, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: active ? 0.28 * (1 - pulse.value) : 0,
    transform: [{ scale: 1 + pulse.value * 1.4 }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.pulse, { backgroundColor: color }, pulseStyle]} />
      <View style={[styles.pin, { borderColor: `${color}66` }]}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 7,
  },
});

