import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
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
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(91, 188, 248, 0.06)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(91, 188, 248, 0.1)',
        },
        style,
      ]}
    >
      {children}
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
});
