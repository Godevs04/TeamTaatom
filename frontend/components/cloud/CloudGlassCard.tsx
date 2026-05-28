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
        backgroundColor: 'rgba(20, 24, 30, 0.45)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
        elevation: Platform.OS === 'android' ? 0 : 4,
      }
    : {
        borderRadius,
        backgroundColor: 'rgba(255, 255, 255, 0.35)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.45)',
        shadowColor: '#1A365D',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 24,
        elevation: Platform.OS === 'android' ? 0 : 2,
      };

  return (
    <View style={[styles.card, cardStyle, style]}>
      {blur ? (
        <BlurView
          intensity={65}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
          {...(Platform.OS === 'android'
            ? { experimentalBlurMethod: 'dimezisBlurView' as const }
            : {})}
        />
      ) : null}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.02)']
            : ['rgba(255, 255, 255, 0.65)', 'rgba(255, 255, 255, 0.1)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 0.4 }}
        style={StyleSheet.absoluteFillObject}
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
