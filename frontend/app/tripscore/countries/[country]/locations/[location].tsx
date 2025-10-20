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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../../context/ThemeContext';
import api from '../../../../../services/api';

interface LocationDetail {
  name: string;
  score: number;
  date: string;
  caption: string;
  category: {
    fromYou: string;
    typeOfSpot: string;
  };
  imageUrl?: string;
  description?: string;
}

export default function LocationDetailScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LocationDetail | null>(null);
  const { theme } = useTheme();
  const router = useRouter();
  const { country, location, userId } = useLocalSearchParams();

  useEffect(() => {
    loadLocationData();
  }, []);

  const loadLocationData = async () => {
    try {
      setLoading(true);
      const countryParam = Array.isArray(country) ? country[0] : country;
      const locationParam = Array.isArray(location) ? location[0] : location;
      
      // Convert slugs back to proper names for API
      const countryName = countryParam.replace(/-/g, ' ');
      const locationName = locationParam.replace(/-/g, ' ');
      
      // Get all locations for the country and find the specific one
      const response = await api.get(`/profile/${userId}/tripscore/countries/${countryName}`);
      const locations = response.data.locations;
      
      // Find the specific location
      const foundLocation = locations.find((loc: any) => 
        loc.name.toLowerCase().replace(/\s+/g, '-') === locationParam
      );
      
      if (foundLocation) {
        setData({
          ...foundLocation,
          description: generateLocationDescription(foundLocation.name, foundLocation.caption)
        });
      }
    } catch (error) {
      console.error('Error loading location data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateLocationDescription = (locationName: string, caption: string) => {
    // Generate descriptions based on location name
    const descriptions: { [key: string]: string } = {
      'the great barrier reef': 'The Great Barrier Reef is the world\'s largest coral reef system, composed of over 2,900 individual reefs and 900 islands stretching for over 2,300 kilometres. It\'s a UNESCO World Heritage site and one of the most biodiverse ecosystems on Earth.',
      'ooty': 'Ooty, with its scenic sightseeing spots and thrilling tourist attractions, is the ideal destination for nature lovers and thrill-seekers alike. Ooty has something for everyone!',
      'rio de janeiro': 'Rio de Janeiro is a vibrant city known for its stunning beaches, iconic landmarks like Christ the Redeemer, and the world-famous Carnival celebration.',
      'amazon rainforest': 'The Amazon Rainforest is the largest tropical rainforest in the world, home to incredible biodiversity and indigenous communities.',
      'machu picchu': 'Machu Picchu is an ancient Incan citadel set high in the Andes Mountains, offering breathtaking views and rich historical significance.',
      'niagara falls': 'Niagara Falls is a group of three waterfalls at the southern end of Niagara Gorge, between the Canadian province of Ontario and the US state of New York.',
    };
    
    const key = locationName.toLowerCase();
    return descriptions[key] || `${locationName} is a beautiful destination with unique attractions and natural beauty that makes it a memorable place to visit.`;
  };

  const getLocationImage = (locationName: string) => {
    // Return placeholder image URLs based on location
    const images: { [key: string]: string } = {
      'the great barrier reef': 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=400',
      'ooty': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
      'rio de janeiro': 'https://images.unsplash.com/photo-1544989165-0c1b4b0b0b0b?w=400',
      'amazon rainforest': 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400',
      'machu picchu': 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=400',
      'niagara falls': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
    };
    
    const key = locationName.toLowerCase();
    return images[key] || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400';
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

  const locationName = Array.isArray(location) ? location[0] : location;
  const displayLocationName = locationName?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

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
          {displayLocationName}
        </Text>
        <TouchableOpacity style={styles.closeButton}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {data && (
          <>
            {/* Location Image */}
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: getLocationImage(data.name) }}
                style={styles.locationImage}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay}>
                <Text style={styles.imageLabel}>{data.name}</Text>
              </View>
            </View>

            {/* Location Categories */}
            <View style={[styles.categoriesContainer, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.categoryRow}>
                <View style={styles.categoryItem}>
                  <Text style={[styles.categoryLabel, { color: theme.colors.textSecondary }]}>
                    FROM YOU
                  </Text>
                  <Text style={[styles.categoryValue, { color: theme.colors.text }]}>
                    {data.category.fromYou}
                  </Text>
                </View>
                <View style={styles.categoryDivider} />
                <View style={styles.categoryItem}>
                  <Text style={[styles.categoryLabel, { color: theme.colors.textSecondary }]}>
                    TYPE OF SPOT
                  </Text>
                  <Text style={[styles.categoryValue, { color: theme.colors.text }]}>
                    {data.category.typeOfSpot}
                  </Text>
                </View>
              </View>
            </View>

            {/* Description */}
            <View style={[styles.descriptionContainer, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.descriptionText, { color: theme.colors.text }]}>
                {data.description}
              </Text>
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
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    height: 250,
  },
  locationImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  imageLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  categoriesContainer: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryItem: {
    flex: 1,
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  categoryValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  categoryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 20,
  },
  descriptionContainer: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  }
});
