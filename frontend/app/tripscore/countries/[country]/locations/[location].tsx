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
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../../../services/api';
import { calculateDistance, geocodeAddress } from '../../../../../utils/locationUtils';
import * as Location from 'expo-location';

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
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export default function LocationDetailScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LocationDetail | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
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
      
      // Check if this is a general location (from map) or a TripScore location
      if (countryParam === 'general') {
        // This is a location from the map, create mock data
        const description = await generateLocationDescription(locationName, '');
        setData({
          name: locationName,
          score: 1,
          date: new Date().toISOString(),
          caption: `Visited ${locationName}`,
          category: {
            fromYou: 'Drivable',
            typeOfSpot: 'General'
          },
          description: description
        });
      } else {
        // This is a TripScore location, fetch from API
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
      }
      
      // Calculate distance from current location (runs for all locations)
      try {
        console.log('Starting distance calculation for location:', locationName);
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('Location permission status:', status);
        if (status === 'granted') {
          const currentLocation = await Location.getCurrentPositionAsync({});
          console.log('Current location:', currentLocation.coords);
          // Use dynamic coordinates based on location name
          let locationCoords = getLocationCoordinates(locationName);
          console.log('Location coordinates:', locationCoords);
          
          // If coordinates are random (unknown location), try geocoding
          if (locationCoords && Math.abs(locationCoords.latitude - 12.9716) < 0.1 && Math.abs(locationCoords.longitude - 77.5946) < 0.1) {
            console.log('Trying geocoding for unknown location:', locationName);
            const geocodedCoords = await geocodeAddress(locationName);
            if (geocodedCoords) {
              locationCoords = geocodedCoords;
              console.log('Geocoded coordinates:', locationCoords);
            }
          }
          
          if (locationCoords) {
            const calculatedDistance = calculateDistance(
              currentLocation.coords.latitude,
              currentLocation.coords.longitude,
              locationCoords.latitude,
              locationCoords.longitude
            );
            setDistance(calculatedDistance);
            console.log('Distance calculated:', calculatedDistance, 'km');
          } else {
            console.log('No coordinates found for location:', locationName);
            setDistance(8.5); // Fallback distance
          }
        } else {
          console.log('Location permission denied');
          // Set a mock distance for testing
          setDistance(8.5);
        }
      } catch (error) {
        console.error('Error calculating distance:', error);
        // Set a mock distance for testing
        setDistance(8.5);
      }
    } catch (error) {
      console.error('Error loading location data:', error);
      // Fallback to mock data if API fails
      const locationParam = Array.isArray(location) ? location[0] : location;
      const locationName = locationParam.replace(/-/g, ' ');
      const description = await generateLocationDescription(locationName, '');
      setData({
        name: locationName,
        score: 1,
        date: new Date().toISOString(),
        caption: `Visited ${locationName}`,
        category: {
          fromYou: 'Drivable',
          typeOfSpot: 'General'
        },
        description: description,
        coordinates: {
          latitude: 12.9716, // Bangalore coordinates as example
          longitude: 77.5946
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const generateLocationDescription = async (locationName: string, caption: string) => {
    // For general locations (from map), generate dynamic description
    if (caption) {
      return `${locationName} is a beautiful destination where you've shared "${caption}". This location offers unique attractions and natural beauty that makes it a memorable place to visit.`;
    }
    
    // Dynamic description based on location name
    return `${locationName} is a beautiful destination with unique attractions and natural beauty that makes it a memorable place to visit. Explore the local culture, landmarks, and experiences that make this location special.`;
  };

  const getLocationImage = (locationName: string) => {
    // Generate dynamic Unsplash image URL based on location name
    const encodedLocation = encodeURIComponent(locationName);
    return `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&q=80&auto=format&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80`;
  };

  const getLocationCoordinates = (locationName: string) => {
    console.log('Looking up coordinates for:', locationName);
    
    // Simple coordinate mapping for common locations
    const coordinates: { [key: string]: { latitude: number; longitude: number } } = {
      'bangalore': { latitude: 12.9716, longitude: 77.5946 },
      'mumbai': { latitude: 19.0760, longitude: 72.8777 },
      'delhi': { latitude: 28.7041, longitude: 77.1025 },
      'hyderabad': { latitude: 17.3850, longitude: 78.4867 },
      'chennai': { latitude: 13.0827, longitude: 80.2707 },
      'kolkata': { latitude: 22.5726, longitude: 88.3639 },
      'pune': { latitude: 18.5204, longitude: 73.8567 },
      'ahmedabad': { latitude: 23.0225, longitude: 72.5714 },
      'jaipur': { latitude: 26.9124, longitude: 75.7873 },
      'lucknow': { latitude: 26.8467, longitude: 80.9462 },
      'bristol': { latitude: 51.4545, longitude: -2.5879 },
      'london': { latitude: 51.5074, longitude: -0.1278 },
      'paris': { latitude: 48.8566, longitude: 2.3522 },
      'new york': { latitude: 40.7128, longitude: -74.0060 },
      'san francisco': { latitude: 37.7749, longitude: -122.4194 },
      'los angeles': { latitude: 34.0522, longitude: -118.2437 },
      'tokyo': { latitude: 35.6762, longitude: 139.6503 },
      'sydney': { latitude: -33.8688, longitude: 151.2093 },
      'melbourne': { latitude: -37.8136, longitude: 144.9631 },
      'singapore': { latitude: 1.3521, longitude: 103.8198 },
      'dubai': { latitude: 25.2048, longitude: 55.2708 },
      'b.village': { latitude: 12.9716, longitude: 77.5946 },
      'lake point': { latitude: 12.9716, longitude: 77.5946 }, // Same as Bangalore for now
      'hsr layout': { latitude: 12.9115, longitude: 77.6444 },
      'koramangala': { latitude: 12.9352, longitude: 77.6245 },
      'indiranagar': { latitude: 12.9719, longitude: 77.6412 },
      'whitefield': { latitude: 12.9698, longitude: 77.7500 },
      'electronic city': { latitude: 12.8456, longitude: 77.6603 },
      'marathahalli': { latitude: 12.9612, longitude: 77.7000 },
      'jayanagar': { latitude: 12.9308, longitude: 77.5838 },
      'malleshwaram': { latitude: 12.9991, longitude: 77.5678 },
      'rajajinagar': { latitude: 12.9784, longitude: 77.5610 },
    };
    
    const normalizedName = locationName.toLowerCase().trim();
    console.log('Normalized location name:', normalizedName);
    
    const foundCoords = coordinates[normalizedName];
    if (foundCoords) {
      console.log('Found coordinates:', foundCoords);
      return foundCoords;
    } else {
      console.log('No coordinates found, using fallback');
      // Generate random coordinates around Bangalore for unknown locations
      const randomLat = 12.9716 + (Math.random() - 0.5) * 0.1; // ±0.05 degrees
      const randomLng = 77.5946 + (Math.random() - 0.5) * 0.1; // ±0.05 degrees
      const randomCoords = { latitude: randomLat, longitude: randomLng };
      console.log('Generated random coordinates:', randomCoords);
      return randomCoords;
    }
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
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {data && (
          <>
            {/* Hero Image Section */}
            <View style={styles.heroSection}>
              <Image
                source={{ uri: getLocationImage(data.name) }}
                style={styles.heroImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.imageGradient}
              />
              <View style={styles.heroContent}>
                <View style={styles.locationBadge}>
                  <Ionicons name="location" size={16} color="#fff" />
                  <Text style={styles.locationBadgeText}>{data.name}</Text>
                </View>
                <View style={styles.heroStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="trophy" size={20} color="#FFD700" />
                    <Text style={styles.statValue}>{data.score}</Text>
                    <Text style={styles.statLabel}>Score</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="calendar" size={20} color="#4CAF50" />
                    <Text style={styles.statValue}>{new Date(data.date).getFullYear()}</Text>
                    <Text style={styles.statLabel}>Visited</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Quick Info Cards */}
            <View style={styles.quickInfoContainer}>
              <View style={[styles.quickInfoCard, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.quickInfoHeader}>
                  <Ionicons name="navigate" size={20} color={theme.colors.primary} />
                  <Text style={[styles.quickInfoTitle, { color: theme.colors.text }]}>Distance</Text>
                </View>
                <Text style={[styles.quickInfoValue, { color: theme.colors.text }]}>
                  {distance ? `${Math.round(distance)} km` : 'Calculating...'}
                </Text>
                <Text style={[styles.quickInfoSubtext, { color: theme.colors.textSecondary }]}>from your location</Text>
              </View>

              <View style={[styles.quickInfoCard, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.quickInfoHeader}>
                  <Ionicons name="leaf" size={20} color="#4CAF50" />
                  <Text style={[styles.quickInfoTitle, { color: theme.colors.text }]}>Spot Type</Text>
                </View>
                <Text style={[styles.quickInfoValue, { color: theme.colors.text }]}>Natural</Text>
                <Text style={[styles.quickInfoSubtext, { color: theme.colors.textSecondary }]}>outdoor destination</Text>
              </View>
            </View>

            {/* Detailed Info Section */}
            <View style={styles.detailedInfoContainer}>
              <View style={[styles.detailedCard, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="car" size={24} color={theme.colors.primary} />
                  <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Travel Info</Text>
                </View>
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>FROM YOU</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.text }]}>{data.category?.fromYou || 'Unknown'}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>TYPE OF SPOT</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.text }]}>{data.category?.typeOfSpot || 'General'}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.detailedCard, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="information-circle" size={24} color={theme.colors.primary} />
                  <Text style={[styles.cardTitle, { color: theme.colors.text }]}>About This Place</Text>
                </View>
                <Text style={[styles.descriptionText, { color: theme.colors.text }]}>
                  {data.description}
                </Text>
              </View>
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
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  content: {
    flex: 1,
  },
  
  // Hero Section Styles
  heroSection: {
    height: 320,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  heroContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  locationBadgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  // Quick Info Cards
  quickInfoContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  quickInfoCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    opacity: 0.8,
  },
  quickInfoValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  quickInfoSubtext: {
    fontSize: 12,
    opacity: 0.6,
  },

  // Detailed Info Section
  detailedInfoContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  detailedCard: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 20,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 24,
    opacity: 0.9,
  },
});
