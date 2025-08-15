import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Formik } from 'formik';
import * as yup from 'yup';

import { colors } from '../../constants/colors';
import { theme } from '../../constants/theme';
import { verifyOTP, resendOTP } from '../../services/auth';
import Card from '../../components/Card';
import NavBar from '../../components/NavBar';

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

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerifyOTP = async (values: { otp: string }) => {
    if (!email) {
      Alert.alert('Error', 'Email not found. Please go back and try again.');
      return;
    }

    try {
      await verifyOTP({ email, otp: values.otp });
      Alert.alert(
        'Success!',
        'Your account has been verified successfully. You can now sign in.',
        [
          {
            text: 'OK',
            onPress: () => router.push('/(auth)/signin'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message);
    }
  };

  const handleResendOTP = async () => {
    if (!email) {
      Alert.alert('Error', 'Email not found. Please go back and try again.');
      return;
    }

    setResendLoading(true);
    try {
      await resendOTP(email);
      setCountdown(60); // 60 seconds countdown
      Alert.alert('OTP Sent', 'A new OTP has been sent to your email.');
    } catch (error: any) {
      Alert.alert('Failed to Resend', error.message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <NavBar
        title="Verify Account"
        showBackButton
        onBackPress={() => router.back()}
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Check Your Email</Text>
              <Text style={styles.subtitle}>
                We've sent a 6-digit verification code to
              </Text>
              <Text style={styles.email}>{email}</Text>
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
                      <ActivityIndicator color={colors.white} />
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
                        <ActivityIndicator size="small" color={colors.primary} />
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
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: theme.spacing.lg,
  },
  card: {
    padding: theme.spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  form: {
    marginBottom: theme.spacing.xl,
  },
  otpContainer: {
    marginBottom: theme.spacing.xl,
  },
  otpLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  otpInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: theme.borderRadius.md,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    backgroundColor: colors.inputBackground,
  },
  otpInputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  otpInputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  verifyButton: {
    backgroundColor: colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  verifyButtonDisabled: {
    backgroundColor: colors.border,
  },
  verifyButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  resendContainer: {
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  resendButton: {
    paddingVertical: theme.spacing.sm,
  },
  resendButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  resendButtonTextDisabled: {
    color: colors.textSecondary,
  },
  helpContainer: {
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  helpText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
});
