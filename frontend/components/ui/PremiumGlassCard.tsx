import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

interface PremiumGlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  strong?: boolean;
  glow?: boolean;
}

export default function PremiumGlassCard({
  children,
  style,
  contentStyle,
  strong = false,
  glow = false,
}: PremiumGlassCardProps) {
  const { theme, isDark } = useTheme();
  const radius = theme.premium?.cardRadius || theme.borderRadius.xl;

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radius,
          borderColor: theme.colors.glassBorder || theme.colors.border,
          shadowColor: theme.colors.softShadow || theme.colors.shadow,
          backgroundColor: strong ? theme.colors.glassStrong : theme.colors.glassSurface,
        },
        glow && { shadowColor: theme.colors.glowBlue || theme.colors.primary, shadowOpacity: isDark ? 0.36 : 0.22 },
        style,
      ]}
    >
      <BlurView
        intensity={strong ? theme.glass.blur.medium : theme.glass.blur.light}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={[
          theme.colors.innerHighlight || 'rgba(255,255,255,0.08)',
          'rgba(255,255,255,0)',
        ]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  content: {
    zIndex: 1,
  },
});
