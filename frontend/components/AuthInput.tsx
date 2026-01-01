import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  Platform,
  Dimensions,
} from 'react-native';
import { theme } from '../constants/theme';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

// Elegant font families for each platform
const getFontFamily = (weight: '400' | '500' | '600' = '400') => {
  if (isWeb) {
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    return 'System';
  }
  return 'Roboto';
};

interface AuthInputProps extends TextInputProps {
  label: string;
  error?: string;
  touched?: boolean;
  rightIcon?: React.ReactNode;
  alwaysShowError?: boolean;
  success?: string;
}

export default function AuthInput({
  label,
  error,
  touched,
  rightIcon,
  alwaysShowError,
  success,
  ...props
}: AuthInputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ position: 'relative' }}>
        <TextInput
          style={[
            styles.input,
            error && (touched || alwaysShowError) ? styles.inputError : undefined,
            !error && success ? styles.inputSuccess : undefined,
            rightIcon ? { paddingRight: 40 } : undefined,
          ].filter(Boolean)}
          placeholderTextColor={theme.colors.textSecondary}
          {...props}
        />
        {rightIcon && (
          <View style={styles.rightIcon}>{rightIcon}</View>
        )}
      </View>
      {error && (touched || alwaysShowError) && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      {!error && success && (
        <Text style={styles.successText}>{success}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  label: {
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : theme.typography.body.fontSize,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    width: '100%',
    letterSpacing: 0.1,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: isTablet ? theme.spacing.lg : theme.spacing.md,
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : theme.typography.body.fontSize,
    fontFamily: getFontFamily('400'),
    color: theme.colors.text,
    width: '100%',
    minHeight: isTablet ? 56 : 50,
    ...theme.shadows.small,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      outlineStyle: 'none',
      transition: 'border-color 0.2s ease',
    } as any),
    ...(isIOS && {
      fontFamily: 'System',
    }),
  },
  inputError: {
    borderColor: theme.colors.error,
    borderWidth: 1.5,
  },
  inputSuccess: {
    borderColor: theme.colors.success,
    borderWidth: 1.5,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.small.fontSize,
    fontFamily: getFontFamily('400'),
    marginTop: theme.spacing.xs,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  successText: {
    color: theme.colors.success,
    fontSize: theme.typography.small.fontSize,
    fontFamily: getFontFamily('400'),
    marginTop: theme.spacing.xs,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  rightIcon: {
    position: 'absolute',
    right: isTablet ? 16 : 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    zIndex: 1,
  },
});
