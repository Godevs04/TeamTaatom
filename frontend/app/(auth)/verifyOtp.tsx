import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Formik } from 'formik';
import * as yup from 'yup';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../constants/theme';
import { useAlert } from '../../context/AlertContext';
import { verifyOTP, resendOTP } from '../../services/auth';

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
    return 'System';
  }
  return 'Roboto';
};

const verifyOtpSchema = yup.object().shape({
  otp: yup
    .string()
    .required('OTP is required')
    .length(6, 'OTP must be 6 digits')
    .matches(/^\d+$/, 'OTP must contain only numbers'),
});

interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const OTPInput: React.FC<OTPInputProps> = ({ value, onChange, error }) => {
  const inputRefs = useRef<TextInput[]>([]);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  useEffect(() => {
    if (value.length <= 6) {
      const otpArray = value.split('');
      while (otpArray.length < 6) {
        otpArray.push('');
      }
      setOtp(otpArray);
    }
  }, [value]);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    
    const otpString = newOtp.join('');
    onChange(otpString);

    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.otpContainer}>
      <Text style={styles.otpLabel}>Enter 6-digit OTP</Text>
      <View style={styles.otpInputContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              if (ref) inputRefs.current[index] = ref;
            }}
            style={[
              styles.otpInput,
              error && styles.otpInputError,
              digit && styles.otpInputFilled,
            ]}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
            keyboardType="numeric"
            maxLength={1}
            selectTextOnFocus
            autoFocus={index === 0}
            placeholder=""
            placeholderTextColor={theme.colors.textSecondary}
          />
        ))}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

export default function VerifyOTPScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { showError, showSuccess } = useAlert();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerifyOTP = async (values: { otp: string }) => {
    if (!email) {
      showError('Email not found. Please go back and try again.');
      return;
    }

    try {
      await verifyOTP({ email, otp: values.otp });
      showSuccess('Your account has been verified successfully. You can now sign in.');
      setTimeout(() => {
        router.push('/(auth)/signin');
      }, 2000);
    } catch (error: any) {
      showError(error.message);
    }
  };

  const handleResendOTP = async () => {
    if (!email) {
      showError('Email not found. Please go back and try again.');
      return;
    }

    setResendLoading(true);
    try {
      await resendOTP(email);
      setCountdown(60); // 60 seconds countdown
      showSuccess(
        'A new OTP has been sent to your email.\n\n📧 Please check your inbox and spam folder for the verification code.',
        'Code Resent'
      );
    } catch (error: any) {
      showError(error.message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[theme.colors.gradient.dark[0], theme.colors.gradient.dark[1]]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Verify Account</Text>
          <View style={styles.backButton} />
        </View>
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : isWeb ? undefined : 'height'}
          style={styles.keyboardAvoid}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={!isWeb}
          >
            <View style={styles.contentContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>Check Your Email</Text>
                <Text style={styles.subtitle}>
                  We've sent a 6-digit verification code to
                </Text>
                <Text style={styles.email}>{email}</Text>
                <View style={styles.spamReminder}>
                  <Text style={styles.spamReminderText}>
                    📧 Don't see the email? Check your spam folder as well!
                  </Text>
                </View>
              </View>

            <Formik
              initialValues={{ otp: '' }}
              validationSchema={verifyOtpSchema}
              onSubmit={handleVerifyOTP}
            >
              {({ handleSubmit, setFieldValue, values, errors, isSubmitting }) => (
                <View style={styles.form}>
                  <OTPInput
                    value={values.otp}
                    onChange={(value) => setFieldValue('otp', value)}
                    error={errors.otp}
                  />

                  <TouchableOpacity
                    style={[
                      styles.verifyButton,
                      (!values.otp || values.otp.length !== 6 || isSubmitting) && styles.verifyButtonDisabled,
                    ]}
                    onPress={() => handleSubmit()}
                    disabled={!values.otp || values.otp.length !== 6 || isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.verifyButtonText}>Verify Account</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.resendContainer}>
                    <Text style={styles.resendText}>Didn't receive the code?</Text>
                    <TouchableOpacity
                      onPress={handleResendOTP}
                      disabled={resendLoading || countdown > 0}
                      style={styles.resendButton}
                    >
                      {resendLoading ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : (
                        <Text style={[
                          styles.resendButtonText,
                          (countdown > 0) && styles.resendButtonTextDisabled,
                        ]}>
                          {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Formik>

              <View style={styles.helpContainer}>
                <Text style={styles.helpText}>
                  Check your spam folder if you don't see the email.
                </Text>
                <Text style={styles.helpText}>
                  The OTP will expire in 10 minutes.
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 10 : 16,
    paddingBottom: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.border,
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
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
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
  contentContainer: {
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
  header: {
    alignItems: 'center',
    marginBottom: isTablet ? theme.spacing.xxl : theme.spacing.xl,
  },
  title: {
    fontSize: isTablet ? 36 : isWeb ? 32 : 28,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
    letterSpacing: isIOS ? -0.3 : 0,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  subtitle: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : theme.typography.body.fontSize,
    fontFamily: getFontFamily('400'),
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
    letterSpacing: 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  email: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : theme.typography.body.fontSize,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    color: theme.colors.primary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  spamReminder: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: '#FFF3CD',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#FFEAA7',
    width: '100%',
  },
  spamReminderText: {
    fontSize: theme.typography.small.fontSize,
    fontFamily: getFontFamily('400'),
    color: '#856404',
    textAlign: 'center',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  form: {
    marginBottom: theme.spacing.xl,
  },
  otpContainer: {
    marginBottom: theme.spacing.xl,
    width: '100%',
  },
  otpLabel: {
    fontSize: isTablet ? theme.typography.body.fontSize + 1 : theme.typography.body.fontSize,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    letterSpacing: 0.1,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  otpInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: isTablet ? theme.spacing.md : theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  otpInput: {
    width: isTablet ? 60 : 50,
    height: isTablet ? 70 : 60,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    textAlign: 'center',
    fontSize: isTablet ? 28 : 24,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceSecondary || theme.colors.surface,
    ...theme.shadows.small,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      outlineStyle: 'none',
    } as any),
  },
  otpInputFilled: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}15`,
  },
  otpInputError: {
    borderColor: theme.colors.error,
    borderWidth: 2.5,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.small.fontSize,
    fontFamily: getFontFamily('400'),
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  verifyButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: isTablet ? theme.spacing.lg : theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    minHeight: isTablet ? 56 : 50,
    ...theme.shadows.medium,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  verifyButtonDisabled: {
    backgroundColor: theme.colors.border,
    opacity: 0.6,
    ...(isWeb && {
      cursor: 'not-allowed',
    } as any),
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : theme.typography.body.fontSize,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 0.3,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  resendText: {
    fontSize: theme.typography.body.fontSize,
    fontFamily: getFontFamily('400'),
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
  resendButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  resendButtonText: {
    fontSize: theme.typography.body.fontSize,
    fontFamily: getFontFamily('600'),
    color: theme.colors.primary,
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      cursor: 'pointer',
    } as any),
  },
  resendButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  helpContainer: {
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  helpText: {
    fontSize: theme.typography.small.fontSize,
    fontFamily: getFontFamily('400'),
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
    lineHeight: 18,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }),
  },
});
