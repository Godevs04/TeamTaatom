import React from 'react';
import { View, StyleSheet, ViewProps, StyleProp, ViewStyle, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';

export interface GlassCardProps extends ViewProps {
  variant?: 'subtle' | 'medium' | 'strong';
  animated?: boolean;
  hoverable?: boolean;
  hasGradientBorder?: boolean;
  gradientColors?: string[];
  customBlurIntensity?: number;
  customBlurTint?: 'light' | 'dark' | 'default';
  error?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const GlassCard = ({ 
  variant = 'medium', 
  animated = false, 
  hoverable = false,
  hasGradientBorder = false,
  gradientColors,
  customBlurIntensity,
  customBlurTint,
  error = false,
  onPress,
  children, 
  style, 
  ...props 
}: GlassCardProps) => {
  const { theme, isDark } = useTheme();

  const getBlurIntensity = () => {
    switch (variant) {
      case 'strong': return 80;
      case 'subtle': return 30;
      default: return theme.glass.blurIntensity || 50;
    }
  };
  
  const blurIntensity = customBlurIntensity ?? getBlurIntensity();
  const blurTint = customBlurTint || (isDark ? 'dark' : 'light');

  const frostTint = error 
    ? (isDark ? 'rgba(255, 69, 58, 0.15)' : 'rgba(255, 69, 58, 0.1)')
    : variant === 'subtle' ? theme.colors.frostTint : 
      variant === 'strong' ? theme.colors.frostTintStrong : 
      theme.colors.frostTintMedium;

  const scale = useSharedValue(1);
  const shakeOffset = useSharedValue(0);
  const isInteractive = !!onPress || hoverable;

  useEffect(() => {
    if (error) {
      shakeOffset.value = withSequence(
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    } else {
      shakeOffset.value = withTiming(0);
    }
  }, [error]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateX: shakeOffset.value }
      ] as any
    };
  });

  const handleHoverIn = () => {
    if (hoverable && !error) {
      scale.value = withSpring(1.02, { damping: 15 });
    }
  };

  const handleHoverOut = () => {
    if (hoverable && !error) {
      scale.value = withSpring(1, { damping: 15 });
    }
  };

  const borderWidth = StyleSheet.hairlineWidth;
  const borderColor = error ? theme.colors.error : theme.colors.glass.border;
  const innerRadius = Math.max(0, theme.borderRadius.md - borderWidth);

  const isAndroid = Platform.OS === 'android';

  // Fallback background color on Android to ensure readability without blur
  const backgroundColor = isAndroid
    ? (isDark ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)')
    : (isDark ? frostTint : theme.colors.glassBackground);

  // Standard elevation/shadow for Android performance fallback
  const androidShadow = isAndroid && !error ? {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  } : {};

  const content = (
    <Pressable
      onPress={onPress}
      disabled={!isInteractive}
      // @ts-ignore - hover events exist on web
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPressIn={() => isInteractive && !error && (scale.value = withSpring(0.98, { damping: 15 }))}
      onPressOut={() => isInteractive && !error && (scale.value = withSpring(1, { damping: 15 }))}
      style={{ width: '100%' }}
    >
      <Animated.View style={[animatedStyle, style]} {...props}>
        {hasGradientBorder && !error ? (
          <LinearGradient
            colors={(gradientColors || [theme.colors.primary, theme.colors.secondary]) as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.container,
              {
                padding: borderWidth,
                borderRadius: theme.borderRadius.md,
                // @ts-ignore - shadows might not be strongly typed here
                ...(theme.shadows.medium),
                ...androidShadow,
              }
            ]}
          >
            <View style={{
              flex: 1,
              borderRadius: innerRadius,
              overflow: 'hidden',
              backgroundColor: backgroundColor,
            }}>
              {!isAndroid && (
                <BlurView
                  intensity={isDark ? blurIntensity : blurIntensity * 0.8}
                  tint={blurTint}
                  style={StyleSheet.absoluteFillObject}
                />
              )}
              <View style={styles.content}>
                {children}
              </View>
            </View>
          </LinearGradient>
        ) : (
          <View style={[styles.container, {
            borderColor: borderColor,
            borderWidth: borderWidth,
            borderRadius: theme.borderRadius.md,
            backgroundColor: backgroundColor,
            // @ts-ignore
            ...(error ? {} : theme.shadows.medium),
            ...androidShadow,
          }]}>
            {!isAndroid && (
              <BlurView
                intensity={isDark ? blurIntensity : blurIntensity * 0.8}
                tint={blurTint}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            <View style={styles.content}>
              {children}
            </View>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );

  if (animated) {
    return (
      <Animated.View entering={FadeIn.duration(400)}>
        {content}
      </Animated.View>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    zIndex: 1,
    flex: 1,
  }
});
