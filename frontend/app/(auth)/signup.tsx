import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Formik } from 'formik';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';
import { useAlert } from '../../context/AlertContext';
import AuthInput from '../../components/AuthInput';
import { signUpSchema } from '../../utils/validation';
import { signUp, checkUsernameAvailability } from '../../services/auth';
import { signInWithGoogle } from '../../services/googleAuth';
import Constants from 'expo-constants';

// Lightweight watcher for debounced username availability checks
function UsernameAvailabilityWatcher({
  username,
  onUnavailable,
  onAvailable,
}: {
  username: string;
  onUnavailable: () => void;
  onAvailable: () => void;
}) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!username || username.length < 3) return;

    timerRef.current = setTimeout(async () => {
      const { available } = await checkUsernameAvailability(username);
      if (available) onAvailable();
      else onUnavailable();
    }, 600); // debounce 600ms

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [username]);

  return null;
}

interface SignUpFormValues {
  fullName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function SignUpScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | undefined>(undefined);
  const router = useRouter();
  const { showError, showSuccess } = useAlert();

  const handleSignUp = async (values: SignUpFormValues) => {
    setIsLoading(true);
    try {
      const response = await signUp({
        fullName: values.fullName,
        username: values.username,
        email: values.email,
        password: values.password,
      });

      showSuccess(response.message);
      setTimeout(() => {
        router.push({
          pathname: '/(auth)/verifyOtp',
          params: { email: values.email }
        });
      }, 2000);
    } catch (error: any) {
      showError(error.message);
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
      showError(error.message);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[theme.colors.gradient.dark[0], theme.colors.gradient.dark[1]]}
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
            <Image
              source={{ uri: Constants.expoConfig?.extra?.LOGO_IMAGE }}
              style={{ width: 80, height: 80, marginBottom: 8, resizeMode: 'contain' }}
              accessibilityLabel="Taatom Logo"
            />
            <Text style={styles.title}>Taatom</Text>
            <Text style={styles.subtitle}>Share your world</Text>
          </View>

          <View style={styles.formContainer}>
            <Formik
              initialValues={{
                fullName: '',
                username: '',
                email: '',
                password: '',
                confirmPassword: '',
              }}
              validationSchema={signUpSchema}
              onSubmit={handleSignUp}
            >
              {({ handleChange, handleBlur, handleSubmit, values, errors, touched, setFieldError, setFieldValue, setFieldTouched }) => (
                <View>
                  <AuthInput
                    label="Full Name"
                    placeholder="Enter your full name"
                    value={values.fullName}
                    onChangeText={handleChange('fullName')}
                    onBlur={handleBlur('fullName')}
                    error={errors.fullName}
                    touched={touched.fullName}
                    autoCapitalize="words"
                  />

                  <AuthInput
                    label="Username"
                    placeholder="Choose a username"
                    value={values.username}
                    onChangeText={(text) => {
                      const sanitized = text.toLowerCase();
                      setFieldValue('username', sanitized);
                      // reset availability state while typing
                      setUsernameAvailable(undefined);
                    }}
                    onBlur={handleBlur('username')}
                    error={errors.username}
                    touched={touched.username}
                    autoCapitalize="none"
                    alwaysShowError
                    success={usernameAvailable ? 'Username available' : undefined}
                  />

                  {/* Live username availability check */}
                  {values.username?.length >= 3 && (
                    <UsernameAvailabilityWatcher
                      username={values.username}
                      onUnavailable={() => {
                        setFieldError('username', 'Username already exists');
                        setFieldTouched('username', true, false);
                        showError('Username already exists. Try another.');
                        setUsernameAvailable(false);
                      }}
                      onAvailable={() => {
                        if (errors.username === 'Username already exists') {
                          setFieldError('username', '');
                        }
                        setUsernameAvailable(true);
                      }}
                    />
                  )}

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
                    placeholder="Confirm your password"
                    value={values.confirmPassword}
                    onChangeText={handleChange('confirmPassword')}
                    onBlur={handleBlur('confirmPassword')}
                    error={errors.confirmPassword}
                    touched={touched.confirmPassword}
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



                  <TouchableOpacity
                    style={[styles.signUpButton, isLoading && styles.signUpButtonDisabled]}
                    onPress={() => handleSubmit()}
                    disabled={isLoading}
                  >
                    <Text style={styles.signUpButtonText}>
                      {isLoading ? 'Creating Account...' : 'Create Account'}
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
                    style={[styles.googleButton, isGoogleLoading && styles.signUpButtonDisabled]}
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
              <Text style={styles.footerText}>Already have an account? </Text>
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
    padding: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  title: {
    fontSize: 48,
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
  signUpButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    ...theme.shadows.medium,
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
  signUpButtonText: {
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
