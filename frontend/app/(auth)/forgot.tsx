import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Formik } from 'formik';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';
import AuthInput from '../../components/AuthInput';
import { forgotPasswordSchema } from '../../utils/validation';
import { forgotPassword } from '../../services/auth';
import { ColorValue } from "react-native";
interface ForgotPasswordFormValues {
  email: string;
}

export default function ForgotPasswordScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleForgotPassword = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      await forgotPassword(values.email);
      setSuccess('Password reset instructions have been sent to your email.');
      setTimeout(() => {
        router.push({ pathname: '/(auth)/reset-password', params: { email: values.email } });
      }, 1200);
    } catch (error: any) {
      setError(error.message || 'Something went wrong.');
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
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you instructions to reset your password.
            </Text>
          </View>

          <View style={styles.formContainer}>
            <Formik
              initialValues={{ email: '' }}
              validationSchema={forgotPasswordSchema}
              onSubmit={handleForgotPassword}
            >
              {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
                <View>
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
                    autoFocus
                    returnKeyType="done"
                  />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  {success ? <Text style={styles.success}>{success}</Text> : null}
                  <TouchableOpacity
                    style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
                    onPress={() => handleSubmit()}
                    disabled={isLoading}
                    accessibilityLabel="Send reset email"
                  >
                    <Text style={styles.resetButtonText}>
                      {isLoading ? 'Sending...' : 'Send Reset Email'}
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
