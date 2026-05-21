import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing, withSequence } from 'react-native-reanimated';

export interface GlowOrbProps {
  color?: string;
  size?: number;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
}

export const GlowOrb = ({ color = 'rgba(255, 76, 34, 0.25)', size = 200, top, left, right, bottom }: GlowOrbProps) => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    translateX.value = withRepeat(
      withSequence(
        withTiming(20, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-20, { duration: 5000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    translateY.value = withRepeat(
      withSequence(
        withTiming(-20, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
        withTiming(20, { duration: 6000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value }
    ] as any
  }));

  return (
    <Animated.View
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          top: top as any,
          left: left as any,
          right: right as any,
          bottom: bottom as any,
        },
        animatedStyle
      ]}
    >
      <LinearGradient
        colors={[color, 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    opacity: 0.6,
  }
});
