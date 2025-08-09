import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { theme } from '../constants/theme';

export const Card: React.FC<ViewProps> = ({ style, children, ...rest }) => {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    padding: theme.spacing.md,
    ...theme.shadows.medium,
  },
});
