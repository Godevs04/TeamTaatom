import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../context/ThemeContext';
import api from '../../../../services/api';

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

interface TripScoreLocationsResponse {
  success: boolean;
  country: string;
  countryScore: number;
  locations: Location[];
}

export default function TripScoreLocationsScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TripScoreLocationsResponse | null>(null);
  const { theme } = useTheme();
  const router = useRouter();
  const { country, userId } = useLocalSearchParams();

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const countryParam = Array.isArray(country) ? country[0] : country;
      // Convert slug back to proper country name for API
      const countryName = countryParam.replace(/-/g, ' ');
      const response = await api.get(`/profile/${userId}/tripscore/countries/${countryName}/locations`);
      setData(response.data);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationPress = (location: Location) => {
    // Navigate to location detail screen
    router.push(`/tripscore/locations/${encodeURIComponent(location.name)}?userId=${userId}`);
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
          {data?.country || (Array.isArray(country) ? country[0] : country)}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {data && (
          <>
            {/* Country Score */}
            <View style={[styles.scoreContainer, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.scoreItem}>
                <Text style={[styles.scoreLabel, { color: theme.colors.textSecondary }]}>
                  TRIPSCORE
                </Text>
                <Text style={[styles.scoreValue, { color: theme.colors.primary }]}>
                  {data.countryScore}
                </Text>
              </View>
            </View>

            {/* List Of Places Visited */}
            <View style={[styles.sectionContainer, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                List Of Places Visited
              </Text>
              
              {data.locations.map((location, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.locationItem,
                    index === data.locations.length - 1 && styles.lastItem
                  ]}
                  onPress={() => handleLocationPress(location)}
                >
                  <Text style={[styles.locationName, { color: theme.colors.text }]}>
                    {location.name}
                  </Text>
                  <Text style={[styles.locationScore, { color: theme.colors.primary }]}>
                    Score: {location.score}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Location Categories */}
            {data.locations.length > 0 && (
              <View style={[styles.categoriesContainer, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  Location Categories
                </Text>
                
                {data.locations.slice(0, 3).map((location, index) => (
                  <View key={index} style={styles.categoryItem}>
                    <View style={styles.categoryRow}>
                      <View style={styles.categoryColumn}>
                        <Text style={[styles.categoryLabel, { color: theme.colors.textSecondary }]}>
                          FROM YOU
                        </Text>
                        <Text style={[styles.categoryValue, { color: theme.colors.text }]}>
                          {location.category.fromYou}
                        </Text>
                      </View>
                      <View style={styles.categoryColumn}>
                        <Text style={[styles.categoryLabel, { color: theme.colors.textSecondary }]}>
                          TYPE OF SPOT
                        </Text>
                        <Text style={[styles.categoryValue, { color: theme.colors.text }]}>
                          {location.category.typeOfSpot}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.locationDescription, { color: theme.colors.textSecondary }]}>
                      {location.caption || 'No description available'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
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
  sectionContainer: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  locationItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  locationScore: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoriesContainer: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  categoryItem: {
    marginBottom: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryColumn: {
    flex: 1,
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  categoryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  locationDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
});
