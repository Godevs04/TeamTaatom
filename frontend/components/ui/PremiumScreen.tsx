import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { GradientBackground } from './GradientBackground';

interface PremiumScreenProps {
  children: React.ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  hideBackgroundDesign?: boolean;
}

export default function PremiumScreen({
  children,
  edges = ['top'],
  style,
  contentStyle,
  hideBackgroundDesign = false,
}: PremiumScreenProps) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }, style]} edges={edges}>
      <GradientBackground>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </GradientBackground>
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
});
