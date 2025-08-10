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
import { AuthInput } from '../../components/AuthInput';
import { signUpSchema } from '../../utils/validation';
import { signUp } from '../../services/auth';

interface SignUpFormValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  gender: 'male' | 'female';
}

export default function SignUpScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (values: SignUpFormValues) => {
    setIsLoading(true);
    try {
      // Assign avatar path based on gender
      const avatarPath = values.gender === 'male'
        ? 'avatars/male_avatar.png'
        : 'avatars/female_avatar.png';
      // Create user
      const user = await signUp(values.email, values.password, values.fullName);
      // Save avatar path to Firestore
      if (user?.uid) {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../../services/firebase');
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { profilePic: avatarPath });
      }
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
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
            <Ionicons name="camera" size={60} color={theme.colors.primary} />
            <Text style={styles.title}>Taatom</Text>
            <Text style={styles.subtitle}>Share your world</Text>
          </View>

          <View style={styles.formContainer}>
            <Formik
              initialValues={{
                fullName: '',
                email: '',
                password: '',
                confirmPassword: '',
                gender: 'male',
              }}
              validationSchema={signUpSchema}
              onSubmit={handleSignUp}
            >
              {({ handleChange, handleBlur, handleSubmit, values, errors, touched, setFieldValue }) => (
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


                  <AuthInput
                    label="Confirm Password"
                    placeholder="Confirm your password"
                    value={values.confirmPassword}
                    onChangeText={handleChange('confirmPassword')}
                    onBlur={handleBlur('confirmPassword')}
                    error={errors.confirmPassword}
                    touched={touched.confirmPassword}
                    secureTextEntry
                  />

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.md, marginBottom: theme.spacing.md }}>
                    <Text style={{ color: theme.colors.text, fontSize: theme.typography.body.fontSize, fontWeight: '600', marginRight: theme.spacing.md }}>Gender:</Text>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', marginRight: theme.spacing.lg }}
                      onPress={() => setFieldValue('gender', 'male')}
                    >
                      <Ionicons
                        name={values.gender === 'male' ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={theme.colors.primary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={{ color: theme.colors.text }}>Male</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => setFieldValue('gender', 'female')}
                    >
                      <Ionicons
                        name={values.gender === 'female' ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={theme.colors.primary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={{ color: theme.colors.text }}>Female</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.signUpButton, isLoading && styles.signUpButtonDisabled]}
                    onPress={() => handleSubmit()}
                    disabled={isLoading}
                  >
                    <Text style={styles.signUpButtonText}>
                      {isLoading ? 'Creating Account...' : 'Create Account'}
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
});
