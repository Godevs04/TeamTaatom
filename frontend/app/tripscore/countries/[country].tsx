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
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../services/api';
import logger from '../../../utils/logger';

// Platform-specific constants
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

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
      logger.error('Error loading country data:', error);
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

  const countryName = Array.isArray(country) ? country[0] : country;
  const displayCountryName = countryName?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const continent = getContinentForCountry(displayCountryName || '');

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
          {displayCountryName}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {data && (
          <>
            {/* Country Overview Card */}
            <View style={[styles.overviewCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.countryHeader}>
                <View style={styles.countryIcon}>
                  <Ionicons name="flag" size={32} color={theme.colors.primary} />
                </View>
                <View style={styles.countryInfo}>
                  <Text style={[styles.countryName, { color: theme.colors.text }]}>
                    {displayCountryName}
                  </Text>
                  <Text style={[styles.countryContinent, { color: theme.colors.textSecondary }]}>
                    {continent}
                  </Text>
                </View>
              </View>
              
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <View style={styles.statIconContainer}>
                    <Ionicons name="trophy" size={20} color="#FFD700" />
                  </View>
                  <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                    {data.countryScore}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                    TRIPSCORE
                  </Text>
                </View>
                
                {/* TODO: Distance section commented out temporarily */}
                {/* <View style={styles.statDivider} />
                
                <View style={styles.statBox}>
                  <View style={styles.statIconContainer}>
                    <Ionicons name="navigate" size={20} color="#4CAF50" />
                  </View>
                  <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                    {data.countryDistance}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                    DISTANCE
                  </Text>
                </View> */}
              </View>
            </View>

            {/* Places Visited Card */}
            <View style={[styles.placesCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="location" size={20} color={theme.colors.primary} />
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                  List Of Places Visited
                </Text>
                <View style={styles.placesCount}>
                  <Text style={[styles.countText, { color: theme.colors.textSecondary }]}>
                    {data.locations.length}
                  </Text>
                </View>
              </View>
              
              <View style={styles.placesList}>
                {data.locations.map((location, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.placeRow}
                    onPress={() => {
                      const locationSlug = location.name.toLowerCase().replace(/\s+/g, '-');
                      router.push({ 
                        pathname: '/tripscore/countries/[country]/locations/[location]', 
                        params: { 
                          country: countryName, 
                          location: locationSlug,
                          userId: (Array.isArray(userId) ? userId[0] : userId) as string 
                        } 
                      });
                    }}
                  >
                    <View style={styles.placeIcon}>
                      <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
                    </View>
                    <View style={styles.placeDetails}>
                      <Text style={[styles.placeName, { color: theme.colors.text }]}>
                        {location.name}
                      </Text>
                      <Text style={[styles.placeMeta, { color: theme.colors.textSecondary }]}>
                        Score: {location.score} • {new Date(location.date).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.placeScore}>
                      <Text style={[styles.scoreText, { color: theme.colors.primary }]}>
                        {location.score}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Map Access Card */}
            <TouchableOpacity 
              style={[styles.mapCard, { backgroundColor: theme.colors.surface }]}
              onPress={() => {
                const slug = (countryName || '').toLowerCase().replace(/\s+/g, '-');
                router.push({ pathname: '/tripscore/countries/[country]/map', params: { country: slug, userId: (Array.isArray(userId) ? userId[0] : userId) as string } });
              }}
            >
              <View style={styles.mapCardContent}>
                <View style={styles.mapInfo}>
                  <View style={styles.mapIconContainer}>
                    <Ionicons name="globe" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.mapTextContainer}>
                    <Text style={[styles.mapTitle, { color: theme.colors.text }]}>
                      Explore on Map
                    </Text>
                    <Text style={[styles.mapSubtitle, { color: theme.colors.textSecondary }]}>
                      View {displayCountryName} locations
                    </Text>
                  </View>
                </View>
                <View style={styles.mapButton}>
                  <Ionicons name="map" size={24} color="#fff" />
                </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Country Overview Card
  overviewCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  countryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  countryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  countryContinent: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.7,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
  },

  // Places Card
  placesCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
    flex: 1,
  },
  placesCount: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
  },
  placesList: {
    gap: 12,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
  },
  placeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeDetails: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  placeMeta: {
    fontSize: 14,
    opacity: 0.7,
  },
  placeScore: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 12,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Map Card
  mapCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  mapCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mapIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  mapTextContainer: {
    flex: 1,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  mapSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  mapButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
