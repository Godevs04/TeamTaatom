import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Dimensions, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { trackScreenView, trackFeatureUsage } from '../../services/analytics';
import { theme } from '../../constants/theme';
import logger from '../../utils/logger';
import { ONBOARDING_COUNTRY_SHORTCUTS, ONBOARDING_OTHER_COUNTRY_ID } from '../../constants/onboardingOptions';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

export default function NationalityOnboarding() {
  const router = useRouter();
  const { theme } = useTheme();
  const [countrySearch, setCountrySearch] = useState('');
  const [nationality, setNationality] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return ONBOARDING_COUNTRY_SHORTCUTS;
    return ONBOARDING_COUNTRY_SHORTCUTS.filter(c => {
      if (c.id === ONBOARDING_OTHER_COUNTRY_ID) {
        return !q || q.includes('other') || c.label.toLowerCase().includes(q);
      }
      return (
        c.label.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    });
  }, [countrySearch]);

  const setNationalityFromShortcut = (label: string, id: string) => {
    if (id === ONBOARDING_OTHER_COUNTRY_ID) {
      setNationality('');
      return;
    }
    setNationality(label);
  };

  const goLocation = () => {
    trackScreenView('onboarding_location');
    router.replace('/onboarding/location');
  };

  const handleContinue = async () => {
    const trimmed = nationality.trim();
    if (!trimmed) {
      setValidationError('Please enter your nationality or country.');
      return;
    }

    setIsLoading(true);
    setValidationError(null);
    try {
      await api.post('/api/v1/profile/interests', { nationality: trimmed });
      trackFeatureUsage('onboarding_nationality_saved', {
        hasNationality: true,
      });
      goLocation();
    } catch (error: any) {
      logger.error('Error saving nationality:', error);
      const msg = error?.response?.data?.message || error?.message || 'Could not save nationality. Please try again.';
      setValidationError(typeof msg === 'string' ? msg : 'Could not save nationality. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    trackScreenView('onboarding_nationality');
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.stepMeta, { color: theme.colors.textSecondary }]}>Step 3 of 6</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Nationality / country</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Required — search for a shortcut or type your nationality or country freely.
          </Text>
        </View>

        <View
          style={[
            styles.searchRow,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            value={countrySearch}
            onChangeText={setCountrySearch}
            placeholder="Search countries…"
            placeholderTextColor={theme.colors.textSecondary}
            style={[styles.searchInput, { color: theme.colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Your nationality or country</Text>
        <TextInput
          value={nationality}
          onChangeText={(text) => {
            setNationality(text);
            setValidationError(null);
          }}
          placeholder="Type here or pick a shortcut below"
          placeholderTextColor={theme.colors.textSecondary}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
            },
          ]}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={100}
        />

        <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
          Shortcuts {countrySearch.trim() ? `(${filteredCountries.length})` : ''}
        </Text>
        <View style={styles.countryWrap}>
          {filteredCountries.map(c => {
            const dim = c.id !== ONBOARDING_OTHER_COUNTRY_ID && nationality === c.label;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => setNationalityFromShortcut(c.label, c.id)}
                style={[
                  styles.countryChip,
                  {
                    backgroundColor: dim ? theme.colors.primary + '18' : theme.colors.card,
                    borderColor: dim ? theme.colors.primary : theme.colors.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: getFontFamily('500'),
                    color: dim ? theme.colors.primary : theme.colors.text,
                  }}
                  numberOfLines={1}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {validationError ? (
          <Text style={[styles.errorText, { color: theme.colors.error || '#DC2626' }]}>{validationError}</Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={handleContinue} disabled={isLoading} style={styles.continueButton} activeOpacity={0.8}>
          <LinearGradient colors={[theme.colors.primary, theme.colors.primary + 'DD']} style={styles.gradient}>
            <Text style={styles.continueButtonText}>{isLoading ? 'Saving...' : 'Continue'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isTablet ? 1000 : 800,
      alignSelf: 'center',
      width: '100%',
    } as object),
  },
  scrollContent: {
    padding: isTablet ? theme.spacing.xxl : 24,
    paddingBottom: isTablet ? 120 : 100,
    ...(isWeb && {
      minHeight: '100vh',
    } as object),
  },
  header: {
    marginBottom: isTablet ? theme.spacing.lg : 20,
  },
  stepMeta: {
    fontSize: 13,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  title: {
    fontSize: isTablet ? theme.typography.h1.fontSize + 10 : 28,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: isTablet ? theme.spacing.sm : 8,
    letterSpacing: isIOS ? -0.5 : 0,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as object),
  },
  subtitle: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as object),
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: theme.borderRadius.md,
    marginBottom: isTablet ? theme.spacing.lg : 16,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: getFontFamily('400'),
    paddingVertical: isIOS ? 12 : 10,
    ...(isWeb && {
      outlineStyle: 'none',
    } as object),
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 10,
  },
  hint: {
    fontSize: 13,
    fontFamily: getFontFamily('500'),
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: isTablet ? 16 : 14,
    fontSize: 16,
    fontFamily: getFontFamily('400'),
  },
  countryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  countryChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    maxWidth: '100%',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: getFontFamily('500'),
  },
  footer: {
    padding: isTablet ? theme.spacing.xl : 24,
    gap: isTablet ? theme.spacing.md : 12,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: isTablet ? theme.spacing.md : 12,
    ...(isWeb && {
      cursor: 'pointer',
    } as object),
  },
  skipText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as object),
  },
  continueButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: isTablet ? theme.spacing.lg : 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as object),
  },
});
