import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, TextInputProps, StyleProp, ViewStyle, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { BlurView } from 'expo-blur';
import { getFontFamily } from '../../constants/typography';

import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  interpolateColor,
  interpolate,
  withSequence
} from 'react-native-reanimated';

export interface GlassInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const GlassInput = ({ label, error, containerStyle, onFocus, onBlur, leftIcon, rightIcon, onChangeText, value, defaultValue, ...props }: GlassInputProps) => {
  const { theme, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [internalValue, setInternalValue] = useState(value || defaultValue || '');
  
  const focusedAnim = useSharedValue(0);
  const labelAnim = useSharedValue(value || defaultValue ? 1 : 0);
  const shakeAnim = useSharedValue(0);

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  useEffect(() => {
    const hasContentOrFocused = isFocused || internalValue.length > 0;
    labelAnim.value = withTiming(hasContentOrFocused ? 1 : 0, { duration: 200 });
  }, [isFocused, internalValue, labelAnim]);

  useEffect(() => {
    if (error) {
      shakeAnim.value = withSequence(
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }
  }, [error, shakeAnim]);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    focusedAnim.value = withTiming(1, { duration: 200 });
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    focusedAnim.value = withTiming(0, { duration: 200 });
    onBlur?.(e);
  };

  const handleChangeText = (text: string) => {
    setInternalValue(text);
    onChangeText?.(text);
  };

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shakeAnim.value }],
      borderColor: error 
        ? theme.colors.error 
        : interpolateColor(
            focusedAnim.value,
            [0, 1],
            ['rgba(28, 115, 180, 0.20)', isDark ? '#FFFFFF' : '#000000']
          ),
      borderWidth: 1.5,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: error 
        ? (isDark ? 'rgba(255, 59, 48, 0.1)' : 'rgba(255, 59, 48, 0.05)') 
        : (isDark ? '#000000' : '#FFFFFF'),
    };
  }, [error, isDark, theme, focusedAnim, shakeAnim]);

  const animatedLabelStyle = useAnimatedStyle(() => {
    return {
      top: interpolate(labelAnim.value, [0, 1], [16, 6]),
      fontSize: interpolate(labelAnim.value, [0, 1], [16, 12]),
      color: error 
        ? theme.colors.error 
        : interpolateColor(
            labelAnim.value,
            [0, 1],
            [theme.colors.textSecondary, theme.colors.primary]
          ),
    };
  }, [labelAnim, error, theme]);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <Animated.View style={[styles.container, animatedContainerStyle]}>
        <BlurView intensity={theme.glass.blur.light} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        
        {label && (
          <Animated.Text style={[
            styles.floatingLabel, 
            animatedLabelStyle,
            { left: leftIcon ? 46 : 16, fontFamily: getFontFamily('medium') }
          ]}>
            {label}
          </Animated.Text>
        )}

        <View style={styles.inputContentContainer}>
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
          <TextInput
            style={[
              styles.input,
              {
                color: theme.colors.text,
                fontFamily: getFontFamily('regular'),
                paddingTop: label ? 16 : 0, // Add top padding if there's a floating label
              }
            ]}
            placeholderTextColor={theme.colors.textSecondary}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChangeText={handleChangeText}
            value={value}
            defaultValue={defaultValue}
            {...props}
            // If we are using floating labels, we probably don't want the default placeholder to show when unfocused
            placeholder={isFocused || !label ? props.placeholder : ''}
          />
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </View>
      </Animated.View>
      {error && <Text style={[styles.error, { color: theme.colors.error, fontFamily: getFontFamily('regular') }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  container: {
    height: 56, // Increased slightly to accommodate floating label better
    overflow: 'hidden',
    justifyContent: 'center',
  },
  inputContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: 16,
    zIndex: 1,
  },
  floatingLabel: {
    position: 'absolute',
    zIndex: 2,
  },
  leftIcon: {
    marginRight: 10,
  },
  rightIcon: {
    marginLeft: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
  },
  error: {
    fontSize: 12,
    marginTop: 6,
    paddingHorizontal: 4,
  }
});
