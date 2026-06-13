import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useTheme } from '../../context/ThemeContext';
import { trackScreenView, trackFeatureUsage, trackDropOff } from '../../services/analytics';
import { theme } from '../../constants/theme';
import logger from '../../utils/logger';
import { updateProfileLocation } from '../../services/profile';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

function formatDetectedLocation(address: Location.LocationGeocodedAddress): string {
  return [address.city || address.subregion || address.district, address.region, address.country]
    .filter(Boolean)
    .join(', ');
}

export default function LocationOnboarding() {
  const router = useRouter();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const goInterests = useCallback(() => {
    trackScreenView('onboarding_interests');
    router.replace('/onboarding/interests');
  }, [router]);

  const handleUseLocation = async () => {
    if (isWeb) {
      setErrorMessage('Location is available in the mobile app. You can skip for now.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const existingPermission = await Location.getForegroundPermissionsAsync();
      const permission =
        existingPermission.status === 'granted'
          ? existingPermission
          : await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setErrorMessage('Location permission was denied. You can continue without sharing your location.');
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync();
      const position =
        lastKnown ||
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));

      const [address] = await Location.reverseGeocodeAsync(position.coords);
      if (!address) {
        setErrorMessage('Could not determine your location. Try again or continue without it.');
        return;
      }

      const cityLabel = formatDetectedLocation(address);
      const country = address.country || undefined;
      if (!cityLabel && !country) {
        setErrorMessage('Could not determine your location. Try again or continue without it.');
        return;
      }

      await updateProfileLocation({
        city: cityLabel || undefined,
        country,
      });

      setDetectedLabel(cityLabel || country || 'Location saved');
      trackFeatureUsage('onboarding_location_saved', {
        hasCity: Boolean(cityLabel),
        hasCountry: Boolean(country),
      });
      goInterests();
    } catch (error) {
      logger.error('Error saving onboarding location:', error);
      setErrorMessage('Something went wrong. Try again or continue without sharing your location.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    trackDropOff('onboarding_location', { step: 'location', action: 'skip' });
    goInterests();
  };

  React.useEffect(() => {
    trackScreenView('onboarding_location');
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.stepMeta, { color: theme.colors.textSecondary }]}>Step 4 of 6</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Share your location?</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Optional — helps us show nearby places and connect you with travelers in your area.
          </Text>
        </View>

        <View style={[styles.iconWrap, { backgroundColor: theme.colors.primary + '15' }]}>
          <Ionicons name="location" size={48} color={theme.colors.primary} />
        </View>

        {detectedLabel ? (
          <View style={[styles.successBox, { backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary }]}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
            <Text style={[styles.successText, { color: theme.colors.text }]}>{detectedLabel}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <Text style={[styles.errorText, { color: theme.colors.error || '#DC2626' }]}>{errorMessage}</Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton} disabled={isLoading}>
          <Text style={[styles.skipText, { color: theme.colors.textSecondary }]}>Not now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleUseLocation}
          disabled={isLoading}
          style={styles.continueButton}
          activeOpacity={0.8}
        >
          <LinearGradient colors={[theme.colors.primary, theme.colors.primary + 'DD']} style={styles.gradient}>
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.continueButtonText}>Use my current location</Text>
            )}
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
    alignItems: 'center',
    ...(isWeb && {
      minHeight: '100vh',
    } as object),
  },
  header: {
    marginBottom: isTablet ? theme.spacing.xl : 28,
    alignSelf: 'stretch',
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
  },
  subtitle: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('400'),
    lineHeight: 24,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    alignSelf: 'stretch',
  },
  successText: {
    flex: 1,
    fontSize: 15,
    fontFamily: getFontFamily('500'),
  },
  errorText: {
    fontSize: 14,
    fontFamily: getFontFamily('500'),
    textAlign: 'center',
    marginTop: 8,
    alignSelf: 'stretch',
  },
  footer: {
    padding: isTablet ? theme.spacing.xl : 24,
    gap: isTablet ? theme.spacing.md : 12,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: isTablet ? theme.spacing.md : 12,
  },
  skipText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  continueButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: isTablet ? theme.spacing.lg : 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
});
