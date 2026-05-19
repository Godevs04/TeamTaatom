import React from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PremiumGlassCard from './PremiumGlassCard';
import { useTheme } from '../../context/ThemeContext';

interface PremiumIconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
  iconSize?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export default function PremiumIconButton({
  icon,
  onPress,
  size = 44,
  iconSize = 22,
  color,
  style,
  accessibilityLabel,
}: PremiumIconButtonProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[{ width: size, height: size }, style]}
    >
      <PremiumGlassCard
        glow
        style={[styles.shell, { width: size, height: size, borderRadius: size / 2 }]}
        contentStyle={styles.content}
      >
        <Ionicons name={icon} size={iconSize} color={color || theme.colors.text} />
      </PremiumGlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  shell: {
    shadowRadius: 16,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
