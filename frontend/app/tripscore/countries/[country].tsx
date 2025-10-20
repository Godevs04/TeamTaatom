import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../services/api';

interface Location {
  name: string;
  score: number;
  date: string;
  caption: string;
  category: {
    fromYou: string;
    typeOfSpot: string;
  };
}

interface TripScoreCountryResponse {
  success: boolean;
  country: string;
  countryScore: number;
  countryDistance: number;
  locations: Location[];
}

export default function TripScoreCountryDetailScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TripScoreCountryResponse | null>(null);
  const { theme } = useTheme();
  const router = useRouter();
  const { country, userId } = useLocalSearchParams();

  useEffect(() => {
    loadCountryData();
  }, []);

  const loadCountryData = async () => {
    try {
      setLoading(true);
      const countryParam = Array.isArray(country) ? country[0] : country;
      // Convert slug back to proper country name for API
      const countryName = countryParam.replace(/-/g, ' ');
      const response = await api.get(`/profile/${userId}/tripscore/countries/${countryName}`);
      
      setData(response.data);
    } catch (error) {
      console.error('Error loading country data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getContinentForCountry = (countryName: string) => {
    const countryLower = countryName.toLowerCase();
    
    // Australia region countries
    if (countryLower.includes('australia') || countryLower.includes('new zealand') || 
        countryLower.includes('fiji') || countryLower.includes('papua')) {
      return 'AUSTRALIA';
    }
    // Asia countries
    if (countryLower.includes('india') || countryLower.includes('china') || 
        countryLower.includes('japan') || countryLower.includes('thailand') ||
        countryLower.includes('singapore') || countryLower.includes('malaysia')) {
      return 'ASIA';
    }
    // Europe countries
    if (countryLower.includes('france') || countryLower.includes('germany') || 
        countryLower.includes('italy') || countryLower.includes('spain') ||
        countryLower.includes('united kingdom') || countryLower.includes('uk')) {
      return 'EUROPE';
    }
    // North America countries
    if (countryLower.includes('united states') || countryLower.includes('usa') || 
        countryLower.includes('canada') || countryLower.includes('mexico')) {
      return 'NORTH AMERICA';
    }
    // South America countries
    if (countryLower.includes('brazil') || countryLower.includes('argentina') || 
        countryLower.includes('chile') || countryLower.includes('peru') ||
        countryLower.includes('colombia') || countryLower.includes('venezuela')) {
      return 'SOUTH AMERICA';
    }
    // Africa countries
    if (countryLower.includes('egypt') || countryLower.includes('south africa') || 
        countryLower.includes('nigeria') || countryLower.includes('kenya')) {
      return 'AFRICA';
    }
    
    return 'UNKNOWN';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const countryName = Array.isArray(country) ? country[0] : country;
  const displayCountryName = countryName?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const continent = getContinentForCountry(displayCountryName || '');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {displayCountryName}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {data && (
          <>
            {/* TripScore and Distance */}
            <View style={[styles.statsContainer, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  TRIPSCORE
                </Text>
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                  {data.countryScore}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  DISTANCE
                </Text>
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                  {data.countryDistance} km
                </Text>
              </View>
            </View>

            {/* List Of Places Visited */}
            <View style={[styles.placesContainer, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                List Of Places Visited
              </Text>
              {data.locations.map((location, index) => (
                <View key={index} style={styles.placeItem}>
                  <Text style={[styles.placeName, { color: theme.colors.text }]}>
                    {location.name}
                  </Text>
                </View>
              ))}
            </View>

            {/* Continent Information */}
            <TouchableOpacity 
              style={[styles.continentContainer, { backgroundColor: theme.colors.surface }]}
              onPress={() => {
                const slug = (countryName || '').toLowerCase().replace(/\s+/g, '-');
                router.push({ pathname: '/tripscore/countries/[country]/map', params: { country: slug, userId: (Array.isArray(userId) ? userId[0] : userId) as string } });
              }}
            >
              <View style={styles.continentInfo}>
                <Text style={[styles.continentLabel, { color: theme.colors.textSecondary }]}>
                  CONTINENT
                </Text>
                <Text style={[styles.continentValue, { color: theme.colors.text }]}>
                  {continent}
                </Text>
              </View>
              <View style={[styles.mapPlaceholder, { backgroundColor: '#4CAF50' }]}>
                <Ionicons name="map-outline" size={40} color="white" />
              </View>
            </TouchableOpacity>
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
  statsContainer: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  placesContainer: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  placeItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  placeName: {
    fontSize: 16,
    fontWeight: '500',
  },
  continentContainer: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  continentInfo: {
    flex: 1,
  },
  continentLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  continentValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  mapPlaceholder: {
    width: 80,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
