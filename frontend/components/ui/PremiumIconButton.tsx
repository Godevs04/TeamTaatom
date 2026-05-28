import React from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PremiumGlassCard from './PremiumGlassCard';
import { useTheme } from '../../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

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
  const iconColor = color || theme.colors.blueDeep || theme.colors.primary;

  const isGradient = icon === 'chevron-back' || icon === 'arrow-back' || icon === 'chevron-back-outline' || icon === 'arrow-back-outline' || icon === 'search' || icon === 'search-outline';

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
        <LinearGradient
          colors={isGradient ? ['#1C73B4', '#50C878'] : ['rgba(255,255,255,0.62)', 'rgba(217,239,255,0.28)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Ionicons name={icon} size={iconSize} color={isGradient ? '#FFFFFF' : iconColor} />
      </PremiumGlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  shell: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 7,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
