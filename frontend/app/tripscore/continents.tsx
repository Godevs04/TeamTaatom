import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { theme } from '../../constants/theme';
import logger from '../../utils/logger';

// Responsive dimensions
const { width: screenWidth } = Dimensions.get('window');
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

interface Continent {
  name: string;
  score: number;
  distance: number;
}

interface TripScoreContinentsResponse {
  success: boolean;
  totalScore: number;
  continents: Continent[];
}

export default function TripScoreContinentsScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TripScoreContinentsResponse | null>(null);
  const { theme } = useTheme();
  const router = useRouter();
  const { userId } = useLocalSearchParams();

  useEffect(() => {
    loadContinents();
  }, []);

  const loadContinents = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/profile/${userId}/tripscore/continents`);
      setData(response.data);
    } catch (error) {
      logger.error('Error loading continents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinentPress = (continent: string) => {
    const continentSlug = continent.toLowerCase().replace(/\s+/g, '-');
    router.push(`/tripscore/continents/${continentSlug}/countries?userId=${userId}`);
  };

  if (loading) {
    return (
      <SafeAreaView 
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={isTablet ? 28 : 24} color={theme.colors.text} />
          </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          TripScore
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {data && (
          <>
            {/* Total Score */}
            <View style={[styles.totalScoreContainer, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.totalScoreNumber, { color: theme.colors.primary }]}>
                {data.totalScore}
              </Text>
              <Text style={[styles.totalScoreLabel, { color: theme.colors.textSecondary }]}>
                Total TripScore
              </Text>
            </View>

            {/* Continents List */}
            <View style={[styles.continentsContainer, { backgroundColor: theme.colors.surface }]}>
              {data.continents.map((continent, index) => (
                <TouchableOpacity
                  key={continent.name}
                  style={[
                    styles.continentItem,
                    { backgroundColor: theme.colors.surface },
                    index === data.continents.length - 1 && styles.lastItem
                  ]}
                  onPress={() => handleContinentPress(continent.name)}
                >
                  <View style={styles.continentContent}>
                    <Text style={[styles.continentName, { color: theme.colors.text }]}>
                      {continent.name}
                    </Text>
                    <Text style={[styles.continentScoreLabel, { color: theme.colors.textSecondary }]}>
                      TRIPSCORE
                    </Text>
                    <Text style={[styles.continentScoreValue, { color: theme.colors.primary }]}>
                      {continent.score.toString().padStart(2, '0')}
                    </Text>
                  </View>
                  <View style={styles.continentRight}>
                    <Text style={[styles.continentDistance, { color: theme.colors.textSecondary }]}>
                      {continent.distance} km
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
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
    } as any),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: isTablet ? theme.spacing.sm : 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: isTablet ? 22 : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: isIOS ? 0.3 : 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  headerRight: {
    width: isTablet ? 48 : 40,
  },
  content: {
    flex: 1,
  },
  totalScoreContainer: {
    margin: isTablet ? theme.spacing.xl : theme.spacing.lg,
    padding: isTablet ? theme.spacing.xl : 24,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  totalScoreNumber: {
    fontSize: isTablet ? 64 : 48,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginBottom: isTablet ? theme.spacing.sm : 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  totalScoreLabel: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  continentsContainer: {
    margin: isTablet ? theme.spacing.xl : theme.spacing.lg,
    marginTop: 0,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  continentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: isTablet ? theme.spacing.lg : 16,
    paddingHorizontal: isTablet ? theme.spacing.xl : 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  continentContent: {
    flex: 1,
  },
  continentName: {
    fontSize: isTablet ? theme.typography.h3.fontSize : 18,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  continentScoreLabel: {
    fontSize: isTablet ? theme.typography.small.fontSize + 1 : 12,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  continentScoreValue: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  continentRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  continentDistance: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});
