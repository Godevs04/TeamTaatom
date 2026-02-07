import React, { useState, useEffect, useReducer, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Dimensions,
  Modal,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { getProfile } from '../../services/profile';
import { getUserFromStorage } from '../../services/auth';
import { useRouter, useFocusEffect } from 'expo-router';
import { geocodeAddress, calculateDistance, invalidateDistanceCacheIfMoved, distanceCache, placesCache, roundCoord, getLocaleDistanceKm, calculateDrivingDistanceKm } from '../../utils/locationUtils';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { getCountries, getStatesByCountry, Country, State } from '../../services/location';
import { getLocales, Locale } from '../../services/locale';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';
import { savedEvents } from '../../utils/savedEvents';
import { theme } from '../../constants/theme';
import axios from 'axios';
import { getGoogleMapsApiKey } from '../../utils/maps';
import { localeCache } from '../../cache/localeCache';
import { ErrorBoundary } from '../../utils/errorBoundary';
import { trackFeatureUsage } from '../../services/analytics';

const logger = createLogger('LocaleScreen');

// Responsive dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Elegant font families
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) {
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    return 'System';
  }
  return 'Roboto';
};

// Google Places API function to fetch exact tourist spot coordinates
// This uses Places API to find the most popular tourist attraction in the city
// This ensures we use exact tourist spot coordinates, not city center coordinates
// Uses caching to avoid repeated API calls for the same place
const fetchRealCoords = async (
  place: string, 
  countryCode?: string,
  cache?: Map<string, { lat: number; lon: number }>,
  description?: string
): Promise<{ lat: number; lon: number } | null> => {
  try {
    const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKey();
    if (!GOOGLE_MAPS_API_KEY) {
      if (__DEV__) {
        console.log('GEOCODE_FETCH_ERROR: Google Maps API key not configured');
      }
      return null;
    }
    
    if (__DEV__) {
      console.log(`🔑 Using Google Maps API Key: ${GOOGLE_MAPS_API_KEY.substring(0, 20)}... (length: ${GOOGLE_MAPS_API_KEY.length})`);
    }

    // Build cache key
    const cacheKey = `${place}-${countryCode || ''}-${description || ''}`.toLowerCase().trim();
    
    // Check global placesCache first (persists across navigation)
    if (placesCache.has(cacheKey)) {
      const cached = placesCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)) {
        if (__DEV__) {
          console.log(`✅ Using global cached coordinates for ${place}:`, { lat: cached.lat, lon: cached.lon });
        }
        return { lat: cached.lat, lon: cached.lon };
      }
    }
    
    // Check component-level cache as fallback
    if (cache && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (cached) {
        if (__DEV__) {
          console.log(`✅ Using component cached coordinates for ${place}:`, cached);
        }
        // Also store in global cache
        placesCache.set(cacheKey, { lat: cached.lat, lon: cached.lon, timestamp: Date.now() });
        return cached;
      }
    }
    
    // Strategy 1: Try Google Places API to find tourist attractions
    // This finds the most popular tourist spot in the city, not the city center
    // Try multiple search strategies for better results
    const searchStrategies = [
      // Strategy 1a: Use description if available
      description && description.length > 0 
        ? `${description.split(' ').slice(0, 5).join(' ')}, ${place}`
        : null,
      // Strategy 1b: Known landmark mappings for popular places
      place.toLowerCase() === 'mysure' || place.toLowerCase() === 'mysuru' 
        ? 'Mysore Palace, Mysuru'
        : place.toLowerCase() === 'ooty' || place.toLowerCase() === 'udagamandalam'
        ? 'Ooty Botanical Gardens, Ooty'
        : place.toLowerCase() === 'munnar'
        ? 'Munnar Tea Gardens, Munnar'
        : place.toLowerCase() === 'tajmahal' || place.toLowerCase() === 'taj mahal'
        ? 'Taj Mahal, Agra'
        : null,
      // Strategy 1c: Tourist attraction + place name
      `tourist attraction ${place}`,
      // Strategy 1d: Popular places in [place]
      `popular places ${place}`,
      // Strategy 1e: Just the place name (Places API will find most popular attraction)
      place,
    ].filter(Boolean) as string[];

    for (const searchQuery of searchStrategies) {
      try {
        const queryWithCountry = countryCode ? `${searchQuery}, ${countryCode}` : searchQuery;
        
        if (__DEV__) {
          console.log(`🔍 Trying Places API search for ${place}:`, queryWithCountry);
        }

        // Use Places API Text Search to find tourist attractions
        const placesRes = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
          params: {
            query: queryWithCountry,
            key: GOOGLE_MAPS_API_KEY,
            // Don't restrict to tourist_attraction type - let it find any relevant place
          },
          timeout: 5000,
        });

        if (__DEV__) {
          console.log(`📡 Places API response for ${place}:`, {
            status: placesRes.data.status,
            resultsCount: placesRes.data.results?.length || 0,
            errorMessage: placesRes.data.error_message,
          });
        }

        if (placesRes.data.status === 'OK' && placesRes.data.results && placesRes.data.results.length > 0) {
          // Get the first result (most relevant)
          const placeResult = placesRes.data.results[0];
          const loc = placeResult.geometry?.location;
          
          if (loc && loc.lat && loc.lng) {
            const coords = { lat: loc.lat, lon: loc.lng };
            if (__DEV__) {
              console.log(`✅ Found place for ${place} via Places API:`, {
                name: placeResult.name,
                coords,
                query: queryWithCountry,
              });
            }
            // Cache the result in both global and component caches
            placesCache.set(cacheKey, { lat: coords.lat, lon: coords.lon, timestamp: Date.now() });
            if (cache) {
              cache.set(cacheKey, coords);
            }
            return coords;
          }
        } else if (placesRes.data.status === 'REQUEST_DENIED') {
          if (__DEV__) {
            console.log(`❌ Places API denied for ${place}. Error:`, placesRes.data.error_message);
            console.log(`💡 Make sure Places API, Distance Matrix API, and Geocoding API are enabled in Google Cloud Console for this API key`);
            console.log(`💡 Falling back to Geocoding API...`);
          }
          // Don't try other Places API strategies if API is denied, but continue to Geocoding API fallback
          break;
        } else if (placesRes.data.status === 'ZERO_RESULTS') {
          if (__DEV__) {
            console.log(`⚠️ No results for ${place} with query: ${queryWithCountry}`);
          }
          // Try next strategy
          continue;
        } else {
          if (__DEV__) {
            console.log(`⚠️ Places API returned status: ${placesRes.data.status} for ${place}`);
          }
          // Try next strategy
          continue;
        }
      } catch (placesError: any) {
        if (__DEV__) {
          console.log(`❌ Places API error for ${place} (query: ${searchQuery}):`, {
            message: placesError?.message,
            response: placesError?.response?.data,
          });
        }
        // Try next strategy
        continue;
      }
    }

    // Strategy 2: Fallback to Geocoding API with specific landmark addresses
    // Use landmark addresses for better accuracy than city center
    // All coordinates are fetched dynamically from geocoding API - no hardcoded values
    const landmarkAddresses: { [key: string]: string } = {
      'mysure': 'Mysore Palace, Sayyaji Rao Rd, Agrahara, Chamrajpura, Mysuru, Karnataka 570001, India',
      'mysuru': 'Mysore Palace, Sayyaji Rao Rd, Agrahara, Chamrajpura, Mysuru, Karnataka 570001, India',
      'ooty': 'Government Botanical Gardens, Ooty, Tamil Nadu 643001, India',
      'udagamandalam': 'Government Botanical Gardens, Ooty, Tamil Nadu 643001, India',
      'munnar': 'Tea Museum, Munnar, Kerala 685612, India',
      'tajmahal': 'Taj Mahal, Dharmapuri, Forest Colony, Tajganj, Agra, Uttar Pradesh 282001, India',
      'taj mahal': 'Taj Mahal, Dharmapuri, Forest Colony, Tajganj, Agra, Uttar Pradesh 282001, India',
      'lakshadweep': 'Kavaratti, Lakshadweep, India',
    };

    const geocodeStrategies = [
      // Try landmark address first if available (most specific)
      landmarkAddresses[place.toLowerCase()],
      // Try with description if available
      description && description.length > 0 
        ? `${description.split(' ').slice(0, 3).join(' ')}, ${place}${countryCode ? `, ${countryCode}` : ''}`
        : null,
      // Fallback to place name with country
      countryCode ? `${place}, ${countryCode}` : place,
    ].filter(Boolean) as string[];

    for (const address of geocodeStrategies) {
      try {
        if (__DEV__) {
          console.log(`🔍 Trying geocoding for ${place}:`, address);
        }

        const geocodeRes = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: {
            address: address,
            key: GOOGLE_MAPS_API_KEY,
          },
          timeout: 5000,
        });

        if (__DEV__) {
          console.log(`📡 Geocoding response for ${place}:`, {
            status: geocodeRes.data.status,
            resultsCount: geocodeRes.data.results?.length || 0,
            formattedAddress: geocodeRes.data.results?.[0]?.formatted_address,
          });
        }

        if (geocodeRes.data.status === 'OK' && geocodeRes.data.results && geocodeRes.data.results.length > 0) {
          // Find the most precise result
          // Priority: ROOFTOP > RANGE_INTERPOLATED > GEOMETRIC_CENTER > APPROXIMATE
          const locationTypePriority: { [key: string]: number } = {
            'ROOFTOP': 4,
            'RANGE_INTERPOLATED': 3,
            'GEOMETRIC_CENTER': 2,
            'APPROXIMATE': 1,
          };

          // Sort results by precision (most precise first)
          const sortedResults = geocodeRes.data.results
            .map((result: any) => ({
              result,
              priority: locationTypePriority[result.geometry?.location_type || 'APPROXIMATE'] || 0,
              isPartialMatch: result.partial_match === true,
            }))
            .sort((a: { priority: number; isPartialMatch: boolean }, b: { priority: number; isPartialMatch: boolean }) => {
              // First sort by priority (higher is better)
              if (b.priority !== a.priority) {
                return b.priority - a.priority;
              }
              // Then prefer non-partial matches
              if (a.isPartialMatch !== b.isPartialMatch) {
                return a.isPartialMatch ? 1 : -1;
              }
              return 0;
            });

          // Get the best result
          const bestResult = sortedResults[0]?.result;
          if (bestResult) {
            const loc = bestResult.geometry?.location;
            if (loc && loc.lat && loc.lng) {
              const locationType = bestResult.geometry?.location_type || 'UNKNOWN';
              const isPartialMatch = bestResult.partial_match === true;
              const precision = locationTypePriority[locationType] || 0;
              
              // Always use geocoded coordinates - no hardcoded values
              // GEOMETRIC_CENTER for landmarks is the center of the building/area, which is fine for distance calculation
              // ROOFTOP and RANGE_INTERPOLATED are high precision
              // Even APPROXIMATE is better than hardcoded values as it's dynamically fetched
              const coords = { lat: loc.lat, lon: loc.lng };
              const formattedAddress = bestResult.formatted_address || address;
              
              if (__DEV__) {
                const isLandmark = landmarkAddresses[place.toLowerCase()] === address;
                const precisionLabel = precision >= 4 ? 'HIGH (ROOFTOP)' : 
                                      precision >= 3 ? 'HIGH (RANGE_INTERPOLATED)' :
                                      precision >= 2 ? 'MEDIUM (GEOMETRIC_CENTER)' : 'LOW (APPROXIMATE)';
                console.log(`${isLandmark && precision >= 2 ? '✅' : '⚠️'} Using geocoded coordinates for ${place}:`, {
                  address: formattedAddress,
                  coords,
                  locationType,
                  isPartialMatch,
                  precision: precisionLabel,
                  isLandmark,
                });
              }
              
              // Cache the result in both global and component caches
              placesCache.set(cacheKey, { lat: coords.lat, lon: coords.lon, timestamp: Date.now() });
              if (cache) {
                cache.set(cacheKey, coords);
              }
              return coords;
            }
          }
        } else if (geocodeRes.data.status === 'ZERO_RESULTS') {
          if (__DEV__) {
            console.log(`⚠️ No geocoding results for ${place} with address: ${address}`);
          }
          // Try next strategy
          continue;
        } else {
          if (__DEV__) {
            console.log(`⚠️ Geocoding returned status: ${geocodeRes.data.status} for ${place}`);
          }
          // Try next strategy
          continue;
        }
      } catch (geocodeError: any) {
        if (__DEV__) {
          console.log(`❌ Geocoding error for ${place} (address: ${address}):`, {
            message: geocodeError?.message,
            response: geocodeError?.response?.data,
          });
        }
        // Try next strategy
        continue;
      }
    }

    // No hardcoded fallback - return null if all geocoding strategies fail
    // This ensures all coordinates are fetched dynamically from geocoding API
    return null;
  } catch (e: any) {
    if (__DEV__) {
      console.log('GEOCODE_FETCH_ERROR:', e?.message || e);
    }
    return null;
  }
};

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  date: string;
  postId?: string;
  imageUrl?: string;
}

interface FilterState {
  country: string;
  countryCode: string;
  stateProvince: string;
  stateCode: string;
  spotTypes: string[];
  searchRadius: string;
}

type FilterAction =
  | { type: 'SET_COUNTRY'; payload: { country: string; countryCode: string } }
  | { type: 'SET_STATE'; payload: { stateProvince: string; stateCode: string } }
  | { type: 'TOGGLE_SPOT_TYPE'; payload: string }
  | { type: 'SET_SEARCH_RADIUS'; payload: string }
  | { type: 'RESET' };

const filterReducer = (state: FilterState, action: FilterAction): FilterState => {
  switch (action.type) {
    case 'SET_COUNTRY':
      return { ...state, country: action.payload.country, countryCode: action.payload.countryCode, stateProvince: '', stateCode: '' };
    case 'SET_STATE':
      return { ...state, stateProvince: action.payload.stateProvince, stateCode: action.payload.stateCode };
    case 'TOGGLE_SPOT_TYPE':
      const spotTypes = state.spotTypes.includes(action.payload)
        ? state.spotTypes.filter(t => t !== action.payload)
        : [...state.spotTypes, action.payload];
      return { ...state, spotTypes };
    case 'SET_SEARCH_RADIUS':
      // Validate and sanitize search radius input
      const radiusValue = action.payload;
      // Allow empty string, numbers, and decimal points
      if (radiusValue === '' || /^[0-9]*\.?[0-9]*$/.test(radiusValue)) {
        return { ...state, searchRadius: radiusValue };
      }
      // Invalid input, don't update
      return state;
    case 'RESET':
      return {
        country: '',
        countryCode: '',
        stateProvince: '',
        stateCode: '',
        spotTypes: [],
        searchRadius: '',
      };
    default:
      return state;
  }
};

