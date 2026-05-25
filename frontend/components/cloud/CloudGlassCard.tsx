import React from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { cloudDesign } from '../../constants/cloudDesign';

export interface CloudGlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
  /** Frosted blur — disable in long lists if needed */
  blur?: boolean;
}

export function useCloudGlassCardTokens() {
  const { mode, theme } = useTheme();
  const isDark =
    mode === 'dark' ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#06121F' ||
    theme.colors.background === '#000000';

  const tokens = isDark ? cloudDesign.postGlass.dark : cloudDesign.postGlass.light;
  return {
    isDark,
    fill: tokens.fill,
    border: tokens.border,
    shadowColor: tokens.shadowColor,
    shadowOpacity: tokens.shadowOpacity,
    insetTop: tokens.insetTop,
    blurIntensity: cloudDesign.postGlass.blurIntensity,
    textPrimary: isDark ? '#F8FCFF' : cloudDesign.textDark,
    textSecondary: isDark ? 'rgba(248,252,255,0.65)' : cloudDesign.textMid,
    textMuted: isDark ? 'rgba(248,252,255,0.45)' : cloudDesign.textMuted,
  };
}

export default function CloudGlassCard({
  children,
  style,
  contentStyle,
  borderRadius = cloudDesign.radius.postCard,
  blur = true,
}: CloudGlassCardProps) {
  const glass = useCloudGlassCardTokens();
  const isDark = glass.isDark;

  const cardStyle = isDark
    ? {
        borderRadius,
        backgroundColor: 'rgba(25, 25, 25, 0.72)',
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderBottomWidth: 1,
        borderRightWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
        borderLeftColor: 'rgba(255, 255, 255, 0.08)',
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        borderRightColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 32,
        elevation: 10,
      }
    : {
        borderRadius,
        borderColor: glass.border,
        backgroundColor: glass.fill,
        shadowColor: glass.shadowColor,
        shadowOpacity: glass.shadowOpacity as number,
        shadowOffset: cloudDesign.postGlass.shadowOffset,
        shadowRadius: cloudDesign.postGlass.shadowRadius,
        elevation: cloudDesign.postGlass.elevation,
        borderWidth: 1,
      };

  return (
    <View style={[styles.card, cardStyle, style]}>
      {blur ? (
        <BlurView
          intensity={isDark ? 15 : glass.blurIntensity}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
          {...(Platform.OS === 'android'
            ? { experimentalBlurMethod: 'dimezisBlurView' as const }
            : {})}
        />
      ) : null}
      {isDark ? (
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.01)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <LinearGradient
          colors={[glass.insetTop, 'transparent']}
          style={[styles.insetHighlight, { borderTopLeftRadius: borderRadius, borderTopRightRadius: borderRadius }]}
          pointerEvents="none"
        />
      )}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  insetHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    opacity: 1,
  },
  content: {
    zIndex: 1,
  },
});
