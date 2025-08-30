import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, ColorValue } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import axios from "../../services/api";
import { theme } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from "@expo/vector-icons";
import { Formik } from "formik";
import AuthInput from "../../components/AuthInput";
import { resetPasswordSchema } from '../../utils/validation';

export default function ResetPassword() {
  const params = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [initialEmail, setInitialEmail] = useState(
    typeof params.email === 'string' ? params.email : Array.isArray(params.email) ? params.email[0] : ''
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      colors={theme.colors.gradient.dark as [ColorValue, ColorValue, ...ColorValue[]]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Ionicons name="lock-open" size={60} color={theme.colors.primary} />
            <Text style={styles.title}>Create New Password</Text>
            <Text style={styles.subtitle}>
              Enter your new Password and confirm to reset your password.
            </Text>
          </View>

          <View style={styles.formContainer}>
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
                <View>
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
                          color={theme.colors.textSecondary}
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
                          color={theme.colors.textSecondary}
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
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: theme.spacing.lg },
  backButton: { position: 'absolute', top: 50, left: theme.spacing.lg, zIndex: 1 },
  header: { alignItems: 'center', marginBottom: theme.spacing.xxl },
  title: { fontSize: 32, fontWeight: 'bold', color: theme.colors.text, marginTop: theme.spacing.md },
  subtitle: { fontSize: theme.typography.body.fontSize, color: theme.colors.textSecondary, marginTop: theme.spacing.sm, textAlign: 'center', lineHeight: 22 },
  formContainer: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, ...theme.shadows.large },
  resetButton: { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.md, paddingVertical: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.lg, ...theme.shadows.medium },
  resetButtonDisabled: { opacity: 0.6 },
  resetButtonText: { color: theme.colors.text, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
  error: { color: 'red', marginTop: 10, textAlign: 'center' },
  success: { color: 'green', marginTop: 10, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.lg },
  footerText: { color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize },
  linkText: { color: theme.colors.primary, fontSize: theme.typography.body.fontSize, fontWeight: '600' },
});