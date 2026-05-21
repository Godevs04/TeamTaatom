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
  /** Softer surface — less inner glow when nesting list rows inside */
  subtle?: boolean;
}

export default function PremiumGlassCard({
  children,
  style,
  contentStyle,
  strong = false,
  glow = false,
  subtle = false,
}: PremiumGlassCardProps) {
  const { theme, isDark } = useTheme();
  const radius = theme.premium?.cardRadius || theme.borderRadius.xl;
  const surface = strong ? theme.colors.glassStrong : theme.colors.glassSurface;
  const cardShadow = glow ? (theme.colors.glowBlue || theme.colors.primary) : (theme.colors.softShadow || theme.colors.shadow);
  const showInnerLift = !subtle;
  const shadowOpacity = subtle
    ? (isDark ? 0.12 : 0.1)
    : glow
      ? (isDark ? 0.26 : 0.24)
      : (isDark ? 0.18 : 0.16);

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radius,
          borderColor: subtle
            ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(91, 188, 248, 0.12)')
            : (theme.colors.glassBorder || theme.colors.border),
          shadowColor: cardShadow,
          backgroundColor: surface,
          shadowOpacity,
          shadowRadius: subtle ? 16 : 24,
          elevation: subtle ? 4 : 8,
        },
        style,
      ]}
    >
      <BlurView
        intensity={subtle ? theme.glass.blur.light : strong ? theme.glass.blur.medium : theme.glass.blur.light}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        colors={[
          theme.colors.innerHighlight || 'rgba(255,255,255,0.08)',
          isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.18)',
        ]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
      />
      {showInnerLift ? (
        <LinearGradient
          colors={[
            'rgba(255,255,255,0.36)',
            'rgba(91,188,248,0.08)',
          ]}
          style={[styles.innerLift, subtle && styles.innerLiftSubtle]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          pointerEvents="none"
        />
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 8,
  },
  innerLift: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.58,
  },
  innerLiftSubtle: {
    opacity: 0.28,
  },
  content: {
    zIndex: 1,
  },
});