export default function LocaleScreen() {
  const { showSuccess, showError, showInfo } = useAlert();
  const { handleScroll } = useScrollToHideNav();
  const [savedLocales, setSavedLocales] = useState<Locale[]>([]);
  const [adminLocales, setAdminLocales] = useState<Locale[]>([]);
  const [filteredLocales, setFilteredLocales] = useState<Locale[]>([]);
  const [loadingLocales, setLoadingLocales] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState<string | null>(null);
  const [calculatingDistances, setCalculatingDistances] = useState(false);
  const [activeTab, setActiveTab] = useState<'locale' | 'saved'>('locale');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [filters, dispatchFilter] = useReducer(filterReducer, {
    country: '',
    countryCode: '',
    stateProvince: '',
    stateCode: '',
    spotTypes: [],
    searchRadius: '',
  });
  
  // Responsive dimensions (inside component to ensure they're accessible)
  const { width: screenWidth } = Dimensions.get('window');
  const isTabletLocal = screenWidth >= 768;
  const isWebLocal = Platform.OS === 'web';
  const isIOSLocal = Platform.OS === 'ios';
  const isAndroidLocal = Platform.OS === 'android';
  
  // Navigation & Lifecycle Safety: Track mounted state
  const isMountedRef = useRef(true);
  
  // Search Input Stability: Debounce timer and abort controller
  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const SEARCH_DEBOUNCE_MS = 350; // 300-400ms as specified
  
  // Pagination & Filter Race Safety: Request guards
  const isSearchingRef = useRef(false);
  const isPaginatingRef = useRef(false);
  const currentPageRef = useRef(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allLocalesWithDistances, setAllLocalesWithDistances] = useState<(Locale & { distanceKm?: number | null })[]>([]);
  const [displayedPage, setDisplayedPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  
  // Load guard: Prevent multiple loads per session
  const loadedOnceRef = useRef(false);
  
  // Distance Calculation Guards: Cache calculated distances per session
  const distanceCacheRef = useRef<Map<string, number>>(new Map());
  
  // Geocoding cache: Store geocoded coordinates for locales
  const geocodedCoordsCacheRef = useRef<Map<string, { latitude: number; longitude: number }>>(new Map());
  
  // Google Geocoding cache: Store real coordinates from Google Geocoding API
  const googleGeocodeCacheRef = useRef<Map<string, { lat: number; lon: number }>>(new Map());
  const geocodingInProgressRef = useRef<Set<string>>(new Set());
  
  // User's current location for distance calculation
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [userCountryCode, setUserCountryCode] = useState<string | null>(null);
  const [userState, setUserState] = useState<string | null>(null);
  const [userStateCode, setUserStateCode] = useState<string | null>(null);
  
  // Bookmark Stability: Track in-flight bookmark operations
  const bookmarkingKeysRef = useRef<Set<string>>(new Set());
  
  const { theme, mode } = useTheme();
  const router = useRouter();

  const spotTypeOptions = [
    'Historical spots',
    'Cultural spots',
    'Natural spots',
    'Adventure spots',
    'Religious/spiritual spots',
    'Wildlife spots',
    'Beach spots',
  ];

  // Get user's current location for distance calculation
  const getUserCurrentLocation = useCallback(async () => {
    // Skip location on web platform as it may not be fully supported
    if (isWeb) {
      logger.debug('Location services not available on web platform');
      setLocationPermissionGranted(false);
      return;
    }

    // Early return if component is unmounted
    if (!isMountedRef.current) {
      return;
    }

    try {
      // Check if location services are available
      let isLocationEnabled = false;
      try {
        isLocationEnabled = await Location.hasServicesEnabledAsync();
      } catch (serviceError) {
        logger.debug('Error checking location services:', serviceError);
        // Continue anyway - some Android devices might not support this check
      }

      if (!isLocationEnabled) {
        logger.debug('Location services are disabled on device');
        setLocationPermissionGranted(false);
        return;
      }

      // Request permissions with better error handling for Android
      let permissionStatus = 'undetermined';
      try {
        const permissionResult = await Location.requestForegroundPermissionsAsync();
        permissionStatus = permissionResult.status;
      } catch (permissionError) {
        logger.debug('Error requesting location permission:', permissionError);
        setLocationPermissionGranted(false);
        return;
      }

      if (permissionStatus !== 'granted') {
        logger.debug('Location permission denied, distance sorting will be unavailable');
        setLocationPermissionGranted(false);
        return;
      }
      
      setLocationPermissionGranted(true);
      
      // Get location with timeout protection and Android-specific handling
      // OPTIMIZATION: Use faster timeout and accept cached location for better UX
      let timeoutId: NodeJS.Timeout | null = null;
      let locationPromise: Promise<Location.LocationObject> | null = null;

      try {
        // Use lower accuracy for faster response (acceptable for distance sorting)
        const accuracy = isAndroid 
          ? Location.Accuracy.Low 
          : Location.Accuracy.Low; // Use Low for both platforms for faster response

        // Build options object - maximumAge is not directly supported, but we can use it via options
        const locationOptions: Location.LocationOptions = {
          accuracy,
        };
        
        // Add timeout via Promise.race instead (handled below)
        locationPromise = Location.getCurrentPositionAsync(locationOptions);

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Location request timeout'));
          }, isAndroid ? 10000 : 8000); // Match timeout above
        });

        const location = await Promise.race([locationPromise, timeoutPromise]);
        
        // Clear timeout if location was obtained
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        // Check if component is still mounted
        if (!isMountedRef.current) {
          return;
        }

        if (location && location.coords) {
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          
          // Validate coordinates
          if (
            typeof coords.latitude === 'number' &&
            typeof coords.longitude === 'number' &&
            !isNaN(coords.latitude) &&
            !isNaN(coords.longitude) &&
            coords.latitude >= -90 &&
            coords.latitude <= 90 &&
            coords.longitude >= -180 &&
            coords.longitude <= 180
          ) {
            if (isMountedRef.current) {
              setUserLocation(coords);
              // Invalidate distance cache if user moved significantly
              invalidateDistanceCacheIfMoved(coords.latitude, coords.longitude);
              logger.debug('✅ User location obtained for distance sorting:', coords);
              
              // CRITICAL FIX: Reverse geocode with FLAT promise chain to avoid Babel crash
              // No nested promises, no async functions inside callbacks
              // Extract to separate functions to avoid hoisting issues
              const tryGoogleReverseGeocode = function() {
                if (!isMountedRef.current) return;
                
                const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKey();
                if (!GOOGLE_MAPS_API_KEY) return;
                
                const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${GOOGLE_MAPS_API_KEY}`;
                
                fetch(googleUrl)
                  .then(function(googleResponse) {
                    return googleResponse.json();
                  })
                  .then(function(googleData) {
                    if (!isMountedRef.current) return;
                    if (googleData.status !== 'OK' || !googleData.results || googleData.results.length === 0) {
                      return;
                    }
                    
                    const googleResult = googleData.results[0];
                    let detectedState: string | null = null;
                    let detectedCountryCode: string | null = null;
                    let detectedCountry: string | null = null;
                    let detectedCity: string | null = null;
                    
                    if (googleResult.address_components) {
                      for (let i = 0; i < googleResult.address_components.length; i++) {
                        const component = googleResult.address_components[i];
                        if (component.types.includes('country') && component.short_name) {
                          detectedCountryCode = component.short_name.toUpperCase();
                          detectedCountry = component.long_name;
                        }
                        if (component.types.includes('administrative_area_level_1')) {
                          detectedState = component.long_name;
                        }
                        if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                          detectedCity = component.long_name;
                        }
                      }
                    }
                    
                    if (isMountedRef.current) {
                      if (detectedCountryCode) setUserCountryCode(detectedCountryCode);
                      if (detectedCountry) setUserCountry(detectedCountry);
                      if (detectedState) setUserState(detectedState);
                      if (detectedCity) setUserCity(detectedCity);
                    }
                    
                    if (__DEV__) {
                      logger.debug('📍 Google reverse geocode result:', {
                        detectedState: detectedState || 'NOT DETECTED',
                        detectedCountryCode: detectedCountryCode || 'NOT DETECTED',
                        detectedCity: detectedCity || 'NOT DETECTED'
                      });
                    }
                  })
                  .catch(function(googleError: any) {
                    if (__DEV__) {
                      logger.debug('⚠️ Google reverse geocoding error:', googleError);
                    }
                  });
              };
              
              const performReverseGeocode = function() {
                if (!isMountedRef.current) return;
                
                Location.reverseGeocodeAsync(coords)
                  .then(function(expoResults: Location.LocationGeocodedAddress[]) {
                    if (!isMountedRef.current) return;
                    if (!expoResults || expoResults.length === 0) {
                      tryGoogleReverseGeocode();
                      return;
                    }
                    
                    const result = expoResults[0];
                    let expoCity: string | null = null;
                    let expoCountry: string | null = null;
                    let expoCountryCode: string | null = null;
                    let expoState: string | null = null;
                    
                    if (result.city) expoCity = result.city;
                    if (result.country) expoCountry = result.country;
                    if (result.isoCountryCode) expoCountryCode = result.isoCountryCode.toUpperCase();
                    expoState = result.region || result.subregion || result.district || null;
                    
                    if (isMountedRef.current) {
                      if (expoCity) setUserCity(expoCity);
                      if (expoCountry) setUserCountry(expoCountry);
                      if (expoCountryCode) setUserCountryCode(expoCountryCode);
                      if (expoState) setUserState(expoState);
                    }
                    
                    if (__DEV__) {
                      logger.debug('📍 Expo reverse geocode result:', {
                        city: expoCity,
                        country: expoCountry,
                        countryCode: expoCountryCode,
                        region: expoState
                      });
                    }
                    
                    // If region not detected, try Google
                    if (!expoState) {
                      tryGoogleReverseGeocode();
                    }
                  })
                  .catch(function(expoError: any) {
                    if (__DEV__) {
                      logger.debug('⚠️ Expo reverse geocode failed:', expoError);
                    }
                    tryGoogleReverseGeocode();
                  });
              };
              
              // Start reverse geocoding
              performReverseGeocode();
            }
          } else {
            logger.warn('Invalid coordinates received:', coords);
            setLocationPermissionGranted(false);
          }
        } else {
          logger.warn('Location object missing coordinates');
          setLocationPermissionGranted(false);
        }
      } catch (locationError: any) {
        // Clear timeout on error
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        // Check if component is still mounted before setting state
        if (!isMountedRef.current) {
          return;
        }

        // Safely extract error message without causing Babel _construct issues
        let errorMessage = 'Unknown location error';
        try {
          if (locationError && typeof locationError === 'object') {
            // Handle CodedError and other Expo errors safely
            errorMessage = locationError.message || locationError.toString() || 'Location error';
          } else if (typeof locationError === 'string') {
            errorMessage = locationError;
          }
        } catch (e) {
          // If error extraction fails, use safe fallback
          errorMessage = 'Location request failed';
        }

        // Don't log timeout errors as errors - they're expected in some cases
        if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
          logger.debug('Location request timed out (this is normal on some devices)');
        } else if (errorMessage.includes('permission') || errorMessage.includes('denied') || errorMessage.includes('PERMISSION')) {
          logger.debug('Location permission denied or unavailable');
        } else {
          // Only log non-critical errors as debug to avoid Babel issues
          logger.debug('Location request failed:', errorMessage);
        }
        
        setLocationPermissionGranted(false);
      }
    } catch (error: any) {
      // Check if component is still mounted before setting state
      if (!isMountedRef.current) {
        return;
      }

      // Safely handle and log errors without causing Babel _construct issues
      let errorMessage = 'Unknown location error';
      try {
        if (error && typeof error === 'object') {
          // Handle CodedError and other Expo errors safely - avoid accessing complex properties
          errorMessage = error.message || error.toString() || 'Location error';
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
      } catch (e) {
        // If error extraction fails, use safe fallback
        errorMessage = 'Location error';
      }

      // Only log as debug to avoid Babel serialization issues with CodedError
      // CodedError objects can cause _construct errors when logged
      if (errorMessage.includes('permission') || errorMessage.includes('timeout') || errorMessage.includes('denied')) {
        logger.debug('[LocaleScreen] Location unavailable:', errorMessage);
      } else {
        // Log as debug instead of error to avoid Babel issues
        logger.debug('[LocaleScreen] Location request failed:', errorMessage);
      }
      
      setLocationPermissionGranted(false);
    }
  }, [isAndroid]);
  
  // Navigation & Lifecycle Safety: Setup and cleanup
  // CRITICAL: Fetch user location FIRST, then load locales for proper distance sorting
  useEffect(() => {
    isMountedRef.current = true;
    const startTime = Date.now();
    
    // CRITICAL: Fetch user location first (with retry), then load other data
    // This ensures locales can be sorted by distance immediately
    const initializeData = async () => {
      try {
        // First, try to get user location (with retry)
        let locationRetries = 0;
        const maxLocationRetries = 2;
        
        while (locationRetries < maxLocationRetries && isMountedRef.current) {
          try {
            await getUserCurrentLocation();
            // Small delay to allow state update
            await new Promise(resolve => setTimeout(resolve, 500));
            // Continue regardless - location will be used when available
            // The getUserCurrentLocation function sets the state internally
            break;
          } catch (error) {
            logger.debug(`Location fetch attempt ${locationRetries + 1} failed:`, error);
          }
          locationRetries++;
          if (locationRetries < maxLocationRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
          }
        }
        
        // Then load other data in parallel
        await Promise.allSettled([
      loadCountries(),
          loadSavedLocales()
        ]);
        
      const loadTime = Date.now() - startTime;
        logger.debug(`[PERF] Locale screen initial data loaded in ${loadTime}ms`);
      } catch (error) {
        logger.error('Error initializing data:', error);
      }
    };
    
    initializeData();
    
    // Load locales after initial data (depends on filters, but can start immediately)
    // Cache check happens in separate useEffect after functions are defined
    loadAdminLocales(true);
    
    return () => {
      isMountedRef.current = false;
      // Cancel any pending search requests
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
      // Clear debounce timer
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
    };
  }, [getUserCurrentLocation]);

  // Fetch key tracking to prevent duplicate fetches
  const lastFetchKeyRef = useRef<string | null>(null);
  
  // Location snapshot tracking - immutable snapshot of location context for sorting gate
  // Snapshot is created once when location context is complete and used for single sort
  const locationSnapshotRef = useRef<{
    lat: number;
    lon: number;
    city: string | null;
    region: string | null;
    countryCode: string | null;
    snapshotKey: string;
  } | null>(null);
  
  // CRITICAL: Single source of truth for sorted locales
  // This is the ONLY array that pagination should slice from
  // All UI state derives from this ref
  const allLocalesSortedRef = useRef<(Locale & { distanceKm?: number | null })[]>([]);
  
  // Track which locales have had driving distance calculated
  const drivingDistanceCalculatedRef = useRef<Set<string>>(new Set());
  
  // Generate location snapshot key - used to gate sorting
  // Returns null if location is not stable (missing lat/lon or countryCode)
  const getLocationSnapshotKey = useCallback((): string | null => {
    if (!userLocation || !locationPermissionGranted) {
      return null;
    }
    
    const lat = userLocation.latitude;
    const lon = userLocation.longitude;
    
    // Location snapshot is stable only if we have coordinates AND countryCode
    // city and region are optional but included in key for proper re-sorting when they become available
    if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon) && userCountryCode) {
      return `${lat.toFixed(4)}-${lon.toFixed(4)}-${userCity || 'x'}-${userState || 'x'}-${userCountryCode || 'x'}`;
    }
    
    return null;
  }, [userLocation, locationPermissionGranted, userCity, userState, userCountryCode]);
  
  // Create location snapshot when context is complete
  const createLocationSnapshot = useCallback((): {
    lat: number;
    lon: number;
    city: string | null;
    region: string | null;
    countryCode: string | null;
    snapshotKey: string;
  } | null => {
    const snapshotKey = getLocationSnapshotKey();
    if (!snapshotKey || !userLocation) {
      return null;
    }
    
    return {
      lat: userLocation.latitude,
      lon: userLocation.longitude,
      city: userCity || null,
      region: userState || null,
      countryCode: userCountryCode || null,
      snapshotKey
    };
  }, [getLocationSnapshotKey, userLocation, userCity, userState, userCountryCode]);
  
  // Pagination & Filter Race Safety: Load locales with request guards
  const loadAdminLocales = useCallback(async (forceRefresh = false) => {
    // Request Guard: Prevent duplicate calls
    if (isSearchingRef.current || isPaginatingRef.current) {
      logger.debug('loadAdminLocales already in progress, skipping');
      return;
    }
    
    // Load guard: If already loaded once and not forcing refresh, skip
    // BUT: Allow reload if we have locales but no distances (user location became available)
    const hasLocales = adminLocales.length > 0;
    const hasDistances = adminLocales.some(locale => {
      const localeWithDistance = locale as Locale & { distanceKm?: number | null };
      return localeWithDistance.distanceKm !== undefined && localeWithDistance.distanceKm !== null;
    });
    const needsDistanceCalculation = hasLocales && !hasDistances && userLocation && locationPermissionGranted;
    
    if (loadedOnceRef.current && !forceRefresh && hasLocales && !needsDistanceCalculation) {
      logger.debug('Locales already loaded once with distances, skipping unless force refresh');
      return;
    }
    
    // If we need to calculate distances for existing locales, reset the guard
    if (needsDistanceCalculation) {
      logger.debug('Locales loaded but distances missing, recalculating distances');
      loadedOnceRef.current = false;
    }
    
    // Generate fetch key from params (include stateCode for proper cache invalidation)
    const fetchKey = `${searchQuery}|${filters.countryCode}|${filters.stateCode}|${filters.spotTypes.join(',')}|${currentPageRef.current}`;
    
    // LAST FETCH KEY LOCK: If same key, return immediately
    if (!forceRefresh && fetchKey === lastFetchKeyRef.current) {
      logger.debug('loadAdminLocales skipped: same fetchKey', fetchKey);
      return;
    }
    
    // Update fetch key BEFORE starting fetch
    lastFetchKeyRef.current = fetchKey;
    
    isSearchingRef.current = true;
    
    // Cancel previous search request if any
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    searchAbortControllerRef.current = new AbortController();
    
    try {
      if (isMountedRef.current) {
        setLoadingLocales(true);
        setLoading(true);
      }
      
      // Reset pagination when filters change or force refresh
      if (forceRefresh) {
        currentPageRef.current = 1;
        setHasMore(false);
        setTotalPages(1);
        setDisplayedPage(1);
        setAllLocalesWithDistances([]); // Clear cached sorted locales
        allLocalesSortedRef.current = []; // Clear single source of truth
        drivingDistanceCalculatedRef.current.clear(); // Reset tracking
        locationSnapshotRef.current = null; // Reset location snapshot to allow re-sorting
      }
      
      // Build query parameters
      // CRITICAL FIX: When user location is available, fetch ALL locales by looping pages
      // Backend caps at 50 per page, so we must paginate client-side to get all locales
      const shouldFetchAll = userLocation && locationPermissionGranted && (forceRefresh || currentPageRef.current === 1);
      
      // Base params for all requests
      const baseParams: any = {
        includeInactive: false, // Only show active locales
      };
      
      // Add search query if provided
      if (searchQuery.trim()) {
        baseParams.search = searchQuery.trim();
      }
      
      // Add country filter if provided (only if not empty)
      if (filters.countryCode && filters.countryCode.trim() !== '' && filters.countryCode !== 'all') {
        baseParams.countryCode = filters.countryCode;
      }
      
      // Add state filter if provided (only if not empty)
      if (filters.stateCode && filters.stateCode.trim() !== '' && filters.stateCode !== 'all') {
        baseParams.stateCode = filters.stateCode;
      }
      
      // Add spot type filter if provided (send all selected spot types)
      const spotTypesParam = filters.spotTypes && filters.spotTypes.length > 0 
        ? filters.spotTypes 
        : '';
      
      // CRITICAL FIX: Fetch ALL locales by looping pages until exhausted
      let allFetchedLocales: Locale[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      const BACKEND_LIMIT = 50; // Backend hard caps at 50
      
      if (shouldFetchAll) {
        // Fetch all pages until exhausted
        while (hasMorePages && isMountedRef.current) {
      const response = await getLocales(
            baseParams.search || '',
            baseParams.countryCode || '',
            baseParams.stateCode || '',
        spotTypesParam,
            currentPage,
            BACKEND_LIMIT,
            baseParams.includeInactive
          );
          
          if (!isMountedRef.current) return;
          
          if (response && response.locales && response.locales.length > 0) {
            allFetchedLocales = [...allFetchedLocales, ...response.locales];
            
            // Check if there are more pages
            if (response.pagination) {
              hasMorePages = currentPage < (response.pagination.totalPages || 1);
              currentPage++;
            } else {
              hasMorePages = false;
            }
          } else {
            hasMorePages = false;
          }
        }
      } else {
        // Regular pagination (no location or subsequent pages)
        const response = await getLocales(
          baseParams.search || '',
          baseParams.countryCode || '',
          baseParams.stateCode || '',
          spotTypesParam,
          currentPageRef.current,
          20,
          baseParams.includeInactive
      );
      
      if (!isMountedRef.current) return;
      
      if (response && response.locales) {
          allFetchedLocales = response.locales;
          
          // Update pagination state
          if (response.pagination) {
            setTotalPages(response.pagination.totalPages || 1);
            setHasMore(currentPageRef.current < (response.pagination.totalPages || 1));
          }
        }
      }
      
      if (!isMountedRef.current) return;
      
      if (allFetchedLocales.length > 0) {
        // Deduplicate locales by unique ID
        const localeMap = new Map<string, Locale>();
        allFetchedLocales.forEach(locale => {
          if (!localeMap.has(locale._id)) {
            localeMap.set(locale._id, locale);
          }
        });
        const newLocales = Array.from(localeMap.values());
        
        // Guard: Skip distance calculation if no locales (prevents infinite loop on empty search results)
        // Only clear locales if this is a search query (not initial load)
        if (newLocales.length === 0) {
          if (isMountedRef.current) {
            // Only clear if there's an active search query, otherwise keep existing locales
            if (searchQuery.trim()) {
              // Search returned empty - clear results
              setAdminLocales([]);
              setFilteredLocales([]);
            }
            // If no search query, keep existing locales (don't clear on network issues)
            setCalculatingDistances(false);
            setLoadingLocales(false);
            setLoading(false);
            loadedOnceRef.current = true; // Mark as loaded to prevent reload loops
          }
          isSearchingRef.current = false;
          return;
        }
        
        // CRITICAL FIX: 3-Stage Distance Strategy for performance
        // Stage 1: Calculate straight-line distance for ALL locales, sort once, render immediately
        // Stage 2: Calculate driving distance ONLY for first N locales (background)
        // Stage 3: Calculate driving distance on-demand when user scrolls
        if (userLocation && locationPermissionGranted) {
          // STAGE 1: Calculate straight-line distances synchronously (fast, <300ms)
          const localesWithStraightLineDistance = newLocales.map((locale) => {
            if (locale.latitude && locale.longitude && 
                locale.latitude !== 0 && locale.longitude !== 0 &&
                !isNaN(locale.latitude) && !isNaN(locale.longitude) &&
                locale.latitude >= -90 && locale.latitude <= 90 &&
                locale.longitude >= -180 && locale.longitude <= 180) {
              const userLat = roundCoord(userLocation.latitude);
              const userLon = roundCoord(userLocation.longitude);
              const localeLat = roundCoord(locale.latitude);
              const localeLon = roundCoord(locale.longitude);
              
              const straightLineDistance = calculateDistance(
                userLat,
                userLon,
                localeLat,
                localeLon
              );
              return {
                ...locale,
                distanceKm: straightLineDistance,
              };
            }
            return {
              ...locale,
              distanceKm: null,
            };
          });

          // Get location snapshot for sorting
          const snapshot = createLocationSnapshot();
          
          if (!snapshot) {
            // Location snapshot not ready - store unsorted, will sort when snapshot becomes ready
            if (shouldFetchAll) {
              setAllLocalesWithDistances(localesWithStraightLineDistance);
              setLoadingLocales(false);
              setLoading(false);
              loadedOnceRef.current = true;
            }
            if (__DEV__) {
              logger.debug('⏳ Location snapshot not ready, storing locales unsorted. Will sort when snapshot becomes available.');
            }
            return;
          }
          
          // Sort once with straight-line distances (STAGE 1 complete)
          const sortedByStraightLine = sortLocalesWithSnapshot(localesWithStraightLineDistance, snapshot);
          
          // Store in single source of truth ref
          allLocalesSortedRef.current = sortedByStraightLine;
          drivingDistanceCalculatedRef.current.clear(); // Reset tracking
          
          // Render first page immediately (user sees results instantly)
          const firstPage = sortedByStraightLine.slice(0, ITEMS_PER_PAGE);
          setAllLocalesWithDistances(sortedByStraightLine);
          setAdminLocales(firstPage);
          setDisplayedPage(1);
          setHasMore(sortedByStraightLine.length > ITEMS_PER_PAGE);
          setTotalPages(Math.ceil(sortedByStraightLine.length / ITEMS_PER_PAGE));
          setLoadingLocales(false);
          setLoading(false);
          loadedOnceRef.current = true;

          // Update filtered locales
          const filtered = applyFilters(firstPage, false);
          setFilteredLocales(filtered);
          
          if (__DEV__) {
            logger.debug('✅ STAGE 1 complete: Straight-line distances calculated, sorted, first page rendered');
          }
          
          // STAGE 2: Calculate driving distance ONLY for first N locales (background, non-blocking)
          // N = ITEMS_PER_PAGE * 2 (e.g., 40 locales for 20 per page)
          const STAGE2_LIMIT = ITEMS_PER_PAGE * 2;
          const localesToCalculate = sortedByStraightLine.slice(0, STAGE2_LIMIT);
          
          if (localesToCalculate.length > 0 && shouldFetchAll) {
          setCalculatingDistances(true);
          
            // Process in batches to avoid rate limiting
            const BATCH_SIZE = 5;
            const updatedLocales = new Map<string, Locale & { distanceKm?: number | null }>();
            
            for (let i = 0; i < localesToCalculate.length; i += BATCH_SIZE) {
              if (!isMountedRef.current) break;
              
              const batch = localesToCalculate.slice(i, i + BATCH_SIZE);
            
            const batchResults = await Promise.allSettled(
              batch.map(async (locale) => {
                  // Skip if already calculated
                  if (drivingDistanceCalculatedRef.current.has(locale._id)) {
                    return locale;
                  }
                  
                let updatedLocale: Locale;
                
                  // Use coordinates from database if valid
                if (locale.latitude && locale.longitude && 
                    locale.latitude !== 0 && locale.longitude !== 0 &&
                    !isNaN(locale.latitude) && !isNaN(locale.longitude) &&
                    locale.latitude >= -90 && locale.latitude <= 90 &&
                    locale.longitude >= -180 && locale.longitude <= 180) {
                  updatedLocale = locale;
                } else {
                    // Try to fetch coordinates if missing
                  const realCoords = await fetchRealCoords(
                    locale.name, 
                    locale.countryCode,
                    googleGeocodeCacheRef.current,
                    locale.description
                  );
                  
                  if (realCoords) {
                    updatedLocale = {
                      ...locale,
                      latitude: realCoords.lat,
                      longitude: realCoords.lon,
                    };
                  } else {
                    updatedLocale = await geocodeLocale(locale);
                  }
                }

                const userLat = userLocation.latitude;
                const userLon = userLocation.longitude;
                const localeLat = updatedLocale.latitude;
                const localeLon = updatedLocale.longitude;
                
                  // Validate coordinates
                if (!localeLat || !localeLon || localeLat === 0 || localeLon === 0 ||
                    isNaN(localeLat) || isNaN(localeLon) ||
                    localeLat < -90 || localeLat > 90 || localeLon < -180 || localeLon > 180) {
                  return {
                    ...updatedLocale,
                      distanceKm: locale.distanceKm || null,
                  };
                }
                
                if (!userLat || !userLon || isNaN(userLat) || isNaN(userLon) ||
                    userLat < -90 || userLat > 90 || userLon < -180 || userLon > 180) {
                  return {
                    ...updatedLocale,
                      distanceKm: locale.distanceKm || null,
                  };
                }
                
                  // Calculate driving distance
                const distanceKm = await getLocaleDistanceKm(
                  updatedLocale._id.toString(),
                  userLat,
                  userLon,
                  localeLat,
                  localeLon
                );

                  drivingDistanceCalculatedRef.current.add(locale._id);

                return {
                  ...updatedLocale,
                    distanceKm: distanceKm || locale.distanceKm || null,
                };
              })
            );
            
              // Update distances in-place
            batchResults.forEach((result, index) => {
              if (result.status === 'fulfilled') {
                  updatedLocales.set(result.value._id, result.value);
              } else {
                logger.error(`Failed to process locale ${batch[index]?.name}:`, result.reason);
                  updatedLocales.set(batch[index]._id, batch[index]);
                }
              });
              
              // Small delay between batches
              if (i + BATCH_SIZE < localesToCalculate.length) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
          
          if (!isMountedRef.current) {
            setCalculatingDistances(false);
            isSearchingRef.current = false;
            return;
          }
          
            // Update distances in-place in the sorted array
            const updatedSorted = allLocalesSortedRef.current.map(locale => {
              const updated = updatedLocales.get(locale._id);
              return updated || locale;
            });
            
            // Re-sort ONCE with updated driving distances
            const reSorted = sortLocalesWithSnapshot(updatedSorted, snapshot);
            allLocalesSortedRef.current = reSorted;
            
            // Re-slice visible items from the top
            const currentVisibleCount = displayedPage * ITEMS_PER_PAGE;
            const visibleLocales = reSorted.slice(0, currentVisibleCount);
            
            setAllLocalesWithDistances(reSorted);
            setAdminLocales(visibleLocales);
            
            setCalculatingDistances(false);
            
          if (__DEV__) {
              logger.debug(`✅ STAGE 2 complete: Driving distances calculated for first ${STAGE2_LIMIT} locales`);
          }
          }
          
          return;
        } else {
          // No user location - sort by createdAt (newest first) as fallback
          const sortedByDate = [...newLocales].sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA;
          });
          
          if (forceRefresh || currentPageRef.current === 1) {
            setAdminLocales(sortedByDate);
          } else {
            setAdminLocales(prev => {
              const localeMap = new Map<string, Locale>();
              prev.forEach(locale => localeMap.set(locale._id, locale));
              sortedByDate.forEach(locale => localeMap.set(locale._id, locale));
              return Array.from(localeMap.values()).sort((a, b) => {
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
              });
            });
          }
            setLoadingLocales(false);
            setLoading(false);
          loadedOnceRef.current = true;
        }
      } else {
        // Response has no locales property or is empty
        // Only clear if there's an active search query, otherwise keep existing locales
        if (isMountedRef.current) {
          if (searchQuery.trim()) {
            // Search returned empty - clear results
            setAdminLocales([]);
            setFilteredLocales([]);
          }
          // If no search query, keep existing locales (don't clear on network issues)
          setCalculatingDistances(false);
          setLoadingLocales(false);
          setLoading(false);
          loadedOnceRef.current = true; // Mark as loaded to prevent reload loops on empty results
        }
        isSearchingRef.current = false;
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        logger.debug('loadAdminLocales aborted');
        if (isMountedRef.current) {
          setCalculatingDistances(false);
          setLoadingLocales(false);
          setLoading(false);
        }
        isSearchingRef.current = false;
        return;
      }
      if (!isMountedRef.current) return;
      logger.error('Failed to load admin locales', error);
      if (isMountedRef.current) {
        // On network error, only clear if there's an active search query
        // Otherwise, keep existing locales for offline support
        if (searchQuery.trim()) {
          // Search failed - clear search results
          setAdminLocales([]);
          setFilteredLocales([]);
        }
        // If no search query, keep existing locales (don't clear on network errors)
        setCalculatingDistances(false); // Hide loading overlay on error
        setLoadingLocales(false);
        setLoading(false);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingLocales(false);
        setLoading(false);
        setCalculatingDistances(false); // Ensure loading overlay is hidden
      }
      isSearchingRef.current = false;
    }
  }, [searchQuery, filters.countryCode, filters.stateCode, filters.spotTypes, userLocation, locationPermissionGranted]); // Safe dependencies - excludes adminLocales to prevent recreation loops

  const loadAdminLocalesRef = useRef(loadAdminLocales);
  loadAdminLocalesRef.current = loadAdminLocales;
  
  // Geocode locale if coordinates are missing
  const geocodeLocale = useCallback(async (locale: Locale): Promise<Locale> => {
    // If locale already has valid coordinates, return as is
    if (locale.latitude && locale.longitude && locale.latitude !== 0 && locale.longitude !== 0) {
      return locale;
    }
    
    // Check cache first
    const cacheKey = `${locale._id}-${locale.name}-${locale.countryCode}`;
    if (geocodedCoordsCacheRef.current.has(cacheKey)) {
      const coords = geocodedCoordsCacheRef.current.get(cacheKey)!;
      return { ...locale, latitude: coords.latitude, longitude: coords.longitude };
    }
    
    // Check if geocoding is already in progress for this locale
    if (geocodingInProgressRef.current.has(locale._id)) {
      return locale; // Return original locale, will be updated when geocoding completes
    }
    
    // Mark as in progress
    geocodingInProgressRef.current.add(locale._id);
    
    try {
      // Geocode using locale name and country code
      const geocodedCoords = await geocodeAddress(locale.name, locale.countryCode);
      
      if (geocodedCoords && geocodedCoords.latitude && geocodedCoords.longitude) {
        // Cache the coordinates
        geocodedCoordsCacheRef.current.set(cacheKey, geocodedCoords);
        
        // Return locale with coordinates
        const updatedLocale = { ...locale, latitude: geocodedCoords.latitude, longitude: geocodedCoords.longitude };
        
        // Update the locale in adminLocales state
        if (isMountedRef.current) {
          setAdminLocales(prev => prev.map(l => l._id === locale._id ? updatedLocale : l));
        }
        
        return updatedLocale;
      }
    } catch (error) {
      logger.error(`Error geocoding locale ${locale.name}:`, error);
    } finally {
      geocodingInProgressRef.current.delete(locale._id);
    }
    
    return locale;
  }, []);

  // Calculate distance for a locale (with caching and geocoding support)
  // Now uses distanceKm from locale object if available, otherwise calculates it
  const getLocaleDistance = useCallback((locale: Locale & { distanceKm?: number | null }): number | null => {
    // First check if distanceKm is already stored in locale object (from updated state)
    if (locale.distanceKm !== undefined && locale.distanceKm !== null) {
      return locale.distanceKm;
    }

    // Fallback: Calculate if not stored (for backwards compatibility)
    if (!userLocation) {
      return null;
    }
    
    // Use coordinates from locale (may be geocoded)
    const lat = locale.latitude;
    const lng = locale.longitude;
    
    if (!lat || !lng || lat === 0 || lng === 0) {
      return null;
    }
    
    // Use rounded coordinates for stable cache
    const userLat = roundCoord(userLocation.latitude);
    const userLon = roundCoord(userLocation.longitude);
    // Note: This is async but we can't make the callback async
    // So we'll calculate synchronously using straight-line as fallback
    // The main distance calculation happens in loadAdminLocales where we await
    const distanceKm = calculateDistance(userLat, userLon, lat, lng);
    
    return distanceKm;
  }, [userLocation]);
  
  // CRITICAL FIX: Single sorting function that uses location snapshot
  // This ensures sorting uses immutable location context, preventing race conditions
  const sortLocalesWithSnapshot = useCallback((
    locales: (Locale & { distanceKm?: number | null })[],
    snapshot: { lat: number; lon: number; city: string | null; region: string | null; countryCode: string | null }
  ): (Locale & { distanceKm?: number | null })[] => {
    const sorted = [...locales];
    
    if (__DEV__ && sorted.length > 0) {
      logger.debug('🔍 Single sort with snapshot:', {
        totalLocales: sorted.length,
        snapshotCity: snapshot.city || 'NOT DETECTED',
        snapshotRegion: snapshot.region || 'NOT DETECTED',
        snapshotCountryCode: snapshot.countryCode || 'NOT DETECTED'
      });
    }
    
    sorted.sort((a, b) => {
      const distanceA = (a as any).distanceKm;
      const distanceB = (b as any).distanceKm;
      
      // Get locale location details
      const aCity = a.city || '';
      const bCity = b.city || '';
      const aState = a.stateProvince || '';
      const bState = b.stateProvince || '';
      const aCountryCode = a.countryCode || '';
      const bCountryCode = b.countryCode || '';
      
      // Normalize names for comparison (case-insensitive, trimmed)
      const normalizedSnapshotCity = snapshot.city?.toLowerCase().trim() || '';
      const normalizedSnapshotRegion = snapshot.region?.toLowerCase().trim() || '';
      const normalizedACity = aCity.toLowerCase().trim();
      const normalizedBCity = bCity.toLowerCase().trim();
      const normalizedAState = aState.toLowerCase().trim();
      const normalizedBState = bState.toLowerCase().trim();
        
        // Only log sorting decisions in development and for specific problematic locales
        if (__DEV__ && sorted.length <= 5) {
          const shouldLog = (a.name && (a.name.includes('Lachen') || a.name.includes('Lachung') || a.name.includes('Chopta'))) ||
                          (b.name && (b.name.includes('Lachen') || b.name.includes('Lachung') || b.name.includes('Chopta')));
          
          if (shouldLog) {
            logger.debug('🔍 Sorting decision:', {
              aName: a.name,
              aState: normalizedAState || 'NO STATE',
              aDistance: distanceA,
              bName: b.name,
              bState: normalizedBState || 'NO STATE',
              bDistance: distanceB,
              snapshotRegion: normalizedSnapshotRegion || 'NOT SET',
              snapshotCity: normalizedSnapshotCity || 'NOT SET'
            });
          }
        }
        
      // Check if in same city (using snapshot)
      const aInSameCity = normalizedSnapshotCity && normalizedACity && 
                         (normalizedACity === normalizedSnapshotCity || 
                          normalizedACity.includes(normalizedSnapshotCity) || 
                          normalizedSnapshotCity.includes(normalizedACity));
      const bInSameCity = normalizedSnapshotCity && normalizedBCity && 
                         (normalizedBCity === normalizedSnapshotCity || 
                          normalizedBCity.includes(normalizedSnapshotCity) || 
                          normalizedSnapshotCity.includes(normalizedBCity));
      
      // Check if in same region/state (using snapshot, generic matching)
      let aInSameRegion = false;
      let bInSameRegion = false;
      
      if (normalizedSnapshotRegion && normalizedAState) {
        if (normalizedAState === normalizedSnapshotRegion) {
          aInSameRegion = true;
        } else if (normalizedAState.includes(normalizedSnapshotRegion) || normalizedSnapshotRegion.includes(normalizedAState)) {
          aInSameRegion = true;
        } else {
          const snapshotRegionWords = normalizedSnapshotRegion.split(/\s+/);
          const aStateWords = normalizedAState.split(/\s+/);
          const significantWords = snapshotRegionWords.filter(w => w.length > 2 && !['state', 'province', 'region'].includes(w));
          if (significantWords.some(word => aStateWords.some(aw => aw.includes(word) || word.includes(aw)))) {
            aInSameRegion = true;
          }
        }
      }
      
      if (normalizedSnapshotRegion && normalizedBState) {
        if (normalizedBState === normalizedSnapshotRegion) {
          bInSameRegion = true;
        } else if (normalizedBState.includes(normalizedSnapshotRegion) || normalizedSnapshotRegion.includes(normalizedBState)) {
          bInSameRegion = true;
        } else {
          const snapshotRegionWords = normalizedSnapshotRegion.split(/\s+/);
          const bStateWords = normalizedBState.split(/\s+/);
          const significantWords = snapshotRegionWords.filter(w => w.length > 2 && !['state', 'province', 'region'].includes(w));
          if (significantWords.some(word => bStateWords.some(bw => bw.includes(word) || word.includes(bw)))) {
            bInSameRegion = true;
          }
        }
      }
      
      // Check if in same country (using snapshot)
      const aInSameCountry = snapshot.countryCode && aCountryCode && 
                            aCountryCode.toUpperCase() === snapshot.countryCode.toUpperCase();
      const bInSameCountry = snapshot.countryCode && bCountryCode && 
                            bCountryCode.toUpperCase() === snapshot.countryCode.toUpperCase();
        
      // PRIORITY 1: Same city - sort by distance (nearest first)
      // CRITICAL: Null distances treated as Infinity (farthest possible)
      if (aInSameCity && bInSameCity) {
        const INFINITY = Number.POSITIVE_INFINITY;
        const effectiveDistanceA = (distanceA !== null && distanceA !== undefined && !isNaN(distanceA)) ? distanceA : INFINITY;
        const effectiveDistanceB = (distanceB !== null && distanceB !== undefined && !isNaN(distanceB)) ? distanceB : INFINITY;
        return effectiveDistanceA - effectiveDistanceB;
      }
      
      // PRIORITY 2: A in same city, B not - A comes first
      if (aInSameCity && !bInSameCity) {
          return -1;
        }
        
      // PRIORITY 3: B in same city, A not - B comes first
      if (bInSameCity && !aInSameCity) {
          return 1;
        }
        
      // PRIORITY 4: Same region/state (but different city) - sort by distance
      if (aInSameRegion && bInSameRegion) {
        const INFINITY = Number.POSITIVE_INFINITY;
        const effectiveDistanceA = (distanceA !== null && distanceA !== undefined && !isNaN(distanceA)) ? distanceA : INFINITY;
        const effectiveDistanceB = (distanceB !== null && distanceB !== undefined && !isNaN(distanceB)) ? distanceB : INFINITY;
        return effectiveDistanceA - effectiveDistanceB;
      }
      
      // PRIORITY 5: A in same region, B not - A comes first
      if (aInSameRegion && !bInSameRegion) {
        return -1;
      }
      
      // PRIORITY 6: B in same region, A not - B comes first
      if (bInSameRegion && !aInSameRegion) {
        return 1;
      }
      
      // PRIORITY 7: Same country (but different region) - sort by distance
      if (aInSameCountry && bInSameCountry) {
        const INFINITY = Number.POSITIVE_INFINITY;
        const effectiveDistanceA = (distanceA !== null && distanceA !== undefined && !isNaN(distanceA)) ? distanceA : INFINITY;
        const effectiveDistanceB = (distanceB !== null && distanceB !== undefined && !isNaN(distanceB)) ? distanceB : INFINITY;
        return effectiveDistanceA - effectiveDistanceB;
      }
      
      // PRIORITY 8: A in same country, B not - A comes first
      if (aInSameCountry && !bInSameCountry) {
        return -1;
      }
      
      // PRIORITY 9: B in same country, A not - B comes first
      if (bInSameCountry && !aInSameCountry) {
        return 1;
      }
      
      // PRIORITY 10: Different countries - sort by distance (nearest first)
      // CRITICAL: Null distances treated as Infinity (never rank above valid distances)
      const INFINITY = Number.POSITIVE_INFINITY;
      const effectiveDistanceA = (distanceA !== null && distanceA !== undefined && !isNaN(distanceA)) ? distanceA : INFINITY;
      const effectiveDistanceB = (distanceB !== null && distanceB !== undefined && !isNaN(distanceB)) ? distanceB : INFINITY;
      
      return effectiveDistanceA - effectiveDistanceB;
    });
    
    if (__DEV__ && sorted.length > 0) {
      const firstFew = sorted.slice(0, 5).map(l => ({
        name: l.name,
        city: l.city || 'N/A',
        state: l.stateProvince || 'N/A',
        distance: (l as any).distanceKm
      }));
      logger.debug('✅ Single sort complete - first 5 locales:', firstFew);
    }
    
    return sorted;
  }, []);
  
  // Legacy sorting function (kept for backward compatibility, but should not be used)
  // CRITICAL FIX: This function should NOT be called - use sortLocalesWithSnapshot instead
  const sortLocalesByDistance = useCallback((locales: Locale[]): Locale[] => {
    // This is a fallback that should not be used in the new flow
    // It's kept for compatibility with existing code that may still call it
    const snapshot = createLocationSnapshot();
    if (snapshot) {
      return sortLocalesWithSnapshot(locales as (Locale & { distanceKm?: number | null })[], snapshot);
    }
    
    // Fallback: sort by createdAt if no snapshot
    return [...locales].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [createLocationSnapshot, sortLocalesWithSnapshot]);
  
  // Bookmark Stability: Load saved locales with defensive parsing
  const loadSavedLocales = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const saved = await AsyncStorage.getItem('savedLocales');
      
      // Defensive JSON parsing with recovery
      let locales: Locale[] = [];
      try {
        if (saved) {
          const parsed = JSON.parse(saved);
          locales = Array.isArray(parsed) ? parsed : [];
        }
      } catch (parseError) {
        logger.warn('Failed to parse savedLocales, resetting', parseError);
        // Recover corrupted storage by resetting
        try {
          await AsyncStorage.setItem('savedLocales', JSON.stringify([]));
        } catch {}
        locales = [];
      }
      
      // Deduplicate by locale ID
      const localeMap = new Map<string, Locale>();
      locales.forEach(locale => {
        if (locale && locale._id) {
          localeMap.set(locale._id, locale);
        }
      });
      const uniqueLocales = Array.from(localeMap.values());
      
      // Calculate driving distances for saved locales if user location is available
      let localesWithDistances = uniqueLocales;
      if (userLocation && locationPermissionGranted) {
        const userLat = roundCoord(userLocation.latitude);
        const userLon = roundCoord(userLocation.longitude);
        localesWithDistances = await Promise.all(
          uniqueLocales.map(async (locale) => {
            const distanceKm = await getLocaleDistanceKm(
              locale._id.toString(),
              userLat,
              userLon,
              locale.latitude,
              locale.longitude
            );
            return {
              ...locale,
              distanceKm: distanceKm,
            };
          })
        );
      }
      
      // PRODUCTION-GRADE: Sort saved locales by distance (nearest first)
      // This ensures consistent sorting across all locale lists
      const sortedLocales = sortLocalesByDistance(localesWithDistances);
      
      if (isMountedRef.current) {
        setSavedLocales(sortedLocales);
        
        // Update AsyncStorage if duplicates were found
        if (uniqueLocales.length !== locales.length) {
          try {
            await AsyncStorage.setItem('savedLocales', JSON.stringify(sortedLocales));
          } catch {}
        }
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      logger.error('Error loading saved locales', error);
      setSavedLocales([]);
    }
  }, [sortLocalesByDistance]);
  
  // Apply client-side filters (for spot types that API doesn't support and saved locales)
  const applyFilters = useCallback((locales: Locale[], isSavedTab = false) => {
    let filtered = [...locales];
    
    // Filter by country (for saved locales - API handles this for locale tab)
    if (filters.countryCode && filters.countryCode.trim() !== '' && isSavedTab) {
      filtered = filtered.filter(locale => 
        locale.countryCode && locale.countryCode.toUpperCase() === filters.countryCode.toUpperCase()
      );
    }
    
    // Filter by state/province (for saved locales - API handles this for locale tab)
    // Handle optional state fields: match by stateCode or stateProvince
    if (filters.stateCode && filters.stateCode.trim() !== '' && isSavedTab) {
      filtered = filtered.filter(locale => {
        // If locale has stateCode, match exactly
        if (locale.stateCode && locale.stateCode.trim() !== '') {
          return locale.stateCode === filters.stateCode || 
                 locale.stateCode.toUpperCase() === filters.stateCode.toUpperCase();
        }
        // If locale has stateProvince, match by name (case-insensitive)
        if (locale.stateProvince && locale.stateProvince.trim() !== '') {
          return locale.stateProvince.toLowerCase() === filters.stateProvince.toLowerCase() ||
                 locale.stateProvince.toLowerCase().includes(filters.stateProvince.toLowerCase());
        }
        // If locale has no state info, exclude it when state filter is applied
        return false;
      });
    }
    
    // Filter by spot types (if multiple selected, show locales that match any)
    if (filters.spotTypes && filters.spotTypes.length > 0) {
      filtered = filtered.filter(locale => 
        locale.spotTypes && locale.spotTypes.some(type => filters.spotTypes.includes(type))
      );
    }
    
    // Filter by search query (client-side for saved, or when not using API)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(locale =>
        locale.name.toLowerCase().includes(query) ||
        locale.description?.toLowerCase().includes(query) ||
        locale.countryCode.toLowerCase().includes(query) ||
        locale.stateProvince?.toLowerCase().includes(query)
      );
    }
    
    // Filter by search radius (if user location available)
    if (filters.searchRadius && filters.searchRadius.trim() !== '') {
      const radiusKm = parseFloat(filters.searchRadius.trim());
      if (!isNaN(radiusKm) && radiusKm > 0 && isFinite(radiusKm)) {
        // Check if user location is available
        if (!userLocation || !locationPermissionGranted) {
          logger.warn(`Search radius filter requires location permission. userLocation: ${!!userLocation}, permission: ${locationPermissionGranted}`);
          // If location is not available, exclude all locales to show empty state
          // This prompts user to enable location
          filtered = [];
        } else {
          const beforeCount = filtered.length;
          filtered = filtered.filter(locale => {
            try {
              // Check if locale has coordinates
              if (!locale.latitude || !locale.longitude || locale.latitude === 0 || locale.longitude === 0) {
                // Exclude locales without coordinates when radius filter is active
                return false;
              }
              
              const distance = getLocaleDistance(locale);
              if (distance === null) {
                // Exclude if distance cannot be calculated
                return false;
              }
              
              const isWithinRadius = distance <= radiusKm;
              return isWithinRadius;
            } catch (error) {
              logger.error('Error calculating distance for locale:', error);
              return false; // Exclude if distance calculation fails
            }
          });
          
          const afterCount = filtered.length;
          logger.debug(`Search radius filter: ${beforeCount} locales before, ${afterCount} locales after (radius: ${radiusKm}km, userLocation: ${userLocation.latitude},${userLocation.longitude})`);
        }
      } else {
        logger.warn(`Invalid search radius value: ${filters.searchRadius}`);
      }
    }
    
    // PRODUCTION-GRADE: Sort ONLY by distance (nearest first)
    // Admin displayOrder is completely ignored - user's location determines order
    // Use shared sorting function for consistency
    const sorted = sortLocalesByDistance(filtered);
    
    return sorted;
  }, [filters, searchQuery, sortLocalesByDistance, userLocation, locationPermissionGranted, getLocaleDistance]);
  
  // Memoized filtered saved locales for performance
  const filteredSavedLocales = useMemo(() => {
    if (activeTab === 'saved' && savedLocales.length > 0) {
      return applyFilters(savedLocales, true);
    }
    return savedLocales;
  }, [savedLocales, filters, searchQuery, activeTab, applyFilters, userLocation, locationPermissionGranted, calculatingDistances]);

  // Memoized sorted admin locales - always sorted by distance (or createdAt if no location)
  // This ensures locales are always in the correct order for display
  // CRITICAL: Include userState in dependencies so sorting updates when state is detected
  const sortedAdminLocales = useMemo(() => {
    if (adminLocales.length === 0) return [];
    // Always sort adminLocales by distance (nearest first) or createdAt if no location
    const sorted = sortLocalesByDistance([...adminLocales]);
    
    // Debug logging to verify sorting
    if (__DEV__ && sorted.length > 0 && userState) {
      const firstFew = sorted.slice(0, 5).map(l => ({
        name: l.name,
        state: l.stateProvince,
        distance: (l as any).distanceKm,
        country: l.countryCode
      }));
      logger.debug('📍 Sorted locales (first 5):', {
        userState,
        userCity,
        userCountryCode,
        firstFew
      });
    }
    
    return sorted;
  }, [adminLocales, sortLocalesByDistance, userState, userCity, userCountryCode]);

  // Update filtered locales when adminLocales change (but NOT when filters/searchQuery change - handled in loadAdminLocales)
  // Also apply client-side filters for multiple spot types and search radius which require client-side processing
  useEffect(() => {
    if (activeTab === 'locale' && sortedAdminLocales.length > 0) {
      // Apply client-side filters for:
      // - Multiple spot types (API supports this, but we also apply client-side for consistency)
      // - Search radius (requires user location, client-side only)
      const filtered = applyFilters(sortedAdminLocales, false);
      setFilteredLocales(filtered);
    } else {
      setFilteredLocales([]);
    }
  }, [sortedAdminLocales, applyFilters, activeTab, filters.spotTypes, filters.searchRadius, userLocation, locationPermissionGranted]);

  // Re-sort locales when user location becomes available or changes
  // This ensures sorting works even if location becomes available after locales are loaded
  // Also recalculates distances if they're missing
  useEffect(() => {
    if (activeTab === 'locale' && adminLocales.length > 0) {
      // Check if we have locales but no distances, and user location is now available
      const hasDistances = adminLocales.some(locale => {
        const localeWithDistance = locale as Locale & { distanceKm?: number | null };
        return localeWithDistance.distanceKm !== undefined && localeWithDistance.distanceKm !== null;
      });
      
      // If user location just became available and we don't have distances, reload to calculate them
      // Guard: Only reload if not currently calculating and not searching
      if (userLocation && locationPermissionGranted && !hasDistances && !isSearchingRef.current && !calculatingDistances) {
        logger.debug('User location available but distances missing, reloading locales to calculate distances');
        loadedOnceRef.current = false; // Reset guard to allow reload
        loadAdminLocales(true).catch(err => {
          logger.error('Error reloading locales for distance calculation:', err);
        });
        return;
      }
      
      // Re-apply filters to trigger distance-based sorting when location becomes available
      // This will re-sort using the updated userLocation (or fallback to createdAt if not available)
      // Use sortedAdminLocales to ensure proper sorting
      const filtered = applyFilters(sortedAdminLocales, false);
      setFilteredLocales(filtered);
    }
  }, [userLocation, locationPermissionGranted, sortedAdminLocales, applyFilters, activeTab, loadAdminLocales, calculatingDistances]);
  
  // CRITICAL FIX: Single sorting entry point - sorts when location snapshot becomes ready
  // This ensures sorting happens exactly once per snapshotKey when all conditions are met
  useEffect(() => {
    // Only proceed if:
    // 1. We're on the locale tab
    // 2. We have locales with distances to sort
    // 3. Location snapshot is ready (has lat/lon + countryCode)
    if (activeTab !== 'locale' || allLocalesWithDistances.length === 0) {
      return;
    }
    
    // Check if locales have distances (at least straight-line)
    const hasDistances = allLocalesWithDistances.some(locale => {
      const localeWithDistance = locale as Locale & { distanceKm?: number | null };
      return localeWithDistance.distanceKm !== undefined && localeWithDistance.distanceKm !== null;
    });
    
    if (!hasDistances) {
      // Distances not calculated yet - wait
      return;
    }
    
    const snapshot = createLocationSnapshot();
    
    // Skip if location snapshot is not ready yet
    if (!snapshot) {
      return;
    }
    
    // Skip if we already sorted with this exact snapshot key
    if (locationSnapshotRef.current?.snapshotKey === snapshot.snapshotKey) {
      return;
    }
    
    // Location snapshot is ready and has changed - perform SINGLE sort
    if (__DEV__) {
      logger.debug('🔐 Location snapshot ready, performing single sort:', {
        previousKey: locationSnapshotRef.current?.snapshotKey || 'none',
        currentKey: snapshot.snapshotKey,
        snapshotCity: snapshot.city || 'NOT DETECTED',
        snapshotRegion: snapshot.region || 'NOT DETECTED',
        snapshotCountryCode: snapshot.countryCode || 'NOT DETECTED',
        totalLocales: allLocalesWithDistances.length
      });
    }
    
    // SINGLE SORT: Sort exactly once with complete location snapshot
    const finalSorted = sortLocalesWithSnapshot(allLocalesWithDistances, snapshot);
    
    // Log first few to verify sorting (only in dev)
    if (finalSorted.length > 0 && __DEV__) {
      const firstFew = finalSorted.slice(0, 10).map(l => ({
        name: l.name,
        city: l.city || 'N/A',
        state: l.stateProvince || 'N/A',
        distance: (l as any).distanceKm,
        country: l.countryCode
      }));
      logger.debug('✅ Single sort complete (first 10):', {
        snapshotKey: snapshot.snapshotKey,
        firstFew
      });
    }
    
    // FINAL STATE UPDATE: Update state exactly once after sorting
    locationSnapshotRef.current = snapshot;
    
    // Store in single source of truth ref
    allLocalesSortedRef.current = finalSorted;
    
    // CACHE: Persist sorted data for instant restore on back navigation
    localeCache.set(finalSorted, snapshot);
    
    setAllLocalesWithDistances(finalSorted);
    
    // Update displayed locales by slicing from single source of truth
    const firstPage = allLocalesSortedRef.current.slice(0, ITEMS_PER_PAGE);
    setAdminLocales(firstPage);
    setDisplayedPage(1);
    setHasMore(allLocalesSortedRef.current.length > ITEMS_PER_PAGE);
    setTotalPages(Math.ceil(allLocalesSortedRef.current.length / ITEMS_PER_PAGE));
    
    // Also update filtered locales
    const filtered = applyFilters(firstPage, false);
    setFilteredLocales(filtered);
  }, [activeTab, allLocalesWithDistances, createLocationSnapshot, sortLocalesWithSnapshot, applyFilters]);

  // CACHE CHECK: Restore from cache on mount (prevents refetch on back navigation)
  // This runs after createLocationSnapshot and applyFilters are defined
  useEffect(() => {
    if (activeTab !== 'locale' || adminLocales.length > 0) {
      // Skip if not on locale tab or already have data
      return;
    }
    
    // Check cache before fetching
    const snapshot = createLocationSnapshot();
    if (snapshot && localeCache.isValid(snapshot.snapshotKey)) {
      const cached = localeCache.get();
      if (cached) {
        logger.debug('✅ Restoring locales from cache on mount (instant restore)');
        // Restore instantly from cache
        allLocalesSortedRef.current = cached.locales;
        setAllLocalesWithDistances(cached.locales);
        const firstPage = cached.locales.slice(0, ITEMS_PER_PAGE);
        setAdminLocales(firstPage);
        setDisplayedPage(1);
        setHasMore(cached.locales.length > ITEMS_PER_PAGE);
        setTotalPages(Math.ceil(cached.locales.length / ITEMS_PER_PAGE));
        locationSnapshotRef.current = cached.snapshot;
        setLoadingLocales(false);
        setLoading(false);
        // Apply filters to first page
        const filtered = applyFilters(firstPage, false);
        setFilteredLocales(filtered);
        // Skip loadAdminLocales since we restored from cache
        return;
      }
    }
  }, [activeTab, createLocationSnapshot, applyFilters, adminLocales.length]);

  useEffect(() => {
    // Reload saved locales when tab changes
    if (activeTab === 'saved') {
      loadSavedLocales();
    }
  }, [activeTab]);

  // Listen for bookmark changes from detail page
  useEffect(() => {
    const unsubscribe = savedEvents.addListener(() => {
      // Reload saved locales (lightweight operation)
      loadSavedLocales();
      // DO NOT reload admin locales here - it causes loops
      // Bookmark status is handled client-side, no need to refetch
    });
    return unsubscribe;
  }, [loadSavedLocales]);

  // Navigation & Lifecycle Safety: Refresh bookmark status on focus (prevent refetch loops)
  useFocusEffect(
    useCallback(() => {
      if (!isMountedRef.current) return;
      
      // Only refresh saved locales (lightweight)
      loadSavedLocales();
      
      // CACHE CHECK: Restore from cache if available (prevents refetch on back navigation)
      const snapshot = createLocationSnapshot();
      if (snapshot && localeCache.isValid(snapshot.snapshotKey)) {
        const cached = localeCache.get();
        if (cached && adminLocales.length === 0) {
          // Only restore if we don't have data in state (fresh mount)
          logger.debug('✅ Restoring locales from cache on focus (instant restore)');
          allLocalesSortedRef.current = cached.locales;
          setAllLocalesWithDistances(cached.locales);
          const firstPage = cached.locales.slice(0, ITEMS_PER_PAGE);
          setAdminLocales(firstPage);
          setDisplayedPage(1);
          setHasMore(cached.locales.length > ITEMS_PER_PAGE);
          setTotalPages(Math.ceil(cached.locales.length / ITEMS_PER_PAGE));
          locationSnapshotRef.current = cached.snapshot;
          setLoadingLocales(false);
          setLoading(false);
          const filtered = applyFilters(firstPage, false);
          setFilteredLocales(filtered);
          return; // Skip fetch if cache restored
        }
      }
      
      // Always load admin locales on focus if:
      // 1. We have no data (initial load), OR
      // 2. We have data but no distances calculated (user location became available)
      const hasLocales = adminLocales.length > 0;
      const hasDistances = adminLocales.some(locale => {
        const localeWithDistance = locale as Locale & { distanceKm?: number | null };
        return localeWithDistance.distanceKm !== undefined && localeWithDistance.distanceKm !== null;
      });
      const shouldLoad = !hasLocales || (hasLocales && !hasDistances && userLocation && locationPermissionGranted);
      
      // Guard: Prevent reload when only filters changed (load only on Search button or initial/focus restore)
      if (shouldLoad && !isSearchingRef.current && !calculatingDistances) {
        if (hasLocales && !hasDistances) {
          loadedOnceRef.current = false;
        }
        loadAdminLocalesRef.current(true);
      }
    }, [loadSavedLocales, adminLocales, userLocation, locationPermissionGranted, createLocationSnapshot, applyFilters]) // Exclude loadAdminLocales so filter changes don't re-run effect
  );

  // Bookmark Stability: Atomic read-modify-write with deduplication
  const saveLocale = useCallback(async (locale: Locale) => {
    if (!locale || !locale._id) {
      logger.warn('Invalid locale provided to saveLocale');
      return;
    }
    
    const localeId = locale._id;
    
    // Bookmark Stability: Prevent duplicate bookmark operations
    if (bookmarkingKeysRef.current.has(localeId)) {
      logger.debug(`Bookmark operation already in progress for ${localeId}, skipping`);
      return;
    }
    
    bookmarkingKeysRef.current.add(localeId);
    
    try {
      // Atomic read-modify-write
      const saved = await AsyncStorage.getItem('savedLocales');
      let locales: Locale[] = [];
      
      try {
        if (saved) {
          const parsed = JSON.parse(saved);
          locales = Array.isArray(parsed) ? parsed : [];
        }
      } catch (parseError) {
        logger.warn('Failed to parse savedLocales in saveLocale, resetting', parseError);
        locales = [];
      }
      
      // Deduplicate: Check if already saved
      if (locales.find(l => l && l._id === localeId)) {
        if (isMountedRef.current) {
          showInfo('This locale is already in your saved list', 'Already Saved');
        }
        return;
      }
      
      // Add new locale
      locales.push(locale);
      
      // Deduplicate all locales before saving
      const localeMap = new Map<string, Locale>();
      locales.forEach(l => {
        if (l && l._id) {
          localeMap.set(l._id, l);
        }
      });
      const uniqueLocales = Array.from(localeMap.values());
      
      // PRODUCTION-GRADE: Sort by distance (nearest first) before saving
      const sortedLocales = sortLocalesByDistance(uniqueLocales);
      
      // Atomic write
      await AsyncStorage.setItem('savedLocales', JSON.stringify(sortedLocales));
      
      if (isMountedRef.current) {
        setSavedLocales(sortedLocales);
        // Emit event to sync with detail page
        savedEvents.emitChanged();
        showSuccess('Locale saved successfully', 'Saved');
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      logger.error('Error saving locale', error);
      showError('Failed to save locale');
    } finally {
      bookmarkingKeysRef.current.delete(localeId);
    }
  }, [sortLocalesByDistance, showSuccess, showError, showInfo]);
  
  // Bookmark Stability: Atomic read-modify-write
  const unsaveLocale = useCallback(async (localeId: string) => {
    if (!localeId) {
      logger.warn('Invalid localeId provided to unsaveLocale');
      return;
    }
    
    // Bookmark Stability: Prevent duplicate bookmark operations
    if (bookmarkingKeysRef.current.has(localeId)) {
      logger.debug(`Unbookmark operation already in progress for ${localeId}, skipping`);
      return;
    }
    
    bookmarkingKeysRef.current.add(localeId);
    
    try {
      // Atomic read-modify-write
      const saved = await AsyncStorage.getItem('savedLocales');
      let locales: Locale[] = [];
      
      try {
        if (saved) {
          const parsed = JSON.parse(saved);
          locales = Array.isArray(parsed) ? parsed : [];
        }
      } catch (parseError) {
        logger.warn('Failed to parse savedLocales in unsaveLocale, resetting', parseError);
        locales = [];
      }
      
      // Remove locale
      const filtered = locales.filter(l => l && l._id !== localeId);
      
      // PRODUCTION-GRADE: Sort by distance (nearest first) after removal
      const sortedLocales = sortLocalesByDistance(filtered);
      
      // Atomic write
      await AsyncStorage.setItem('savedLocales', JSON.stringify(sortedLocales));
      
      if (isMountedRef.current) {
        setSavedLocales(sortedLocales);
        // Emit event to sync with detail page
        savedEvents.emitChanged();
        showSuccess('Locale removed from saved list', 'Removed');
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      logger.error('Error unsaving locale', error);
      showError('Failed to remove locale');
    } finally {
      bookmarkingKeysRef.current.delete(localeId);
    }
  }, [sortLocalesByDistance, showSuccess, showError]);
  
  const isLocaleSaved = (localeId: string): boolean => {
    return savedLocales.some(l => l._id === localeId);
  };

  const loadCountries = async () => {
    if (!isMountedRef.current) return;
    
    try {
      if (isMountedRef.current) {
        setLoadingCountries(true);
      }
      
      const countriesData = await getCountries();
      
      if (!isMountedRef.current) return;
      
      setCountries(Array.isArray(countriesData) ? countriesData : []);
      
      // Load states only if a country is selected
      if (countriesData && countriesData.length > 0 && filters.countryCode && filters.countryCode.trim() !== '') {
        await loadStatesForCountry(filters.countryCode);
      } else {
        // Clear states if no country selected
        if (isMountedRef.current) {
          setStates([]);
        }
      }
    } catch (error) {
      logger.error('Error loading countries:', error);
      if (isMountedRef.current) {
        // Countries will be loaded from static data automatically
        setStates([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingCountries(false);
      }
    }
  };

  const loadStatesForCountry = async (countryCode: string) => {
    if (!isMountedRef.current || !countryCode || countryCode.trim() === '') {
      if (isMountedRef.current) {
        setStates([]);
        setLoadingStates(false);
      }
      return;
    }
    
    // Create a timeout promise to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('States loading timeout')), 10000); // 10 second timeout
    });
    
    try {
      if (isMountedRef.current) {
        setLoadingStates(true);
      }
      
      // Race between the actual API call and timeout
      const statesData = await Promise.race([
        getStatesByCountry(countryCode),
        timeoutPromise
      ]);
      
      if (!isMountedRef.current) return;
      
      // Validate and set states
      const validStates = Array.isArray(statesData) ? statesData : [];
      setStates(validStates);
      
      // If no states found, show a message
      if (validStates.length === 0) {
        logger.debug(`No states/provinces available for country code: ${countryCode}`);
      } else {
        logger.debug(`Loaded ${validStates.length} states for ${countryCode}`);
      }
    } catch (error: any) {
      logger.error(`Error loading states for ${countryCode}:`, error);
      if (isMountedRef.current) {
        // Set empty array on error to prevent UI issues
        setStates([]);
        // Don't show error to user, just log it
        if (error.message === 'States loading timeout') {
          logger.warn(`States loading timed out for ${countryCode}`);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingStates(false);
      }
    }
  };

  const handleCountrySelect = async (country: Country) => {
    if (!isMountedRef.current || !country || !country.code) {
      return;
    }
    
    try {
      setShowCountryDropdown(false);
      setCountrySearchQuery('');
      if (isMountedRef.current) {
        setStates([]);
        setShowStateDropdown(false);
        setLoadingStates(false);
      }
      // Only update filter state; do not trigger list load (load only on Search button)
      dispatchFilter({ type: 'SET_COUNTRY', payload: { country: country.name, countryCode: country.code } });
    } catch (error) {
      logger.error('Error selecting country:', error);
      if (isMountedRef.current) {
        setShowCountryDropdown(false);
        setShowStateDropdown(false);
        setStates([]);
        setLoadingStates(false);
      }
    }
  };

  const handleStateSelect = (state: State) => {
    if (!isMountedRef.current || !state) return;
    try {
      dispatchFilter({ type: 'SET_STATE', payload: { stateProvince: state.name, stateCode: state.code } });
      setShowStateDropdown(false);
      setStateSearchQuery('');
    } catch (error) {
      logger.error('Error selecting state:', error);
      if (isMountedRef.current) {
        setShowStateDropdown(false);
      }
    }
  };

  // Load More handler for pagination with STAGE 3: On-demand driving distance calculation
  const handleLoadMore = useCallback(async () => {
    if (isPaginatingRef.current || loadingMore || !hasMore || loadingLocales) {
      return;
    }
    
    // CRITICAL: Always paginate from single source of truth
    if (allLocalesSortedRef.current.length > 0 && userLocation && locationPermissionGranted) {
      const nextPage = displayedPage + 1;
      const startIndex = displayedPage * ITEMS_PER_PAGE; // Current visible end
      const endIndex = nextPage * ITEMS_PER_PAGE; // New visible end
      
      // STAGE 3: Calculate driving distance for newly revealed range (on-demand)
      const newlyRevealedRange = allLocalesSortedRef.current.slice(startIndex, endIndex);
      const needsDrivingDistance = newlyRevealedRange.filter(
        locale => !drivingDistanceCalculatedRef.current.has(locale._id)
      );
      
      if (needsDrivingDistance.length > 0) {
        setCalculatingDistances(true);
        
        // Calculate driving distance for newly revealed locales
        const BATCH_SIZE = 5;
        const updatedLocales = new Map<string, Locale & { distanceKm?: number | null }>();
        
        for (let i = 0; i < needsDrivingDistance.length; i += BATCH_SIZE) {
          if (!isMountedRef.current) break;
          
          const batch = needsDrivingDistance.slice(i, i + BATCH_SIZE);
          
          const batchResults = await Promise.allSettled(
            batch.map(async (locale) => {
              let updatedLocale: Locale;
              
              if (locale.latitude && locale.longitude && 
                  locale.latitude !== 0 && locale.longitude !== 0 &&
                  !isNaN(locale.latitude) && !isNaN(locale.longitude) &&
                  locale.latitude >= -90 && locale.latitude <= 90 &&
                  locale.longitude >= -180 && locale.longitude <= 180) {
                updatedLocale = locale;
              } else {
                const realCoords = await fetchRealCoords(
                  locale.name, 
                  locale.countryCode,
                  googleGeocodeCacheRef.current,
                  locale.description
                );
                
                if (realCoords) {
                  updatedLocale = {
                    ...locale,
                    latitude: realCoords.lat,
                    longitude: realCoords.lon,
                  };
                } else {
                  updatedLocale = await geocodeLocale(locale);
                }
              }

              const userLat = userLocation.latitude;
              const userLon = userLocation.longitude;
              const localeLat = updatedLocale.latitude;
              const localeLon = updatedLocale.longitude;
              
              if (!localeLat || !localeLon || localeLat === 0 || localeLon === 0 ||
                  isNaN(localeLat) || isNaN(localeLon) ||
                  localeLat < -90 || localeLat > 90 || localeLon < -180 || localeLon > 180) {
                return {
                  ...updatedLocale,
                  distanceKm: locale.distanceKm || null,
                };
              }
              
              if (!userLat || !userLon || isNaN(userLat) || isNaN(userLon) ||
                  userLat < -90 || userLat > 90 || userLon < -180 || userLon > 180) {
                return {
                  ...updatedLocale,
                  distanceKm: locale.distanceKm || null,
                };
              }
              
              const distanceKm = await getLocaleDistanceKm(
                updatedLocale._id.toString(),
                userLat,
                userLon,
                localeLat,
                localeLon
              );

              drivingDistanceCalculatedRef.current.add(locale._id);
              
              return {
                ...updatedLocale,
                distanceKm: distanceKm || locale.distanceKm || null,
              };
            })
          );
          
          batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              updatedLocales.set(result.value._id, result.value);
            } else {
              updatedLocales.set(batch[index]._id, batch[index]);
            }
          });
          
          if (i + BATCH_SIZE < needsDrivingDistance.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        if (!isMountedRef.current) {
          setCalculatingDistances(false);
          return;
        }
        
        // Update distances in-place and re-sort
        const snapshot = createLocationSnapshot();
        if (snapshot) {
          const updatedSorted = allLocalesSortedRef.current.map(locale => {
            const updated = updatedLocales.get(locale._id);
            return updated || locale;
          });
          
          const reSorted = sortLocalesWithSnapshot(updatedSorted, snapshot);
          allLocalesSortedRef.current = reSorted;
          
          // Re-slice visible items from the top
          const visibleLocales = reSorted.slice(0, endIndex);
          
          setAllLocalesWithDistances(reSorted);
          setAdminLocales(visibleLocales);
          setDisplayedPage(nextPage);
          setHasMore(endIndex < reSorted.length);
          setTotalPages(Math.ceil(reSorted.length / ITEMS_PER_PAGE));
          
          const filtered = applyFilters(visibleLocales, false);
          setFilteredLocales(filtered);
        }
        
        setCalculatingDistances(false);
        
        if (__DEV__) {
          logger.debug('✅ STAGE 3 complete: Driving distances calculated for newly revealed range');
        }
      } else {
        // No need to calculate - just paginate
        setLoadingMore(true);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const visibleLocales = allLocalesSortedRef.current.slice(0, endIndex);
        setAdminLocales(visibleLocales);
        setDisplayedPage(nextPage);
        setHasMore(endIndex < allLocalesSortedRef.current.length);
        
        const filtered = applyFilters(visibleLocales, false);
        setFilteredLocales(filtered);
        
        setLoadingMore(false);
      }
      
      return;
    }
    
    // Fallback: Server-side pagination (when no location or all locales not loaded)
    if (currentPageRef.current >= totalPages) {
      setHasMore(false);
      return;
    }
    
    isPaginatingRef.current = true;
    setLoadingMore(true);
    
    try {
      currentPageRef.current += 1;
      await loadAdminLocales(false);
    } catch (error) {
      logger.error('Error loading more locales:', error);
      currentPageRef.current = Math.max(1, currentPageRef.current - 1);
    } finally {
      isPaginatingRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, totalPages, loadingMore, loadingLocales, loadAdminLocales, displayedPage, userLocation, locationPermissionGranted, createLocationSnapshot, sortLocalesWithSnapshot, applyFilters]);

  // Pagination & Filter Race Safety: Refresh with guards
  const handleRefresh = useCallback(async () => {
    if (isSearchingRef.current || isPaginatingRef.current) {
      logger.debug('Refresh already in progress, skipping');
      return;
    }
    
    if (!isMountedRef.current) return;
    
    // CACHE: Invalidate cache on manual refresh
    localeCache.invalidate();
    
    setRefreshing(true);
    try {
      currentPageRef.current = 1;
      setHasMore(false);
      setTotalPages(1);
      setDisplayedPage(1);
      setAllLocalesWithDistances([]); // Clear cached sorted locales
      locationSnapshotRef.current = null; // Reset location snapshot to allow re-sorting
      await loadAdminLocales(true);
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [loadAdminLocales]);

  const toggleSpotType = (spotType: string) => {
    if (!isMountedRef.current || !spotType) return;
    try {
      dispatchFilter({ type: 'TOGGLE_SPOT_TYPE', payload: spotType });
    } catch (error) {
      logger.error('Error toggling spot type:', error);
    }
  };

  // Calculate active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.countryCode) count++;
    if (filters.stateCode) count++;
    if (filters.spotTypes.length > 0) count += filters.spotTypes.length;
    if (filters.searchRadius && parseFloat(filters.searchRadius) > 0) count++;
    return count;
  }, [filters]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    if (!isMountedRef.current) return;
    
    try {
      // Close modal first to prevent white screen
      setShowFilterModal(false);
      
      // Close dropdowns
      setShowCountryDropdown(false);
      setShowStateDropdown(false);
      
      // Clear states
      setStates([]);
      
      // Reset filters to empty state (not default country)
      dispatchFilter({ type: 'RESET' });
      setSearchQuery('');
      
      // CACHE: Invalidate cache when filters are cleared
      localeCache.invalidate();
      
      // Reset pagination
      currentPageRef.current = 1;
      setHasMore(false);
      setTotalPages(1);
      setDisplayedPage(1);
      setAllLocalesWithDistances([]); // Clear cached sorted locales
      locationSnapshotRef.current = null; // Reset location snapshot to allow re-sorting
      lastFetchKeyRef.current = null;
      
      // Reload locales without filters (only for locale tab) - use setTimeout to avoid blocking UI
      if (activeTab === 'locale') {
        // Use setTimeout to ensure modal closes before reloading
        setTimeout(() => {
          if (isMountedRef.current) {
            loadAdminLocales(true).catch(err => {
              logger.error('Error reloading locales after reset:', err);
            });
          }
        }, 100);
      }
      // For saved tab, filtering is handled by useMemo - no reload needed
    } catch (error) {
      logger.error('Error clearing filters:', error);
      // Ensure UI doesn't break even if there's an error
      if (isMountedRef.current) {
        setShowFilterModal(false);
        setShowCountryDropdown(false);
        setShowStateDropdown(false);
        setStates([]);
      }
    }
  }, [activeTab, loadAdminLocales]);

  // Pagination & Filter Race Safety: Reset pagination when filters change
  const handleSearch = useCallback(() => {
    if (!isMountedRef.current) return;
    
    try {
      // Close modal first to prevent white screen
      setShowFilterModal(false);
      
      // Close dropdowns
      setShowCountryDropdown(false);
      setShowStateDropdown(false);
      
      // CACHE: Invalidate cache when filters change
      localeCache.invalidate();
      
      // Reset pagination cleanly when filters change
      currentPageRef.current = 1;
      setHasMore(false);
      setTotalPages(1);
      setDisplayedPage(1);
      setAllLocalesWithDistances([]); // Clear cached sorted locales
      // Reset fetch key to force new fetch
      lastFetchKeyRef.current = null;
      
      // Reload locales with filters applied (only for locale tab)
      // Use setTimeout to ensure modal closes before reloading
      if (activeTab === 'locale') {
        setTimeout(() => {
          if (isMountedRef.current) {
            loadAdminLocales(true).catch(err => {
              logger.error('Error loading locales after search:', err);
              // Ensure UI doesn't break even if there's an error
              if (isMountedRef.current) {
                setLoadingLocales(false);
              }
            });
          }
        }, 100);
      }
      // For saved tab, filtering is handled by useMemo
    } catch (error) {
      logger.error('Error in handleSearch:', error);
      // Ensure UI doesn't break even if there's an error
      if (isMountedRef.current) {
        setShowFilterModal(false);
        setShowCountryDropdown(false);
        setShowStateDropdown(false);
      }
    }
  }, [loadAdminLocales, activeTab]);
  
  // Search Input Stability: Debounced search with request cancellation
  useEffect(() => {
    // Clear previous debounce timer
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }
    
    // Cancel previous search request
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    
    // Set up new debounce timer - always trigger on searchQuery change
    searchDebounceTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && !isSearchingRef.current) {
        // Reset pagination on new search
        currentPageRef.current = 1;
        // Reset fetch key to force new fetch
        lastFetchKeyRef.current = null;
        loadAdminLocales(true);
      }
    }, SEARCH_DEBOUNCE_MS);
    
    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
    };
  }, [searchQuery, loadAdminLocales]);

  const filteredCountriesForFilter = useMemo(() => {
    const q = countrySearchQuery.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(c => c.name.toLowerCase().includes(q));
  }, [countries, countrySearchQuery]);

  const filteredStatesForFilter = useMemo(() => {
    const q = stateSearchQuery.trim().toLowerCase();
    if (!q) return states;
    return states.filter(s => s.name.toLowerCase().includes(q));
  }, [states, stateSearchQuery]);

  const renderFilterModal = () => {
    if (!showFilterModal) return null;
    
    return (
      <Modal
        visible={showFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setCountrySearchQuery('');
          setStateSearchQuery('');
          setShowFilterModal(false);
        }}
      >
        <SafeAreaView style={[styles.filterModalContainer, { backgroundColor: theme.colors.background }]}>
          <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
        
        {/* Header */}
        <View style={[styles.filterHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              setCountrySearchQuery('');
              setStateSearchQuery('');
              setShowFilterModal(false);
            }}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.filterTitleContainer}>
            <Text style={[styles.filterTitle, { color: theme.colors.text }]}>FILTER</Text>
            {activeFilterCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </View>
          {activeFilterCount > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={handleClearFilters}
            >
              <Text style={[styles.clearButtonText, { color: theme.colors.primary }]}>Clear</Text>
            </TouchableOpacity>
          )}
          {activeFilterCount === 0 && <View style={styles.placeholder} />}
        </View>

        <ScrollView 
          style={styles.filterContent} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {/* Country */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>COUNTRY</Text>
            <TouchableOpacity 
              style={[styles.dropdownField, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              }]}
              onPress={() => setShowCountryDropdown(!showCountryDropdown)}
            >
              <Text style={[styles.dropdownText, { color: theme.colors.text }]}>
                {filters.country || 'Select Country'}
              </Text>
              <View style={styles.dropdownIconContainer}>
                {loadingCountries ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Ionicons 
                    name={showCountryDropdown ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={theme.colors.textSecondary} 
                  />
                )}
              </View>
            </TouchableOpacity>
            
            {/* Country Dropdown */}
            {showCountryDropdown && (
              <View style={[styles.dropdownList, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.text,
              }]}>
                <View style={[styles.countrySearchContainer, { 
                  backgroundColor: theme.colors.surface,
                  borderBottomColor: theme.colors.border,
                }]}>
                  <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} style={styles.countrySearchIcon} />
                  <TextInput
                    style={[styles.countrySearchInput, { color: theme.colors.text }]}
                    placeholder="Search countries..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={countrySearchQuery}
                    onChangeText={setCountrySearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {countrySearchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setCountrySearchQuery('')}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={styles.countrySearchClear}
                    >
                      <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredCountriesForFilter.length > 0 ? (
                    filteredCountriesForFilter.map((country, index) => (
                      <TouchableOpacity
                        key={country.code || index}
                        style={[styles.dropdownItem, { 
                          backgroundColor: filters.countryCode === country.code ? theme.colors.primary + '15' : 'transparent',
                          borderBottomColor: theme.colors.border,
                        }]}
                        onPress={() => {
                          if (country && country.code) {
                            handleCountrySelect(country).catch(err => {
                              logger.error('Error in country selection:', err);
                            });
                          }
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { 
                          color: filters.countryCode === country.code ? theme.colors.primary : theme.colors.text,
                          fontWeight: filters.countryCode === country.code ? '600' : '400',
                        }]}>
                          {country.name}
                        </Text>
                        {filters.countryCode === country.code && (
                          <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={[styles.dropdownItem, { borderBottomWidth: 0 }]}>
                      <Text style={[styles.dropdownItemText, { color: theme.colors.textSecondary, fontStyle: 'italic' }]}>
                        No countries match "{countrySearchQuery}"
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* State/Province */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>STATE/PROVINCE</Text>
            <TouchableOpacity 
              style={[styles.dropdownField, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                opacity: !filters.countryCode ? 0.5 : 1,
              }]}
              onPress={() => {
                if (!filters.countryCode) return;
                // Load states only when opening dropdown (no loading on country select)
                if (!showStateDropdown && states.length === 0) {
                  loadStatesForCountry(filters.countryCode);
                }
                setShowStateDropdown(!showStateDropdown);
              }}
              disabled={!filters.countryCode}
            >
              <Text style={[styles.dropdownText, { color: theme.colors.text }]}>
                {filters.stateProvince || 'Select State/Province'}
              </Text>
              <View style={styles.dropdownIconContainer}>
                {loadingStates ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Ionicons 
                    name={showStateDropdown ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={theme.colors.textSecondary} 
                  />
                )}
              </View>
            </TouchableOpacity>
            
            {/* State Dropdown */}
            {showStateDropdown && (
              <View style={[styles.dropdownList, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.text,
              }]}>
                <View style={[styles.countrySearchContainer, { 
                  backgroundColor: theme.colors.surface,
                  borderBottomColor: theme.colors.border,
                }]}>
                  <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} style={styles.countrySearchIcon} />
                  <TextInput
                    style={[styles.countrySearchInput, { color: theme.colors.text }]}
                    placeholder="Search states..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={stateSearchQuery}
                    onChangeText={setStateSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {stateSearchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setStateSearchQuery('')}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={styles.countrySearchClear}
                    >
                      <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
                {states.length > 0 ? (
                  <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filteredStatesForFilter.length > 0 ? (
                      filteredStatesForFilter.map((state, index) => (
                        <TouchableOpacity
                          key={state.code || index}
                          style={[styles.dropdownItem, { 
                            backgroundColor: filters.stateCode === state.code ? theme.colors.primary + '15' : 'transparent',
                            borderBottomColor: theme.colors.border,
                          }]}
                          onPress={() => handleStateSelect(state)}
                        >
                          <Text style={[styles.dropdownItemText, { 
                            color: filters.stateCode === state.code ? theme.colors.primary : theme.colors.text,
                            fontWeight: filters.stateCode === state.code ? '600' : '400',
                          }]}>
                            {state.name}
                          </Text>
                          {filters.stateCode === state.code && (
                            <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))
                    ) : (
                      <View style={[styles.dropdownItem, { borderBottomWidth: 0 }]}>
                        <Text style={[styles.dropdownItemText, { color: theme.colors.textSecondary, fontStyle: 'italic' }]}>
                          No states match "{stateSearchQuery}"
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                ) : (
                  <View style={[styles.dropdownItem, { 
                    backgroundColor: 'transparent',
                    borderBottomColor: theme.colors.border,
                  }]}>
                    <Text style={[styles.dropdownItemText, { 
                      color: theme.colors.textSecondary,
                      fontStyle: 'italic',
                    }]}>
                      No states/provinces available
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Type of Spot */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>TYPE OF SPOT</Text>
            {spotTypeOptions.map((spotType, index) => (
              <TouchableOpacity
                key={index}
                style={styles.spotTypeOption}
                onPress={() => toggleSpotType(spotType)}
              >
                <View style={[
                  styles.checkbox,
                  { 
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                  },
                  filters.spotTypes.includes(spotType) && {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary,
                  }
                ]}>
                  {filters.spotTypes.includes(spotType) && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
                <Text style={[styles.spotTypeText, { color: theme.colors.text }]}>{spotType}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search Radius */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>SEARCH RADIUS</Text>
            <View style={[styles.radiusContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <TextInput
                style={[styles.radiusInput, { color: theme.colors.text }]}
                placeholder="Enter radius in km"
                placeholderTextColor={theme.colors.textSecondary}
                value={filters.searchRadius}
                onChangeText={(text) => dispatchFilter({ type: 'SET_SEARCH_RADIUS', payload: text })}
                keyboardType="numeric"
              />
              <Text style={[styles.radiusUnit, { color: theme.colors.textSecondary }]}>km</Text>
            </View>
          </View>
        </ScrollView>

        {/* Search Button */}
        <View style={[styles.filterFooter, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
          <View style={styles.filterFooterButtons}>
            <TouchableOpacity 
              style={[styles.resetButton, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              }]} 
              onPress={handleClearFilters}
            >
              <Ionicons name="refresh-outline" size={18} color={theme.colors.text} />
              <Text style={[styles.resetButtonText, { color: theme.colors.text }]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.searchButton, { backgroundColor: theme.colors.primary }]} 
              onPress={handleSearch}
            >
              <Ionicons name="search" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.searchButtonText}>
                {activeFilterCount > 0 ? `Search (${activeFilterCount})` : 'Search'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
    );
  };



  // List Rendering Performance: Memoize render functions
  const renderAdminLocaleCard = useCallback(({ locale, index }: { locale: Locale; index: number }) => {
    // Use distanceKm from locale object (always available if coordinates exist)
    const d = (locale as Locale & { distanceKm?: number | null }).distanceKm ?? 
              (userLocation && locationPermissionGranted ? getLocaleDistance(locale) : null);
    // Fix distance display formatting - ensure correct units
    const distanceText = d !== null && d !== undefined
      ? d < 1
        ? `${Math.round(d * 1000)} m`
        : `${d.toFixed(1)} km`
      : '–';
    
    // Debug: Log distance calculation
    if (__DEV__) {
      logger.debug(`Locale ${locale.name}: distance=${d}, distanceText=${distanceText}, hasCoords=${!!(locale.latitude && locale.longitude)}, userLocation=${!!userLocation}`);
    }
    
    return (
      <TouchableOpacity 
        style={[
          styles.locationCard,
          styles.wideCard,
          { marginBottom: 16 }
        ]}
        onPress={() => {
          // Navigate to locale detail - Legacy flow
          try {
            trackFeatureUsage('locale_open', { locale_id: locale._id });
            router.push({
              pathname: '/tripscore/countries/[country]/locations/[location]',
              params: {
                country: locale.countryCode.toLowerCase(),
                location: locale.name.toLowerCase().replace(/\s+/g, '-'),
                userId: 'admin-locale',
                imageUrl: locale.imageUrl || '',
                latitude: (locale.latitude && locale.latitude !== 0) ? locale.latitude.toString() : '',
                longitude: (locale.longitude && locale.longitude !== 0) ? locale.longitude.toString() : '',
                description: locale.description || '',
                spotTypes: locale.spotTypes?.join(', ') || '',
                travelInfo: locale.travelInfo || 'Drivable',
              }
            });
          } catch (error) {
            logger.error('Error navigating to locale detail:', error);
            showError('Failed to open locale details');
          }
        }}
      >
        {locale.imageUrl ? (
          <Image 
            source={{ uri: locale.imageUrl }} 
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={['#D4EDDA', '#A8DADC']}
            style={styles.cardImage}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.mapPlaceholder}>
              <Ionicons name="location" size={40} color="#2C5530" />
            </View>
          </LinearGradient>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.cardGradient}
        />
        <View style={styles.cardContent}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{locale.name}</Text>
          </View>
          <Text style={[styles.cardSubtitle, { color: '#FFFFFF' }]}>
            {locale.countryCode}
          </Text>
        </View>
        {distanceText ? (
          <View style={styles.distanceBadgeAbsolute}>
            <Ionicons name="location" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.distanceText}>{distanceText}</Text>
          </View>
        ) : (userLocation && locationPermissionGranted && locale.latitude && locale.longitude) ? (
          <View style={styles.distanceBadgeAbsolute}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }, [router, theme, userLocation, locationPermissionGranted, getLocaleDistance]);

  const renderAdminLocales = () => {
    // Always use filteredLocales when filters are active, even if empty
    // Only fallback to sortedAdminLocales if no filters are applied and filteredLocales is empty
    const hasActiveFilters = filters.countryCode || filters.stateCode || filters.spotTypes.length > 0 || 
                            (filters.searchRadius && filters.searchRadius.trim() !== '' && parseFloat(filters.searchRadius.trim()) > 0) ||
                            searchQuery.trim() !== '';
    
    // CRITICAL: Always use sorted locales (by distance, nearest first)
    // sortedAdminLocales is already sorted by distance via useMemo
    const localesToShow = (hasActiveFilters || filteredLocales.length > 0) ? filteredLocales : sortedAdminLocales;
    
    if (loadingLocales) {
      return (
        <View style={styles.adminLocalesSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Featured Locales</Text>
          <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 20 }} />
        </View>
      );
    }

    if (localesToShow.length === 0) {
      return (
        <View style={styles.adminLocalesSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Featured Locales</Text>
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={60} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Locales Found</Text>
            <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
              {searchQuery || filters.spotTypes.length > 0 || filters.countryCode || filters.stateCode || 
               (filters.searchRadius && filters.searchRadius.trim() !== '' && parseFloat(filters.searchRadius.trim()) > 0)
                ? 'Try adjusting your search or filters'
                : 'Check back later for exciting new destinations!'}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.adminLocalesSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 16 }]}>Featured Locales</Text>
        <View style={styles.localesList}>
          {localesToShow.map((locale, index) => (
            <View key={locale._id}>
              {renderAdminLocaleCard({ locale, index })}
            </View>
          ))}
        </View>
        {/* Load More Button - Always visible when there are more locales */}
        {hasMore && !loadingMore && !loadingLocales && localesToShow.length > 0 && (
          <View style={styles.loadMoreButtonContainer}>
            <TouchableOpacity
              style={[styles.loadMoreButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleLoadMore}
              activeOpacity={0.7}
            >
              <Text style={[styles.loadMoreText, { color: '#FFFFFF' }]}>Load More</Text>
              <Ionicons name="chevron-down" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
        )}
        {loadingMore && (
          <View style={styles.loadMoreContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.loadMoreText, { color: theme.colors.textSecondary, marginLeft: 8 }]}>
              Loading more locales...
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderCustomLayout = useCallback(() => {
    return (
      <View style={{ paddingBottom: isTabletLocal ? 30 : 40 }}>
        {/* Admin-managed locales section */}
        {renderAdminLocales()}
      </View>
    );
  }, [filteredLocales, sortedAdminLocales, loadingLocales, theme, searchQuery, filters]);

  // List Rendering Performance: Memoize render functions
  const renderSavedLocaleCard = useCallback(({ locale, index }: { locale: Locale; index: number }) => {
    // Use distanceKm from locale object (always available if coordinates exist)
    const d = (locale as Locale & { distanceKm?: number | null }).distanceKm ?? 
              (userLocation && locationPermissionGranted ? getLocaleDistance(locale) : null);
    // Fix distance display formatting - ensure correct units
    const distanceText = d !== null && d !== undefined
      ? d < 1
        ? `${Math.round(d * 1000)} m`
        : `${d.toFixed(1)} km`
      : '–';
    
    return (
      <TouchableOpacity 
        style={[
          styles.locationCard,
          styles.wideCard,
          { marginBottom: 16 }
        ]}
        onPress={() => {
          // Navigate to locale detail - Legacy flow
          try {
            trackFeatureUsage('locale_open', { locale_id: locale._id });
            router.push({
              pathname: '/tripscore/countries/[country]/locations/[location]',
              params: {
                country: locale.countryCode.toLowerCase(),
                location: locale.name.toLowerCase().replace(/\s+/g, '-'),
                userId: 'admin-locale',
                imageUrl: locale.imageUrl || '',
                latitude: (locale.latitude && locale.latitude !== 0) ? locale.latitude.toString() : '',
                longitude: (locale.longitude && locale.longitude !== 0) ? locale.longitude.toString() : '',
                description: locale.description || '',
                spotTypes: locale.spotTypes?.join(', ') || '',
                travelInfo: locale.travelInfo || 'Drivable',
              }
            });
          } catch (error) {
            logger.error('Error navigating to locale detail:', error);
            showError('Failed to open locale details');
          }
        }}
      >
        {locale.imageUrl ? (
          <Image 
            source={{ uri: locale.imageUrl }} 
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={['#D4EDDA', '#A8DADC']}
            style={styles.cardImage}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.mapPlaceholder}>
              <Ionicons name="location" size={40} color="#2C5530" />
            </View>
          </LinearGradient>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.cardGradient}
        />
        <View style={styles.cardContent}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{locale.name}</Text>
          </View>
          <Text style={[styles.cardSubtitle, { color: '#FFFFFF' }]}>
            {locale.countryCode}
          </Text>
          {locale.description && (
            <Text style={[styles.cardSubtitle, { color: '#FFFFFF', marginTop: 4 }]} numberOfLines={1}>
              {locale.description}
            </Text>
          )}
        </View>
        {distanceText && (
          <View style={styles.distanceBadgeAbsolute}>
            <Ionicons name="location" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.distanceText}>{distanceText}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={(e) => {
            e.stopPropagation();
            unsaveLocale(locale._id);
          }}
        >
          <Ionicons 
            name="bookmark" 
            size={20} 
            color="#FFD700" 
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [router, theme, unsaveLocale, userLocation, locationPermissionGranted, getLocaleDistance]);

  const renderEmptySavedState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="bookmark-outline" size={60} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Saved Locales</Text>
      <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
        Bookmark featured locales you love to find them here later
      </Text>
    </View>
  );

  // Elegant travel-themed loading animation component
  const TravelLoadingOverlay = () => {
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;
    const globeRotateAnim = useRef(new Animated.Value(0)).current;
    const shimmerAnim = useRef(new Animated.Value(0)).current;
    const dot1Anim = useRef(new Animated.Value(0)).current;
    const dot2Anim = useRef(new Animated.Value(0)).current;
    const dot3Anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (calculatingDistances) {
        // Start all animations immediately
        Animated.parallel([
          // Fade in
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // Continuous airplane rotation
          Animated.loop(
            Animated.timing(rotateAnim, {
              toValue: 1,
              duration: 4000,
              easing: Easing.linear,
              useNativeDriver: true,
            })
          ),
          // Smooth pulsing
          Animated.loop(
            Animated.sequence([
              Animated.timing(pulseAnim, {
                toValue: 1,
                duration: 1500,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 0,
                duration: 1500,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ])
          ),
          // Floating animation
          Animated.loop(
            Animated.sequence([
              Animated.timing(floatAnim, {
                toValue: 1,
                duration: 2000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(floatAnim, {
                toValue: 0,
                duration: 2000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ])
          ),
          // Globe rotation
          Animated.loop(
            Animated.timing(globeRotateAnim, {
              toValue: 1,
              duration: 8000,
              easing: Easing.linear,
              useNativeDriver: true,
            })
          ),
          // Shimmer effect
          Animated.loop(
            Animated.timing(shimmerAnim, {
              toValue: 1,
              duration: 2000,
              easing: Easing.linear,
              useNativeDriver: true,
            })
          ),
          // Animated dots with staggered delays
          Animated.loop(
            Animated.sequence([
              Animated.parallel([
                Animated.timing(dot1Anim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.delay(200),
                Animated.timing(dot2Anim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.delay(400),
                Animated.timing(dot3Anim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              ]),
              Animated.parallel([
                Animated.timing(dot1Anim, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.delay(200),
                Animated.timing(dot2Anim, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.delay(400),
                Animated.timing(dot3Anim, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
              ]),
            ])
          ),
        ]).start();
      } else {
        // Fade out smoothly
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }, [calculatingDistances, rotateAnim, pulseAnim, fadeAnim, floatAnim, globeRotateAnim, shimmerAnim, dot1Anim, dot2Anim, dot3Anim]);

    const rotation = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    const scale = pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.15],
    });

    const translateY = floatAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -15],
    });

    const globeRotation = globeRotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    const shimmerTranslate = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-100, 100],
    });

    const shimmerOpacity = shimmerAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 0.3, 0],
    });

    const dot1Scale = dot1Anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.3],
    });

    const dot1Opacity = dot1Anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    });

    const dot2Scale = dot2Anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.3],
    });

    const dot2Opacity = dot2Anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    });

    const dot3Scale = dot3Anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.3],
    });

    const dot3Opacity = dot3Anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1],
    });
    
    // Only render when calculating distances
    if (!calculatingDistances) return null;

    return (
      <Animated.View
        style={[
          styles.travelLoadingOverlay,
          {
            opacity: fadeAnim,
            backgroundColor: mode === 'dark' ? 'rgba(0, 0, 0, 0.92)' : 'rgba(255, 255, 255, 0.98)',
          },
        ]}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={mode === 'dark' 
            ? ['rgba(30, 30, 30, 0.95)', 'rgba(20, 20, 30, 0.95)']
            : ['rgba(255, 255, 255, 0.98)', 'rgba(245, 250, 255, 0.98)']}
          style={styles.travelLoadingGradient}
        >
          <View style={styles.travelLoadingContent}>
            {/* Main Icon Container with Multiple Animations */}
            <Animated.View
              style={[
                styles.travelIconContainer,
                {
                  transform: [
                    { rotate: rotation },
                    { scale },
                    { translateY },
                  ],
                },
              ]}
            >
              {/* Background Globe - Behind everything */}
              <Animated.View
                style={[
                  styles.travelGlobeBackground,
                  {
                    transform: [{ rotate: globeRotation }],
                    opacity: 0.12,
                  },
                ]}
                pointerEvents="none"
              >
                <Ionicons name="earth" size={100} color={theme.colors.primary} />
              </Animated.View>

              {/* Icon Wrapper with Shimmer */}
              <View style={styles.travelIconWrapper}>
                {/* Shimmer Effect */}
                <Animated.View
                  style={[
                    styles.travelShimmer,
                    {
                      transform: [{ translateX: shimmerTranslate }],
                      opacity: shimmerOpacity,
                    },
                  ]}
                  pointerEvents="none"
                />
                
                {/* Airplane Icon */}
                <Ionicons name="airplane" size={56} color={theme.colors.primary} style={styles.travelAirplaneIcon} />
              </View>
            </Animated.View>

            {/* Animated Dots */}
            <View style={styles.travelDotsContainer}>
              <Animated.View
                style={[
                  styles.travelDot,
                  {
                    transform: [{ scale: dot1Scale }],
                    opacity: dot1Opacity,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.travelDot,
                  {
                    transform: [{ scale: dot2Scale }],
                    opacity: dot2Opacity,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.travelDot,
                  {
                    transform: [{ scale: dot3Scale }],
                    opacity: dot3Opacity,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
              />
            </View>

            {/* Text Content */}
            <View style={styles.travelTextContainer}>
              <Text style={[styles.travelLoadingText, { color: theme.colors.text }]}>
                Capturing the best locales for you
              </Text>
              <Text style={[styles.travelLoadingSubtext, { color: theme.colors.textSecondary }]}>
                Calculating distances...
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  if (loading && !calculatingDistances) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary level="route">
    <SafeAreaView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <StatusBar 
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.background} 
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TravelLoadingOverlay />
      {/* Elegant Top Navigation */}
      <View style={[styles.topNavigation, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[
              styles.tabButton, 
              activeTab === 'locale' && [styles.activeTab, { backgroundColor: theme.colors.primary }]
            ]}
            onPress={() => setActiveTab('locale')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="location-outline" 
              size={isTabletLocal ? 20 : 18} 
              color={activeTab === 'locale' ? '#FFFFFF' : theme.colors.textSecondary} 
            />
            <Text style={[
              styles.tabText, 
              { color: activeTab === 'locale' ? '#FFFFFF' : theme.colors.textSecondary }
            ]}>
              LOCALE
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.tabButton, 
              activeTab === 'saved' && [styles.activeTab, { backgroundColor: theme.colors.primary }]
            ]}
            onPress={() => setActiveTab('saved')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="bookmark-outline" 
              size={isTabletLocal ? 20 : 18} 
              color={activeTab === 'saved' ? '#FFFFFF' : theme.colors.textSecondary} 
            />
            <Text style={[
              styles.tabText, 
              { color: activeTab === 'saved' ? '#FFFFFF' : theme.colors.textSecondary }
            ]}>
              SAVED
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search"
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={(text) => {
              // Update search query immediately for UI responsiveness
              setSearchQuery(text);
              
              // Clear existing debounce timer
              if (searchDebounceTimerRef.current) {
                clearTimeout(searchDebounceTimerRef.current);
              }
              
              // Debounce the actual search/filter operation
              searchDebounceTimerRef.current = setTimeout(() => {
                // Trigger filter update after debounce delay
                // The filteredLocales will update automatically via useEffect
                logger.debug(`Debounced search query: "${text}"`);
              }, SEARCH_DEBOUNCE_MS);
            }}
          />
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={isTabletLocal ? 24 : 20} color={theme.colors.textSecondary} />
            {activeFilterCount > 0 && (
              <View style={[styles.filterButtonBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.filterButtonBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {activeTab === 'locale' ? (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: isTabletLocal ? 80 : 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#4A90E2']}
              tintColor="#4A90E2"
            />
          }
        >
          {renderCustomLayout()}
        </ScrollView>
      ) : (
        <FlatList
          data={filteredSavedLocales}
          renderItem={({ item, index }) => renderSavedLocaleCard({ locale: item, index })}
          keyExtractor={(item, index) => item._id || `locale-${index}`}
          // List Rendering Performance: FlatList optimization
          removeClippedSubviews={true}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          getItemLayout={(data, index) => ({
            length: 200 + 16, // card height + margin
            offset: (200 + 16) * index,
            index,
          })}
          ListEmptyComponent={
            savedLocales.length === 0 
              ? renderEmptySavedState() 
              : filteredSavedLocales.length === 0 
                ? (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="filter-outline" size={60} color={theme.colors.textSecondary} />
                      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Results</Text>
                      <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
                        Try adjusting your filters or search query
                      </Text>
                      <TouchableOpacity 
                        style={[styles.clearFiltersButton, { backgroundColor: theme.colors.primary }]}
                        onPress={handleClearFilters}
                      >
                        <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
                      </TouchableOpacity>
                    </View>
                  )
                : null
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                if (!isMountedRef.current) return;
                setRefreshing(true);
                try {
                  await loadSavedLocales();
                } finally {
                  if (isMountedRef.current) {
                    setRefreshing(false);
                  }
                }
              }}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContainer, { paddingHorizontal: 20, paddingTop: 20 }]}
        />
      )}

      {/* Filter Modal */}
      {renderFilterModal()}
      </KeyboardAvoidingView>
    </SafeAreaView>
    </ErrorBoundary>
  );
}

// Create styles function that uses the constants
const createStyles = () => {
  const { width: screenWidth } = Dimensions.get('window');
  const isTabletLocal = screenWidth >= 768;
  const isWebLocal = Platform.OS === 'web';
  const isIOSLocal = Platform.OS === 'ios';
  const isAndroidLocal = Platform.OS === 'android';

  return StyleSheet.create({
    container: {
      flex: 1,
      ...(isWebLocal && {
        maxWidth: isTabletLocal ? 1200 : 1000,
        alignSelf: 'center',
        width: '100%',
      } as any),
    },
    topNavigation: {
      paddingHorizontal: isTabletLocal ? theme.spacing.xl : 24,
      paddingTop: isAndroidLocal ? (isTabletLocal ? theme.spacing.xl + 8 : 20 + 8) : (isTabletLocal ? theme.spacing.xl : 20),
      paddingBottom: isTabletLocal ? theme.spacing.xl : 20,
      borderBottomWidth: 0.5,
      minHeight: isAndroidLocal ? (isTabletLocal ? 80 : 64) : (isTabletLocal ? 72 : 60),
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: 'rgba(0,0,0,0.08)',
      borderRadius: isTabletLocal ? theme.borderRadius.lg : 16,
      padding: isTabletLocal ? 8 : 6,
    },
    tabButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: isTabletLocal ? theme.spacing.xl : 24,
      paddingVertical: isTabletLocal ? theme.spacing.md : (isAndroidLocal ? 16 : 14),
      borderRadius: theme.borderRadius.md,
      flex: 1,
      marginHorizontal: isTabletLocal ? 4 : 3,
      // Minimum touch target: 44x44 for iOS, 48x48 for Android
      minHeight: isAndroidLocal ? 48 : 44,
      ...(isWebLocal && {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      } as any),
    },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
    tabText: {
      fontSize: isTabletLocal ? theme.typography.body.fontSize + 2 : 16,
      fontFamily: getFontFamily('600'),
      fontWeight: '600',
      marginLeft: isTabletLocal ? theme.spacing.md : 10,
      letterSpacing: isIOSLocal ? 0.3 : 0.2,
      ...(isWebLocal && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    searchContainer: {
      paddingHorizontal: isTabletLocal ? theme.spacing.xl : 20,
      paddingVertical: isTabletLocal ? theme.spacing.lg : 16,
      alignItems: 'center',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: isTabletLocal ? theme.spacing.lg : 16,
      paddingVertical: isTabletLocal ? theme.spacing.md : 10,
      borderWidth: 0,
      width: '100%',
      maxWidth: isTabletLocal ? 800 : '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
    searchInput: {
      flex: 1,
      fontSize: isTabletLocal ? theme.typography.body.fontSize + 1 : 15,
      fontFamily: getFontFamily('400'),
      marginLeft: isTabletLocal ? theme.spacing.md : 12,
      fontWeight: '400',
      ...(isWebLocal && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        outlineStyle: 'none',
      } as any),
    },
    filterButton: {
      padding: isTabletLocal ? theme.spacing.sm : 6,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: 'rgba(0,0,0,0.05)',
      ...(isWebLocal && {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      } as any),
    },
    listContainer: {
      paddingHorizontal: isTabletLocal ? theme.spacing.md : 12,
      // Add padding for tab bar (88px mobile, 70px web) + extra spacing for load more button
      paddingBottom: isWebLocal ? 140 : (isTabletLocal ? 160 : 150),
    },
    row: {
      justifyContent: 'space-between',
      paddingHorizontal: 0,
      marginBottom: isTabletLocal ? theme.spacing.sm : 8,
    },
    firstRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: isTabletLocal ? theme.spacing.md : 12,
    },
    locationCard: {
      borderRadius: isTabletLocal ? theme.borderRadius.lg : 16,
      overflow: 'hidden',
      marginBottom: isTabletLocal ? theme.spacing.md : 12,
      position: 'relative',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    backgroundColor: '#FFFFFF',
  },
    halfCard: {
      width: isTabletLocal ? (screenWidth - theme.spacing.xxl * 2 - theme.spacing.md) / 2 : (screenWidth - 36) / 2,
      height: isTabletLocal ? 220 : 180,
    },
    wideCard: {
      width: isTabletLocal ? screenWidth - theme.spacing.xxl * 2 : screenWidth - 40,
      height: isTabletLocal ? 200 : 160,
      alignSelf: 'center',
    },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    color: '#2C5530',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  markerOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    zIndex: 1,
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  cardContent: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 80, // Leave space for distance badge on the right
  },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    cardTitle: {
      fontSize: isTabletLocal ? theme.typography.h3.fontSize : 18,
      fontFamily: getFontFamily('600'),
      fontWeight: '600',
      color: '#FFFFFF',
      textShadowColor: 'rgba(0,0,0,0.7)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
      letterSpacing: isIOSLocal ? 0.3 : 0.2,
      flex: 1,
      marginRight: 8,
      ...(isWebLocal && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    savedIndicator: {
      position: 'absolute',
      top: isAndroidLocal ? 12 : 10,
      right: isAndroidLocal ? 12 : 10,
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderRadius: isTabletLocal ? 16 : 14,
      padding: isTabletLocal ? 8 : (isAndroidLocal ? 8 : 6),
      // Minimum touch target: 44x44 for iOS, 48x48 for Android
      minWidth: isAndroidLocal ? 48 : 44,
      minHeight: isAndroidLocal ? 48 : 44,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 10,
  },
  loadingIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 14,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  travelLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 9999, // For Android
  },
  travelLoadingGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  travelLoadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: 32,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    minWidth: 300,
    maxWidth: 340,
    overflow: 'hidden',
    position: 'relative',
  },
  travelIconContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    position: 'relative',
    width: 140,
    height: 140,
  },
  travelGlobeBackground: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -50,
    marginLeft: -50,
    zIndex: 0,
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(74, 144, 226, 0.2)',
    zIndex: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  travelShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 40,
    zIndex: 1,
  },
  travelAirplaneIcon: {
    zIndex: 3,
    position: 'relative',
  },
  travelDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 12,
    zIndex: 2,
  },
  travelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 4,
  },
  travelTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  travelLoadingText: {
    fontSize: 20,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  travelLoadingSubtext: {
    fontSize: 15,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.75,
    letterSpacing: 0.2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },
  emptyDescription: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
  },
  exploreButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  exploreButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  savedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  savedText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
  },
  adminLocalesSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: isTabletLocal ? 30 : 40, // Increased to ensure load more button is fully visible above bottom nav
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    marginTop: 8,
  },
  localesList: {
    flexDirection: 'column',
    marginBottom: 16,
  },
  loadMoreButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: isTabletLocal ? theme.spacing.md : 16,
    marginBottom: isTabletLocal ? theme.spacing.lg : 24,
    paddingBottom: isTabletLocal ? theme.spacing.md : 16,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isTabletLocal ? theme.spacing.md : 14,
    paddingHorizontal: isTabletLocal ? theme.spacing.xl : 24,
    borderRadius: theme.borderRadius.md,
    minWidth: isTabletLocal ? 200 : 160,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadMoreText: {
    fontSize: isTabletLocal ? theme.typography.body.fontSize + 1 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  loadMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isTabletLocal ? theme.spacing.md : 16,
    marginTop: isTabletLocal ? theme.spacing.md : 16,
    marginBottom: isTabletLocal ? theme.spacing.md : 16,
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.9,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  distanceBadgeAbsolute: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  distanceText: {
    fontSize: 11,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    ...(isWebLocal && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  // Filter Modal Styles
  filterModalContainer: {
    flex: 1,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  filterTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  filterContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterScrollContent: {
    paddingBottom: 20,
  },
  filterSection: {
    marginTop: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  dropdownField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    minHeight: 56,
  },
  dropdownText: {
    fontSize: 16,
    flex: 1,
  },
  dropdownIconContainer: {
    marginLeft: 12,
  },
  dropdownList: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 256,
    zIndex: 1000,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 16,
    flex: 1,
  },
  spotTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotTypeText: {
    fontSize: 16,
    flex: 1,
  },
  radiusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    minHeight: 56,
  },
  radiusInput: {
    fontSize: 16,
    flex: 1,
  },
  radiusUnit: {
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  countrySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  countrySearchIcon: {
    marginRight: 10,
  },
  countrySearchInput: {
    fontSize: 16,
    flex: 1,
    paddingVertical: 8,
    paddingRight: 8,
  },
  countrySearchClear: {
    padding: 4,
  },
  filterFooter: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
  },
  filterFooterButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  resetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    gap: 6,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  filterButtonBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  filterButtonBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  clearFiltersButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearFiltersButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
    saveButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
  });
};

const styles = createStyles();

