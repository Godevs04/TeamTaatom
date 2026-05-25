import React from 'react';
import { StyleSheet, ViewStyle, StyleProp, ActivityIndicator, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { getFontFamily } from '../../constants/typography';
import { BlurView } from 'expo-blur';

export interface GlassButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const getContrastColor = (bgColor: string, defaultDark = '#121212', defaultLight = '#FFFFFF') => {
  if (!bgColor) return defaultLight;
  let color = bgColor.trim().toLowerCase();

  // Parse rgb / rgba
  if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0], 10);
      const g = parseInt(matches[1], 10);
      const b = parseInt(matches[2], 10);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 125 ? defaultDark : defaultLight;
    }
  }

  // Parse Hex
  if (color.startsWith('#')) {
    color = color.slice(1);
  }

  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }

  if (color.length === 6) {
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 125 ? defaultDark : defaultLight;
  }

  return defaultLight;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const GlassButton = ({ variant = 'primary', title, onPress, loading = false, disabled = false, style, iconLeft, iconRight }: GlassButtonProps) => {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const primaryTextColor = React.useMemo(() => {
    const startColor = (theme.colors as any).gradient?.button?.[0] || '#FFFFFF';
    return getContrastColor(startColor, '#121212', '#FFFFFF');
  }, [theme.colors]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => {
    // We import withTiming from reanimated for smooth transitions
    const { withTiming } = require('react-native-reanimated');
    return {
      opacity: withTiming(loading ? 0 : 1, { duration: 200 }),
      transform: [{ scale: withTiming(loading ? 0.95 : 1, { duration: 200 }) }]
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.96, theme.animation.spring);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, theme.animation.spring);
  };

  const renderContent = () => {
    return (
      <>
        <Animated.View style={[styles.contentContainer, contentAnimatedStyle]}>
          {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
          <Text style={[
            styles.text, 
            { 
              fontFamily: getFontFamily('bold'),
              color: variant === 'primary' ? primaryTextColor : theme.colors.text 
            }
          ]}>
            {title}
          </Text>
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </Animated.View>
        
        {loading && (
          <View style={[StyleSheet.absoluteFillObject, styles.loadingOverlay]}>
            <ActivityIndicator color={variant === 'primary' ? primaryTextColor : theme.colors.text} />
          </View>
        )}
      </>
    );
  };

  const buttonStyle: StyleProp<ViewStyle> = [
    styles.button,
    { borderRadius: theme.borderRadius.full },
    style
  ];

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[buttonStyle, animatedStyle, disabled && styles.disabled, { overflow: 'hidden' }]}
      >
        <LinearGradient
          colors={theme.colors.gradient.button as [string, string]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {renderContent()}
      </AnimatedPressable>
    );
  }

  if (variant === 'secondary') {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[buttonStyle, animatedStyle, disabled && styles.disabled, {
          borderWidth: theme.glass.border.width,
          borderColor: theme.glass.border.color,
          backgroundColor: isDark ? theme.colors.frostTintMedium : theme.colors.glassBackground,
          overflow: 'hidden'
        }]}
      >
        <BlurView intensity={theme.glass.blur.medium} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        <View style={styles.contentZIndex}>{renderContent()}</View>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[buttonStyle, animatedStyle, disabled && styles.disabled, { backgroundColor: 'transparent' }]}
    >
      {renderContent()}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  text: {
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  contentZIndex: {
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  }
});
