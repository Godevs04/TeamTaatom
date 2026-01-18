import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Easing,
} from 'react-native';
import { Formik } from 'formik';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';
import { useAlert } from '../../context/AlertContext';
import AuthInput from '../../components/AuthInput';
import { signInSchema } from '../../utils/validation';
import { signIn } from '../../services/auth';
// import { signInWithGoogle } from '../../services/googleAuth'; // Hidden for now, will use later
import { track } from '../../services/analytics';
import Constants from 'expo-constants';
import { LOGO_IMAGE } from '../../utils/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../../utils/logger';

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

interface SignInFormValues {
  email: string;
  password: string;
}

// Travel-themed animated background component
const TravelAnimatedBackground = () => {
  const airplane1Anim = useRef(new Animated.Value(0)).current;
  const airplane2Anim = useRef(new Animated.Value(0)).current;
  const locationAnim = useRef(new Animated.Value(0)).current;
  const compassAnim = useRef(new Animated.Value(0)).current;
  const mapAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Airplane 1 - flying across top
    Animated.loop(
      Animated.sequence([
        Animated.timing(airplane1Anim, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(airplane1Anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Airplane 2 - flying across middle (delayed)
    Animated.loop(
      Animated.sequence([
        Animated.delay(3000),
        Animated.timing(airplane2Anim, {
          toValue: 1,
          duration: 10000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(airplane2Anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Location pin - floating
    Animated.loop(
      Animated.sequence([
        Animated.timing(locationAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(locationAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Compass - rotating
    Animated.loop(
      Animated.timing(compassAnim, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Map - subtle pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(mapAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(mapAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const airplane1TranslateX = airplane1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, screenWidth + 100],
  });

  const airplane2TranslateX = airplane2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, screenWidth + 100],
  });

  const locationTranslateY = locationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const compassRotate = compassAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const mapScale = mapAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  return (
    <Animated.View style={[styles.animatedBackground, { opacity: fadeAnim }]} pointerEvents="none">
      {/* Airplane 1 - Top - More visible */}
      <Animated.View
        style={[
          styles.travelIcon,
          styles.airplane1,
          {
            transform: [{ translateX: airplane1TranslateX }],
          },
        ]}
      >
        <Ionicons name="airplane" size={40} color="rgba(255, 255, 255, 0.25)" />
      </Animated.View>

      {/* Airplane 2 - Middle - More visible */}
      <Animated.View
        style={[
          styles.travelIcon,
          styles.airplane2,
          {
            transform: [{ translateX: airplane2TranslateX }],
          },
        ]}
      >
        <Ionicons name="airplane" size={36} color="rgba(255, 255, 255, 0.22)" />
      </Animated.View>

      {/* Location Pin - Floating - More visible */}
      <Animated.View
        style={[
          styles.travelIcon,
          styles.locationPin,
          {
            transform: [{ translateY: locationTranslateY }],
          },
        ]}
      >
        <Ionicons name="location" size={48} color="rgba(100, 200, 255, 0.3)" />
      </Animated.View>

      {/* Compass - Rotating - More visible */}
      <Animated.View
        style={[
          styles.travelIcon,
          styles.compass,
          {
            transform: [{ rotate: compassRotate }],
          },
        ]}
      >
        <Ionicons name="compass" size={44} color="rgba(255, 255, 255, 0.25)" />
      </Animated.View>

      {/* Map - Pulsing - More visible */}
      <Animated.View
        style={[
          styles.travelIcon,
          styles.map,
          {
            transform: [{ scale: mapScale }],
          },
        ]}
      >
        <Ionicons name="map" size={52} color="rgba(150, 200, 255, 0.2)" />
      </Animated.View>

      {/* Additional decorative icons - More visible */}
      <View style={[styles.travelIcon, styles.camera]}>
        <Ionicons name="camera" size={32} color="rgba(255, 255, 255, 0.15)" />
      </View>
      <View style={[styles.travelIcon, styles.bed]}>
        <Ionicons name="bed" size={36} color="rgba(255, 255, 255, 0.15)" />
      </View>
      
      {/* Travel-themed decorative circles */}
      <View style={[styles.decorativeCircle, styles.circle1]} />
      <View style={[styles.decorativeCircle, styles.circle2]} />
      <View style={[styles.decorativeCircle, styles.circle3]} />
    </Animated.View>
  );
};

export default function SignInScreen() {
  const [isLoading, setIsLoading] = useState(false);
  // const [isGoogleLoading, setIsGoogleLoading] = useState(false); // Hidden for now
  const router = useRouter();
  const { showError, showSuccess, showConfirm } = useAlert();
  
  // Form entrance animation
  const formFadeAnim = useRef(new Animated.Value(0)).current;
  const formSlideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(formFadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(formSlideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSignIn = async (values: SignInFormValues) => {
    setIsLoading(true);
    try {
      const response = await signIn({
        email: values.email,
        password: values.password,
      });
      
      logger.debug('Sign-in successful:', response.user);
      
      // Track login
      track('user_login', {
        method: 'email',
        user_id: response.user?._id,
      });
      
      // Check onboarding status - only show for fresh signups, not existing users
      const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
      
      // Check if user was just created (within last 15 minutes) - indicates fresh signup
      const userCreatedAt = response.user?.createdAt ? new Date(response.user.createdAt) : null;
      const userAge = userCreatedAt ? Date.now() - userCreatedAt.getTime() : null;
      const isFreshSignup = userAge !== null && userAge < 15 * 60 * 1000; // 15 minutes
      
      if (!onboardingCompleted && isFreshSignup) {
        // Fresh signup (user created within last 15 minutes) - navigate to onboarding
        logger.debug(`[SignIn] Fresh signup detected (user age: ${Math.round(userAge / 1000)}s), navigating to onboarding`);
        router.replace('/onboarding/welcome');
      } else {
        // Existing user or onboarding already completed - navigate to home
        // If flag is missing for existing user, set it to prevent future checks
        if (!onboardingCompleted) {
          await AsyncStorage.setItem('onboarding_completed', 'true');
          logger.debug(`[SignIn] Existing user detected (user age: ${userAge ? Math.round(userAge / 1000) : 'unknown'}s), setting onboarding flag and navigating to home`);
        }
        router.replace('/(tabs)/home');
      }
    } catch (error: any) {
      // Check if this is an expected authentication error (incorrect credentials)
      // These shouldn't be reported to Sentry as errors since they're user input errors
      const { parseError } = require('../../utils/errorCodes');
      const parsedError = error?.parsedError || (error?.originalError ? parseError(error.originalError) : null);
      const isIncorrectCredentials = error?.message?.includes('incorrect') || 
                                      error?.message?.includes('Invalid email or password') ||
                                      error?.originalError?.response?.data?.error?.code === 'AUTH_1004' ||
                                      parsedError?.code === 'AUTH_1004';
      
      if (isIncorrectCredentials) {
        // Log as debug instead of error - this is expected user behavior
        logger.debug('Sign-in failed: incorrect credentials');
      } else {
        // Log other errors normally
        logger.error('Sign-in error:', error);
      }
      
      // Check if account is not verified
      if (error.message.includes('verify')) {
        showConfirm(
          error.message,
          () => router.push({
            pathname: '/(auth)/verifyOtp',
            params: { email: values.email }
          }),
          'Account Not Verified',
          'Verify Now',
          'Cancel'
        );
      } else {
        showError(error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Hidden for now, will use later
  // const handleGoogleSignIn = async () => {
  //   setIsGoogleLoading(true);
  //   try {
  //     const response = await signInWithGoogle();
  //     logger.debug('Google sign-in successful:', response.user);
  //     
  //     // Track login
  //     track('user_login', {
  //       method: 'google',
  //       user_id: response.user?._id,
  //     });
  //     
  //     // Check onboarding status immediately after signin
  //     const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
  //     if (!onboardingCompleted) {
  //       // New user - navigate to onboarding immediately
  //       logger.debug('[SignIn] New user detected (Google), navigating to onboarding');
  //       router.replace('/onboarding/welcome');
  //     } else {
  //       // Existing user - navigate to tabs
  //       router.replace('/(tabs)/home');
  //     }
  //   } catch (error: any) {
  //     logger.error('Google sign-in error:', error);
  //     showError(error.message);
  //   } finally {
  //     setIsGoogleLoading(false);
  //   }
  // };

  return (
    <LinearGradient
      colors={theme.colors.gradient.dark as [string, string, ...string[]]}
      style={styles.container}
    >
      {/* Travel-themed animated background */}
      <TravelAnimatedBackground />
      
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
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          <Animated.View
            style={[
              styles.formContainer,
              {
                opacity: formFadeAnim,
                transform: [{ translateY: formSlideAnim }],
              },
            ]}
          >
            <Formik
              initialValues={{
                email: '',
                password: '',
              }}
              validationSchema={signInSchema}
              onSubmit={handleSignIn}
            >
              {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
                <View style={styles.formFields}>
                  <AuthInput
                    label="Email or Username"
                    placeholder="Enter your email or username"
                    value={values.email}
                    onChangeText={handleChange('email')}
                    onBlur={handleBlur('email')}
                    error={errors.email}
                    touched={touched.email}
                    keyboardType="default"
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

                  {/* Google Auth Hidden - Will use later */}
                  {/* 
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity
                    style={[styles.googleButton]}
                    onPress={() => {}}
                    disabled={false}
                  >
                    <Ionicons name="logo-google" size={20} color="#4285F4" style={styles.googleIcon} />
                    <Text style={styles.googleButtonText}>
                      Continue with Google
                    </Text>
                  </TouchableOpacity>
                  */}
                </View>
              )}
            </Formik>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                <Text style={styles.linkText}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
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
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    paddingVertical: isTablet ? theme.spacing.xxl + 8 : theme.spacing.xl + 4,
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
    zIndex: 2,
  },
  logoContainer: {
    width: isTablet ? 150 : 130,
    height: isTablet ? 150 : 130,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: isTablet ? 40 : 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg + 4,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    // Enhanced glassmorphism effect
    ...(isWeb && {
      backdropFilter: 'blur(30px) saturate(180%)',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)',
    } as any),
    ...theme.shadows.large,
  },
  logo: {
    width: isTablet ? 120 : 100,
    height: isTablet ? 120 : 100,
    resizeMode: 'contain' as const,
    tintColor: undefined,
  },
  title: {
    fontSize: isTablet ? 44 : isWeb ? 40 : 38,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: theme.spacing.md + 4,
    textAlign: 'center',
    letterSpacing: isIOS ? -1 : -0.8,
    lineHeight: isTablet ? 52 : 46,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    ...(isWeb && {
      fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: '700',
    }),
  },
  subtitle: {
    fontSize: isTablet ? 18 : 17,
    fontFamily: getFontFamily('400'),
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    letterSpacing: 0.4,
    ...(isWeb && {
      fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: '400',
    }),
  },
  formContainer: {
    backgroundColor: 'rgba(20, 20, 30, 0.7)',
    borderRadius: isTablet ? 32 : 28,
    padding: isTablet ? theme.spacing.xl + 12 : theme.spacing.lg + 8,
    width: '100%',
    maxWidth: isWeb ? 460 : isTablet ? 580 : 500,
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 2,
    // Enhanced glassmorphism with better shadows and depth
    ...(isWeb && {
      backdropFilter: 'blur(30px) saturate(180%)',
      backgroundColor: 'rgba(20, 20, 30, 0.75)',
      boxShadow: '0 20px 60px 0 rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.05)',
    } as any),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  formFields: {
    width: '100%',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontSize: theme.typography.body.fontSize,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
      cursor: 'pointer',
    } as any),
  },
  signInButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: isTablet ? 18 : 16,
    paddingVertical: isTablet ? theme.spacing.lg + 4 : theme.spacing.md + 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xl + 4,
    minHeight: isTablet ? 60 : 56,
    overflow: 'hidden',
    // Enhanced elegant gradient with better shadows
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primary}ee 100%)`,
      boxShadow: '0 8px 24px 0 rgba(0, 0, 0, 0.3), 0 2px 8px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)',
    } as any),
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  signInButtonDisabled: {
    opacity: 0.6,
    ...(isWeb && {
      cursor: 'not-allowed',
    } as any),
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: isTablet ? theme.typography.body.fontSize + 3 : theme.typography.body.fontSize + 1,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    ...(isWeb && {
      fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
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
      fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
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
      fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  animatedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  travelIcon: {
    position: 'absolute',
    zIndex: 0,
  },
  airplane1: {
    top: '15%',
    left: 0,
  },
  airplane2: {
    top: '45%',
    left: 0,
  },
  locationPin: {
    top: '25%',
    right: '10%',
  },
  compass: {
    bottom: '30%',
    left: '8%',
  },
  map: {
    top: '60%',
    right: '15%',
  },
  camera: {
    bottom: '20%',
    right: '8%',
  },
  bed: {
    top: '75%',
    left: '12%',
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(100, 200, 255, 0.08)',
    ...(isWeb && {
      backdropFilter: 'blur(20px)',
    } as any),
  },
  circle1: {
    width: 200,
    height: 200,
    top: '10%',
    right: '-10%',
  },
  circle2: {
    width: 150,
    height: 150,
    bottom: '15%',
    left: '-8%',
  },
  circle3: {
    width: 120,
    height: 120,
    top: '50%',
    right: '-5%',
  },
});
