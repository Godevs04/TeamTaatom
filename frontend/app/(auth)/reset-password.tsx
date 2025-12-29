import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, ColorValue, Image, Dimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import axios from "../../services/api";
import { theme } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from "@expo/vector-icons";
import { Formik } from "formik";
import AuthInput from "../../components/AuthInput";
import { resetPasswordSchema } from '../../utils/validation';
import Constants from 'expo-constants';
import { LOGO_IMAGE } from '../../utils/config';

// Responsive dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Professional and elegant font families for each platform
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) {
    // Use Poppins for elegant, modern look on web
    return '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    // Use SF Pro Display for headings, SF Pro Text for body (System handles this)
    return 'System';
  }
  // Android: Use Roboto (default) or custom elegant font
  return 'Roboto';
};

export default function ResetPassword() {
  const params = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [initialEmail, setInitialEmail] = useState(
    typeof params.email === 'string' ? params.email : Array.isArray(params.email) ? params.email[0] : ''
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { theme: appTheme } = useTheme();

  useEffect(() => {
    if (params.email) {
      setInitialEmail(
        typeof params.email === 'string' ? params.email : Array.isArray(params.email) ? params.email[0] : ''
      );
    }
  }, [params.email]);

  const handleForgotPassword = async (values: any) => {
    setIsLoading(true);
    setMessage("");
    try {
      const res = await axios.post("/auth/reset-password", {
        token: values.token,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
        email: values.email,
      });
      setMessage(res.data.message || "Password reset successful!");
      setTimeout(() => {
        router.push('/(auth)/signin');
      }, 1200);
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Error resetting password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={appTheme.colors.gradient.dark as [ColorValue, ColorValue, ...ColorValue[]]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : isWeb ? undefined : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={!isWeb}
            keyboardShouldPersistTaps="handled"
          >
          <View style={styles.navBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color={appTheme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.navTitle}>Create New Password</Text>
            <View style={styles.backButton} />
          </View>

          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: LOGO_IMAGE }}
                style={styles.logo}
                accessibilityLabel="Taatom Logo"
              />
            </View>
            <Text style={styles.title}>Create New Password</Text>
            <Text style={styles.subtitle}>
              Enter your new Password and confirm to reset your password.
            </Text>
          </View>

          <View style={[styles.formContainer,{ backgroundColor: appTheme.colors.surface }]}>
            <Formik
              initialValues={{
                token: '',
                email: initialEmail,
                newPassword: '',
                confirmPassword: '',
              }}
              validationSchema={resetPasswordSchema}
              onSubmit={handleForgotPassword}
              enableReinitialize
            >
              {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
                <View style={styles.formFields}>
                  <AuthInput
                    label="Token"
                    placeholder="Enter token from email address"
                    value={values.token}
                    onChangeText={handleChange('token')}
                    onBlur={handleBlur('token')}
                    error={errors.token}
                    touched={touched.token}
                    autoCapitalize="none"
                    autoFocus
                  />
                  <AuthInput
                    label="Email"
                    placeholder="Enter your email address"
                    value={values.email}
                    onChangeText={handleChange('email')}
                    onBlur={handleBlur('email')}
                    error={errors.email}
                    touched={touched.email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <AuthInput
                    label="New Password"
                    placeholder="Enter your new password"
                    value={values.newPassword}
                    onChangeText={handleChange('newPassword')}
                    onBlur={handleBlur('newPassword')}
                    error={errors.newPassword}
                    touched={touched.newPassword}
                    autoCapitalize="none"
                    secureTextEntry={!showPassword}
                    rightIcon={
                      <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                        <Ionicons
                          name={showPassword ? 'eye-off' : 'eye'}
                          size={22}
                          color={appTheme.colors.textSecondary}
                        />
                      </TouchableOpacity>
                    }
                  />
                  <AuthInput
                    label="Confirm Password"
                    placeholder="Enter your confirm password"
                    value={values.confirmPassword}
                    onChangeText={handleChange('confirmPassword')}
                    onBlur={handleBlur('confirmPassword')}
                    error={errors.confirmPassword}
                    touched={touched.confirmPassword}
                    autoCapitalize="none"
                    secureTextEntry={!showConfirmPassword}
                    rightIcon={
                      <TouchableOpacity onPress={() => setShowConfirmPassword((prev) => !prev)}>
                        <Ionicons
                          name={showConfirmPassword ? 'eye-off' : 'eye'}
                          size={22}
                          color={appTheme.colors.textSecondary}
                        />
                      </TouchableOpacity>
                    }
                  />
                  {message ? (
                    <Text style={message.includes("success") ? styles.success : styles.error}>
                      {message}
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
                    onPress={() => handleSubmit()}
                    disabled={isLoading}
                    accessibilityLabel="Reset password"
                  >
                    <Text style={styles.resetButtonText}>
                      {isLoading ? 'Resetting...' : 'Reset Password'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </Formik>
            <View style={styles.footer}>
              <Text style={styles.footerText}>Remember your password? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signin')}>
                <Text style={styles.linkText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    paddingVertical: isTablet ? theme.spacing.xxl : theme.spacing.xl,
    minHeight: isWeb ? screenHeight : screenHeight,
    ...(isWeb && {
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
    paddingBottom: 16,
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    flex: 1,
    fontSize: isTablet ? 24 : 20,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    letterSpacing: 0.3,
    ...(isWeb && {
      fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: isTablet ? theme.spacing.xxl * 1.5 : theme.spacing.xxl,
    width: '100%',
  },
  logoContainer: {
    width: isTablet ? 120 : 100,
    height: isTablet ? 120 : 100,
    backgroundColor: 'transparent',
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    // Subtle backdrop blur effect for better logo visibility
    ...(isWeb && {
      backdropFilter: 'blur(10px)',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    } as any),
  },
  logo: {
    width: isTablet ? 96 : 80,
    height: isTablet ? 96 : 80,
    resizeMode: 'contain' as const,
    // Ensure logo blends with background
    tintColor: undefined, // Remove any tint to show original colors
  },
  title: {
    fontSize: isTablet ? 56 : isWeb ? 52 : 48,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    letterSpacing: isIOS ? -0.5 : 0,
    ...(isWeb && {
      fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: '700',
    }),
  },
  subtitle: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : theme.typography.body.fontSize,
    fontFamily: getFontFamily('400'),
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    textAlign: 'center',
    lineHeight: isTablet ? 26 : 22,
    letterSpacing: 0.2,
    paddingHorizontal: theme.spacing.md,
    ...(isWeb && {
      fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: '400',
    }),
  },
  formContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
    width: '100%',
    maxWidth: isWeb ? 480 : isTablet ? 600 : 500,
    alignSelf: 'center',
    ...theme.shadows.large,
    ...(isWeb && {
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    } as any),
  },
  formFields: {
    width: '100%',
  },
  resetButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: isTablet ? theme.spacing.lg : theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
    minHeight: isTablet ? 56 : 50,
    ...theme.shadows.medium,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  resetButtonDisabled: {
    opacity: 0.6,
    ...(isWeb && {
      cursor: 'not-allowed',
    } as any),
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : theme.typography.body.fontSize,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 0.3,
    ...(isWeb && {
      fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  error: {
    color: theme.colors.error,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    fontSize: theme.typography.small.fontSize,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  success: {
    color: theme.colors.success,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    fontSize: theme.typography.small.fontSize,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    flexWrap: 'wrap',
  },
  footerText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: theme.typography.body.fontSize,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
      cursor: 'pointer',
    } as any),
  },
});