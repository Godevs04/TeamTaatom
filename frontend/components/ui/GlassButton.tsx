import React from 'react';
import { StyleSheet, ViewStyle, StyleProp, ActivityIndicator, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { getFontFamily } from '../../constants/typography';

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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const GlassButton = ({
  variant = 'primary',
  title,
  onPress,
  loading = false,
  disabled = false,
  style,
  iconLeft,
  iconRight,
}: GlassButtonProps) => {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const activeColor = isDark ? '#38BDF8' : '#1C73B4'; // Sky Blue in dark mode, Ocean Blue in light mode
  const primaryTextColor = '#FFFFFF'; // Pure White text for primary
  const secondaryTextColor = activeColor;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => {
    const { withTiming } = require('react-native-reanimated');
    return {
      opacity: withTiming(loading ? 0 : 1, { duration: 200 }),
      transform: [{ scale: withTiming(loading ? 0.95 : 1, { duration: 200 }) }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.96, theme.animation.spring);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, theme.animation.spring);
  };

  const renderContent = () => {
    const textColor = variant === 'primary' ? primaryTextColor : secondaryTextColor;
    return (
      <>
        <Animated.View style={[styles.contentContainer, contentAnimatedStyle]}>
          {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
          <Text
            style={[
              styles.text,
              {
                fontFamily: getFontFamily('bold'),
                color: textColor,
              },
            ]}
          >
            {title}
          </Text>
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </Animated.View>

        {loading && (
          <View style={[StyleSheet.absoluteFillObject, styles.loadingOverlay]}>
            <ActivityIndicator color={textColor} />
          </View>
        )}
      </>
    );
  };

  const buttonStyle: StyleProp<ViewStyle> = [
    styles.button,
    { borderRadius: theme.borderRadius.full },
    style,
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
          colors={['#1C73B4', '#50C878']}
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
        style={[
          buttonStyle,
          animatedStyle,
          disabled && styles.disabled,
          {
            borderWidth: 1.5,
            borderColor: activeColor,
            backgroundColor: isDark ? '#000000' : '#FFFFFF',
            overflow: 'hidden',
          },
        ]}
      >
        {renderContent()}
      </AnimatedPressable>
    );
  }

  // variant === 'ghost'
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
  loadingOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
});
export default GlassButton;
