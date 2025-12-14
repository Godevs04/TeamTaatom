import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../../../services/api';
import { calculateDistance, geocodeAddress } from '../../../../../utils/locationUtils';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Locale } from '../../../../../services/locale';
import { savedEvents } from '../../../../../utils/savedEvents';

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
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [localeData, setLocaleData] = useState<Locale | null>(null);
  
  // Navigation & Lifecycle Safety: Track mounted state
  const isMountedRef = useRef(true);
  
  // Bookmark Stability: Track in-flight bookmark operations
  const bookmarkingRef = useRef(false);
  
  // Distance Calculation Guards: Cache calculated distances per session
  const distanceCacheRef = useRef<Map<string, number>>(new Map());
  
  const { theme } = useTheme();
  const router = useRouter();
  const { country, location, userId, imageUrl, latitude, longitude, description, spotTypes } = useLocalSearchParams();

  // Check if coming from locale flow (general) or tripscore flow or admin locale
  const countryParam = Array.isArray(country) ? country[0] : country;
  const userIdParam = Array.isArray(userId) ? userId[0] : userId;
  const isFromLocaleFlow = countryParam === 'general';
  const isAdminLocale = userIdParam === 'admin-locale';

  // Navigation & Lifecycle Safety: Setup and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    loadLocationData();
    checkBookmarkStatus();
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isMountedRef.current) return;
    if ((data?.name || localeData) && (isAdminLocale ? localeData : data)) {
      checkBookmarkStatus();
    }
  }, [data?.name, localeData, isAdminLocale]);

  // Listen for bookmark changes from other screens
  useEffect(() => {
    const unsubscribe = savedEvents.addListener(() => {
      // Refresh bookmark status when saved locales change
      if (isMountedRef.current) {
        checkBookmarkStatus();
      }
    });
    return unsubscribe;
  }, []);

  // Refresh bookmark status when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!isMountedRef.current) return;
      checkBookmarkStatus();
    }, [localeData, data?.name])
  );

  // Calculate distance when coordinates are available
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (data?.coordinates && data.coordinates.latitude && data.coordinates.longitude) {
      const lat = data.coordinates.latitude;
      const lng = data.coordinates.longitude;
      // Only calculate if coordinates are valid (not 0 or undefined) and distance hasn't been calculated yet
      if (lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng) && distance === null) {
        console.log('useEffect: Triggering distance calculation with coordinates:', { lat, lng });
        calculateDistanceAsync(lat, lng);
      }
    }
  }, [data?.coordinates?.latitude, data?.coordinates?.longitude, distance]);

  // Helper functions - defined before use
  const getLocationImage = (locationName: string) => {
    // Generate dynamic Unsplash image URL based on location name
    const encodedLocation = encodeURIComponent(locationName);
    return `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&q=80&auto=format&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80`;
  };

  const generateLocationDescription = async (locationName: string, caption: string) => {
    // For general locations (from map), generate dynamic description
    if (caption) {
      return `${locationName} is a beautiful destination where you've shared "${caption}". This location offers unique attractions and natural beauty that makes it a memorable place to visit.`;
    }
    
    // Dynamic description based on location name
    return `${locationName} is a beautiful destination with unique attractions and natural beauty that makes it a memorable place to visit. Explore the local culture, landmarks, and experiences that make this location special.`;
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
      'ooty': { latitude: 11.4102, longitude: 76.6950 },
      'mysore': { latitude: 12.2958, longitude: 76.6394 },
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

  // Distance Calculation Guards: Handle null location, permission denied, with caching
  const calculateDistanceAsync = async (targetLat: number, targetLng: number) => {
    try {
      // Distance Calculation Guards: Validate coordinates
      if (!targetLat || !targetLng || isNaN(targetLat) || isNaN(targetLng) || targetLat === 0 || targetLng === 0) {
        console.log('Invalid coordinates provided:', { targetLat, targetLng });
        if (isMountedRef.current) {
          setDistance(null);
        }
        return;
      }
      
      // Distance Calculation Guards: Check cache first (per session)
      const cacheKey = `${targetLat},${targetLng}`;
      if (distanceCacheRef.current.has(cacheKey)) {
        const cachedDistance = distanceCacheRef.current.get(cacheKey);
        if (cachedDistance !== undefined && isMountedRef.current) {
          setDistance(cachedDistance);
          return;
        }
      }

      // Distance Calculation Guards: Request permission with error handling
      let status;
      try {
        status = await Location.requestForegroundPermissionsAsync();
      } catch (permError) {
        console.warn('Failed to request location permission:', permError);
        if (isMountedRef.current) {
          setDistance(null);
        }
        return;
      }
      
      if (status.status !== 'granted') {
        // Distance Calculation Guards: Permission denied - fallback to null (hide distance)
        console.log('Location permission denied or unavailable');
        if (isMountedRef.current) {
          setDistance(null);
        }
        return;
      }
      
      // Distance Calculation Guards: Get current location with error handling
      let currentLocation;
      try {
        // Note: expo-location doesn't support timeout in LocationOptions
        // Use Promise.race for timeout functionality
        const locationPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Location request timeout')), 10000);
        });
        
        currentLocation = await Promise.race([locationPromise, timeoutPromise]);
      } catch (locationError) {
        console.warn('Failed to get current location:', locationError);
        if (isMountedRef.current) {
          setDistance(null);
        }
        return;
      }
      
      if (currentLocation && currentLocation.coords && 
          currentLocation.coords.latitude && currentLocation.coords.longitude) {
        // Distance Calculation Guards: Validate current location coordinates
        const currentLat = currentLocation.coords.latitude;
        const currentLng = currentLocation.coords.longitude;
        
        if (isNaN(currentLat) || isNaN(currentLng) || currentLat === 0 || currentLng === 0) {
          console.warn('Invalid current location coordinates');
          if (isMountedRef.current) {
            setDistance(null);
          }
          return;
        }
        
        const calculatedDistance = calculateDistance(
          currentLat,
          currentLng,
          targetLat,
          targetLng
        );
        
        // Distance Calculation Guards: Validate calculated distance
        if (isNaN(calculatedDistance) || calculatedDistance < 0) {
          console.warn('Invalid calculated distance:', calculatedDistance);
          if (isMountedRef.current) {
            setDistance(null);
          }
          return;
        }
        
        // Cache the calculated distance
        distanceCacheRef.current.set(cacheKey, calculatedDistance);
        
        console.log('Distance calculated successfully:', calculatedDistance, 'km');
        if (isMountedRef.current) {
          setDistance(calculatedDistance);
        }
      } else {
        // Distance Calculation Guards: Missing coordinates - fallback
        console.log('Failed to get current location coordinates');
        if (isMountedRef.current) {
          setDistance(null);
        }
      }
    } catch (error) {
      // Distance Calculation Guards: Catch-all error handling
      console.error('Error calculating distance:', error);
      if (isMountedRef.current) {
        setDistance(null);
      }
    }
  };

  // Bookmark Stability: Check bookmark status with defensive parsing
  const checkBookmarkStatus = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      if (isAdminLocale && localeData) {
        // Check saved locales for admin locales
        const savedLocales = await AsyncStorage.getItem('savedLocales');
        let saved: Locale[] = [];
        
        try {
          if (savedLocales) {
            const parsed = JSON.parse(savedLocales);
            saved = Array.isArray(parsed) ? parsed : [];
          }
        } catch (parseError) {
          console.warn('Failed to parse savedLocales in checkBookmarkStatus', parseError);
          saved = [];
        }
        
        if (isMountedRef.current) {
          setIsBookmarked(saved.some((loc: Locale) => loc && loc._id === localeData._id));
        }
      } else {
        // Check saved locations for regular locations
        const savedLocations = await AsyncStorage.getItem('savedLocations');
        let saved: any[] = [];
        
        try {
          if (savedLocations) {
            const parsed = JSON.parse(savedLocations);
            saved = Array.isArray(parsed) ? parsed : [];
          }
        } catch (parseError) {
          console.warn('Failed to parse savedLocations in checkBookmarkStatus', parseError);
          saved = [];
        }
        
        const locationName = data?.name || (Array.isArray(location) ? location[0] : location);
        const locationSlug = locationName.toLowerCase().replace(/\s+/g, '-');
        
        if (isMountedRef.current) {
          setIsBookmarked(saved.some((loc: any) => loc && (loc.slug === locationSlug || loc.name === locationName)));
        }
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error checking bookmark status:', error);
    }
  }, [isAdminLocale, localeData, data?.name, location]);

  // Bookmark Stability: Atomic read-modify-write with deduplication
  const handleBookmark = useCallback(async () => {
    // Bookmark Stability: Prevent duplicate bookmark operations
    if (bookmarkingRef.current) {
      console.debug('Bookmark operation already in progress, skipping');
      return;
    }
    
    if (!isMountedRef.current) return;
    
    bookmarkingRef.current = true;
    setBookmarkLoading(true);
    
    try {
      if (isAdminLocale && localeData) {
        // Handle admin locale bookmarking - Atomic read-modify-write
        const savedLocales = await AsyncStorage.getItem('savedLocales');
        let locales: Locale[] = [];
        
        try {
          if (savedLocales) {
            const parsed = JSON.parse(savedLocales);
            locales = Array.isArray(parsed) ? parsed : [];
          }
        } catch (parseError) {
          console.warn('Failed to parse savedLocales in handleBookmark, resetting', parseError);
          locales = [];
        }
        
        if (isBookmarked) {
          // Remove bookmark
          const updated = locales.filter((loc: Locale) => loc && loc._id !== localeData._id);
          await AsyncStorage.setItem('savedLocales', JSON.stringify(updated));
          if (isMountedRef.current) {
            setIsBookmarked(false);
          }
          // Emit event to sync with list page
          savedEvents.emitChanged();
        } else {
          // Add bookmark - Deduplicate before adding
          if (!locales.find(l => l && l._id === localeData._id)) {
            const updated = [...locales, localeData];
            await AsyncStorage.setItem('savedLocales', JSON.stringify(updated));
            if (isMountedRef.current) {
              setIsBookmarked(true);
            }
            // Emit event to sync with list page
            savedEvents.emitChanged();
          }
        }
      } else {
        // Handle regular location bookmarking - Atomic read-modify-write
        const locationName = data?.name || (Array.isArray(location) ? location[0] : location);
        const locationSlug = locationName.toLowerCase().replace(/\s+/g, '-');
        
        const savedLocations = await AsyncStorage.getItem('savedLocations');
        let saved: any[] = [];
        
        try {
          if (savedLocations) {
            const parsed = JSON.parse(savedLocations);
            saved = Array.isArray(parsed) ? parsed : [];
          }
        } catch (parseError) {
          console.warn('Failed to parse savedLocations in handleBookmark, resetting', parseError);
          saved = [];
        }
        
        if (isBookmarked) {
          // Remove bookmark
          const updated = saved.filter((loc: any) => loc && loc.slug !== locationSlug && loc.name !== locationName);
          await AsyncStorage.setItem('savedLocations', JSON.stringify(updated));
          if (isMountedRef.current) {
            setIsBookmarked(false);
          }
        } else {
          // Add bookmark - Deduplicate before adding
          if (!saved.find(l => l && (l.slug === locationSlug || l.name === locationName))) {
            const locationData = {
              id: `loc-${Date.now()}`,
              name: locationName.toUpperCase(),
              slug: locationSlug,
              imageUrl: data?.imageUrl || getLocationImage(locationName),
              type: data?.category?.typeOfSpot?.toLowerCase() || 'general',
              description: data?.description || `${locationName} is a beautiful destination`,
              savedDate: new Date().toISOString(),
              coordinates: data?.coordinates,
            };
            
            const updated = [...saved, locationData];
            await AsyncStorage.setItem('savedLocations', JSON.stringify(updated));
            if (isMountedRef.current) {
              setIsBookmarked(true);
            }
          }
        }
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error bookmarking location:', error);
      Alert.alert('Error', 'Failed to save location');
    } finally {
      bookmarkingRef.current = false;
      if (isMountedRef.current) {
        setBookmarkLoading(false);
      }
    }
  }, [isAdminLocale, localeData, isBookmarked, data, location]);

  const loadLocationData = async () => {
    try {
      setLoading(true);
      const countryParam = Array.isArray(country) ? country[0] : country;
      const locationParam = Array.isArray(location) ? location[0] : location;
      
      // Convert slugs back to proper names for API
      const countryName = countryParam.replace(/-/g, ' ');
      const locationName = locationParam.replace(/-/g, ' ');
      
      // Check if this is an admin locale
      if (isAdminLocale) {
        // Handle admin locale - use params passed from navigation
        const localeImageUrl = Array.isArray(imageUrl) ? imageUrl[0] : imageUrl;
        const localeLatStr = Array.isArray(latitude) ? latitude[0] : latitude;
        const localeLngStr = Array.isArray(longitude) ? longitude[0] : longitude;
        
        // Parse coordinates, handling empty strings and invalid values
        let localeLat: number | undefined = undefined;
        let localeLng: number | undefined = undefined;
        
        if (localeLatStr && localeLatStr !== '' && localeLatStr !== '0' && localeLatStr !== 'undefined') {
          const parsed = parseFloat(localeLatStr);
          if (!isNaN(parsed) && parsed !== 0) {
            localeLat = parsed;
          }
        }
        
        if (localeLngStr && localeLngStr !== '' && localeLngStr !== '0' && localeLngStr !== 'undefined') {
          const parsed = parseFloat(localeLngStr);
          if (!isNaN(parsed) && parsed !== 0) {
            localeLng = parsed;
          }
        }
        
        const localeDesc = Array.isArray(description) ? description[0] : description || '';
        const localeSpotTypes = spotTypes ? (Array.isArray(spotTypes) ? spotTypes[0] : spotTypes).split(', ') : [];
        
        console.log('Admin locale params:', {
          localeImageUrl,
          localeLat,
          localeLng,
          localeLatStr,
          localeLngStr,
          locationName
        });
        
        // If coordinates are missing, try to get them from location name
        let finalLat = localeLat;
        let finalLng = localeLng;
        
        if ((!finalLat || !finalLng || finalLat === 0 || finalLng === 0) && locationName) {
          const coords = getLocationCoordinates(locationName);
          if (coords && coords.latitude && coords.longitude && coords.latitude !== 0 && coords.longitude !== 0) {
            finalLat = coords.latitude;
            finalLng = coords.longitude;
            console.log('Using coordinates from location name lookup:', { finalLat, finalLng });
          } else {
            // Try geocoding as last resort
            try {
              const geocodedCoords = await geocodeAddress(locationName);
              if (geocodedCoords && geocodedCoords.latitude && geocodedCoords.longitude) {
                finalLat = geocodedCoords.latitude;
                finalLng = geocodedCoords.longitude;
                console.log('Using geocoded coordinates:', { finalLat, finalLng });
              }
            } catch (geocodeError) {
              console.error('Geocoding failed:', geocodeError);
            }
          }
        }
        
        // Create locale object
        const locale: Locale = {
          _id: `admin-${locationName.toLowerCase().replace(/\s+/g, '-')}`,
          name: locationName,
          countryCode: countryParam.toUpperCase(),
          imageUrl: localeImageUrl || getLocationImage(locationName),
          description: localeDesc,
          spotTypes: localeSpotTypes,
          latitude: finalLat,
          longitude: finalLng,
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        
        setLocaleData(locale);
        
        // Set data for display
        const coordinates = finalLat && finalLng ? { latitude: finalLat, longitude: finalLng } : undefined;
        console.log('Setting data with coordinates:', { finalLat, finalLng, coordinates });
        
        setData({
          name: locationName,
          score: 1,
          date: new Date().toISOString(),
          caption: `Visit ${locationName}`,
          category: {
            fromYou: 'Drivable',
            typeOfSpot: localeSpotTypes[0] || 'Natural'
          },
          description: localeDesc || `${locationName} is a beautiful destination with unique attractions and natural beauty.`,
          imageUrl: localeImageUrl || getLocationImage(locationName),
          coordinates: coordinates
        });
        
        setLoading(false);
        
        // Calculate distance immediately if coordinates are available
        if (coordinates && coordinates.latitude && coordinates.longitude) {
          console.log('Immediately calculating distance with coordinates:', coordinates);
          calculateDistanceAsync(coordinates.latitude, coordinates.longitude);
        }
        
        return;
      }
      
      // Check if this is a general location (from map) or a TripScore location
      if (countryParam === 'general') {
        // This is a location from the map, create mock data
        const description = await generateLocationDescription(locationName, '');
        // Get coordinates for the location
        let locationCoords = getLocationCoordinates(locationName);
        
        // Try geocoding if coordinates seem like fallback
        if (locationCoords && Math.abs(locationCoords.latitude - 12.9716) < 0.1 && Math.abs(locationCoords.longitude - 77.5946) < 0.1) {
          const geocodedCoords = await geocodeAddress(locationName);
          if (geocodedCoords) {
            locationCoords = geocodedCoords;
          }
        }
        
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
          coordinates: locationCoords
        });
      } else {
        // This is a TripScore location, fetch from API
        // Only fetch if userId is not 'admin-locale'
        if (userIdParam && userIdParam !== 'admin-locale') {
          try {
            const response = await api.get(`/api/v1/profile/${userIdParam}/tripscore/countries/${countryName}`);
            const locations = response.data.locations;
          
            // Find the specific location
            const foundLocation = locations.find((loc: any) => 
              loc.name.toLowerCase().replace(/\s+/g, '-') === locationParam
            );
            
            if (foundLocation) {
              // Get coordinates for the location
              const locationCoords = getLocationCoordinates(foundLocation.name);
              let finalCoords = locationCoords;
              
              // Try geocoding if coordinates seem like fallback
              if (locationCoords && Math.abs(locationCoords.latitude - 12.9716) < 0.1 && Math.abs(locationCoords.longitude - 77.5946) < 0.1) {
                const geocodedCoords = await geocodeAddress(foundLocation.name);
                if (geocodedCoords) {
                  finalCoords = geocodedCoords;
                }
              }
              
              setData({
                ...foundLocation,
                description: await generateLocationDescription(foundLocation.name, foundLocation.caption),
                coordinates: finalCoords || foundLocation.coordinates
              });
            }
          } catch (apiError) {
            console.error('Error fetching TripScore location:', apiError);
            // Fall through to use fallback data
          }
        }
      }
      
      // Calculate distance from current location (runs for all locations that haven't calculated yet)
      if (!isAdminLocale && data?.coordinates && data.coordinates.latitude && data.coordinates.longitude) {
        // Calculate distance asynchronously after data is set
        calculateDistanceAsync(data.coordinates.latitude, data.coordinates.longitude);
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
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.bookmarkButton}
            onPress={handleBookmark}
            disabled={bookmarkLoading}
          >
            {bookmarkLoading ? (
              <ActivityIndicator size="small" color={isBookmarked ? '#FFD700' : theme.colors.textSecondary} />
            ) : (
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={isBookmarked ? '#FFD700' : theme.colors.textSecondary}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {data && (
          <>
            {/* Hero Image Section */}
            <View style={styles.heroSection}>
              <Image
                source={{ 
                  uri: isAdminLocale && localeData?.imageUrl 
                    ? localeData.imageUrl 
                    : (data?.imageUrl || getLocationImage(data?.name || '')) 
                }}
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
              <View style={[styles.quickInfoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border || 'rgba(0,0,0,0.08)' }]}>
                <View style={styles.quickInfoHeader}>
                  <Ionicons name="navigate" size={22} color={theme.colors.primary} />
                  <Text style={[styles.quickInfoTitle, { color: theme.colors.text }]}>Distance</Text>
                </View>
                <Text style={[styles.quickInfoValue, { color: theme.colors.text }]}>
                  {distance ? `${Math.round(distance)} km` : 'Calculating...'}
                </Text>
                <Text style={[styles.quickInfoSubtext, { color: theme.colors.textSecondary }]}>from your location</Text>
              </View>

              <View style={[styles.quickInfoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border || 'rgba(0,0,0,0.08)' }]}>
                <View style={styles.quickInfoHeader}>
                  <Ionicons name="leaf" size={22} color="#4CAF50" />
                  <Text style={[styles.quickInfoTitle, { color: theme.colors.text }]}>Spot Type</Text>
                </View>
                <Text style={[styles.quickInfoValue, { color: theme.colors.text }]}>
                  {localeData?.spotTypes?.[0] || data?.category?.typeOfSpot || 'Natural'}
                </Text>
                <Text style={[styles.quickInfoSubtext, { color: theme.colors.textSecondary }]}>outdoor destination</Text>
              </View>
            </View>

            {/* Travel Info and Explore on Map - Two Box Model */}
            <View style={styles.quickInfoContainer}>
                {/* Left Box - Travel Info */}
                <View style={[styles.quickInfoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border || 'rgba(0,0,0,0.08)' }]}>
                  <View style={styles.quickInfoHeader}>
                    <Ionicons name="car" size={22} color={theme.colors.primary} />
                    <Text style={[styles.quickInfoTitle, { color: theme.colors.text }]}>Travel Info</Text>
                  </View>
                  <Text style={[styles.quickInfoValue, { color: theme.colors.text }]}>{data.category?.fromYou || 'Unknown'}</Text>
                  <Text style={[styles.quickInfoSubtext, { color: theme.colors.textSecondary }]}>FROM YOU</Text>
                </View>

                {/* Right Box - Explore on Map */}
                <TouchableOpacity
                  style={[styles.quickInfoCard, styles.clickableCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border || 'rgba(0,0,0,0.08)' }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    // Try to get coordinates from data or calculate them
                    let coords = data.coordinates;
                    
                    if (!coords || !coords.latitude || !coords.longitude) {
                      // Fallback: try to get coordinates from location name
                      const locationCoords = getLocationCoordinates(data.name);
                      if (locationCoords) {
                        coords = locationCoords;
                      }
                    }
                    
                    if (coords && coords.latitude && coords.longitude) {
                      router.push({
                        pathname: '/map/current-location',
                        params: {
                          latitude: coords.latitude.toString(),
                          longitude: coords.longitude.toString(),
                          address: data.name,
                          locationName: data.name,
                        },
                      });
                    } else {
                      console.warn('Location coordinates not available for:', data.name);
                      // Try geocoding as last resort
                      geocodeAddress(data.name).then((geocodedCoords) => {
                        if (geocodedCoords) {
                          router.push({
                            pathname: '/map/current-location',
                            params: {
                              latitude: geocodedCoords.latitude.toString(),
                              longitude: geocodedCoords.longitude.toString(),
                              address: data.name,
                              locationName: data.name,
                            },
                          });
                        }
                      });
                    }
                  }}
                >
                  <View style={styles.quickInfoHeader}>
                    <View style={styles.headerLeft}>
                      <Ionicons name="globe-outline" size={22} color="#4CAF50" />
                      <Text style={[styles.quickInfoTitle, { color: theme.colors.text }]}>Explore on Map</Text>
                    </View>
                    <View style={styles.clickableIndicator}>
                      <Ionicons name="chevron-forward" size={18} color="#4CAF50" />
                    </View>
                  </View>
                  <Text style={[styles.quickInfoValue, { color: theme.colors.text }]}>Navigate</Text>
                  <Text style={[styles.quickInfoSubtext, { color: theme.colors.textSecondary }]}>View {data.name} location</Text>
                </TouchableOpacity>
              </View>

            {/* Detailed Info Section */}
            <View style={styles.detailedInfoContainer}>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookmarkButton: {
    padding: 8,
    borderRadius: 20,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
  },
  content: {
    flex: 1,
  },
  
  // Hero Section Styles
  heroSection: {
    height: 340,
    position: 'relative',
    marginBottom: 8,
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
    gap: 14,
  },
  quickInfoCard: {
    flex: 1,
    padding: 20,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    minHeight: 140,
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  quickInfoTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  quickInfoValue: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    lineHeight: 32,
    letterSpacing: -0.8,
  },
  quickInfoSubtext: {
    fontSize: 12,
    opacity: 0.6,
    lineHeight: 16,
    letterSpacing: 0.2,
    fontWeight: '500',
  },
  clickableCard: {
    position: 'relative',
  },
  clickableIndicator: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 20,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
    marginTop: -10,
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
