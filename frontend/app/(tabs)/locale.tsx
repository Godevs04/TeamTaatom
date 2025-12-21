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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getProfile } from '../../services/profile';
import { getUserFromStorage } from '../../services/auth';
import { useRouter, useFocusEffect } from 'expo-router';
import { geocodeAddress, calculateDistance } from '../../utils/locationUtils';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { getCountries, getStatesByCountry, Country, State } from '../../services/location';
import { getLocales, Locale } from '../../services/locale';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';
import { savedEvents } from '../../utils/savedEvents';
import { theme } from '../../constants/theme';

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
      return { ...state, searchRadius: action.payload };
    case 'RESET':
      return {
        country: 'United Kingdom',
        countryCode: 'GB',
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
  const { handleScroll } = useScrollToHideNav();
  const [savedLocales, setSavedLocales] = useState<Locale[]>([]);
  const [adminLocales, setAdminLocales] = useState<Locale[]>([]);
  const [filteredLocales, setFilteredLocales] = useState<Locale[]>([]);
  const [loadingLocales, setLoadingLocales] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'locale' | 'saved'>('locale');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
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
  
  // Distance Calculation Guards: Cache calculated distances per session
  const distanceCacheRef = useRef<Map<string, number>>(new Map());
  
  // Geocoding cache: Store geocoded coordinates for locales
  const geocodedCoordsCacheRef = useRef<Map<string, { latitude: number; longitude: number }>>(new Map());
  const geocodingInProgressRef = useRef<Set<string>>(new Set());
  
  // User's current location for distance calculation
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  
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
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        logger.debug('Location permission denied, distance sorting will be unavailable');
        setLocationPermissionGranted(false);
        return;
      }
      
      setLocationPermissionGranted(true);
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      if (location && location.coords) {
        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        
        if (isMountedRef.current) {
          setUserLocation(coords);
          logger.debug('✅ User location obtained for distance sorting:', coords);
        }
      }
    } catch (error) {
      logger.error('Error getting user location:', error);
      setLocationPermissionGranted(false);
    }
  }, []);
  
  // Navigation & Lifecycle Safety: Setup and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    loadCountries();
    loadSavedLocales();
    loadAdminLocales();
    getUserCurrentLocation(); // Get user location for distance sorting
    
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
  
  // Pagination & Filter Race Safety: Load locales with request guards
  const loadAdminLocales = useCallback(async (forceRefresh = false) => {
    // Request Guard: Prevent duplicate calls
    if (isSearchingRef.current || isPaginatingRef.current) {
      logger.debug('loadAdminLocales already in progress, skipping');
      return;
    }
    
    // Generate fetch key from params
    const fetchKey = `${searchQuery}|${filters.countryCode}|${filters.spotTypes.join(',')}|${currentPageRef.current}`;
    
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
      }
      
      // Build query parameters
      const params: any = {
        page: currentPageRef.current,
        limit: 100,
        includeInactive: false, // Only show active locales
      };
      
      // Add search query if provided
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      
      // Add country filter if provided
      if (filters.countryCode && filters.countryCode !== 'all') {
        params.countryCode = filters.countryCode;
      }
      
      // Add spot type filter if provided
      if (filters.spotTypes && filters.spotTypes.length > 0) {
        params.spotType = filters.spotTypes[0]; // API supports single spot type
      }
      
      const response = await getLocales(
        params.search || '',
        params.countryCode || '',
        params.spotType || '',
        params.page,
        params.limit,
        params.includeInactive
      );
      
      if (!isMountedRef.current) return;
      
      if (response && response.locales) {
        // Pagination & Filter Race Safety: Deduplicate locales by unique ID
        const newLocales = response.locales;
        
        // Geocode locales that don't have coordinates (in background)
        if (userLocation && locationPermissionGranted) {
          // Geocode locales without coordinates
          const geocodePromises = newLocales.map(async (locale) => {
            if (!locale.latitude || !locale.longitude || locale.latitude === 0 || locale.longitude === 0) {
              return await geocodeLocale(locale);
            }
            return locale;
          });
          
          Promise.all(geocodePromises).then(geocodedLocales => {
            if (!isMountedRef.current) return;
            
            if (forceRefresh || currentPageRef.current === 1) {
              setAdminLocales(geocodedLocales);
            } else {
              setAdminLocales(prev => {
                const localeMap = new Map<string, Locale>();
                prev.forEach(locale => localeMap.set(locale._id, locale));
                geocodedLocales.forEach(locale => localeMap.set(locale._id, locale));
                return Array.from(localeMap.values());
              });
            }
          }).catch(error => {
            logger.error('Error geocoding locales:', error);
            // Fallback to original locales if geocoding fails
            if (forceRefresh || currentPageRef.current === 1) {
              setAdminLocales(newLocales);
            } else {
              setAdminLocales(prev => {
                const localeMap = new Map<string, Locale>();
                prev.forEach(locale => localeMap.set(locale._id, locale));
                newLocales.forEach(locale => localeMap.set(locale._id, locale));
                return Array.from(localeMap.values());
              });
            }
          });
        } else {
          // No user location, just set locales as is
          if (forceRefresh || currentPageRef.current === 1) {
            setAdminLocales(newLocales);
          } else {
            setAdminLocales(prev => {
              const localeMap = new Map<string, Locale>();
              prev.forEach(locale => localeMap.set(locale._id, locale));
              newLocales.forEach(locale => localeMap.set(locale._id, locale));
              return Array.from(localeMap.values());
            });
          }
        }
      } else {
        if (isMountedRef.current) {
          setAdminLocales([]);
          setFilteredLocales([]);
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.debug('loadAdminLocales aborted');
        return;
      }
      if (!isMountedRef.current) return;
      logger.error('Failed to load admin locales', error);
      setAdminLocales([]);
      setFilteredLocales([]);
    } finally {
      if (isMountedRef.current) {
        setLoadingLocales(false);
        setLoading(false);
      }
      isSearchingRef.current = false;
    }
  }, [searchQuery, filters.countryCode, filters.spotTypes, userLocation, locationPermissionGranted]); // Added userLocation dependencies for geocoding
  
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
  const getLocaleDistance = useCallback((locale: Locale): number | null => {
    if (!userLocation) {
      return null;
    }
    
    // Use coordinates from locale (may be geocoded)
    const lat = locale.latitude;
    const lng = locale.longitude;
    
    if (!lat || !lng || lat === 0 || lng === 0) {
      return null;
    }
    
    // Check cache first
    const cacheKey = `${locale._id}-${userLocation.latitude}-${userLocation.longitude}`;
    if (distanceCacheRef.current.has(cacheKey)) {
      return distanceCacheRef.current.get(cacheKey)!;
    }
    
    // Calculate distance
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      lat,
      lng
    );
    
    // Cache the result
    distanceCacheRef.current.set(cacheKey, distance);
    return distance;
  }, [userLocation]);
  
  // PRODUCTION-GRADE: Shared sorting function - sorts by distance (nearest first)
  // Admin displayOrder is completely ignored - user's location determines order
  const sortLocalesByDistance = useCallback((locales: Locale[]): Locale[] => {
    const sorted = [...locales];
    
    sorted.sort((a, b) => {
      // PRIMARY SORT: Distance-based (nearest first)
      if (userLocation && locationPermissionGranted) {
        const distanceA = getLocaleDistance(a);
        const distanceB = getLocaleDistance(b);
        
        // Case 1: Both have valid distances - sort by distance (nearest first)
        if (distanceA !== null && distanceB !== null) {
          return distanceA - distanceB;
        }
        
        // Case 2: Only A has distance - A comes first
        if (distanceA !== null && distanceB === null) {
          return -1;
        }
        
        // Case 3: Only B has distance - B comes first
        if (distanceA === null && distanceB !== null) {
          return 1;
        }
        
        // Case 4: Both null (no coordinates) - maintain original order
        // Fall through to secondary sort
      }
      
      // SECONDARY SORT: Only used when distance sorting is unavailable
      // Sort by createdAt (newest first) as tiebreaker
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
    
    return sorted;
  }, [userLocation, locationPermissionGranted, getLocaleDistance]);
  
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
      
      // PRODUCTION-GRADE: Sort saved locales by distance (nearest first)
      // This ensures consistent sorting across all locale lists
      const sortedLocales = sortLocalesByDistance(uniqueLocales);
      
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
  
  // Apply client-side filters (for spot types that API doesn't support)
  const applyFilters = useCallback((locales: Locale[]) => {
    let filtered = [...locales];
    
    // Filter by spot types (if multiple selected, show locales that match any)
    if (filters.spotTypes && filters.spotTypes.length > 0) {
      filtered = filtered.filter(locale => 
        locale.spotTypes && locale.spotTypes.some(type => filters.spotTypes.includes(type))
      );
    }
    
    // Filter by search query (if not already filtered by API)
    if (searchQuery.trim() && !searchQuery.includes(' ')) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(locale =>
        locale.name.toLowerCase().includes(query) ||
        locale.description?.toLowerCase().includes(query) ||
        locale.countryCode.toLowerCase().includes(query)
      );
    }
    
    // PRODUCTION-GRADE: Sort ONLY by distance (nearest first)
    // Admin displayOrder is completely ignored - user's location determines order
    // Use shared sorting function for consistency
    const sorted = sortLocalesByDistance(filtered);
    
    setFilteredLocales(sorted);
  }, [filters.spotTypes, searchQuery, sortLocalesByDistance]);
  
  // Update filtered locales when adminLocales change (but NOT when filters/searchQuery change - handled in loadAdminLocales)
  useEffect(() => {
    if (adminLocales.length > 0) {
      // Always apply filters to ensure sorting is applied
      applyFilters(adminLocales);
    } else {
      setFilteredLocales([]);
    }
  }, [adminLocales, applyFilters]);

  // Re-sort locales when user location becomes available or changes
  // This ensures sorting works even if location becomes available after locales are loaded
  useEffect(() => {
    if (adminLocales.length > 0) {
      // Re-apply filters to trigger distance-based sorting when location becomes available
      // This will re-sort using the updated userLocation (or fallback to createdAt if not available)
      applyFilters(adminLocales);
    }
  }, [userLocation, locationPermissionGranted, adminLocales, applyFilters]);

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
      
      // Only refresh admin locales if we have NO data (initial load)
      // DO NOT refresh if we already have data - causes loops
      if (adminLocales.length === 0 && !isSearchingRef.current) {
        // Initial load only
        loadAdminLocales(true);
      }
    }, [loadSavedLocales, loadAdminLocales]) // Removed adminLocales.length to prevent loops
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
          Alert.alert('Already Saved', 'This locale is already in your saved list');
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
        Alert.alert('Saved', 'Locale saved successfully');
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      logger.error('Error saving locale', error);
      Alert.alert('Error', 'Failed to save locale');
    } finally {
      bookmarkingKeysRef.current.delete(localeId);
    }
  }, [sortLocalesByDistance]);
  
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
        Alert.alert('Removed', 'Locale removed from saved list');
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      logger.error('Error unsaving locale', error);
      Alert.alert('Error', 'Failed to remove locale');
    } finally {
      bookmarkingKeysRef.current.delete(localeId);
    }
  }, [sortLocalesByDistance]);
  
  const isLocaleSaved = (localeId: string): boolean => {
    return savedLocales.some(l => l._id === localeId);
  };

  const loadCountries = async () => {
    try {
      setLoadingCountries(true);
      const countriesData = await getCountries();
      setCountries(countriesData);
      
      // Load states for the default country
      if (countriesData.length > 0) {
        await loadStatesForCountry(filters.countryCode);
      }
    } catch (error) {
      logger.debug('Countries loaded from static data');
      // Countries will be loaded from static data automatically
    } finally {
      setLoadingCountries(false);
    }
  };

  const loadStatesForCountry = async (countryCode: string) => {
    try {
      setLoadingStates(true);
      const statesData = await getStatesByCountry(countryCode);
      setStates(statesData);
      
      // If no states found, show a message
      if (statesData.length === 0) {
        logger.debug(`No states/provinces available for country code: ${countryCode}`);
      }
    } catch (error) {
      logger.debug(`States loaded from static data for ${countryCode}`);
      setStates([]); // Ensure states array is empty on error
    } finally {
      setLoadingStates(false);
    }
  };

  const handleCountrySelect = async (country: Country) => {
    dispatchFilter({ type: 'SET_COUNTRY', payload: { country: country.name, countryCode: country.code } });
    setShowCountryDropdown(false);
    
    // Load states for the selected country
    await loadStatesForCountry(country.code);
  };

  const handleStateSelect = (state: State) => {
    dispatchFilter({ type: 'SET_STATE', payload: { stateProvince: state.name, stateCode: state.code } });
    setShowStateDropdown(false);
  };


  // Pagination & Filter Race Safety: Refresh with guards
  const handleRefresh = useCallback(async () => {
    if (isSearchingRef.current || isPaginatingRef.current) {
      logger.debug('Refresh already in progress, skipping');
      return;
    }
    
    if (!isMountedRef.current) return;
    
    setRefreshing(true);
    try {
      currentPageRef.current = 1;
      await loadAdminLocales(true);
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [loadAdminLocales]);

  const toggleSpotType = (spotType: string) => {
    dispatchFilter({ type: 'TOGGLE_SPOT_TYPE', payload: spotType });
  };

  // Pagination & Filter Race Safety: Reset pagination when filters change
  const handleSearch = useCallback(() => {
    setShowFilterModal(false);
    // Reset pagination cleanly when filters change
    currentPageRef.current = 1;
    // Reset fetch key to force new fetch
    lastFetchKeyRef.current = null;
    // Reload locales with filters applied
    loadAdminLocales(true);
  }, [loadAdminLocales]);
  
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

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.filterModalContainer, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
        
        {/* Header */}
        <View style={[styles.filterHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setShowFilterModal(false)}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.filterTitle, { color: theme.colors.text }]}>FILTER</Text>
          <View style={styles.placeholder} />
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
                <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled>
                  {countries.map((country, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.dropdownItem, { 
                        backgroundColor: filters.countryCode === country.code ? theme.colors.primary + '15' : 'transparent',
                        borderBottomColor: theme.colors.border,
                      }]}
                      onPress={() => handleCountrySelect(country)}
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
                  ))}
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
              onPress={() => filters.countryCode && setShowStateDropdown(!showStateDropdown)}
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
                {states.length > 0 ? (
                  <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled>
                    {states.map((state, index) => (
                      <TouchableOpacity
                        key={index}
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
                    ))}
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
          <TouchableOpacity 
            style={[styles.searchButton, { backgroundColor: theme.colors.primary }]} 
            onPress={handleSearch}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );



  // List Rendering Performance: Memoize render functions
  const renderAdminLocaleCard = useCallback(({ locale, index }: { locale: Locale; index: number }) => {
    // Calculate distance if user location is available
    const distance = userLocation && locationPermissionGranted ? getLocaleDistance(locale) : null;
    const distanceText = distance !== null ? `${distance < 1 ? Math.round(distance * 1000) : distance.toFixed(1)}${distance < 1 ? 'm' : 'km'}` : null;
    
    // Debug: Log distance calculation
    if (__DEV__) {
      console.log(`Locale ${locale.name}: distance=${distance}, distanceText=${distanceText}, hasCoords=${!!(locale.latitude && locale.longitude)}, userLocation=${!!userLocation}`);
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
              }
            });
          } catch (error) {
            logger.error('Error navigating to locale detail:', error);
            Alert.alert('Error', 'Failed to open locale details');
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
    const localesToShow = filteredLocales.length > 0 ? filteredLocales : adminLocales;
    
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
              {searchQuery || filters.spotTypes.length > 0 || filters.countryCode
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
      </View>
    );
  };

  const renderCustomLayout = useCallback(() => {
    return (
      <View style={{ paddingBottom: 30 }}>
        {/* Admin-managed locales section */}
        {renderAdminLocales()}
      </View>
    );
  }, [filteredLocales, adminLocales, loadingLocales, theme, searchQuery, filters]);

  // List Rendering Performance: Memoize render functions
  const renderSavedLocaleCard = useCallback(({ locale, index }: { locale: Locale; index: number }) => {
    // Calculate distance if user location is available
    const distance = userLocation && locationPermissionGranted ? getLocaleDistance(locale) : null;
    const distanceText = distance !== null ? `${distance < 1 ? Math.round(distance * 1000) : distance.toFixed(1)}${distance < 1 ? 'm' : 'km'}` : null;
    
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
              }
            });
          } catch (error) {
            logger.error('Error navigating to locale detail:', error);
            Alert.alert('Error', 'Failed to open locale details');
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

  if (loading) {
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
    <SafeAreaView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <StatusBar 
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.background} 
      />
      
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
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={isTabletLocal ? 24 : 20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {activeTab === 'locale' ? (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
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
          data={savedLocales}
          renderItem={({ item, index }) => renderSavedLocaleCard({ locale: item, index })}
          keyExtractor={(item, index) => item._id || `locale-${index}`}
          // List Rendering Performance: FlatList optimization
          removeClippedSubviews={true}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={7}
          getItemLayout={(data, index) => ({
            length: 200 + 16, // card height + margin
            offset: (200 + 16) * index,
            index,
          })}
          ListEmptyComponent={savedLocales.length === 0 ? renderEmptySavedState() : null}
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
    </SafeAreaView>
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
      paddingBottom: isTabletLocal ? 40 : 30,
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
    paddingBottom: 8,
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
    maxHeight: 200,
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
  filterFooter: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
  },
  searchButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
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

