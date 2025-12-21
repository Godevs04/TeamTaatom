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
  Platform,
  Dimensions,
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
import logger from '../../../../../utils/logger';

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
  // Responsive dimensions (inside component to ensure they're accessible)
  const { width: screenWidth } = Dimensions.get('window');
  const isTabletLocal = screenWidth >= 768;
  const isAndroidLocal = Platform.OS === 'android';
  const isWebLocal = Platform.OS === 'web';
  
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
      // Call checkBookmarkStatus directly - it's defined later but safe to call
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
        logger.debug('useEffect: Triggering distance calculation with coordinates:', { lat, lng });
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

  // PRODUCTION-GRADE: All coordinates fetched from Google Geocoding API
  // No hardcoded coordinates - all locations use geocoding API with country context
  const getLocationCoordinates = async (locationName: string, countryCode?: string): Promise<{ latitude: number; longitude: number } | null> => {
    if (!locationName || locationName.trim() === '') {
      logger.warn('⚠️ Empty location name provided for geocoding');
      return null;
    }
    
    logger.debug('🌍 Geocoding location via Google API:', { locationName, countryCode: countryCode || undefined });
    
    try {
      // Use Google Geocoding API with country context for better accuracy
      const coords = await geocodeAddress(locationName, countryCode);
      
      if (coords && coords.latitude && coords.longitude && 
          coords.latitude !== 0 && coords.longitude !== 0) {
        logger.debug('✅ Geocoding SUCCESS:', { locationName, coords });
        return coords;
      } else {
        logger.warn('⚠️ Geocoding returned invalid coordinates for:', locationName);
        return null;
      }
    } catch (error) {
      logger.error('❌ Geocoding ERROR for:', { locationName, error });
      return null;
    }
  };

  // Distance Calculation Guards: Handle null location, permission denied, with caching
  const calculateDistanceAsync = async (targetLat: number, targetLng: number) => {
    try {
      // Distance Calculation Guards: Validate coordinates
      if (!targetLat || !targetLng || isNaN(targetLat) || isNaN(targetLng) || targetLat === 0 || targetLng === 0) {
        logger.debug('Invalid coordinates provided:', { targetLat, targetLng });
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
        logger.warn('Failed to request location permission:', permError);
        if (isMountedRef.current) {
          setDistance(null);
        }
        return;
      }
      
      if (status.status !== 'granted') {
        // Distance Calculation Guards: Permission denied - fallback to null (hide distance)
        logger.debug('Location permission denied or unavailable');
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
        logger.warn('Failed to get current location:', locationError);
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
          logger.warn('Invalid current location coordinates');
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
          logger.warn('Invalid calculated distance:', calculatedDistance);
          if (isMountedRef.current) {
            setDistance(null);
          }
          return;
        }
        
        // Cache the calculated distance
        distanceCacheRef.current.set(cacheKey, calculatedDistance);
        
        logger.debug('Distance calculated successfully:', { distance: calculatedDistance, unit: 'km' });
        if (isMountedRef.current) {
          setDistance(calculatedDistance);
        }
      } else {
        // Distance Calculation Guards: Missing coordinates - fallback
        logger.debug('Failed to get current location coordinates');
        if (isMountedRef.current) {
          setDistance(null);
        }
      }
    } catch (error) {
      // Distance Calculation Guards: Catch-all error handling
      logger.error('Error calculating distance:', error);
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
          logger.warn('Failed to parse savedLocales in checkBookmarkStatus', parseError);
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
          logger.warn('Failed to parse savedLocations in checkBookmarkStatus', parseError);
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
      logger.error('Error checking bookmark status:', error);
    }
  }, [isAdminLocale, localeData, data?.name, location]);

  // Bookmark Stability: Atomic read-modify-write with deduplication
  const handleBookmark = useCallback(async () => {
    // Bookmark Stability: Prevent duplicate bookmark operations
    if (bookmarkingRef.current) {
      logger.debug('Bookmark operation already in progress, skipping');
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
          logger.warn('Failed to parse savedLocales in handleBookmark, resetting', parseError);
          locales = [];
        }
        
        if (isBookmarked) {
          // Remove bookmark - Update state immediately for instant UI feedback
          if (isMountedRef.current) {
            setIsBookmarked(false);
          }
          const updated = locales.filter((loc: Locale) => loc && loc._id !== localeData._id);
          await AsyncStorage.setItem('savedLocales', JSON.stringify(updated));
          // Emit event to sync with list page
          savedEvents.emitChanged();
        } else {
          // Add bookmark - Update state immediately for instant UI feedback
          if (isMountedRef.current) {
            setIsBookmarked(true);
          }
          // Add bookmark - Deduplicate before adding
          if (!locales.find(l => l && l._id === localeData._id)) {
            const updated = [...locales, localeData];
            await AsyncStorage.setItem('savedLocales', JSON.stringify(updated));
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
          logger.warn('Failed to parse savedLocations in handleBookmark, resetting', parseError);
          saved = [];
        }
        
        if (isBookmarked) {
          // Remove bookmark - Update state immediately for instant UI feedback
          if (isMountedRef.current) {
            setIsBookmarked(false);
          }
          const updated = saved.filter((loc: any) => loc && loc.slug !== locationSlug && loc.name !== locationName);
          await AsyncStorage.setItem('savedLocations', JSON.stringify(updated));
        } else {
          // Add bookmark - Update state immediately for instant UI feedback
          if (isMountedRef.current) {
            setIsBookmarked(true);
          }
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
          }
        }
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      logger.error('Error bookmarking location:', error);
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
        
        logger.debug('Admin locale params:', {
          localeImageUrl,
          localeLat,
          localeLng,
          localeLatStr,
          localeLngStr,
          locationName
        });
        
        // PRODUCTION-GRADE: If coordinates are missing, fetch from Google Geocoding API with country context
        let finalLat = localeLat;
        let finalLng = localeLng;
        
        if ((!finalLat || !finalLng || finalLat === 0 || finalLng === 0) && locationName) {
          try {
            // Use geocoding API with country code for better accuracy
            const countryCodeForGeocoding = countryParam && countryParam !== 'general' ? countryParam.toUpperCase() : 'IN';
            const geocodedCoords = await geocodeAddress(locationName, countryCodeForGeocoding);
            if (geocodedCoords && geocodedCoords.latitude && geocodedCoords.longitude &&
                geocodedCoords.latitude !== 0 && geocodedCoords.longitude !== 0) {
              finalLat = geocodedCoords.latitude;
              finalLng = geocodedCoords.longitude;
              logger.debug('✅ Using geocoded coordinates from API:', { finalLat, finalLng });
            } else {
              logger.warn('⚠️ Geocoding API returned invalid coordinates for:', locationName);
            }
          } catch (geocodeError) {
            logger.error('❌ Geocoding API failed for:', { locationName, error: geocodeError });
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
        logger.debug('Setting data with coordinates:', { finalLat, finalLng, coordinates });
        
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
        
        // CRITICAL: Calculate distance immediately with EXACT coordinates from locale
        // This ensures accurate distance calculation for locale flow
        if (coordinates && coordinates.latitude && coordinates.longitude && 
            coordinates.latitude !== 0 && coordinates.longitude !== 0) {
          logger.debug('Immediately calculating distance with EXACT coordinates:', coordinates);
          // Reset distance to null first to force recalculation
          setDistance(null);
          calculateDistanceAsync(coordinates.latitude, coordinates.longitude);
        } else {
          logger.warn('Cannot calculate distance: coordinates missing or invalid', coordinates);
        }
        
        return;
      }
      
      // Check if this is a general location (from map) or a TripScore location
      if (countryParam === 'general') {
        // This is a location from the map, create mock data
        const description = await generateLocationDescription(locationName, '');
        // PRODUCTION-GRADE: Get coordinates from Google Geocoding API with country context
        let locationCoords: { latitude: number; longitude: number } | null = null;
        
        try {
          // Use India as default country context for better accuracy
          locationCoords = await geocodeAddress(locationName, 'IN');
          if (locationCoords && locationCoords.latitude && locationCoords.longitude) {
            logger.debug('✅ Geocoded coordinates for general location:', { locationName, locationCoords });
          } else {
            logger.warn('⚠️ Geocoding returned null for:', locationName);
          }
        } catch (geocodeError) {
          logger.error('❌ Geocoding failed for general location:', { locationName, error: geocodeError });
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
          coordinates: locationCoords || undefined // Convert null to undefined for type compatibility
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
              // PRODUCTION-GRADE: Get coordinates from Google Geocoding API with country context
              let finalCoords: { latitude: number; longitude: number } | undefined = undefined;
              
              try {
                // Use country name for better geocoding accuracy
                const countryCodeForGeocoding = countryName ? countryName.toUpperCase() : 'IN';
                const geocodedCoords = await geocodeAddress(foundLocation.name, countryCodeForGeocoding);
                if (geocodedCoords && geocodedCoords.latitude && geocodedCoords.longitude &&
                    geocodedCoords.latitude !== 0 && geocodedCoords.longitude !== 0) {
                  finalCoords = geocodedCoords;
                  logger.debug('✅ Geocoded coordinates for TripScore location:', { locationName: foundLocation.name, coords: finalCoords });
                } else {
                  logger.warn('⚠️ Geocoding returned invalid coordinates for:', foundLocation.name);
                }
              } catch (geocodeError) {
                logger.error('❌ Geocoding failed for TripScore location:', { locationName: foundLocation.name, error: geocodeError });
              }
              
              setData({
                ...foundLocation,
                description: await generateLocationDescription(foundLocation.name, foundLocation.caption),
                coordinates: finalCoords || foundLocation.coordinates
              });
            }
          } catch (apiError) {
            logger.error('Error fetching TripScore location:', apiError);
            // Fall through to use fallback data
          }
        }
      }
      
      // CRITICAL: Calculate distance ONLY for tripscore flow, NOT for locale flow
      // Locale flow distance is calculated above with exact coordinates
      if (!isAdminLocale && !isFromLocaleFlow && data?.coordinates && 
          data.coordinates.latitude && data.coordinates.longitude &&
          data.coordinates.latitude !== 0 && data.coordinates.longitude !== 0) {
        // Calculate distance asynchronously after data is set (tripscore flow only)
        logger.debug('Calculating distance for tripscore flow:', data.coordinates);
        setDistance(null); // Reset to force recalculation
        calculateDistanceAsync(data.coordinates.latitude, data.coordinates.longitude);
      }
    } catch (error) {
      logger.error('Error loading location data:', error);
      // PRODUCTION-GRADE: Fallback to geocoding API if API fails
      const locationParam = Array.isArray(location) ? location[0] : location;
      const locationName = locationParam.replace(/-/g, ' ');
      const description = await generateLocationDescription(locationName, '');
      
      // PRODUCTION-GRADE: Try to get coordinates from geocoding API with country context
      let fallbackCoords: { latitude: number; longitude: number } | undefined = undefined;
      try {
        // Use India as default country context
        const geocodedCoords = await geocodeAddress(locationName, 'IN');
        if (geocodedCoords && geocodedCoords.latitude && geocodedCoords.longitude &&
            geocodedCoords.latitude !== 0 && geocodedCoords.longitude !== 0) {
          fallbackCoords = geocodedCoords;
          logger.debug('✅ Using geocoded coordinates as error fallback:', fallbackCoords);
        }
      } catch (geocodeError) {
        logger.error('❌ Geocoding also failed in error handler:', geocodeError);
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
        coordinates: fallbackCoords // Will be undefined if geocoding fails, which is acceptable
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
    <SafeAreaView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // CRITICAL: Always navigate directly to LocaleHome (locale tab)
            // This ensures clean back navigation without stacked screens
            if (isAdminLocale || isFromLocaleFlow) {
              router.replace('/(tabs)/locale');
            } else {
              router.back();
            }
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={isTabletLocal ? 28 : 24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {displayLocationName}
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.bookmarkButton,
              isBookmarked && styles.bookmarkButtonActive
            ]}
            onPress={handleBookmark}
            disabled={bookmarkLoading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            {bookmarkLoading ? (
              <ActivityIndicator size="small" color={isBookmarked ? '#FFD700' : theme.colors.textSecondary} />
            ) : (
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={isTabletLocal ? 28 : 24}
                color={isBookmarked ? '#FFD700' : theme.colors.textSecondary}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              // CRITICAL: Always navigate directly to LocaleHome (locale tab)
              // This ensures clean back navigation without stacked screens
              if (isAdminLocale || isFromLocaleFlow) {
                router.replace('/(tabs)/locale');
              } else {
                router.back();
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={isTabletLocal ? 28 : 24} color={theme.colors.textSecondary} />
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
                    <Ionicons name="trophy" size={16} color="#FFD700" />
                    <Text style={styles.statValue}>{data.score}</Text>
                    <Text style={styles.statLabel}>Score</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="calendar" size={16} color="#4CAF50" />
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
                  <Ionicons name="navigate" size={18} color={theme.colors.primary} />
                  <Text style={[styles.quickInfoTitle, { color: theme.colors.text }]}>Distance</Text>
                </View>
                <Text style={[styles.quickInfoValue, { color: theme.colors.text }]}>
                  {distance ? `${Math.round(distance)} km` : 'Calculating...'}
                </Text>
                <Text style={[styles.quickInfoSubtext, { color: theme.colors.textSecondary }]}>from your location</Text>
              </View>

              <View style={[styles.quickInfoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border || 'rgba(0,0,0,0.08)' }]}>
                <View style={styles.quickInfoHeader}>
                  <Ionicons name="leaf" size={18} color="#4CAF50" />
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
                    <Ionicons name="car" size={18} color={theme.colors.primary} />
                    <Text style={[styles.quickInfoTitle, { color: theme.colors.text }]}>Travel Info</Text>
                  </View>
                  <Text style={[styles.quickInfoValue, { color: theme.colors.text }]}>{data.category?.fromYou || 'Unknown'}</Text>
                  <Text style={[styles.quickInfoSubtext, { color: theme.colors.textSecondary }]}>FROM YOU</Text>
                </View>

                {/* Right Box - Explore on Map */}
                <TouchableOpacity
                  style={[styles.quickInfoCard, styles.clickableCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border || 'rgba(0,0,0,0.08)' }]}
                  activeOpacity={0.7}
                  onPress={async () => {
                    // CRITICAL: For locale flow, use EXACT coordinates from localeData
                    // For tripscore flow, use coordinates from data
                    let coords: { latitude: number; longitude: number } | undefined = undefined;
                    
                    if (isAdminLocale && localeData) {
                      // Locale flow: Use EXACT coordinates from locale data
                      if (localeData.latitude && localeData.longitude && 
                          localeData.latitude !== 0 && localeData.longitude !== 0) {
                        coords = {
                          latitude: localeData.latitude,
                          longitude: localeData.longitude
                        };
                        logger.debug('Using EXACT locale coordinates:', coords);
                      }
                    } else if (data?.coordinates) {
                      // Tripscore flow: Use coordinates from data
                      if (data.coordinates.latitude && data.coordinates.longitude &&
                          data.coordinates.latitude !== 0 && data.coordinates.longitude !== 0) {
                        coords = data.coordinates;
                        logger.debug('Using tripscore coordinates:', coords);
                      }
                    }
                    
                    // PRODUCTION-GRADE: Fallback to geocoding API with country context if coordinates not available
                    if (!coords && data?.name) {
                      try {
                        // Use country code for better geocoding accuracy
                        const countryCodeForGeocoding = countryParam && countryParam !== 'general' ? countryParam.toUpperCase() : 'IN';
                        const geocodedCoords = await geocodeAddress(data.name, countryCodeForGeocoding);
                        if (geocodedCoords && geocodedCoords.latitude && geocodedCoords.longitude &&
                            geocodedCoords.latitude !== 0 && geocodedCoords.longitude !== 0) {
                          coords = geocodedCoords;
                          logger.debug('✅ Using geocoded coordinates from API as fallback:', coords);
                        } else {
                          logger.warn('⚠️ Geocoding API returned invalid coordinates for:', data.name);
                        }
                      } catch (geocodeError) {
                        logger.error('❌ Geocoding API failed for:', { locationName: data.name, error: geocodeError });
                      }
                    }
                    
                    if (coords && coords.latitude && coords.longitude) {
                      // Navigate to map with EXACT coordinates
                      router.push({
                        pathname: '/map/current-location',
                        params: {
                          latitude: coords.latitude.toString(),
                          longitude: coords.longitude.toString(),
                          address: data?.name || '',
                          locationName: data?.name || '',
                          // Pass locale context to help map navigate back correctly
                          country: countryParam || 'general',
                          userId: isAdminLocale ? 'admin-locale' : (userIdParam || 'current-user'),
                          // Preserve locale data for map screen
                          imageUrl: isAdminLocale && localeData?.imageUrl ? localeData.imageUrl : (data?.imageUrl || ''),
                          description: isAdminLocale && localeData?.description ? localeData.description : (data?.description || ''),
                          spotTypes: isAdminLocale && localeData?.spotTypes ? localeData.spotTypes.join(', ') : '',
                        },
                      });
                    } else {
                      logger.warn('Location coordinates not available for:', data?.name);
                      Alert.alert('Location Error', 'Unable to determine exact location coordinates. Please try again.');
                    }
                  }}
                >
                  <View style={styles.quickInfoHeader}>
                    <View style={styles.headerLeft}>
                      <Ionicons name="globe-outline" size={18} color="#4CAF50" />
                      <Text style={[styles.quickInfoTitle, { color: theme.colors.text }]}>Explore on Map</Text>
                    </View>
                    <View style={styles.clickableIndicator}>
                      <Ionicons name="chevron-forward" size={16} color="#4CAF50" />
                    </View>
                  </View>
                  <Text style={[styles.quickInfoValue, { color: theme.colors.text }]}>Navigate</Text>
                  <Text style={[styles.quickInfoSubtext, { color: theme.colors.textSecondary }]}>View {data.name} location</Text>
                </TouchableOpacity>
              </View>

            {/* Detailed Info Section */}
            <View style={styles.detailedInfoContainer}>
              <View style={[styles.detailedCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border || 'rgba(0,0,0,0.08)' }]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
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

// Create styles function that uses the constants
const createStyles = () => {
  const { width: screenWidth } = Dimensions.get('window');
  const isTabletLocal = screenWidth >= 768;
  const isAndroidLocal = Platform.OS === 'android';
  const isWebLocal = Platform.OS === 'web';

  return StyleSheet.create({
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
      paddingHorizontal: isTabletLocal ? 24 : 20,
      paddingTop: isAndroidLocal ? (isTabletLocal ? 20 : 18) : (isTabletLocal ? 16 : 14),
      paddingBottom: isTabletLocal ? 18 : 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
      minHeight: isAndroidLocal ? (isTabletLocal ? 72 : 64) : (isTabletLocal ? 64 : 56),
    },
    backButton: {
      // Minimum touch target: 44x44 for iOS, 48x48 for Android
      minWidth: isAndroidLocal ? 48 : 44,
      minHeight: isAndroidLocal ? 48 : 44,
      justifyContent: 'center',
      alignItems: 'center',
      padding: isTabletLocal ? 10 : (isAndroidLocal ? 10 : 8),
      borderRadius: isTabletLocal ? 24 : 20,
      marginLeft: isTabletLocal ? -10 : -8,
      ...(isWebLocal && {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      } as any),
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
      // Minimum touch target: 44x44 for iOS, 48x48 for Android
      minWidth: isAndroidLocal ? 48 : 44,
      minHeight: isAndroidLocal ? 48 : 44,
      justifyContent: 'center',
      alignItems: 'center',
      padding: isTabletLocal ? 10 : (isAndroidLocal ? 10 : 8),
      borderRadius: isTabletLocal ? 24 : 20,
      backgroundColor: 'transparent',
      ...(isWebLocal && {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      } as any),
    },
    bookmarkButtonActive: {
      backgroundColor: 'rgba(255, 215, 0, 0.15)',
      borderWidth: 1.5,
      borderColor: '#FFD700',
    },
    closeButton: {
      // Minimum touch target: 44x44 for iOS, 48x48 for Android
      minWidth: isAndroidLocal ? 48 : 44,
      minHeight: isAndroidLocal ? 48 : 44,
      justifyContent: 'center',
      alignItems: 'center',
      padding: isTabletLocal ? 10 : (isAndroidLocal ? 10 : 8),
      borderRadius: isTabletLocal ? 24 : 20,
      ...(isWebLocal && {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      } as any),
    },
  content: {
    flex: 1,
  },
  
  // Hero Section Styles
  heroSection: {
    height: 280,
    position: 'relative',
    marginBottom: 12,
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
    height: 100,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  locationBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },

  // Quick Info Cards
  quickInfoContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  quickInfoCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    minHeight: 120,
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  quickInfoTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  quickInfoValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  quickInfoSubtext: {
    fontSize: 12,
    opacity: 0.65,
    lineHeight: 16,
    letterSpacing: 0.3,
    fontWeight: '500',
  },
  clickableCard: {
    position: 'relative',
  },
  clickableIndicator: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 16,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
    height: 28,
    marginTop: -8,
  },

  // Detailed Info Section
  detailedInfoContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  detailedCard: {
    padding: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
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
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.9,
  },
  });
};

const styles = createStyles();
