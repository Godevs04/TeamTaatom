import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Dimensions, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import { trackScreenView, trackFeatureUsage } from '../../services/analytics';
import { theme } from '../../constants/theme';
import logger from '../../utils/logger';
import { ONBOARDING_LANGUAGES, ONBOARDING_OTHER_LANGUAGE_ID, ONBOARDING_MIN_LANGUAGES, ONBOARDING_MAX_LANGUAGES } from '../../constants/onboardingOptions';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

function parseOtherLanguages(text: string): string[] {
  return text
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function buildLanguagesKnown(selectedIds: string[], otherText: string): string[] {
  const preset = selectedIds.filter(id => id !== ONBOARDING_OTHER_LANGUAGE_ID);
  const extra = parseOtherLanguages(otherText);
  return [...preset, ...extra];
}

export default function LanguagesOnboarding() {
  const router = useRouter();
  const { theme } = useTheme();
  const [languageSearch, setLanguageSearch] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [otherLanguagesText, setOtherLanguagesText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const otherLanguageSelected = selectedLanguages.includes(ONBOARDING_OTHER_LANGUAGE_ID);

  const languagesKnownPreview = useMemo(
    () => buildLanguagesKnown(selectedLanguages, otherLanguagesText),
    [selectedLanguages, otherLanguagesText]
  );

  const filteredLanguages = useMemo(() => {
    const q = languageSearch.trim().toLowerCase();
    if (!q) return ONBOARDING_LANGUAGES;
    return ONBOARDING_LANGUAGES.filter(
      l =>
        l.label.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        l.id.replace(/_/g, ' ').toLowerCase().includes(q)
    );
  }, [languageSearch]);

  const showOtherChip = useMemo(() => {
    const q = languageSearch.trim().toLowerCase();
    if (!q || otherLanguageSelected) return true;
    return (
      q.includes('other') ||
      q.includes('specify') ||
      q.includes('custom') ||
      filteredLanguages.length === 0
    );
  }, [languageSearch, otherLanguageSelected, filteredLanguages.length]);

  const toggleLanguage = (id: string) => {
    setValidationError(null);
    setSelectedLanguages(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      const nextPreview = buildLanguagesKnown([...prev, id], otherLanguagesText);
      if (nextPreview.length > ONBOARDING_MAX_LANGUAGES) {
        setValidationError(`You can select up to ${ONBOARDING_MAX_LANGUAGES} languages.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const goNationality = () => {
    trackScreenView('onboarding_nationality');
    router.replace('/onboarding/nationality');
  };

  const handleContinue = async () => {
    const languagesKnown = languagesKnownPreview;
    if (languagesKnown.length < ONBOARDING_MIN_LANGUAGES) {
      setValidationError(`Please select at least ${ONBOARDING_MIN_LANGUAGES} language.`);
      return;
    }
    if (languagesKnown.length > ONBOARDING_MAX_LANGUAGES) {
      setValidationError(`You can select up to ${ONBOARDING_MAX_LANGUAGES} languages.`);
      return;
    }
    if (otherLanguageSelected && !parseOtherLanguages(otherLanguagesText).length && selectedLanguages.length === 1) {
      setValidationError('Please specify your language under Other, or pick a language from the list.');
      return;
    }

    setIsLoading(true);
    setValidationError(null);
    try {
      await api.post('/api/v1/profile/interests', { languagesKnown });
      await AsyncStorage.setItem('onboarding_languages', JSON.stringify(languagesKnown));
      trackFeatureUsage('onboarding_languages_saved', {
        count: languagesKnown.length,
        languages: languagesKnown,
      });
      goNationality();
    } catch (error: any) {
      logger.error('Error saving languages:', error);
      const msg = error?.response?.data?.message || error?.message || 'Could not save languages. Please try again.';
      setValidationError(typeof msg === 'string' ? msg : 'Could not save languages. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    trackScreenView('onboarding_languages');
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.stepMeta, { color: theme.colors.textSecondary }]}>Step 2 of 6</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Languages you speak</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Select at least {ONBOARDING_MIN_LANGUAGES} language (up to {ONBOARDING_MAX_LANGUAGES}). Search to find one quickly, or choose Other to specify.
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
            value={languageSearch}
            onChangeText={setLanguageSearch}
            placeholder="Search languages…"
            placeholderTextColor={theme.colors.textSecondary}
            style={[styles.searchInput, { color: theme.colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
          {languageSearch.trim() ? `Matches (${filteredLanguages.length})` : 'All languages'}
          {languagesKnownPreview.length > 0 ? ` · ${languagesKnownPreview.length}/${ONBOARDING_MAX_LANGUAGES} selected` : ''}
        </Text>
        <View style={styles.grid}>
          {filteredLanguages.map(lang => {
            const isSelected = selectedLanguages.includes(lang.id);
            return (
              <TouchableOpacity
                key={lang.id}
                onPress={() => toggleLanguage(lang.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? theme.colors.primary + '20' : theme.colors.card,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={22}
                  color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.chipLabel,
                    {
                      color: isSelected ? theme.colors.primary : theme.colors.text,
                      fontWeight: isSelected ? '600' : '400',
                    },
                  ]}
                >
                  {lang.label}
                </Text>
                {isSelected && (
                  <LinearGradient
                    colors={['#50C878', '#1C73B4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.checkmark}
                  >
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </LinearGradient>
                )}
              </TouchableOpacity>
            );
          })}
          {showOtherChip && (
            <TouchableOpacity
              onPress={() => toggleLanguage(ONBOARDING_OTHER_LANGUAGE_ID)}
              style={[
                styles.chip,
                {
                  backgroundColor: otherLanguageSelected ? theme.colors.primary + '20' : theme.colors.card,
                  borderColor: otherLanguageSelected ? theme.colors.primary : theme.colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="add-circle-outline"
                size={22}
                color={otherLanguageSelected ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.chipLabel,
                  {
                    color: otherLanguageSelected ? theme.colors.primary : theme.colors.text,
                    fontWeight: otherLanguageSelected ? '600' : '400',
                  },
                ]}
              >
                Other (specify)
              </Text>
              {otherLanguageSelected && (
                <LinearGradient
                  colors={['#50C878', '#1C73B4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.checkmark}
                >
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </LinearGradient>
              )}
            </TouchableOpacity>
          )}
        </View>

        {otherLanguageSelected && (
          <TextInput
            value={otherLanguagesText}
            onChangeText={(text) => {
              setOtherLanguagesText(text);
              setValidationError(null);
            }}
            placeholder="e.g. Icelandic, ASL — comma-separated"
            placeholderTextColor={theme.colors.textSecondary}
            style={[
              styles.input,
              styles.otherLanguagesInput,
              {
                color: theme.colors.text,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.card,
              },
            ]}
            multiline
            maxLength={300}
          />
        )}

        {validationError ? (
          <Text style={[styles.errorText, { color: theme.colors.error || '#DC2626' }]}>{validationError}</Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={handleContinue} disabled={isLoading} style={styles.continueButton} activeOpacity={0.8}>
          <LinearGradient
            colors={['#50C878', '#1C73B4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <Text style={styles.continueButtonText}>
              {isLoading ? 'Saving...' : `Continue (${languagesKnownPreview.length})`}
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
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isTablet ? theme.spacing.md : 12,
  },
  chip: {
    width: isTablet ? '31%' : '47%',
    padding: isTablet ? theme.spacing.lg : 14,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: isTablet ? 100 : 88,
    position: 'relative',
  },
  chipLabel: {
    marginTop: isTablet ? theme.spacing.sm : 8,
    fontSize: isTablet ? theme.typography.body.fontSize : 13,
    fontFamily: getFontFamily('500'),
    textAlign: 'center',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as object),
  },
  checkmark: {
    position: 'absolute',
    top: isTablet ? theme.spacing.sm : 8,
    right: isTablet ? theme.spacing.sm : 8,
    width: isTablet ? 28 : 24,
    height: isTablet ? 28 : 24,
    borderRadius: isTablet ? 14 : 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    borderWidth: 2,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: isTablet ? 16 : 14,
    fontSize: 16,
    fontFamily: getFontFamily('400'),
  },
  otherLanguagesInput: {
    marginTop: 12,
    minHeight: 72,
    textAlignVertical: 'top',
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
