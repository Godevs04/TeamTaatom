import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { theme } from '../../constants/theme';
import AuthInput from '../../components/AuthInput';
import { forgotPasswordSchema } from '../../utils/validation';
import { forgotPassword } from '../../services/auth';
import { ColorValue } from "react-native";
import Constants from 'expo-constants';
import { LOGO_IMAGE } from '../../utils/config';
import { getUserFromStorage } from '../../services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
        <Ionicons name="airplane" size={40} color="rgba(255, 255, 255, 0.35)" />
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
        <Ionicons name="airplane" size={36} color="rgba(255, 255, 255, 0.32)" />
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
        <Ionicons name="location" size={48} color="rgba(100, 200, 255, 0.4)" />
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
        <Ionicons name="compass" size={44} color="rgba(255, 255, 255, 0.35)" />
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
        <Ionicons name="map" size={52} color="rgba(150, 200, 255, 0.3)" />
      </Animated.View>

      {/* Additional decorative icons - More visible */}
      <View style={[styles.travelIcon, styles.camera]}>
        <Ionicons name="camera" size={32} color="rgba(255, 255, 255, 0.2)" />
      </View>
      <View style={[styles.travelIcon, styles.bed]}>
        <Ionicons name="bed" size={36} color="rgba(255, 255, 255, 0.2)" />
      </View>
      
      {/* Travel-themed decorative circles */}
      <View style={[styles.decorativeCircle, styles.circle1]} />
      <View style={[styles.decorativeCircle, styles.circle2]} />
      <View style={[styles.decorativeCircle, styles.circle3]} />
    </Animated.View>
  );
};

interface ForgotPasswordFormValues {
  email: string;
}

export default function ForgotPasswordScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme: appTheme } = useTheme();

  // Check if user is logged in (coming from settings)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const fromSettings = params.fromSettings === 'true';
        if (fromSettings) {
          const token = await AsyncStorage.getItem('authToken');
          const user = await getUserFromStorage();
          setIsLoggedIn(!!(token && user));
        }
      } catch (error) {
        setIsLoggedIn(false);
      }
    };
    checkAuth();
  }, [params.fromSettings]);

  // Form entrance animation
  const formFadeAnim = useRef(new Animated.Value(0)).current;
  const formSlideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Start form entrance animation immediately (only once on mount)
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
  }, []); // Empty dependency array - only run once on mount

  const handleForgotPassword = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      await forgotPassword(values.email);
      setSuccess('Password reset OTP code has been sent to your email.\n\n Please check your inbox and spam folder for the 6-digit code.\n\n The code will expire in 30 minutes.');
      setTimeout(() => {
        router.push({ 
          pathname: '/(auth)/reset-password', 
          params: { 
            email: values.email,
            fromSettings: isLoggedIn ? 'true' : undefined
          } 
        });
      }, 2000);
    } catch (error: any) {
      setError(error.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[theme.colors.gradient.dark[0], theme.colors.gradient.dark[1]]}
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
            style={{ backgroundColor: 'transparent' }}
          >
          <View style={[styles.header, { backgroundColor: 'transparent' }]}>
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: LOGO_IMAGE }}
                style={styles.logo}
                accessibilityLabel="Taatom Logo"
              />
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you instructions to reset your password.
            </Text>
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
              initialValues={{ email: '' }}
              validationSchema={forgotPasswordSchema}
              onSubmit={handleForgotPassword}
            >
              {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
                <View style={styles.formFields}>
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
            {!isLoggedIn && (
              <View style={styles.footer}>
                <Text style={styles.footerText}>Remember your password? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/signin')}>
                  <Text style={styles.linkText}>Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
            {isLoggedIn && (
              <View style={styles.footer}>
                <TouchableOpacity onPress={() => router.back()}>
                  <Text style={styles.linkText}>Back to Settings</Text>
                </TouchableOpacity>
              </View>
            )}
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
    backgroundColor: 'transparent',
    ...(isWeb && {
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
      backgroundColor: 'transparent',
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
  resetButton: {
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
  resetButtonDisabled: {
    opacity: 0.6,
    ...(isWeb && {
      cursor: 'not-allowed',
    } as any),
  },
  resetButtonText: {
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
