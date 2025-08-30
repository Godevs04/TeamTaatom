import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { theme } from '../constants/theme';

interface AuthInputProps extends TextInputProps {
  label: string;
  error?: string;
  touched?: boolean;
  rightIcon?: React.ReactNode;
}

export default function AuthInput({
  label,
  error,
  touched,
  rightIcon,
  ...props
}: AuthInputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ position: 'relative' }}>
        <TextInput
          style={[
            styles.input,
            error && touched ? styles.inputError : undefined,
            rightIcon ? { paddingRight: 40 } : undefined,
          ].filter(Boolean)}
          placeholderTextColor={theme.colors.textSecondary}
          {...props}
        />
        {rightIcon && (
          <View style={styles.rightIcon}>{rightIcon}</View>
        )}
      </View>
      {error && touched && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text,
    ...theme.shadows.small,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.small.fontSize,
    marginTop: theme.spacing.xs,
  },
  rightIcon: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
});
