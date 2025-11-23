import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import { trackScreenView, trackFeatureUsage, trackDropOff } from '../../services/analytics';

const INTERESTS = [
  { id: 'adventure', label: 'Adventure', icon: 'trail-sign' },
  { id: 'beach', label: 'Beach', icon: 'water' },
  { id: 'mountains', label: 'Mountains', icon: 'triangle' },
  { id: 'city', label: 'City Life', icon: 'business' },
  { id: 'nature', label: 'Nature', icon: 'leaf' },
  { id: 'culture', label: 'Culture', icon: 'library' },
  { id: 'food', label: 'Food & Dining', icon: 'restaurant' },
  { id: 'nightlife', label: 'Nightlife', icon: 'moon' },
  { id: 'photography', label: 'Photography', icon: 'camera' },
  { id: 'wildlife', label: 'Wildlife', icon: 'paw' },
  { id: 'history', label: 'History', icon: 'book' },
  { id: 'art', label: 'Art & Museums', icon: 'color-palette' },
];

export default function InterestsOnboarding() {
  const router = useRouter();
  const { theme } = useTheme();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleContinue = async () => {
    if (selectedInterests.length === 0) {
      // Allow skipping interests
      trackDropOff('onboarding_interests', { step: 'interests', action: 'skip_no_selection' });
      router.replace('/onboarding/suggested-users');
      return;
    }

    setIsLoading(true);
    try {
      // Save interests to user profile
      await api.post('/api/v1/profile/interests', { interests: selectedInterests });
      await AsyncStorage.setItem('onboarding_interests', JSON.stringify(selectedInterests));
      
      // Track feature usage
      trackFeatureUsage('onboarding_interests_selected', {
        count: selectedInterests.length,
        interests: selectedInterests,
      });
      
      trackScreenView('onboarding_suggested_users');
      router.replace('/onboarding/suggested-users');
    } catch (error) {
      console.error('Error saving interests:', error);
      // Continue anyway
      router.replace('/onboarding/suggested-users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    trackDropOff('onboarding_interests', { step: 'interests', action: 'skip' });
    router.replace('/onboarding/suggested-users');
  };
  
  React.useEffect(() => {
    trackScreenView('onboarding_interests');
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            What interests you?
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Select a few to personalize your feed
          </Text>
        </View>

        <View style={styles.interestsGrid}>
          {INTERESTS.map(interest => {
            const isSelected = selectedInterests.includes(interest.id);
            return (
              <TouchableOpacity
                key={interest.id}
                onPress={() => toggleInterest(interest.id)}
                style={[
                  styles.interestCard,
                  {
                    backgroundColor: isSelected 
                      ? theme.colors.primary + '20' 
                      : theme.colors.card,
                    borderColor: isSelected 
                      ? theme.colors.primary 
                      : theme.colors.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={interest.icon as any}
                  size={24}
                  color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.interestLabel,
                    {
                      color: isSelected ? theme.colors.primary : theme.colors.text,
                      fontWeight: isSelected ? '600' : '400',
                    },
                  ]}
                >
                  {interest.label}
                </Text>
                {isSelected && (
                  <View style={[styles.checkmark, { backgroundColor: theme.colors.primary }]}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipButton}
        >
          <Text style={[styles.skipText, { color: theme.colors.textSecondary }]}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleContinue}
          disabled={isLoading}
          style={styles.continueButton}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primary + 'DD']}
            style={styles.gradient}
          >
            <Text style={styles.continueButtonText}>
              {isLoading ? 'Saving...' : `Continue (${selectedInterests.length})`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  interestCard: {
    width: '47%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    position: 'relative',
  },
  interestLabel: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    padding: 24,
    gap: 12,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  continueButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

