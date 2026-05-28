import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

export interface GradientCardProps {
  children: React.ReactNode;
  variant?: 'border' | 'top-edge';
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export default function GradientCard({
  children,
  variant = 'border',
  style,
  contentStyle,
}: GradientCardProps) {
  const { isDark } = useTheme();

  if (variant === 'top-edge') {
    return (
      <View
        style={[
          styles.topEdgeCard,
          {
            backgroundColor: isDark ? '#000000' : '#FFFFFF',
            borderColor: 'rgba(28, 115, 180, 0.15)',
          },
          style,
        ]}
      >
        <LinearGradient
          colors={['#1C73B4', '#50C878']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topEdgeLine}
        />
        <View style={contentStyle}>{children}</View>
      </View>
    );
  }

  // Variant: 'border'
  return (
    <LinearGradient
      colors={['#1C73B4', '#50C878']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.outerWrapper, style]}
    >
      <BlurView
        intensity={50}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.innerCore,
          {
            backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)',
          }
        ]}
      >
        <View style={[styles.content, contentStyle]}>{children}</View>
      </BlurView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    borderRadius: 16,
    padding: 1.5,
    overflow: 'hidden',
  },
  innerCore: {
    flex: 1,
    width: '100%',
    height: '100%',
    margin: 0,
    borderRadius: 14.5,
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    zIndex: 1,
  },
  topEdgeCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  topEdgeLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    zIndex: 2,
  },
});
