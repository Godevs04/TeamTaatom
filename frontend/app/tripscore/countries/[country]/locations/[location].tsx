import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  Platform,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StatusBar,
} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import LoadingGlobe from '../../../../../components/LoadingGlobe';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import api from '../../../../../services/api';
import { calculateDistance, geocodeAddress, calculateDrivingDistanceKm, roundCoord, distanceCache } from '../../../../../utils/locationUtils';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Locale, getLocaleById, getLocales } from '../../../../../services/locale';
import { savedEvents } from '../../../../../utils/savedEvents';
import logger from '../../../../../utils/logger';


interface LocationDetail {
  tripVisitId?: string;
  stableId?: string;
  postId?: string;
  name: string;
  score: number;
  date: string;
  caption: string;
  category: {
    fromYou: string;
    typeOfSpot: string;
  };
  imageUrl?: string;
  imageUrls?: string[];
  /** Bug 18b: all photos taken at this same TripScore pin (returned by backend). */
  photos?: string[];
  postType?: 'photo' | 'short';
  description?: string;
  journeyId?: string | null;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  travelInfo?: string;
  distanceFromCurrent?: number; // Distance from current location in km (for nearby locations)
}

const normalizeRouteParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
};

const parseRouteCoordinate = (value: string | string[] | undefined): number | null => {
  const raw = normalizeRouteParam(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasUsableCoordinates = (coords?: { latitude: number; longitude: number } | null) => {
  if (!coords) return false;
  return (
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    coords.latitude !== 0 &&
    coords.longitude !== 0 &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
};

const ADMIN_LOCALE_CAROUSEL_MS = 3000;

function AdminLocaleHeroCarousel({
  urls,
  height,
  width,
  resizeMode,
}: {
  urls: string[];
  height: number;
  width: number;
  resizeMode: 'contain' | 'cover';
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const key = urls.join('|');

  useEffect(() => {
    if (urls.length <= 1) return;
    const t = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % urls.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, ADMIN_LOCALE_CAROUSEL_MS);
    return () => clearInterval(t);
  }, [urls.length, width, key]);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / Math.max(width, 1));
      if (i >= 0 && i < urls.length) setIndex(i);
    },
    [urls.length, width]
  );

  if (!urls.length) return null;
  if (urls.length === 1) {
    return <Image source={{ uri: urls[0] }} style={{ width: '100%', height }} resizeMode={resizeMode} />;
  }

  return (
    <View style={{ height, position: 'relative' }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        decelerationRate="fast"
        keyboardShouldPersistTaps="handled"
      >
        {urls.map((uri) => (
          <Image key={uri} source={{ uri }} style={{ width, height }} resizeMode={resizeMode} />
        ))}
      </ScrollView>
      <View
        style={{
          position: 'absolute',
          bottom: 56,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        pointerEvents="none"
      >
        {urls.map((_, i) => (
          <View
            key={`dot-${i}`}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              marginHorizontal: 3,
              backgroundColor: i === index ? '#ffffff' : 'rgba(255,255,255,0.45)',
            }}
          />
        ))}
      </View>
    </View>
  );
}

export default function LocationDetailScreen() {
  // Responsive dimensions (inside component to ensure they're accessible)
  const { width: screenWidth } = Dimensions.get('window');
  const isTabletLocal = screenWidth >= 768;
  const isAndroidLocal = Platform.OS === 'android';
  const isWebLocal = Platform.OS === 'web';

  const { theme, isDark } = useTheme();
  const router = useRouter();
  const { country, location, userId, imageUrl, latitude, longitude, description, spotTypes, travelInfo, localeId, galleryUrls: galleryUrlsParam, distanceKm: distanceKmParam, isDrivingDistance, tripVisitId, stableId } = useLocalSearchParams();

  // Check if coming from locale flow (general) or tripscore flow or admin locale
  const countryParam = Array.isArray(country) ? country[0] : country;
  const userIdParam = Array.isArray(userId) ? userId[0] : userId;
  const isFromLocaleFlow = countryParam === 'general';
  const isAdminLocale = userIdParam === 'admin-locale';
  // TripScore flow: when country is not 'general' and userId is not 'admin-locale'
  const isTripScoreFlow = !isFromLocaleFlow && !isAdminLocale;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LocationDetail | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  // Pre-seed distance from list param so detail shows the same value.
  // useLocalSearchParams() MUST be called above this so distanceKmParam is available.
  const hasPreSeededDistanceRef = useRef(false);
  const [distance, setDistance] = useState<number | null>(() => {
    const paramVal = Array.isArray(distanceKmParam) ? distanceKmParam[0] : distanceKmParam;
    const isDrivingStr = Array.isArray(isDrivingDistance) ? isDrivingDistance[0] : isDrivingDistance;
    if (paramVal && paramVal !== '' && isDrivingStr === 'true') {
      const parsed = parseFloat(paramVal as string);
      if (!isNaN(parsed)) {
        hasPreSeededDistanceRef.current = true;
        return parsed;
      }
    }
    return null;
  });
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [localeData, setLocaleData] = useState<Locale | null>(null);
  const [navigatingToMap, setNavigatingToMap] = useState(false);
  const [allCountryLocations, setAllCountryLocations] = useState<LocationDetail[]>([]); // Store all locations for nearby section
  const [nearbyLocations, setNearbyLocations] = useState<LocationDetail[]>([]); // Nearby locations sorted by distance

  // Navigation & Lifecycle Safety: Track mounted state
  const isMountedRef = useRef(true);

  // Bookmark Stability: Track in-flight bookmark operations
  const bookmarkingRef = useRef(false);

  // Distance Calculation Guards: Cache calculated distances per session
  const distanceCacheRef = useRef<Map<string, number>>(new Map());

  // Synchronize distance with route params if they change / become available after mount
  useEffect(() => {
    if (!isMountedRef.current) return;
    const paramVal = Array.isArray(distanceKmParam) ? distanceKmParam[0] : distanceKmParam;
    const isDrivingStr = Array.isArray(isDrivingDistance) ? isDrivingDistance[0] : isDrivingDistance;
    if (paramVal && paramVal !== '' && isDrivingStr === 'true') {
      const parsed = parseFloat(paramVal as string);
      if (!isNaN(parsed) && !hasPreSeededDistanceRef.current) {
        logger.debug('Syncing pre-seeded distance from param:', parsed);
        hasPreSeededDistanceRef.current = true;
        setDistance(parsed);
      }
    }
  }, [distanceKmParam, isDrivingDistance]);

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

  // Listen for bookmark changes from other screens.
  //
  // The listener used to have empty deps and capture `checkBookmarkStatus`
  // from the first render — at which point `localeData` was still null
  // and the captured callback fell into the regular-location branch
  // (reading `savedLocations` instead of `savedLocales`). When the user
  // first tapped Save, the optimistic `setIsBookmarked(true)` was
  // immediately reverted by this stale listener reading the wrong key.
  // The second tap only "worked" because the deduplication path skipped
  // emitChanged and the buggy listener never fired.
  //
  // Pin the live callback in a ref so the listener always invokes the
  // latest version (with the correct localeData closure). The ref is
  // null on the first render — checkBookmarkStatus is defined further
  // down — and gets wired up by the sync effect below `checkBookmarkStatus`.
  const checkBookmarkStatusRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    const unsubscribe = savedEvents.addListener(() => {
      if (isMountedRef.current) {
        checkBookmarkStatusRef.current?.();
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
  // SKIP if distance was already passed from the list page (pre-seeded) to avoid mismatch
  useEffect(() => {
    if (!isMountedRef.current) return;
    if (hasPreSeededDistanceRef.current) return; // Distance from list — never override

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

  // Calculate nearby locations when current location data is available (tripscore flow only)
  useEffect(() => {
    if (!isMountedRef.current || !isTripScoreFlow) return;
    if (!data?.coordinates || !allCountryLocations.length) return;
    
    const currentLat = data.coordinates.latitude;
    const currentLng = data.coordinates.longitude;
    
    // Skip if coordinates are invalid
    if (!currentLat || !currentLng || currentLat === 0 || currentLng === 0 || 
        isNaN(currentLat) || isNaN(currentLng)) {
      return;
    }
    
    try {
      // Calculate distance from current location to all other locations in the country
      const locationsWithDistance = allCountryLocations
        .filter(loc => {
          // Exclude current location and locations without coordinates
          const isCurrentLocation = loc.name.toLowerCase().replace(/\s+/g, '-') === 
            (Array.isArray(location) ? location[0] : location)?.toLowerCase().replace(/-/g, ' ');
          const hasValidCoords = loc.coordinates?.latitude && loc.coordinates?.longitude &&
                                 loc.coordinates.latitude !== 0 && loc.coordinates.longitude !== 0 &&
                                 !isNaN(loc.coordinates.latitude) && !isNaN(loc.coordinates.longitude);
          return !isCurrentLocation && hasValidCoords;
        })
        .map(loc => {
          const distanceKm = calculateDistance(
            currentLat,
            currentLng,
            loc.coordinates!.latitude,
            loc.coordinates!.longitude
          );
          // Convert null to undefined for TypeScript compatibility
          const distance: number | undefined = distanceKm !== null && distanceKm !== undefined ? distanceKm : undefined;
          return {
            ...loc,
            distanceFromCurrent: distance
          };
        })
        .sort((a, b) => (a.distanceFromCurrent || 0) - (b.distanceFromCurrent || 0)) // Sort by distance (closest first)
        .slice(0, 5); // Show top 5 nearby locations
      
      setNearbyLocations(locationsWithDistance);
      logger.debug('Nearby locations calculated:', { count: locationsWithDistance.length });
    } catch (error) {
      logger.error('Error calculating nearby locations:', error);
      setNearbyLocations([]);
    }
  }, [data?.coordinates, allCountryLocations, isTripScoreFlow, location]);

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
      // Use rounded coordinates for stable cache key (same as locale list page)
      const roundedTargetLat = roundCoord(targetLat);
      const roundedTargetLng = roundCoord(targetLng);
      const cacheKey = `${roundedTargetLat},${roundedTargetLng}`;
      if (distanceCacheRef.current.has(cacheKey)) {
        const cachedDistance = distanceCacheRef.current.get(cacheKey);
        if (cachedDistance !== undefined && isMountedRef.current) {
          setDistance(cachedDistance);
          return;
        }
      }

      // Distance Calculation Guards: Request permission with error handling
      let permissionGranted = false;
      try {
        const currentPerm = await Location.getForegroundPermissionsAsync();
        let status = currentPerm.status;
        if (status === 'undetermined') {
          const requested = await Location.requestForegroundPermissionsAsync();
          status = requested.status;
        }
        permissionGranted = status === 'granted';
      } catch (permError) {
        logger.warn('Failed to request location permission:', permError);
        if (isMountedRef.current) {
          setDistance(null);
        }
        return;
      }
      
      if (!permissionGranted) {
        // Distance Calculation Guards: Permission denied - fallback to null (hide distance)
        logger.debug('Location permission denied or unavailable');
        if (isMountedRef.current) {
          setDistance(null);
        }
        return;
      }
      
      // Distance Calculation Guards: Get cached location first for instant response
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown && lastKnown.coords && isMountedRef.current) {
          const distanceKm = calculateDistance(
            lastKnown.coords.latitude,
            lastKnown.coords.longitude,
            targetLat,
            targetLng
          );
          if (distanceKm !== null && !isNaN(distanceKm)) {
            setDistance(distanceKm);
            logger.debug('✅ User last known location obtained for detail:', distanceKm);
          }
        }
      } catch (lastKnownError) {
        logger.debug('Failed to get last known location in detail:', lastKnownError);
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
        // Do not set distance to null if we already got a cached/last known distance!
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

        // Check shared distanceCache first!
        const roundedUserLat = roundCoord(currentLat);
        const roundedUserLon = roundCoord(currentLng);
        const cleanLocaleId = String((Array.isArray(localeId) ? localeId[0] : localeId) || '');
        const sharedCacheKey = cleanLocaleId ? `${cleanLocaleId}-${roundedUserLat}-${roundedUserLon}` : null;
        if (sharedCacheKey && distanceCache.has(sharedCacheKey)) {
          const cached = distanceCache.get(sharedCacheKey);
          if (cached !== undefined && cached !== null) {
            logger.debug('Using shared cache distance on detail page:', cached);
            if (isMountedRef.current) {
              setDistance(cached);
            }
            return;
          }
        }
        
        // Try to calculate Google Distance Matrix driving distance
        let calculatedDistance = null;
        if (calculatedDistance === null || isNaN(calculatedDistance) || calculatedDistance < 0) {
          try {
            calculatedDistance = await calculateDrivingDistanceKm(
              currentLat,
              currentLng,
              targetLat,
              targetLng
            );
          } catch (googleError) {
            logger.warn('Failed to calculate Google Maps driving distance:', googleError);
          }
        }

        // Fallback to straight-line distance (Haversine) if Google APIs fail
        if (calculatedDistance === null || isNaN(calculatedDistance) || calculatedDistance < 0) {
          calculatedDistance = calculateDistance(
            currentLat,
            currentLng,
            targetLat,
            targetLng
          );
        }
        
        // Distance Calculation Guards: Validate calculated distance
        if (calculatedDistance === null || isNaN(calculatedDistance) || calculatedDistance < 0) {
          logger.warn('Invalid calculated distance:', calculatedDistance);
          if (isMountedRef.current) {
            setDistance(null);
          }
          return;
        }
        
        // Cache the calculated distance locally
        distanceCacheRef.current.set(cacheKey, calculatedDistance);

        // Cache in the shared distanceCache as well!
        if (sharedCacheKey && calculatedDistance !== null && !isNaN(calculatedDistance)) {
          distanceCache.set(sharedCacheKey, calculatedDistance);
        }
        
        logger.debug('Distance calculated successfully (routing/fallback):', { distance: calculatedDistance, unit: 'km' });
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
        if (!locationName) {
          // No identifier available yet — skip silently; will re-run when data loads.
          return;
        }
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

  // Keep the savedEvents listener pointed at the latest checkBookmarkStatus,
  // so it always uses the current isAdminLocale / localeData / data closure
  // — without re-binding the listener on every dep change.
  useEffect(() => {
    checkBookmarkStatusRef.current = checkBookmarkStatus;
  }, [checkBookmarkStatus]);

  // Bookmark Stability: Atomic read-modify-write with deduplication
  const handleBookmark = useCallback(async () => {
    // Bookmark Stability: Prevent duplicate bookmark operations
    if (bookmarkingRef.current) {
      logger.debug('Bookmark operation already in progress, skipping');
      return;
    }
    
    if (!isMountedRef.current) return;

    // Admin-locale flow needs `localeData` to know which entry to toggle.
    // If a user taps before the locale fetch resolves (or after it failed),
    // falling through to the regular-location branch would (a) write to the
    // wrong AsyncStorage key and (b) crash on `locationName.toLowerCase()`
    // when neither `data.name` nor the URL param is populated yet.
    if (isAdminLocale && !localeData) {
      Alert.alert('Please wait', 'Still loading locale details — try again in a moment.');
      return;
    }

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
        if (!locationName) {
          Alert.alert('Please wait', 'Location details are still loading — try again in a moment.');
          return;
        }
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
        const localeIdRaw = Array.isArray(localeId) ? localeId[0] : localeId;
        let idStr = localeIdRaw ? String(localeIdRaw).trim() : '';
        if (idStr && !/^[a-f0-9]{24}$/i.test(idStr)) {
          idStr = '';
        }
        const rawGalleryJoined = Array.isArray(galleryUrlsParam) ? galleryUrlsParam[0] : galleryUrlsParam;
        const galleryFromParams =
          typeof rawGalleryJoined === 'string' && rawGalleryJoined.length > 0
            ? rawGalleryJoined.split('|||').map((u) => u.trim()).filter(Boolean)
            : [];

        let fetchedLocale: Locale | null = null;
        if (idStr) {
          try {
            fetchedLocale = await getLocaleById(idStr);
          } catch (e) {
            logger.warn('Admin locale: getLocaleById failed, will try list fallback', e);
          }
        }

        if ((!fetchedLocale || !(fetchedLocale.imageUrls && fetchedLocale.imageUrls.length > 0)) && locationName) {
          try {
            const cc =
              countryParam && countryParam !== 'general'
                ? String(countryParam).toUpperCase().slice(0, 10)
                : '';
            const res = await getLocales(locationName, cc, '', '', 1, 40, false);
            const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
            const want = norm(locationName);
            const locSlug = String(locationParam || '').toLowerCase();
            const match = res.locales?.find((l) => {
              const n = norm(l?.name || '');
              const c = norm(l?.city || '');
              return n === want || c === want || n.replace(/\s+/g, '-') === locSlug.replace(/\s+/g, '-');
            });
            if (match?._id) {
              const detail = await getLocaleById(String(match._id));
              if (
                detail &&
                (!fetchedLocale ||
                  (detail.imageUrls?.length || 0) >= (fetchedLocale.imageUrls?.length || 0))
              ) {
                fetchedLocale = detail;
              }
            }
          } catch (fallbackErr) {
            logger.warn('Admin locale: getLocales fallback failed', fallbackErr);
          }
        }

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
        const localeSpotTypes = spotTypes ? (Array.isArray(spotTypes) ? spotTypes[0] : spotTypes).split(', ').filter(s => s.trim().length > 0) : [];
        const localeTravelInfo = travelInfo ? (Array.isArray(travelInfo) ? travelInfo[0] : travelInfo) : 'Drivable';
        
        logger.debug('Admin locale params:', {
          localeImageUrl,
          localeLat,
          localeLng,
          localeLatStr,
          localeLngStr,
          locationName,
          localeTravelInfo,
          localeSpotTypes
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
            const errorToLog = geocodeError instanceof Error 
              ? geocodeError 
              : new Error(String(geocodeError) || 'Geocoding API failed');
            logger.error('❌ Geocoding API failed for:', errorToLog, { locationName });
          }
        }
        
        const fallbackImg = localeImageUrl || getLocationImage(locationName);
        const galleryUrls: string[] = (() => {
          const fromApi = fetchedLocale?.imageUrls?.filter((u) => typeof u === 'string' && u.length > 0);
          if (fromApi && fromApi.length > 0) return fromApi;
          if (galleryFromParams.length > 0) return galleryFromParams;
          const single = (fetchedLocale?.imageUrl && String(fetchedLocale.imageUrl)) || fallbackImg;
          return single ? [single] : [];
        })();

        const displayName = fetchedLocale?.name || locationName;
        const descFinal =
          (fetchedLocale?.description != null && String(fetchedLocale.description).trim() !== ''
            ? fetchedLocale.description
            : localeDesc) ||
          `${displayName} is a beautiful destination with unique attractions and natural beauty.`;

        const locale: Locale = {
          _id: fetchedLocale?._id || `admin-${locationName.toLowerCase().replace(/\s+/g, '-')}`,
          name: displayName,
          countryCode: fetchedLocale?.countryCode || countryParam.toUpperCase(),
          imageUrl: galleryUrls[0] || '',
          imageUrls: galleryUrls,
          description: typeof descFinal === 'string' ? descFinal : localeDesc,
          spotTypes:
            fetchedLocale?.spotTypes?.length ? fetchedLocale.spotTypes : localeSpotTypes,
          travelInfo: fetchedLocale?.travelInfo || localeTravelInfo,
          latitude: fetchedLocale?.latitude ?? finalLat,
          longitude: fetchedLocale?.longitude ?? finalLng,
          isActive: true,
          createdAt: fetchedLocale?.createdAt || new Date().toISOString(),
        };
        
        setLocaleData(locale);
        
        const coordinates =
          locale.latitude != null &&
          locale.longitude != null &&
          !Number.isNaN(locale.latitude) &&
          !Number.isNaN(locale.longitude)
            ? { latitude: locale.latitude, longitude: locale.longitude }
            : finalLat && finalLng
              ? { latitude: finalLat, longitude: finalLng }
              : undefined;
        logger.debug('Setting data with coordinates:', { coordinates });
        
        setData({
          name: displayName,
          score: 1,
          date: new Date().toISOString(),
          caption: `Visit ${displayName}`,
          category: {
            fromYou: locale.travelInfo || localeTravelInfo,
            typeOfSpot: (locale.spotTypes && locale.spotTypes[0]) || localeSpotTypes[0] || 'Natural'
          },
          travelInfo: locale.travelInfo || localeTravelInfo,
          description: descFinal,
          imageUrl: galleryUrls[0],
          imageUrls: galleryUrls,
          coordinates: coordinates
        });
        
        setLoading(false);
        
        // Distance: Use the pre-seeded value from the list (passed via route params).
        // Only recalculate if no distance was passed (e.g. deep link / direct navigation).
        if (!hasPreSeededDistanceRef.current && coordinates && coordinates.latitude && coordinates.longitude &&
            coordinates.latitude !== 0 && coordinates.longitude !== 0) {
          logger.debug('No pre-seeded distance, calculating with coordinates:', coordinates);
          calculateDistanceAsync(coordinates.latitude, coordinates.longitude);
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
          const errorToLog = geocodeError instanceof Error 
            ? geocodeError 
            : new Error(String(geocodeError) || 'Geocoding failed');
          logger.error('❌ Geocoding failed for general location:', errorToLog, { locationName });
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
            const routeTripVisitId = normalizeRouteParam(tripVisitId);
            const routeStableId = normalizeRouteParam(stableId);
            const routeLat = parseRouteCoordinate(latitude);
            const routeLng = parseRouteCoordinate(longitude);
            const routeCoords =
              routeLat !== null && routeLng !== null
                ? { latitude: routeLat, longitude: routeLng }
                : undefined;
            
            // CRITICAL: Store all locations for nearby locations section
            // Process all locations with coordinates
            const processedLocations = locations.map((loc: any, index: number) => ({
              ...loc,
              stableId: loc.tripVisitId || `${loc.name || `loc-${index}`}-${loc.coordinates?.latitude ?? 'na'}-${loc.coordinates?.longitude ?? 'na'}-${index}`,
              description: loc.description || `${loc.name} is a beautiful destination`,
              coordinates: loc.coordinates || undefined
            }));
            setAllCountryLocations(processedLocations);
          
            // Find the specific TripVisit first. Name slugs are not unique for nearby posts.
            const foundLocation =
              processedLocations.find((loc: any) => loc.tripVisitId && loc.tripVisitId === routeTripVisitId) ||
              processedLocations.find((loc: any) => loc.stableId && loc.stableId === routeStableId) ||
              (routeCoords
                ? processedLocations.find((loc: any) =>
                    hasUsableCoordinates(loc.coordinates) &&
                    Math.abs(loc.coordinates.latitude - routeCoords.latitude) < 0.000001 &&
                    Math.abs(loc.coordinates.longitude - routeCoords.longitude) < 0.000001
                  )
                : null) ||
              processedLocations.find((loc: any) => 
                loc.name.toLowerCase().replace(/\s+/g, '-') === locationParam
              );
            
            if (foundLocation) {
              // TripScore coordinates from backend/route are the source of truth.
              // Geocoding is fallback only; it must never override a post's saved GPS.
              let finalCoords: { latitude: number; longitude: number } | undefined =
                hasUsableCoordinates(foundLocation.coordinates)
                  ? foundLocation.coordinates
                  : hasUsableCoordinates(routeCoords)
                    ? routeCoords
                    : undefined;
              
              if (!finalCoords) {
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
                const errorToLog = geocodeError instanceof Error 
                  ? geocodeError 
                  : new Error(String(geocodeError) || 'Geocoding failed');
                logger.error('❌ Geocoding failed for TripScore location:', errorToLog, { locationName: foundLocation.name });
              }
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
      if (!isAdminLocale && !isFromLocaleFlow && !hasPreSeededDistanceRef.current && data?.coordinates && 
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
        const errorToLog = geocodeError instanceof Error 
          ? geocodeError 
          : new Error(String(geocodeError) || 'Geocoding failed');
        logger.error('❌ Geocoding also failed in error handler:', errorToLog);
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
          <LoadingGlobe size="large" color={theme.colors.primary} />
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
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/locale');
              }
            } else {
              router.back();
            }
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={isTabletLocal ? 28 : 24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text 
          style={[styles.headerTitle, { color: theme.colors.text }]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {displayLocationName}
        </Text>
        <View style={styles.headerRight}>
          {/* Only show bookmark button in locale flow (not TripScore flow) */}
          {!isTripScoreFlow && (
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
                <LoadingGlobe size="small" color={isBookmarked ? '#1C73B4' : theme.colors.textSecondary} />
              ) : isBookmarked ? (
                <MaskedView
                  style={{ width: isTabletLocal ? 28 : 24, height: isTabletLocal ? 28 : 24 }}
                  maskElement={
                    <Ionicons
                      name="bookmark"
                      size={isTabletLocal ? 28 : 24}
                      color="#000000"
                    />
                  }
                >
                  <LinearGradient
                    colors={['#1C73B4', '#50C878']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1 }}
                  />
                </MaskedView>
              ) : (
                <Ionicons
                  name="bookmark-outline"
                  size={isTabletLocal ? 28 : 24}
                  color={theme.colors.textSecondary}
                />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              // CRITICAL: Always navigate directly to LocaleHome (locale tab)
              // This ensures clean back navigation without stacked screens
              if (isAdminLocale || isFromLocaleFlow) {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/locale');
                }
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
            {/* Hero Image Section with Glassmorphism Effect */}
            <View style={styles.heroSection}>
              {isAdminLocale && data?.imageUrls && data.imageUrls.length > 0 ? (
                <AdminLocaleHeroCarousel
                  urls={data.imageUrls}
                  height={280}
                  width={screenWidth}
                  resizeMode="contain"
                />
              ) : isTripScoreFlow && Array.isArray((data as any)?.photos) && ((data as any).photos as string[]).length > 1 ? (
                // Bug 18b: multi-photo swipe for TripScore locations with multiple posts at the same pin
                <AdminLocaleHeroCarousel
                  urls={(data as any).photos as string[]}
                  height={280}
                  width={screenWidth}
                  resizeMode="contain"
                />
              ) : (
                <Image
                  source={{
                    uri: isTripScoreFlow && data?.imageUrl
                      ? data.imageUrl
                      : isAdminLocale && localeData?.imageUrl
                        ? localeData.imageUrl
                        : data?.imageUrl || getLocationImage(data?.name || ''),
                  }}
                  style={styles.heroImage}
                  resizeMode="contain"
                />
              )}
              {/* Glassmorphism overlay effect */}
              <View style={styles.glassmorphismOverlay} />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
                style={styles.imageGradient}
                locations={[0, 0.5, 1]}
              />
              <View style={styles.heroContent}>
                <View style={styles.locationBadge}>
                  <Ionicons name="location" size={16} color="#fff" />
                  <Text style={styles.locationBadgeText}>{data.name}</Text>
                </View>
                {/* Score and Visited - Moved left with liquid gradient effect */}
                {isTripScoreFlow && (
                  <View style={styles.heroStatsLeft}>
                    <LinearGradient
                      colors={['rgba(255, 215, 0, 0.3)', 'rgba(255, 215, 0, 0.1)', 'rgba(0, 0, 0, 0.85)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.statItem}
                    >
                      <Ionicons name="trophy" size={18} color="#FFD700" />
                      <Text style={styles.statValue}>{data.score}</Text>
                      <Text style={styles.statLabel}>Score</Text>
                    </LinearGradient>
                    <LinearGradient
                      colors={['rgba(76, 175, 80, 0.3)', 'rgba(76, 175, 80, 0.1)', 'rgba(0, 0, 0, 0.85)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.statItem}
                    >
                      <Ionicons name="calendar" size={18} color="#4CAF50" />
                      <Text style={styles.statValue}>
                        {data.date ? (() => {
                          try {
                            const date = new Date(data.date);
                            if (isNaN(date.getTime())) {
                              // Invalid date, try to parse as timestamp
                              const timestamp = typeof data.date === 'number' ? data.date : parseInt(data.date);
                              if (!isNaN(timestamp) && timestamp > 0) {
                                const year = new Date(timestamp).getFullYear();
                                return isNaN(year) ? 'N/A' : year;
                              }
                              return 'N/A';
                            }
                            return date.getFullYear();
                          } catch (error) {
                            logger.warn('Error parsing date for visited year:', { date: data.date, error });
                            return 'N/A';
                          }
                        })() : 'N/A'}
                      </Text>
                      <Text style={styles.statLabel}>Visited</Text>
                    </LinearGradient>
                  </View>
                )}
              </View>
            </View>

            {/* Quick Info Grid */}
            <View style={styles.quickInfoContainer}>
              {/* Card 1: Distance */}
              <BlurView
                intensity={95}
                tint={isDark ? 'dark' : 'light'}
                style={[styles.quickInfoCard, { overflow: 'hidden', backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.4)', borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.6)', borderWidth: 1 }]}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name="navigate" size={18} color={theme.colors.primary} />
                </View>
                <Text style={[styles.quickInfoTitle, { color: theme.colors.text }]}>Distance</Text>
                <Text 
                  style={[
                    styles.quickInfoValue, 
                    styles.distanceValue,
                    { color: theme.colors.text }
                  ]}
                  numberOfLines={1}
                >
                  {distance !== null && distance !== undefined
                    ? distance < 1
                      ? `${Math.round(distance * 1000)} m`
                      : `${distance.toFixed(1)} km`
                    : 'Calculating...'}
                </Text>
                <Text style={[styles.quickInfoSubtext, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  from your location
                </Text>
              </BlurView>

              {/* Card 2: Spot Type */}
              <BlurView
                intensity={95}
                tint={isDark ? 'dark' : 'light'}
                style={[styles.quickInfoCard, { overflow: 'hidden', backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.4)', borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.6)', borderWidth: 1 }]}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name="leaf" size={18} color="#4CAF50" />
                </View>
                <Text style={[styles.quickInfoTitle, { color: theme.colors.text }]}>Spot Type</Text>
                <Text style={[styles.quickInfoValue, styles.spotTypeValue, { color: theme.colors.text }]} numberOfLines={2}>
                  {isTripScoreFlow 
                    ? (data?.category?.typeOfSpot || 'General')
                    : (localeData?.spotTypes?.[0] || data?.category?.typeOfSpot || 'Natural')
                  }
                </Text>
                <Text style={[styles.quickInfoSubtext, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  outdoor destination
                </Text>
              </BlurView>

              {/* Card 3: Travel Info */}
              <BlurView
                intensity={95}
                tint={isDark ? 'dark' : 'light'}
                style={[styles.quickInfoCard, { overflow: 'hidden', backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.4)', borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.6)', borderWidth: 1 }]}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name="car" size={18} color={theme.colors.primary} />
                </View>
                <Text style={[styles.quickInfoTitle, { color: theme.colors.text }]}>Travel Info</Text>
                <Text style={[styles.quickInfoValue, styles.travelValue, { color: theme.colors.text }]} numberOfLines={1}>
                  {isTripScoreFlow 
                    ? (data?.category?.fromYou || 'Drivable')
                    : (localeData?.travelInfo || data?.category?.fromYou || 'Drivable')
                  }
                </Text>
                <Text style={[styles.quickInfoSubtext, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  FROM YOU
                </Text>
              </BlurView>

              {/* Card 4: Navigate */}
              <TouchableOpacity
                style={[styles.quickInfoCard, styles.clickableCard, { overflow: 'hidden', padding: 0, borderWidth: 0, backgroundColor: 'transparent' }]}
                activeOpacity={0.7}
                disabled={navigatingToMap}
                onPress={async () => {
                  if (navigatingToMap) return;
                  setNavigatingToMap(true);
                  try {
                  // CRITICAL: For locale flow, use EXACT coordinates from database (localeData)
                  // For tripscore flow, use coordinates from data
                  let coords: { latitude: number; longitude: number } | undefined = undefined;

                  // Helper: validate coordinate sanity
                  const isValidCoord = (lat?: number, lng?: number) =>
                    !!lat && !!lng && lat !== 0 && lng !== 0 &&
                    !isNaN(lat) && !isNaN(lng) &&
                    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

                  // Bound any geocoding call so a stalled fetch can never
                  // freeze the button.
                  const GEOCODE_TIMEOUT_MS = 3000;
                  const geocodeWithTimeout = (
                    address: string,
                    cc?: string
                  ): Promise<{ latitude: number; longitude: number } | null> =>
                    Promise.race([
                      geocodeAddress(address, cc),
                      new Promise<null>((resolve) =>
                        setTimeout(() => resolve(null), GEOCODE_TIMEOUT_MS)
                      ),
                    ]);

                  if (isAdminLocale && localeData) {
                    const dbHasCoords = isValidCoord(localeData.latitude, localeData.longitude);
                    const dbCoords = dbHasCoords ? {
                      latitude: localeData.latitude!,
                      longitude: localeData.longitude!
                    } : null;

                    if (dbCoords) {
                      coords = dbCoords;
                    } else {
                     try {
                      const nameQuery = [
                        localeData.name,
                        localeData.city,
                        localeData.stateProvince,
                        localeData.country
                      ].filter(Boolean).join(', ');
                      const ccForGeocode = (localeData.countryCode || countryParam || 'IN').toUpperCase();
                      const geocoded = await geocodeWithTimeout(nameQuery || localeData.name, ccForGeocode);

                      if (geocoded && isValidCoord(geocoded.latitude, geocoded.longitude)) {
                        if (dbCoords) {
                          const drift = calculateDistance(
                            dbCoords.latitude, dbCoords.longitude,
                            geocoded.latitude, geocoded.longitude
                          );
                          if (drift <= 50) {
                            coords = dbCoords;
                            logger.debug('✅ DB coords match geocode (drift ' + drift.toFixed(1) + 'km), using DB:', coords);
                          } else {
                            coords = geocoded;
                            logger.warn('⚠️ DB coords drift ' + drift.toFixed(1) + 'km from geocode — using geocoded coords for accuracy:', coords);
                          }
                        } else {
                          coords = geocoded;
                          logger.debug('✅ Using geocoded coordinates (no DB coords):', coords);
                        }
                      } else if (dbCoords) {
                        coords = dbCoords;
                        logger.debug('✅ Geocode failed, falling back to DB coords:', coords);
                      }
                    } catch (e) {
                      if (dbCoords) {
                        coords = dbCoords;
                        logger.warn('⚠️ Geocode threw, falling back to DB coords:', coords);
                      }
                    }
                    }
                  } else if (data?.coordinates || data?.name) {
                    const dbCoords = (data?.coordinates && isValidCoord(data.coordinates.latitude, data.coordinates.longitude))
                      ? { latitude: data.coordinates.latitude, longitude: data.coordinates.longitude }
                      : null;

                    if (dbCoords) {
                      coords = dbCoords;
                      logger.debug('Using exact TripScore coordinates from selected post:', {
                        tripVisitId: data.tripVisitId,
                        locationName: data.name,
                        coords,
                      });
                    } else
                    if (data?.name) {
                      try {
                        const ccForGeocode = (countryParam && countryParam !== 'general' ? countryParam : 'IN').toUpperCase();
                        const geocoded = await geocodeWithTimeout(data.name, ccForGeocode);

                        if (geocoded && isValidCoord(geocoded.latitude, geocoded.longitude)) {
                          if (dbCoords) {
                            const drift = calculateDistance(
                              dbCoords.latitude, dbCoords.longitude,
                              geocoded.latitude, geocoded.longitude
                            );
                            if (drift <= 50) {
                              coords = dbCoords;
                              logger.debug('✅ DB coords match geocode (drift ' + drift.toFixed(1) + 'km), using DB:', coords);
                            } else {
                              coords = geocoded;
                              logger.warn('⚠️ DB coords drift ' + drift.toFixed(1) + 'km from geocode — using geocoded coords:', coords);
                            }
                          } else {
                            coords = geocoded;
                            logger.debug('✅ Using geocoded coordinates (no DB coords):', coords);
                          }
                        } else if (dbCoords) {
                          coords = dbCoords;
                          logger.debug('✅ Geocode failed, falling back to DB coords:', coords);
                        }
                      } catch {
                        if (dbCoords) {
                          coords = dbCoords;
                          logger.warn('⚠️ Geocode threw, falling back to DB coords:', coords);
                        }
                      }
                    } else if (dbCoords) {
                      coords = dbCoords;
                    }
                  }
                  
                  if (!coords && data?.name) {
                    try {
                      const countryCodeForGeocoding = countryParam && countryParam !== 'general' ? countryParam.toUpperCase() : 'IN';
                      const geocodedCoords = await geocodeWithTimeout(data.name, countryCodeForGeocoding);
                      if (geocodedCoords && geocodedCoords.latitude && geocodedCoords.longitude &&
                          geocodedCoords.latitude !== 0 && geocodedCoords.longitude !== 0) {
                        coords = geocodedCoords;
                        logger.debug('✅ Using geocoded coordinates from API as fallback:', coords);
                      } else {
                        logger.warn('⚠️ Geocoding API returned invalid coordinates for:', data.name);
                      }
                    } catch (geocodeError) {
                      const errorToLog = geocodeError instanceof Error
                        ? geocodeError
                        : new Error(String(geocodeError) || 'Geocoding API failed');
                      logger.error('❌ Geocoding API failed for:', errorToLog, { locationName: data.name });
                    }
                  }
                  
                  if (coords && coords.latitude && coords.longitude) {
                    logger.debug('📍 Navigating to map with database coordinates:', {
                      locationName: data?.name,
                      coordinates: coords,
                      source: isAdminLocale ? 'Database (localeData)' : 'Data coordinates'
                    });
                    
                    router.push({
                      pathname: '/map/current-location',
                      params: {
                        latitude: coords.latitude.toString(),
                        longitude: coords.longitude.toString(),
                        address: data?.name || '',
                        locationName: data?.name || '',
                        postId: data?.postId || data?.tripVisitId || normalizeRouteParam(tripVisitId) || '',
                        country: countryParam || 'general',
                        userId: isAdminLocale ? 'admin-locale' : (userIdParam || 'current-user'),
                        imageUrl: isAdminLocale && localeData?.imageUrl ? localeData.imageUrl : (data?.imageUrl || ''),
                        description: isAdminLocale && localeData?.description ? localeData.description : (data?.description || ''),
                        spotTypes: isAdminLocale && localeData?.spotTypes ? localeData.spotTypes.join(', ') : '',
                      },
                    });
                  } else {
                    logger.warn('❌ Location coordinates not available for:', {
                      locationName: data?.name,
                      isAdminLocale,
                      localeData: localeData ? {
                        hasLatitude: !!localeData.latitude,
                        hasLongitude: !!localeData.longitude,
                        latitude: localeData.latitude,
                        longitude: localeData.longitude
                      } : 'null',
                      dataCoordinates: data?.coordinates
                    });
                    Alert.alert('Location Error', 'Unable to determine exact location coordinates. Please try again.');
                  }
                  } finally {
                    setNavigatingToMap(false);
                  }
                }}
              >
                <BlurView
                  intensity={95}
                  tint={isDark ? 'dark' : 'light'}
                  style={[styles.quickInfoCardInner, { overflow: 'hidden', backgroundColor: isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.4)', borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.6)', borderWidth: 1, borderRadius: 24, flex: 1, width: '100%', height: '100%' }]}
                >
                  <View style={styles.iconContainer}>
                    <Ionicons name="globe-outline" size={18} color="#4CAF50" />
                  </View>
                  <Text style={[styles.quickInfoTitle, { color: theme.colors.text }]}>Explore on Map</Text>
                  <Text style={[styles.quickInfoValue, styles.navigateValue, { color: theme.colors.text }]}>{navigatingToMap ? 'Opening…' : 'Navigate'}</Text>
                  <Text style={[styles.quickInfoSubtext, { color: theme.colors.textSecondary }]} numberOfLines={1}>View {data.name} location</Text>
                  
                  <View style={styles.navigateArrowContainer}>
                    {navigatingToMap ? (
                      <LoadingGlobe size="small" color="#4CAF50" />
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color="#4CAF50" />
                    )}
                  </View>
                </BlurView>
              </TouchableOpacity>
            </View>

            {/* Nearby Locations Section - Only for TripScore flow */}
            {isTripScoreFlow && nearbyLocations.length > 0 && (
              <View style={styles.detailedInfoContainer}>
                <View style={[styles.detailedCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border || 'rgba(0,0,0,0.08)' }]}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="map-outline" size={20} color={theme.colors.primary} />
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Nearby Locations</Text>
                  </View>
                  {nearbyLocations.map((nearbyLoc, index) => (
                    <TouchableOpacity
                      key={nearbyLoc.name || index}
                      style={[styles.nearbyLocationItem, { borderBottomColor: theme.colors.border || 'rgba(0,0,0,0.08)' }]}
                      onPress={() => {
                        const locationSlug = nearbyLoc.name.toLowerCase().replace(/\s+/g, '-');
                        const countryParam = Array.isArray(country) ? country[0] : country;
                        router.push({
                          pathname: '/tripscore/countries/[country]/locations/[location]',
                          params: { 
                            country: countryParam as string, 
                            location: locationSlug, 
                            userId: (Array.isArray(userId) ? userId[0] : userId) as string 
                          }
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.nearbyLocationContent}>
                        <View style={styles.nearbyLocationIcon}>
                          <Ionicons name="location" size={18} color={theme.colors.primary} />
                        </View>
                        <View style={styles.nearbyLocationInfo}>
                          <Text style={[styles.nearbyLocationName, { color: theme.colors.text }]} numberOfLines={1}>
                            {nearbyLoc.name}
                          </Text>
                          <Text style={[styles.nearbyLocationDistance, { color: theme.colors.textSecondary }]}>
                            {nearbyLoc.distanceFromCurrent !== undefined && nearbyLoc.distanceFromCurrent < 1
                              ? `${Math.round(nearbyLoc.distanceFromCurrent * 1000)} m away`
                              : nearbyLoc.distanceFromCurrent !== undefined
                              ? `${nearbyLoc.distanceFromCurrent.toFixed(1)} km away`
                              : 'Distance unknown'}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Detailed Info Section */}
            <View style={styles.detailedInfoContainer}>
              <LinearGradient
                colors={['#1C73B4', '#50C878']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.detailedCard, { borderRadius: 16, overflow: 'hidden' }]}
              >
                <View style={styles.cardHeader}>
                  <Ionicons name="information-circle" size={20} color="#000000" />
                  <Text style={[styles.cardTitle, { color: '#000000', fontWeight: 'bold' }]}>About This Place</Text>
                </View>
                <Text style={[styles.descriptionText, { color: '#000000', fontWeight: '500' }]}>
                  {data.description}
                </Text>
              </LinearGradient>
            </View>

            {isTripScoreFlow && data?.journeyId ? (
              <View style={styles.detailedInfoContainer}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    router.push({
                      pathname: '/navigate/detail',
                      params: {
                        journeyId: data.journeyId || '',
                      }
                    });
                  }}
                >
                  <LinearGradient
                    colors={isDark ? ['#3B82F6', '#10B981'] : ['#2563EB', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.detailedCard, { borderRadius: 16, overflow: 'hidden', padding: 16 }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 12 }}>
                          <Ionicons name="navigate" size={24} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                            View Travel Journey
                          </Text>
                          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                            Show path, speed and travel proof details
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : null}
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
      // Extra breathing room above the back / title / bookmark / close row.
      // On Android, SafeAreaView doesn't handle the status bar inset, so we
      // add StatusBar.currentHeight to keep the header below the notification bar.
      paddingTop: isAndroidLocal
        ? (StatusBar.currentHeight || 0) + (isTabletLocal ? 12 : 8)
        : (isTabletLocal ? 28 : 24),
      paddingBottom: isTabletLocal ? 18 : 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      minHeight: isAndroidLocal ? (isTabletLocal ? 84 : 76) : (isTabletLocal ? 76 : 68),
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
        ['transition']: 'all 0.2s ease',
      } as any),
    },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.3,
    paddingHorizontal: 8,
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
        ['transition']: 'all 0.2s ease',
      } as any),
    },
    bookmarkButtonActive: {
      backgroundColor: 'transparent',
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
        ['transition']: 'all 0.2s ease',
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
    height: 160,
    zIndex: 1,
  },
  glassmorphismOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 1,
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  locationBadgeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 16,
  },
  heroStatsLeft: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 'auto',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    minWidth: 70,
    overflow: 'hidden',
  },
  statValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  statLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    opacity: 0.95,
  },

  // Quick Info Cards
  quickInfoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
    rowGap: 16,
    columnGap: 16,
  },
  quickInfoCard: {
    width: (Dimensions.get('window').width - 32 - 16) / 2,
    height: 140,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
    overflow: 'hidden',
  },
  quickInfoCardInner: {
    flex: 1,
    borderRadius: 24,
    position: 'relative',
  },
  iconContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
  },
  quickInfoTitle: {
    position: 'absolute',
    top: 44,
    left: 20,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  quickInfoValue: {
    position: 'absolute',
    top: 72,
    left: 20,
    right: 20,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  distanceValue: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  spotTypeValue: {
    lineHeight: 18,
    fontSize: 15,
  },
  travelValue: {
    lineHeight: 26,
    fontSize: 20,
  },
  navigateValue: {
    lineHeight: 26,
    fontSize: 20,
  },
  quickInfoSubtext: {
    position: 'absolute',
    top: 108,
    left: 20,
    right: 20,
    fontSize: 12,
    opacity: 0.65,
    lineHeight: 16,
    letterSpacing: 0.3,
    fontWeight: '500',
  },
  clickableCard: {
    position: 'relative',
  },
  navigateArrowContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 16,
    padding: 5,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
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
    borderWidth: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
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
  // Nearby Locations Styles
  nearbyLocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nearbyLocationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  nearbyLocationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  nearbyLocationInfo: {
    flex: 1,
  },
  nearbyLocationName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  nearbyLocationDistance: {
    fontSize: 12,
    opacity: 0.7,
  },
  });
};

const styles = createStyles();
