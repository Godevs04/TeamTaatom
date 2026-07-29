import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import NavBar from '../../components/NavBar';
import { useAlert } from '../../context/AlertContext';
import { getUserFromStorage, saveUserToStorage } from '../../services/auth';
import { getProfile, updateProfile } from '../../services/profile';
import { ONBOARDING_LANGUAGES, ONBOARDING_INTERESTS } from '../../constants/onboardingOptions';
import logger from '../../utils/logger';

// Responsive dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

export default function PersonalDetailsScreen() {
  const router = useRouter();
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark' || theme.colors.background === '#0B1A2B';
  const { showError, showSuccess } = useAlert();

  const isMountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState('');

  // Personal data sheet state fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [nationality, setNationality] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [customLanguage, setCustomLanguage] = useState('');
  const [languageSearch, setLanguageSearch] = useState('');

  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      const cached = await getUserFromStorage();
      if (cached && cached._id) {
        setUserId(cached._id);
        setFullName(cached.fullName || '');
        setUsername(cached.username || '');
        setEmail(cached.email || '');
        setBio(cached.bio || '');
        setNationality(cached.nationality || '');
        setCurrentLocation(cached.currentLocation || cached.currentCountry || '');
        if (Array.isArray(cached.interests)) setSelectedInterests(cached.interests);
        if (Array.isArray(cached.languagesKnown)) setSelectedLanguages(cached.languagesKnown);

        // Fetch fresh profile from API
        try {
          const profileRes = await getProfile(cached._id);
          const p = profileRes.profile;
          if (p) {
            setFullName(p.fullName || '');
            setUsername(p.username || '');
            setEmail(p.email || '');
            setBio(p.bio || '');
            setNationality((p as any).nationality || '');
            setCurrentLocation((p as any).currentLocation || (p as any).currentCountry || '');
            if (Array.isArray((p as any).interests)) setSelectedInterests((p as any).interests);
            if (Array.isArray((p as any).languagesKnown)) setSelectedLanguages((p as any).languagesKnown);
          }
        } catch (apiErr) {
          logger.warn('Failed to fetch profile API, using cached data', apiErr);
        }
      }
    } catch (err: any) {
      logger.error('Error loading personal details', err);
      showError('Failed to load profile details');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    isMountedRef.current = true;
    loadUserData();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadUserData]);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      return () => {};
    }, [])
  );

  // Filter languages based on search query
  const filteredLanguages = useMemo(() => {
    const q = languageSearch.trim().toLowerCase();
    if (!q) return ONBOARDING_LANGUAGES;
    return ONBOARDING_LANGUAGES.filter(
      l => l.label.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)
    );
  }, [languageSearch]);

  const toggleInterest = (item: string) => {
    setSelectedInterests(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const toggleLanguage = (item: string) => {
    setSelectedLanguages(prev =>
      prev.includes(item) ? prev.filter(l => l !== item) : [...prev, item]
    );
  };

  const handleAddCustomInterest = () => {
    const trimmed = customInterest.trim();
    if (trimmed && !selectedInterests.includes(trimmed)) {
      setSelectedInterests(prev => [...prev, trimmed]);
      setCustomInterest('');
    }
  };

  const handleAddCustomLanguage = () => {
    const trimmed = customLanguage.trim();
    if (trimmed && !selectedLanguages.includes(trimmed)) {
      setSelectedLanguages(prev => [...prev, trimmed]);
      setCustomLanguage('');
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      showError('Full Name cannot be empty');
      return;
    }
    if (!userId) {
      showError('User session invalid. Please log in again.');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        fullName: fullName.trim(),
        bio: bio.trim(),
        nationality: nationality.trim(),
        currentLocation: currentLocation.trim(),
        interests: selectedInterests,
        languagesKnown: selectedLanguages,
      };

      const res = await updateProfile(userId, updateData);
      
      // Update local storage user object
      const stored = await getUserFromStorage();
      if (stored) {
        const updated = {
          ...stored,
          fullName: res.user.fullName || updateData.fullName,
          bio: res.user.bio || updateData.bio,
          nationality: (res.user as any).nationality || updateData.nationality,
          interests: (res.user as any).interests || updateData.interests,
          languagesKnown: (res.user as any).languagesKnown || updateData.languagesKnown,
          currentLocation: (res.user as any).currentLocation || updateData.currentLocation,
        };
        await saveUserToStorage(updated);
      }

      showSuccess('Personal details updated successfully!');
    } catch (err: any) {
      logger.error('Failed to save personal details', err);
      showError(err?.message || 'Failed to save personal details');
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  };

  // Helper render for Chip with signature Gradient background when active
  const renderChip = (label: string, active: boolean, onPress: () => void, isRemove: boolean = false) => {
    if (active) {
      return (
        <TouchableOpacity
          key={label}
          onPress={onPress}
          activeOpacity={0.85}
          style={styles.chipWrapper}
        >
          <LinearGradient
            colors={['#1C73B4', '#50C878']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.activeChipGradient}
          >
            <Text style={styles.activeChipText}>
              {label} {isRemove ? '✕' : ''}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={label}
        style={[
          styles.inactiveChip,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
          },
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={[styles.inactiveChipText, { color: theme.colors.text }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title="Personal Details" />
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <NavBar title="Personal Details Data Sheet" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={isIOS ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Card */}
          <View style={[styles.card, { backgroundColor: theme.colors.card || theme.colors.surface || 'rgba(255,255,255,0.06)', borderColor: theme.colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="card-outline" size={24} color={theme.colors.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Personal Data Sheet</Text>
                <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]}>
                  View and update your personal details collected during signup and onboarding.
                </Text>
              </View>
            </View>
          </View>

          {/* Basic Identity Section */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account Information</Text>
          </View>

          <View style={[styles.fieldGroup, { backgroundColor: theme.colors.card || theme.colors.surface || 'rgba(255,255,255,0.04)', borderColor: theme.colors.border }]}>
            {/* Full Name */}
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Full Name</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            {/* Username (Read Only) */}
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Username</Text>
              <TextInput
                style={[styles.input, styles.disabledInput, { color: theme.colors.textSecondary, borderColor: theme.colors.border }]}
                value={`@${username}`}
                editable={false}
              />
            </View>

            {/* Email (Read Only) */}
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Email Address</Text>
              <TextInput
                style={[styles.input, styles.disabledInput, { color: theme.colors.textSecondary, borderColor: theme.colors.border }]}
                value={email}
                editable={false}
              />
            </View>

            {/* Bio */}
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Bio</Text>
              <TextInput
                style={[styles.input, styles.multilineInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell others about yourself..."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Demographic & Location Section */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Demographics & Origin</Text>
          </View>

          <View style={[styles.fieldGroup, { backgroundColor: theme.colors.card || theme.colors.surface || 'rgba(255,255,255,0.04)', borderColor: theme.colors.border }]}>
            {/* Nationality */}
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Nationality / Country</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                value={nationality}
                onChangeText={setNationality}
                placeholder="e.g. United States, India, Germany"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            {/* Current Location */}
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Current City / Location</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                value={currentLocation}
                onChangeText={setCurrentLocation}
                placeholder="e.g. New York, London, Tokyo"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>
          </View>

          {/* Languages Spoken Section */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Languages Spoken</Text>
          </View>

          <View style={[styles.fieldGroup, { backgroundColor: theme.colors.card || theme.colors.surface || 'rgba(255,255,255,0.04)', borderColor: theme.colors.border }]}>
            {/* Selected Languages Header */}
            {selectedLanguages.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.subGroupLabel, { color: theme.colors.textSecondary }]}>Selected Languages ({selectedLanguages.length}):</Text>
                <View style={styles.chipsContainer}>
                  {selectedLanguages.map(lang => renderChip(lang, true, () => toggleLanguage(lang), true))}
                </View>
              </View>
            )}

            {/* Language Search Input */}
            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                value={languageSearch}
                onChangeText={setLanguageSearch}
                placeholder="Search 100+ languages..."
                placeholderTextColor={theme.colors.textSecondary}
              />
              {languageSearch.length > 0 && (
                <TouchableOpacity onPress={() => setLanguageSearch('')}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Languages Chips List */}
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              <View style={styles.chipsContainer}>
                {filteredLanguages.map(item => {
                  const label = item.label;
                  const active = selectedLanguages.includes(label) || selectedLanguages.includes(item.id);
                  return renderChip(label, active, () => toggleLanguage(label));
                })}
              </View>
            </ScrollView>

            {/* Custom Language Addition */}
            <View style={styles.addCustomRow}>
              <TextInput
                style={[styles.input, { flex: 1, color: theme.colors.text, borderColor: theme.colors.border, marginRight: 8 }]}
                value={customLanguage}
                onChangeText={setCustomLanguage}
                placeholder="Add other language..."
                placeholderTextColor={theme.colors.textSecondary}
              />
              <TouchableOpacity
                onPress={handleAddCustomLanguage}
                activeOpacity={0.8}
                style={{ borderRadius: 12, overflow: 'hidden' }}
              >
                <LinearGradient
                  colors={['#1C73B4', '#50C878']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addButtonGradient}
                >
                  <Ionicons name="add" size={24} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Interests Section */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Travel Interests & Preferences</Text>
          </View>

          <View style={[styles.fieldGroup, { backgroundColor: theme.colors.card || theme.colors.surface || 'rgba(255,255,255,0.04)', borderColor: theme.colors.border }]}>
            <View style={styles.chipsContainer}>
              {ONBOARDING_INTERESTS.map(interest => {
                const label = interest.label;
                const active = selectedInterests.includes(label) || selectedInterests.includes(interest.id);
                return renderChip(label, active, () => toggleInterest(label));
              })}
              {selectedInterests
                .filter(i => !ONBOARDING_INTERESTS.some(oi => oi.label === i || oi.id === i))
                .map(customI => renderChip(customI, true, () => toggleInterest(customI), true))}
            </View>

            <View style={styles.addCustomRow}>
              <TextInput
                style={[styles.input, { flex: 1, color: theme.colors.text, borderColor: theme.colors.border, marginRight: 8 }]}
                value={customInterest}
                onChangeText={setCustomInterest}
                placeholder="Add custom interest..."
                placeholderTextColor={theme.colors.textSecondary}
              />
              <TouchableOpacity
                onPress={handleAddCustomInterest}
                activeOpacity={0.8}
                style={{ borderRadius: 12, overflow: 'hidden' }}
              >
                <LinearGradient
                  colors={['#1C73B4', '#50C878']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addButtonGradient}
                >
                  <Ionicons name="add" size={24} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Save Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
              style={{ borderRadius: 16, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={['#1C73B4', '#50C878']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveButtonGradient}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.saveButtonText}>Save Details</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: isTablet ? 24 : 16,
    paddingBottom: 40,
    ...(isWeb && {
      maxWidth: isTablet ? 800 : 640,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: isTablet ? 18 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  cardSub: {
    fontSize: 13,
    fontFamily: getFontFamily('400'),
    marginTop: 4,
    lineHeight: 18,
  },
  sectionHeader: {
    marginBottom: 8,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: isTablet ? 16 : 14,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subGroupLabel: {
    fontSize: 12,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 6,
  },
  fieldGroup: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  fieldRow: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: getFontFamily('400'),
  },
  disabledInput: {
    opacity: 0.7,
  },
  multilineInput: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(128,128,128,0.12)',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: getFontFamily('400'),
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  chipWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  activeChipGradient: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  inactiveChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveChipText: {
    fontSize: 13,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  addCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  addButtonGradient: {
    height: 48,
    width: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    marginTop: 12,
    marginBottom: 20,
  },
  saveButtonGradient: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
});
