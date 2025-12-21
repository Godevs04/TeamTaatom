import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../context/ThemeContext';
import api from '../../../../services/api';
import logger from '../../../../utils/logger';

// Responsive dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

interface Country {
  name: string;
  score: number;
  visited: boolean;
}

interface TripScoreCountriesResponse {
  success: boolean;
  continent: string;
  continentScore: number;
  countries: Country[];
}

export default function TripScoreCountriesScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TripScoreCountriesResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCountries, setFilteredCountries] = useState<Country[]>([]);
  const { theme } = useTheme();
  const router = useRouter();
  const { continent, userId } = useLocalSearchParams();

  useEffect(() => {
    loadCountries();
  }, []);

  useEffect(() => {
    if (data) {
      const filtered = data.countries.filter(country =>
        country.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCountries(filtered);
    }
  }, [data, searchQuery]);

  const loadCountries = async () => {
    try {
      setLoading(true);
      const continentParam = Array.isArray(continent) ? continent[0] : continent;
      // Convert slug back to proper continent name for API
      const continentName = continentParam.replace(/-/g, ' ').toUpperCase();
      const response = await api.get(`/profile/${userId}/tripscore/continents/${continentName}/countries`);
      setData(response.data);
    } catch (error) {
      logger.error('Error loading countries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCountryPress = (country: string) => {
    const countrySlug = country.toLowerCase().replace(/\s+/g, '-');
    router.push(`/tripscore/countries/${countrySlug}?userId=${userId}`);
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
          {data?.continent || (Array.isArray(continent) ? continent[0] : continent)?.toUpperCase()}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {data && (
          <>
            {/* Continent Score */}
            <View style={[styles.scoreContainer, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.scoreItem}>
                <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>
                  TRIPSCORE
                </Text>
                <Text style={[styles.scoreValue, { color: theme.colors.primary }]}>
                  {data.continentScore}
                </Text>
              </View>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.background }]}>
                <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder="Search countries..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            {/* Countries List */}
            <View style={styles.countriesContainer}>
              {(searchQuery ? filteredCountries : data.countries).map((country, index) => (
                <TouchableOpacity
                  key={country.name}
                  style={[
                    styles.countryItem,
                    { backgroundColor: theme.colors.surface },
                    country.visited && { backgroundColor: theme.colors.primary + '20' },
                    index === data.countries.length - 1 && styles.lastItem
                  ]}
                  onPress={() => handleCountryPress(country.name)}
                >
                  <Text
                    style={[
                      styles.countryName,
                      { color: country.visited ? theme.colors.primary : theme.colors.text }
                    ]}
                  >
                    {country.name}
                  </Text>
                  {country.visited && (
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
                  )}
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scoreContainer: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    margin: 16,
    marginTop: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  countriesContainer: {
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '500',
  },
});
