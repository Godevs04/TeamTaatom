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
    if (isDark) {
      switch (variant) {
        case 'strong': return 30;
        case 'subtle': return 10;
        default: return 15;
      }
    } else {
      switch (variant) {
        case 'strong': return 80;
        case 'subtle': return 30;
        default: return 45;
      }
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
    ? (isDark ? 'rgba(25, 25, 25, 0.9)' : 'rgba(255, 255, 255, 0.95)')
    : (isDark ? frostTint : (theme.colors.lightSurfaceSecondary || 'rgba(255, 255, 255, 0.40)'));

  // Standard elevation/shadow for Android performance fallback
  const androidShadow = isAndroid && !error ? {
    elevation: 4,
    shadowColor: isDark ? '#000' : '#1A2B3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.15 : 0.05,
    shadowRadius: 6,
  } : {};

  const borderStyles = isDark ? {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderTopColor: error ? theme.colors.error : 'rgba(255, 255, 255, 0.08)',
    borderLeftColor: error ? theme.colors.error : 'rgba(255, 255, 255, 0.08)',
    borderBottomColor: error ? theme.colors.error : 'rgba(255, 255, 255, 0.08)',
    borderRightColor: error ? theme.colors.error : 'rgba(255, 255, 255, 0.08)',
  } : {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderTopColor: error ? theme.colors.error : 'rgba(255, 255, 255, 0.8)',
    borderLeftColor: error ? theme.colors.error : 'rgba(255, 255, 255, 0.8)',
    borderBottomColor: error ? theme.colors.error : 'rgba(255, 255, 255, 0.2)',
    borderRightColor: error ? theme.colors.error : 'rgba(255, 255, 255, 0.2)',
  };

  const finalShadow = error 
    ? {} 
    : isDark 
      ? {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.45,
          shadowRadius: 32,
          elevation: 10,
        }
      : {
          shadowColor: '#1A2B3C',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 24,
          elevation: 6,
        };

  const renderCardContent = () => {
    if (hasGradientBorder && !error && !isDark) {
      return (
        <LinearGradient
          colors={(gradientColors || [theme.colors.primary, theme.colors.secondary]) as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.container,
            {
              padding: borderWidth,
              borderRadius: theme.borderRadius.md,
              // @ts-ignore
              ...(theme.shadows.medium),
              ...androidShadow,
            }
          ]}
        >
          <BlurView
            intensity={40}
            tint="light"
            style={{
              flex: 1,
              borderRadius: innerRadius,
              overflow: 'hidden',
              backgroundColor: 'rgba(255, 255, 255, 0.6)',
            }}
            {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
          >
            <View style={styles.content}>
              {children}
            </View>
          </BlurView>
        </LinearGradient>
      );
    }

    const containerStyle: ViewStyle = {
      borderRadius: theme.borderRadius.md,
      backgroundColor: isDark ? 'rgba(25, 25, 25, 0.72)' : 'rgba(255, 255, 255, 0.6)',
      // @ts-ignore
      ...finalShadow,
      ...(isDark ? {} : androidShadow),
      ...borderStyles,
    };

    return (
      <BlurView
        intensity={isDark ? 20 : 40}
        tint={isDark ? 'dark' : 'light'}
        style={[styles.container, containerStyle]}
        {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
      >
        {isDark ? (
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.01)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        ) : (
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.20)', 'rgba(255, 255, 255, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        <View style={styles.content}>
          {children}
        </View>
      </BlurView>
    );
  };

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
        {renderCardContent()}
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
