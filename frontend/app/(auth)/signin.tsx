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
import { signInSchema } from '../../utils/validation';
import { signIn } from '../../services/auth';
import { signInWithGoogle } from '../../services/googleAuth';

interface SignInFormValues {
  email: string;
  password: string;
}

export default function SignInScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();

  const handleSignIn = async (values: SignInFormValues) => {
    setIsLoading(true);
    try {
      const response = await signIn({
        email: values.email,
        password: values.password,
      });
      
      console.log('Sign-in successful:', response.user);
      // Navigate to tabs without alert for better UX
      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.log('Sign-in error:', error);
      
      // Check if account is not verified
      if (error.message.includes('verify')) {
        Alert.alert(
          'Account Not Verified',
          error.message,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Verify Now',
              onPress: () => router.push({
                pathname: '/(auth)/verifyOtp',
                params: { email: values.email }
              }),
            },
          ]
        );
      } else {
        Alert.alert('Error', error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const response = await signInWithGoogle();
      console.log('Google sign-in successful:', response.user);
      router.replace('/(tabs)');
    } catch (error: any) {
      console.log('Google sign-in error:', error);
      Alert.alert('Google Sign-In Failed', error.message);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={theme.colors.gradient.dark as [string, string, ...string[]]}
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
          <View style={styles.header}>
            <Ionicons name="camera" size={60} color={theme.colors.primary} />
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          <View style={styles.formContainer}>
            <Formik
              initialValues={{
                email: '',
                password: '',
              }}
              validationSchema={signInSchema}
              onSubmit={handleSignIn}
            >
              {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
                <View>
                  <AuthInput
                    label="Email"
                    placeholder="Enter your email"
                    value={values.email}
                    onChangeText={handleChange('email')}
                    onBlur={handleBlur('email')}
                    error={errors.email}
                    touched={touched.email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <AuthInput
                    label="Password"
                    placeholder="Enter your password"
                    value={values.password}
                    onChangeText={handleChange('password')}
                    onBlur={handleBlur('password')}
                    error={errors.password}
                    touched={touched.password}
                    secureTextEntry
                  />

                  <TouchableOpacity
                    style={styles.forgotPassword}
                    onPress={() => router.push('/(auth)/forgot')}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
                    onPress={() => handleSubmit()}
                    disabled={isLoading}
                  >
                    <Text style={styles.signInButtonText}>
                      {isLoading ? 'Signing In...' : 'Sign In'}
                    </Text>
                  </TouchableOpacity>

                  {/* Divider */}
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  {/* Google Sign In Button */}
                  <TouchableOpacity
                    style={[styles.googleButton, isGoogleLoading && styles.signInButtonDisabled]}
                    onPress={handleGoogleSignIn}
                    disabled={isGoogleLoading}
                  >
                    <Ionicons name="logo-google" size={20} color="#4285F4" style={styles.googleIcon} />
                    <Text style={styles.googleButtonText}>
                      {isGoogleLoading ? 'Signing In...' : 'Continue with Google'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </Formik>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                <Text style={styles.linkText}>Sign Up</Text>
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
    padding: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  subtitle: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  formContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.large,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontSize: theme.typography.body.fontSize,
  },
  signInButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.medium,
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
  },
  footerText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.small.fontSize,
    marginHorizontal: theme.spacing.md,
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.small,
  },
  googleIcon: {
    marginRight: theme.spacing.sm,
  },
  googleButtonText: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
});
