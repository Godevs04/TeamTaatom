import React, { useEffect, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../constants/colors';

interface PremiumMapMarkerProps {
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  active?: boolean;
  isActive?: boolean;
  pointType?: 'start' | 'end' | 'default';
}

const PremiumMapMarker = memo(function PremiumMapMarker({
  icon = 'location',
  color,
  active = false,
  isActive,
  pointType = 'default',
}: PremiumMapMarkerProps) {
  const activeState = isActive ?? active;
  const markerColor = pointType === 'start'
    ? colors.success
    : pointType === 'end'
      ? colors.pinActive
      : activeState
        ? colors.pinActive
        : (color || colors.pinInactive);
  const pulse = useSharedValue(0);
  const activeProgress = useSharedValue(activeState ? 1 : 0);

  useEffect(() => {
    // Animate active state progress (bloom/shrink transition)
    activeProgress.value = withTiming(activeState ? 1 : 0, {
      duration: 300,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });

    if (activeState) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
        -1,
        false
      );
    } else {
      pulse.value = 0;
    }
  }, [activeState, activeProgress, pulse]);

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
      <Animated.View style={[styles.pulse, { backgroundColor: markerColor }, pulseStyle]} />

      {/* Active Pin State */}
      <Animated.View style={[styles.pin, pinStyle]}>
        <View style={[styles.dot, styles.activeDot, { backgroundColor: markerColor }]}>
          {icon !== 'location' && (
            <Ionicons name={icon} size={10} color="#FFFFFF" />
          )}
        </View>
      </Animated.View>

      {/* Inactive Dot State */}
      <Animated.View style={[styles.dotContainer, dotStyle]}>
        <View style={[styles.dot, { backgroundColor: markerColor }]} />
      </Animated.View>
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.active === nextProps.active &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.icon === nextProps.icon &&
    prevProps.color === nextProps.color &&
    prevProps.pointType === nextProps.pointType
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
    width: 16,
    height: 16,
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
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  activeDot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

