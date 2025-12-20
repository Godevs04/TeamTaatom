import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackScreenView, trackDropOff } from '../../services/analytics';
import { theme } from '../../constants/theme';

// Responsive dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Elegant font families
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

export default function WelcomeOnboarding() {
  const router = useRouter();
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: 'earth',
      title: 'Discover Amazing Places',
      description: 'Explore beautiful locations shared by travelers around the world',
      color: '#4A90E2',
    },
    {
      icon: 'camera',
      title: 'Share Your Journey',
      description: 'Capture and share your travel experiences with the community',
      color: '#FF6B6B',
    },
    {
      icon: 'people',
      title: 'Connect with Travelers',
      description: 'Follow inspiring travelers and discover new destinations',
      color: '#50C878',
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    trackDropOff('onboarding_welcome', { step: 'welcome', action: 'skip' });
    handleComplete();
  };

  const handleComplete = async () => {
    await AsyncStorage.setItem('onboarding_completed', 'true');
    trackScreenView('onboarding_interests');
    router.replace('/onboarding/interests');
  };
  
  React.useEffect(() => {
    trackScreenView('onboarding_welcome');
  }, []);

  const currentStepData = steps[currentStep];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Skip button */}
        <TouchableOpacity 
          style={styles.skipButton}
          onPress={handleSkip}
        >
          <Text style={[styles.skipText, { color: theme.colors.textSecondary }]}>Skip</Text>
        </TouchableOpacity>

        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.stepDot,
                {
                  backgroundColor: index === currentStep 
                    ? currentStepData.color 
                    : theme.colors.border,
                  width: index === currentStep ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: currentStepData.color + '20' }]}>
            <Ionicons 
              name={currentStepData.icon as any} 
              size={80} 
              color={currentStepData.color} 
            />
          </View>

          <Text style={[styles.title, { color: theme.colors.text }]}>
            {currentStepData.title}
          </Text>
          
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            {currentStepData.description}
          </Text>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        {currentStep > 0 && (
          <TouchableOpacity
            onPress={() => setCurrentStep(currentStep - 1)}
            style={[styles.backButton, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.backButtonText, { color: theme.colors.text }]}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleNext}
          style={styles.nextButton}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[currentStepData.color, currentStepData.color + 'DD']}
            style={styles.gradient}
          >
            <Text style={styles.nextButtonText}>
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isTablet ? 1000 : 800,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: isTablet ? theme.spacing.xxl : 24,
    ...(isWeb && {
      minHeight: '100vh',
    } as any),
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: isTablet ? theme.spacing.lg : 16,
    marginTop: isTablet ? theme.spacing.lg : 16,
    ...(isWeb && {
      cursor: 'pointer',
    } as any),
  },
  skipText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: isTablet ? theme.spacing.sm : 8,
    marginTop: isTablet ? theme.spacing.xl : 32,
    marginBottom: isTablet ? theme.spacing.xxl : 48,
  },
  stepDot: {
    height: isTablet ? 10 : 8,
    borderRadius: isTablet ? 5 : 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: isTablet ? theme.spacing.xxl : 48,
  },
  iconContainer: {
    width: isTablet ? 200 : 160,
    height: isTablet ? 200 : 160,
    borderRadius: isTablet ? 100 : 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isTablet ? theme.spacing.xl : 32,
  },
  title: {
    fontSize: isTablet ? theme.typography.h1.fontSize + 10 : 32,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: isTablet ? theme.spacing.lg : 16,
    letterSpacing: isIOS ? -0.5 : 0,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  description: {
    fontSize: isTablet ? theme.typography.body.fontSize + 4 : 18,
    fontFamily: getFontFamily('400'),
    textAlign: 'center',
    lineHeight: isTablet ? 32 : 28,
    paddingHorizontal: isTablet ? theme.spacing.xxl : 24,
    maxWidth: isTablet ? 600 : 400,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  actions: {
    flexDirection: 'row',
    padding: isTablet ? theme.spacing.xl : 24,
    gap: isTablet ? theme.spacing.md : 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: isTablet ? theme.spacing.lg : 16,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  backButtonText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  nextButton: {
    flex: 2,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: isTablet ? theme.spacing.lg : 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});

