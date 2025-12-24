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
  Dimensions,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { track } from '../../services/analytics';
import Constants from 'expo-constants';
import { LOGO_IMAGE } from '../../utils/config';
import logger from '../../utils/logger';

// Responsive dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Elegant font families for each platform
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) {
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    // SF Pro Display for headings, SF Pro Text for body
    return 'System';
  }
  // Android - Roboto
  return 'Roboto';
};

// Lightweight watcher for debounced username availability checks
function UsernameAvailabilityWatcher({
  username,
  onUnavailable,
  onAvailable,
  onChecking,
}: {
  username: string;
  onUnavailable: () => void;
  onAvailable: () => void;
  onChecking: (checking: boolean) => void;
}) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!username || username.length < 3) {
      onChecking(false);
      return;
    }

    onChecking(true); // Start checking
    timerRef.current = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(username);
        
        // Only update UI if we have a definitive availability result
        if (result.error && result.available === undefined) {
          // Network/validation error - don't show availability status
          // Just stop checking and don't call callbacks
          onChecking(false);
          return;
        }
        
        // Only call callbacks if we have a clear availability result
        if (typeof result.available === 'boolean') {
          // Stop checking first, then call the appropriate callback
          onChecking(false);
          if (result.available) {
            onAvailable();
          } else {
            onUnavailable();
          }
        } else {
          // No clear result - just stop checking
          onChecking(false);
        }
      } catch (error) {
        onChecking(false);
      }
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
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
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

      // Ensure onboarding flag is not set for new users
      await AsyncStorage.removeItem('onboarding_completed');

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
      logger.debug('Google sign-in successful:', response.user);
      
      // Check onboarding status immediately after Google signin
      const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
      if (!onboardingCompleted) {
        // New user - navigate to onboarding immediately
        logger.debug('[SignUp] New user detected (Google), navigating to onboarding');
        router.replace('/onboarding/welcome');
      } else {
        // Existing user - navigate to tabs
        router.replace('/(tabs)/home');
      }
    } catch (error: any) {
      logger.error('Google sign-in error:', error);
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
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: LOGO_IMAGE }}
                style={styles.logo}
                accessibilityLabel="Taatom Logo"
              />
            </View>
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
                <View style={styles.formFields}>
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
                    success={usernameAvailable ? 'Username is available!' : undefined}
                  />

                  {/* Live username availability check */}
                  {values.username?.length >= 3 && (
                    <>
                      <UsernameAvailabilityWatcher
                        username={values.username}
                        onUnavailable={() => {
                          setFieldError('username', 'Username already exists');
                          setFieldTouched('username', true, false);
                          // Don't show error alert - the field error is enough
                          setUsernameAvailable(false);
                          setIsCheckingUsername(false);
                        }}
                        onAvailable={() => {
                          // Clear any previous errors
                          if (errors.username === 'Username already exists') {
                            setFieldError('username', '');
                          }
                          // Set available state - this will show the success message
                          setUsernameAvailable(true);
                          setIsCheckingUsername(false);
                        }}
                        onChecking={(checking) => {
                          setIsCheckingUsername(checking);
                          // Don't reset availability state here - let callbacks handle it
                        }}
                      />
                      {isCheckingUsername && (
                        <Text style={{ color: '#FF9800', fontSize: 12, marginTop: -8, marginBottom: 8 }}>
                          Checking availability...
                        </Text>
                      )}
                    </>
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
  header: {
    alignItems: 'center',
    marginBottom: isTablet ? theme.spacing.xxl * 1.5 : theme.spacing.xxl,
    width: '100%',
  },
  logoContainer: {
    width: isTablet ? 120 : 100,
    height: isTablet ? 120 : 100,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.medium,
  },
  logo: {
    width: isTablet ? 96 : 80,
    height: isTablet ? 96 : 80,
    resizeMode: 'contain' as const,
  },
  title: {
    fontSize: isTablet ? 56 : isWeb ? 52 : 48,
    fontWeight: '700',
    fontFamily: getFontFamily('700'),
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    letterSpacing: isIOS ? -0.5 : 0,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: '700',
    }),
  },
  subtitle: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : theme.typography.body.fontSize,
    fontFamily: getFontFamily('400'),
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    letterSpacing: 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
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
  signUpButton: {
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
  signUpButtonDisabled: {
    opacity: 0.6,
    ...(isWeb && {
      cursor: 'not-allowed',
    } as any),
  },
  signUpButtonText: {
    color: '#FFFFFF',
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : theme.typography.body.fontSize,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 0.3,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: '600',
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
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: theme.typography.body.fontSize,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      cursor: 'pointer',
    } as any),
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
    fontFamily: getFontFamily('500'),
    marginHorizontal: theme.spacing.md,
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    paddingVertical: isTablet ? theme.spacing.lg : theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: isTablet ? 56 : 50,
    ...theme.shadows.small,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  googleIcon: {
    marginRight: theme.spacing.sm,
  },
  googleButtonText: {
    color: theme.colors.text,
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : theme.typography.body.fontSize,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
});
