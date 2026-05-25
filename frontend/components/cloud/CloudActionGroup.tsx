import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';

interface CloudActionGroupProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Single soft surface for stacked list rows — avoids box-in-box nesting */
export default function CloudActionGroup({ children, style }: CloudActionGroupProps) {
  const { theme, mode } = useTheme();
  const isDark =
    mode === 'dark' ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#000000';

  return (
    <View
      style={[
        styles.group,
        {
          backgroundColor: isDark ? 'rgba(25, 25, 25, 0.72)' : 'rgba(255, 255, 255, 0.55)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.90)',
        },
        style,
      ]}
    >
      <BlurView
        intensity={isDark ? 42 : 28}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  content: {
    zIndex: 1,
  },
});
