import React, { useEffect, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
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

function PinSvg({ 
  color = '#FF3B30', 
  icon = 'location',
  size = 38 
}: { 
  color?: string; 
  icon?: keyof typeof Ionicons.glyphMap;
  size?: number 
}) {
  const isDefaultIcon = icon === 'location';

  return (
    <View style={{ width: size, height: size * 1.2, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size * 1.2} viewBox="0 0 24 28.8" style={StyleSheet.absoluteFill}>
        <Path
          d="M12 0C5.37 0 0 5.37 0 12c0 9 12 16.8 12 16.8s12-7.8 12-16.8c0-6.63-5.37-12-12-12z"
          fill={color}
          stroke="#FFFFFF"
          strokeWidth={1.5}
        />
        {isDefaultIcon && (
          <Circle cx={12} cy={12} r={4.5} fill="#FFFFFF" />
        )}
      </Svg>
      {!isDefaultIcon && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={size * 0.38} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

const PremiumMapMarker = memo(function PremiumMapMarker({
  icon = 'location',
  color = '#FF3B30', // Vibrant branded red as default pin color
  active = false,
}: PremiumMapMarkerProps) {
  const pulse = useSharedValue(0);
  const activeProgress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    // Animate active state progress (bloom/shrink transition)
    activeProgress.value = withTiming(active ? 1 : 0, {
      duration: 300,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });

    if (active) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
        -1,
        false
      );
    } else {
      pulse.value = 0;
    }
  }, [active, activeProgress, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: activeProgress.value * 0.28 * (1 - pulse.value),
    transform: [{ scale: (1 + pulse.value * 1.4) * activeProgress.value }],
  }));

  const pinStyle = useAnimatedStyle(() => ({
    opacity: activeProgress.value,
    transform: [{ scale: activeProgress.value }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 1 - activeProgress.value,
    transform: [{ scale: 1 - activeProgress.value }],
    position: 'absolute',
  }));

  return (
    <View style={styles.container}>
      {/* Pulse ring for active state */}
      <Animated.View style={[styles.pulse, { backgroundColor: color }, pulseStyle]} />

      {/* Active Pin State */}
      <Animated.View style={[styles.pin, pinStyle]}>
        <PinSvg color={color} icon={icon} />
      </Animated.View>

      {/* Inactive Dot State */}
      <Animated.View style={[styles.dotContainer, dotStyle]}>
        <View style={styles.dot} />
      </Animated.View>
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.active === nextProps.active &&
    prevProps.icon === nextProps.icon &&
    prevProps.color === nextProps.color
  );
});

export default PremiumMapMarker;

const styles = StyleSheet.create({
  container: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  pin: {
    width: 38,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 5.5,
    elevation: 8,
  },
  dotContainer: {
    position: 'absolute',
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#8A96A8', // desaturated blue-grey
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
});


