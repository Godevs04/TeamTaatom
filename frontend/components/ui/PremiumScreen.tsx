import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

interface PremiumScreenProps {
  children: React.ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export default function PremiumScreen({
  children,
  edges = ['top'],
  style,
  contentStyle,
}: PremiumScreenProps) {
  const { theme, isDark } = useTheme();
  const gradient = (theme.premium?.screenGradient || theme.colors.appBackgroundGradient) as [string, string, string];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }, style]} edges={edges}>
      <LinearGradient colors={gradient} style={StyleSheet.absoluteFillObject} />
      <View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: theme.colors.glowBlue || theme.colors.primary,
            opacity: isDark ? 0.26 : 0.18,
          },
        ]}
      />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -120,
    bottom: Platform.OS === 'ios' ? 80 : 64,
    transform: [{ rotate: '-18deg' }],
  },
});
