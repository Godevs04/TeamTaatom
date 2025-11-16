import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

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
    handleComplete();
  };

  const handleComplete = async () => {
    await AsyncStorage.setItem('onboarding_completed', 'true');
    router.replace('/onboarding/interests');
  };

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
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: 16,
    marginTop: 16,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
    marginBottom: 48,
  },
  stepDot: {
    height: 8,
    borderRadius: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: 24,
  },
  actions: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

