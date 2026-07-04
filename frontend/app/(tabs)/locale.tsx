import React, { useState, useEffect, useReducer, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  Image,
  ImageStyle,
  TouchableOpacity,
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
  ActivityIndicator,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import EmptyState from '../../components/EmptyState';
import { Image as ExpoImage } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList) as any;
import { useInfiniteQuery } from '@tanstack/react-query';
import { KalmanFilter } from '../../utils/kalmanFilter';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { getProfile } from '../../services/profile';
import { getUserFromStorage } from '../../services/auth';
import { useRouter, useFocusEffect } from 'expo-router';
import { geocodeAddress, calculateDistance, invalidateDistanceCacheIfMoved, distanceCache, placesCache, roundCoord, getLocaleDistanceKm, calculateDrivingDistanceKm } from '../../utils/locationUtils';
import { LocationDisclosureModal } from '../../components/ui/LocationDisclosureModal';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { matchGradientLocations } from '../../utils/linearGradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { getCountries, getStatesByCountry, Country, State } from '../../services/location';
import { getLocales, getLocaleById, Locale } from '../../services/locale';
import { updateDynamicLocation } from '../../services/userManagement';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';
import { savedEvents } from '../../utils/savedEvents';
import { theme } from '../../constants/theme';
import { optimizeCloudinaryUrl, useCachedImage } from '../../utils/imageCache';
import axios from 'axios';
import { getGoogleMapsApiKey } from '../../utils/maps';
import { localeCache } from '../../cache/localeCache';
import { ErrorBoundary } from '../../utils/errorBoundary';
import { trackFeatureUsage } from '../../services/analytics';
import TravelLoadingOverlay from '../../components/TravelLoadingOverlay';
import {

  CloudSegmentedControl,
  CloudSearchDock,
  CloudLocaleFeed,
} from '../../components/cloud';
import ScrollEdgeFades from '../../components/ScrollEdgeFades';
import type { CloudLocaleCardData } from '../../components/cloud/CloudLocaleCard';
import { LocaleCardSkeleton } from '../../components/ui/Skeleton';

const logger = createLogger('LocaleScreen');

// Strip the query string from a signed URL so the cache key stays stable across
// sessions. Without this, a fresh signature on each backend response would miss
// the cache and force a re-download of an image we already have on disk.
const getStableCacheKey = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  const cleanUrl = url.split('?')[0];
  let hash = 0;
  for (let i = 0; i < cleanUrl.length; i++) {
    const char = cleanUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

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
        const placesParams: Record<string, string> = {
          query: queryWithCountry,
          key: GOOGLE_MAPS_API_KEY,
        };
        // Add region bias so Google prioritises results from the locale's country
        if (countryCode) {
          placesParams.region = countryCode.toLowerCase();
        }
        const placesRes = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
          params: placesParams,
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

function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;
  const debounced = (...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  return debounced as any;
}

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

interface ExpoImageWithShimmerProps {
  source: any;
  style: any;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  cachePolicy?: 'none' | 'disk' | 'memory-disk' | 'memory';
  transition?: number;
  placeholder?: string | any;
}

const ExpoImageWithShimmer = React.memo(({ source, style, contentFit = 'cover', cachePolicy = 'memory-disk', transition = 0, placeholder }: ExpoImageWithShimmerProps) => {
  const sourceUri = typeof source === 'object' ? source.uri : source;
  
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const shimmerAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (loading) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      shimmerAnim.setValue(0);
    }
    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [loading, shimmerAnim]);

  // Handle source changes - reset loading state and error state
  useEffect(() => {
    setLoading(true);
    setHasError(false);
  }, [sourceUri]);

  if (hasError) {
    return (
      <LinearGradient
        colors={['#D4EDDA', '#A8DADC']}
        style={[style, { justifyContent: 'center', alignItems: 'center' }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name="location" size={40} color="#2C5530" />
      </LinearGradient>
    );
  }

  const cacheKey = getStableCacheKey(sourceUri);

  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {loading && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              opacity: shimmerAnim,
              borderRadius: style?.borderRadius || 0,
              zIndex: 1,
            },
          ]}
        />
      )}
      <ExpoImage
        source={{
          uri: sourceUri,
          cacheKey: cacheKey,
        }}
        style={[style, { width: '100%', height: '100%' }]}
        contentFit={contentFit}
        cachePolicy={cachePolicy}
        transition={transition}
        placeholder={placeholder}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setHasError(true);
        }}
      />
    </View>
  );
});

// Standalone Memoized Featured Locale Card Component to avoid re-creating interpolations
interface FeaturedLocaleCardProps {
  locale: Locale;
  index: number;
  scrollY: Animated.Value;
  screenHeight: number;
  cardWidth: number;
  cardHeight: number;
  userLocation: any;
  resolveLocaleDistance: (locale: Locale) => number | null;
  formatLocaleDistance: (locale: Locale) => string;
  openLocaleDetail: (locale: Locale) => void;
  skeletonAnim: Animated.Value;
  theme: any;
  isDark: boolean;
}

const FeaturedLocaleCard = React.memo(({
  locale,
  index,
  scrollY,
  screenHeight,
  cardWidth,
  cardHeight,
  userLocation,
  resolveLocaleDistance,
  formatLocaleDistance,
  openLocaleDetail,
  skeletonAnim,
  theme,
  isDark,
}: FeaturedLocaleCardProps) => {
  const d = resolveLocaleDistance(locale);
  const distanceText = formatLocaleDistance(locale);

  const cardTop = 40 + index * (cardHeight + 20); // 40px estimated ListHeaderComponent height
  const translateY = scrollY.interpolate({
    inputRange: [cardTop - screenHeight, cardTop + cardHeight],
    outputRange: [-24, 24],
    extrapolate: 'clamp',
  });

  return (
    <TouchableOpacity
      style={[
        styles.locationCard,
        {
          width: cardWidth,
          height: cardHeight,
          alignSelf: 'center',
          marginBottom: 0,
        }
      ]}
      onPress={() => openLocaleDetail(locale)}
      accessibilityLabel={`${locale.name}, ${locale.countryCode}`}
      accessibilityRole="button"
      accessibilityHint="Opens locale details"
    >
      {locale.imageUrl ? (
        <Animated.View
          key={String(locale._id)}
          style={{
            width: '100%',
            height: cardHeight + 64,
            position: 'absolute',
            top: -32,
            left: 0,
            transform: [{ translateY }, { scale: 1.05 }],
          }}
        >
          <ExpoImageWithShimmer
            source={{ uri: optimizeCloudinaryUrl(locale.imageUrl, { width: 400, height: 300 }) }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
            placeholder={(locale as any).blurhash || 'L6PZ|Ye.dHNGo~WhZ~StH?S#xZ$*'}
          />
        </Animated.View>
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

      {/* Bottom Glassmorphic/Translucent Metadata Panel */}
      <View
        style={{
          position: 'absolute',
          bottom: -1,
          left: -1,
          right: -1,
          height: '30%',
          overflow: 'hidden',
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.15)',
        }}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={45}
            tint="dark"
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              overflow: 'hidden',
            }}
          >
            {/* Left Column: Primary Title & Location Tag */}
            <View style={{ flex: 1, marginRight: 12, justifyContent: 'center' }}>
              <Text 
                style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '700',
                  fontFamily: getFontFamily('700'),
                  marginBottom: 2,
                }}
                numberOfLines={1}
              >
                {locale.name}
              </Text>
              <Text 
                style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: 12,
                  fontWeight: '500',
                  fontFamily: getFontFamily('500'),
                }}
                numberOfLines={1}
              >
                {locale.countryCode}
              </Text>
            </View>
            {distanceText === 'Calculating...' ? (
              <Animated.View
                style={[
                  styles.distanceBadge,
                  {
                    opacity: skeletonAnim,
                    width: 70,
                    height: 20,
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }
                ]}
              >
                <View style={{ width: 45, height: 8, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 4 }} />
              </Animated.View>
            ) : distanceText && distanceText !== '-- km' ? (
              <View style={[styles.distanceBadge, { flexShrink: 1 }]}>
                <Ionicons name="location-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={[styles.distanceText, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">
                  {distanceText}
                </Text>
              </View>
            ) : null}
          </BlurView>
        ) : (
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              overflow: 'hidden',
              backgroundColor: 'rgba(25, 25, 25, 0.85)',
            }}
          >
            {/* Left Column: Primary Title & Location Tag */}
            <View style={{ flex: 1, marginRight: 12, justifyContent: 'center' }}>
              <Text 
                style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '700',
                  fontFamily: getFontFamily('700'),
                  marginBottom: 2,
                }}
                numberOfLines={1}
              >
                {locale.name}
              </Text>
              <Text 
                style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: 12,
                  fontWeight: '500',
                  fontFamily: getFontFamily('500'),
                }}
                numberOfLines={1}
              >
                {locale.countryCode}
              </Text>
            </View>
            {distanceText === 'Calculating...' ? (
              <Animated.View
                style={[
                  styles.distanceBadge,
                  {
                    opacity: skeletonAnim,
                    width: 70,
                    height: 20,
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }
                ]}
              >
                <View style={{ width: 45, height: 8, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 4 }} />
              </Animated.View>
            ) : distanceText && distanceText !== '-- km' ? (
              <View style={[styles.distanceBadge, { flexShrink: 1 }]}>
                <Ionicons name="location-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={[styles.distanceText, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">
                  {distanceText}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.locale?._id === nextProps.locale?._id &&
    prevProps.locale?.name === nextProps.locale?.name &&
    prevProps.locale?.countryCode === nextProps.locale?.countryCode &&
    prevProps.locale?.imageUrl === nextProps.locale?.imageUrl &&
    prevProps.locale?.latitude === nextProps.locale?.latitude &&
    prevProps.locale?.longitude === nextProps.locale?.longitude &&
    prevProps.locale?.distanceKm === nextProps.locale?.distanceKm &&
    prevProps.index === nextProps.index &&
    prevProps.cardWidth === nextProps.cardWidth &&
    prevProps.cardHeight === nextProps.cardHeight &&
    prevProps.screenHeight === nextProps.screenHeight &&
    prevProps.isDark === nextProps.isDark &&
    prevProps.userLocation?.latitude === nextProps.userLocation?.latitude &&
    prevProps.userLocation?.longitude === nextProps.userLocation?.longitude
  );
});

// Standalone Memoized Saved Locale Card Component
interface SavedLocaleCardProps {
  locale: Locale;
  index: number;
  userLocation: any;
  resolveLocaleDistance: (locale: Locale) => number | null;
  formatLocaleDistance: (locale: Locale) => string;
  openLocaleDetail: (locale: Locale) => void;
  unsaveLocale: (localeId: string) => void;
  skeletonAnim: Animated.Value;
  styles: any;
}

const SavedLocaleCard = React.memo(({
  locale,
  index,
  userLocation,
  resolveLocaleDistance,
  formatLocaleDistance,
  openLocaleDetail,
  unsaveLocale,
  skeletonAnim,
  styles,
}: SavedLocaleCardProps) => {
  const safeName = typeof locale?.name === 'string' ? locale.name : '';
  const safeCountryCode = typeof locale?.countryCode === 'string' ? locale.countryCode : '';
  const safeDescription = typeof locale?.description === 'string' ? locale.description : '';
  const safeImageUrl = typeof locale?.imageUrl === 'string' && locale.imageUrl ? locale.imageUrl : '';

  const d = resolveLocaleDistance(locale);
  const distanceText = formatLocaleDistance(locale);

  return (
    <TouchableOpacity
      style={[
        styles.locationCard,
        styles.wideCard,
        { marginBottom: 16 }
      ]}
      onPress={() => openLocaleDetail(locale)}
      accessibilityLabel={`${safeName}, ${safeCountryCode}`}
      accessibilityRole="button"
      accessibilityHint="Opens locale details"
    >
      {safeImageUrl ? (
        <View style={StyleSheet.absoluteFillObject}>
          <ExpoImageWithShimmer
            source={{ uri: optimizeCloudinaryUrl(safeImageUrl, { width: 300, height: 200 }) }}
            style={styles.cardImage as ImageStyle}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
            placeholder={(locale as any).blurhash || 'L6PZ|Ye.dHNGo~WhZ~StH?S#xZ$*'}
          />
        </View>
      ) : (
        <LinearGradient
          colors={['#D4EDDA', '#A8DADC']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.mapPlaceholder}>
            <Ionicons name="location" size={40} color="#2C5530" />
          </View>
        </LinearGradient>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.5, 1]}
        style={styles.cardGradient}
      />
      <View style={styles.cardContent}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="location" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.cardTitle}>{safeName}</Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: '#FFFFFF' }]}>
          {safeCountryCode}
        </Text>
        {safeDescription ? (
          <Text style={[styles.cardSubtitle, { color: '#FFFFFF', marginTop: 4 }]} numberOfLines={1}>
            {safeDescription}
          </Text>
        ) : null}
      </View>
      {distanceText === 'Calculating...' ? (
        <Animated.View
          style={[
            styles.distanceBadgeAbsolute,
            {
              opacity: skeletonAnim,
              width: 70,
              height: 22,
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              justifyContent: 'center',
              alignItems: 'center',
            }
          ]}
        >
          <View style={{ width: 45, height: 8, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 4 }} />
        </Animated.View>
      ) : distanceText && distanceText !== '-- km' ? (
        <View style={[styles.distanceBadgeAbsolute, { flexShrink: 1 }]}>
          <Ionicons name="location-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={[styles.distanceText, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">
            {distanceText}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.saveButton}
        onPress={(e) => {
          e?.stopPropagation?.();
          if (locale?._id) unsaveLocale(locale._id);
        }}
        accessibilityLabel={`Remove ${safeName} from saved`}
        accessibilityRole="button"
      >
        <MaskedView
          style={{ width: 20, height: 20 }}
          maskElement={
            <Ionicons name="bookmark" size={20} color="#000000" />
          }
        >
          <LinearGradient
            colors={['#1C73B4', '#50C878']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </MaskedView>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.locale?._id === nextProps.locale?._id &&
    prevProps.locale?.name === nextProps.locale?.name &&
    prevProps.locale?.countryCode === nextProps.locale?.countryCode &&
    prevProps.locale?.imageUrl === nextProps.locale?.imageUrl &&
    prevProps.locale?.latitude === nextProps.locale?.latitude &&
    prevProps.locale?.longitude === nextProps.locale?.longitude &&
    prevProps.locale?.distanceKm === nextProps.locale?.distanceKm &&
    prevProps.index === nextProps.index &&
    prevProps.userLocation?.latitude === nextProps.userLocation?.latitude &&
    prevProps.userLocation?.longitude === nextProps.userLocation?.longitude
  );
});

export default function LocaleScreen() {
  const { showSuccess, showError, showInfo } = useAlert();
  const { handleScroll } = useScrollToHideNav();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(insets.top > 0 ? insets.top + 130 : 170);
  const [savedLocales, setSavedLocales] = useState<Locale[]>([]);
  const [adminLocales, setAdminLocales] = useState<Locale[]>([]);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [filteredLocales, setFilteredLocales] = useState<Locale[]>([]);
  const [loadingLocales, setLoadingLocales] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState<string | null>(null);
  const [calculatingDistances, setCalculatingDistances] = useState(false);
  const [activeTab, setActiveTab] = useState<'locale' | 'saved'>('locale');
  // searchInput drives the TextInput value (immediate); searchQuery is the
  // debounced/applied value that all search and filter effects key off. Splitting
  // them keeps typing from triggering loadAdminLocales / applyFilters on every
  // keystroke (which previously caused a loading flash on each character).
  const [searchLocaleInput, setSearchLocaleInput] = useState('');
  const [searchLocaleQuery, setSearchLocaleQuery] = useState('');
  const [searchSavedInput, setSearchSavedInput] = useState('');
  const [searchSavedQuery, setSearchSavedQuery] = useState('');

  const searchInput = activeTab === 'locale' ? searchLocaleInput : searchSavedInput;
  const setSearchInput = useCallback((text: string) => {
    if (activeTab === 'locale') {
      setSearchLocaleInput(text);
    } else {
      setSearchSavedInput(text);
    }
  }, [activeTab]);
  const searchQuery = activeTab === 'locale' ? searchLocaleQuery : searchSavedQuery;
  const setSearchQuery = useCallback((text: string) => {
    if (activeTab === 'locale') {
      setSearchLocaleQuery(text);
    } else {
      setSearchSavedQuery(text);
    }
  }, [activeTab]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [isFetchingStates, setIsFetchingStates] = useState(false);
  const [radiusInput, setRadiusInput] = useState('');
  const [activeLocaleFilters, dispatchLocaleFilter] = useReducer(filterReducer, {
    country: '',
    countryCode: '',
    stateProvince: '',
    stateCode: '',
    spotTypes: [],
    searchRadius: '',
  });

  const [activeSavedFilters, dispatchSavedFilter] = useReducer(filterReducer, {
    country: '',
    countryCode: '',
    stateProvince: '',
    stateCode: '',
    spotTypes: [],
    searchRadius: '',
  });

  const filters = activeTab === 'locale' ? activeLocaleFilters : activeSavedFilters;
  const dispatchFilter = activeTab === 'locale' ? dispatchLocaleFilter : dispatchSavedFilter;
  
  // Responsive dimensions (inside component to ensure they're accessible)
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const isTabletLocal = screenWidth >= 768;
  const isWebLocal = Platform.OS === 'web';
  const isIOSLocal = Platform.OS === 'ios';
  const isAndroidLocal = Platform.OS === 'android';

  const CARD_WIDTH = isTabletLocal ? (screenWidth - 48) : (screenWidth - 32);
  const CARD_HEIGHT = CARD_WIDTH * 10 / 16;

  const scrollY = useRef(new Animated.Value(0)).current;
  const savedScrollOffsetRef = useRef<number>(0);
  const flatListRef = useRef<any>(null);
  const filterScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      savedScrollOffsetRef.current = value;
    });
    return () => {
      scrollY.removeListener(id);
    };
  }, [scrollY]);

  // Pulsing animation for skeletons
  const skeletonAnim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonAnim, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [skeletonAnim]);

  const handleVerticalScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (event: any) => {
        handleScroll(event);
      },
    }
  ), [scrollY, handleScroll]);
  
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
  const loadedPagesCountRef = useRef(0);
  const geospatialCursorRef = useRef<string | number | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allLocalesWithDistances, setAllLocalesWithDistances] = useState<(Locale & { distanceKm?: number | null })[]>([]);
  const [displayedPage, setDisplayedPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  
  // Load guard: Prevent multiple loads per session
  const loadedOnceRef = useRef(false);
  
  // Grasp Country Defaulting Refs
  const hasDefaultedCountryRef = useRef(false);
  const isCountryDefaultedRef = useRef(false);
  
  // Distance Calculation Guards: Cache calculated distances per session
  const distanceCacheRef = useRef<Map<string, number>>(new Map());
  
  // Geocoding cache: Store geocoded coordinates for locales
  const geocodedCoordsCacheRef = useRef<Map<string, { latitude: number; longitude: number }>>(new Map());
  
  // Google Geocoding cache: Store real coordinates from Google Geocoding API
  const googleGeocodeCacheRef = useRef<Map<string, { lat: number; lon: number }>>(new Map());
  const geocodingInProgressRef = useRef<Set<string>>(new Set());
  
  // User's current location for distance calculation
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocationAccurate, setIsLocationAccurate] = useState(false);
  const [drivingDistances, setDrivingDistances] = useState<Record<string, number>>({});
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const kalmanFilterRef = useRef<KalmanFilter | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [userCountryCode, setUserCountryCode] = useState<string | null>(null);
  const [userState, setUserState] = useState<string | null>(null);
  const [userStateCode, setUserStateCode] = useState<string | null>(null);
  
  // State and ref to track if user's location is currently being resolved
  const [isLocationResolving, setIsLocationResolving] = useState(true);
  const isLocationResolvingRef = useRef(true);
  isLocationResolvingRef.current = isLocationResolving;

  // Ref to lock coordinates used for the current query session (ensures consistent sorting across page fetches)
  const queryLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const roundedUserLocStr = useMemo(() => {
    if (!userLocation) return null;
    return `${userLocation.latitude.toFixed(1)}_${userLocation.longitude.toFixed(1)}`;
  }, [userLocation]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isRefetching,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      'locales',
      searchLocaleQuery,
      activeLocaleFilters.countryCode,
      activeLocaleFilters.stateCode,
      activeLocaleFilters.spotTypes,
      activeLocaleFilters.stateProvince,
      roundedUserLocStr,
    ],
    queryFn: async ({ pageParam }) => {
      // First page fetch: lock the coordinates for this query session
      if (pageParam === null || pageParam === undefined) {
        queryLocationRef.current = userLocationRef.current
          ? { latitude: userLocationRef.current.latitude, longitude: userLocationRef.current.longitude }
          : null;
      }

      const activeLoc = queryLocationRef.current;
      const res = await getLocales(
        searchLocaleQuery.trim(),
        (activeLocaleFilters.countryCode && activeLocaleFilters.countryCode !== 'all') ? activeLocaleFilters.countryCode : '',
        (activeLocaleFilters.stateCode && activeLocaleFilters.stateCode !== 'all') ? activeLocaleFilters.stateCode : '',
        activeLocaleFilters.spotTypes && activeLocaleFilters.spotTypes.length > 0 ? activeLocaleFilters.spotTypes : '',
        1,
        100,
        false,
        activeLocaleFilters.stateProvince || '',
        undefined,
        activeLoc?.latitude ?? undefined,
        activeLoc?.longitude ?? undefined,
        pageParam
      );
      return res;
    },
    initialPageParam: null as string | number | null,
    getNextPageParam: (lastPage) => {
      return lastPage.pagination?.hasMore ? lastPage.pagination?.nextCursor : undefined;
    },
    enabled: !isLocationResolving,
    staleTime: 5 * 60 * 1000,
  });

  // Reset loaded pages count on refetch so we reconstruct adminLocales from scratch
  useEffect(() => {
    if (isRefetching) {
      loadedPagesCountRef.current = 0;
    }
  }, [isRefetching]);

  // Synchronize adminLocales with query pages and drivingDistances in a stable way
  useEffect(() => {
    if (!data?.pages || data.pages.length === 0) {
      setAdminLocales([]);
      loadedPagesCountRef.current = 0;
      return;
    }

    const currentPagesCount = data.pages.length;
    const activeQueryLoc = queryLocationRef.current;

    const mapLocaleDistances = (locale: Locale) => {
      const drivingDist = drivingDistances[locale._id];
      const distanceKm = drivingDist !== undefined ? drivingDist : (
        typeof locale.latitude === 'number' && Number.isFinite(locale.latitude) &&
        typeof locale.longitude === 'number' && Number.isFinite(locale.longitude) &&
        activeQueryLoc && locationPermissionGranted
          ? calculateDistance(activeQueryLoc.latitude, activeQueryLoc.longitude, locale.latitude, locale.longitude)
          : null
      );
      
      return {
        ...locale,
        localeId: String(locale._id),
        distanceKm,
      };
    };

    const sortMappedLocales = (localesToSort: any[]) => {
      if (activeQueryLoc) {
        const INFINITY = Number.POSITIVE_INFINITY;
        return [...localesToSort].sort((a, b) => {
          const dA = a.distanceKm;
          const dB = b.distanceKm;
          const effA = (dA !== null && dA !== undefined && !isNaN(dA)) ? dA : INFINITY;
          const effB = (dB !== null && dB !== undefined && !isNaN(dB)) ? dB : INFINITY;
          return effA - effB;
        });
      }
      
      return [...localesToSort].sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
    };

    if (currentPagesCount === 1) {
      const page1Locales = data.pages[0].locales || [];
      const mapped = page1Locales.map(mapLocaleDistances);
      const sorted = sortMappedLocales(mapped);
      setAdminLocales(sorted);
      setDisplayLimit(20);
      loadedPagesCountRef.current = 1;
    } else if (currentPagesCount > loadedPagesCountRef.current) {
      let newMappedList = loadedPagesCountRef.current === 0 ? [] : [...adminLocales];
      for (let i = loadedPagesCountRef.current; i < currentPagesCount; i++) {
        const newPageLocales = data.pages[i].locales || [];
        const mappedPage = newPageLocales.map(mapLocaleDistances);
        const sortedPage = sortMappedLocales(mappedPage);
        newMappedList = [...newMappedList, ...sortedPage];
      }
      setAdminLocales(newMappedList);
      setDisplayLimit(prev => prev + 20);
      loadedPagesCountRef.current = currentPagesCount;
    }
  }, [data, locationPermissionGranted]);

  // Update distances and re-sort whenever user or driving distances change.
  useEffect(() => {
    if (!userLocation || !locationPermissionGranted || adminLocales.length === 0) return;
    
    setAdminLocales(prev => {
      let changed = false;
      const updated = prev.map(locale => {
        const drivingDist = drivingDistances[locale._id];
        if (drivingDist !== undefined) {
          if (locale.distanceKm !== drivingDist) {
            changed = true;
            return { ...locale, distanceKm: drivingDist };
          }
          return locale;
        }
        if (
          typeof locale.latitude === 'number' && Number.isFinite(locale.latitude) &&
          typeof locale.longitude === 'number' && Number.isFinite(locale.longitude)
        ) {
          const straightLineDistance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            locale.latitude,
            locale.longitude
          );
          if (locale.distanceKm !== straightLineDistance) {
            changed = true;
            return { ...locale, distanceKm: straightLineDistance };
          }
        }
        return locale;
      });
      if (!changed) return prev;
      
      const INFINITY = Number.POSITIVE_INFINITY;
      return [...updated].sort((a, b) => {
        const dA = a.distanceKm;
        const dB = b.distanceKm;
        const effA = (dA !== null && dA !== undefined && !isNaN(dA)) ? dA : INFINITY;
        const effB = (dB !== null && dB !== undefined && !isNaN(dB)) ? dB : INFINITY;
        return effA - effB;
      });
    });
  }, [userLocation, locationPermissionGranted, drivingDistances, adminLocales.length]);

  useEffect(() => {
    setHasMore((displayLimit < adminLocales.length) || !!hasNextPage);
  }, [hasNextPage, displayLimit, adminLocales.length]);

  useEffect(() => {
    setLoadingMore(isFetchingNextPage);
  }, [isFetchingNextPage]);

  useEffect(() => {
    setLoadingLocales(isLoading);
  }, [isLoading]);

  useEffect(() => {
    if (data?.pages) {
      const lastPage = data.pages[data.pages.length - 1];
      if (lastPage?.pagination?.totalPages) {
        setTotalPages(lastPage.pagination.totalPages);
      }
    }
  }, [data]);

  useEffect(() => {
    if (!userLocation || !locationPermissionGranted || adminLocales.length === 0) return;

    const userLat = roundCoord(userLocation.latitude);
    const userLon = roundCoord(userLocation.longitude);

    adminLocales.forEach(async (locale) => {
      if (drivingDistanceCalculatedRef.current.has(locale._id)) return;
      if (!locale.latitude || !locale.longitude) return;

      try {
        const dist = await getLocaleDistanceKm(
          locale._id.toString(),
          userLat,
          userLon,
          locale.latitude,
          locale.longitude
        );
        if (dist !== null && isMountedRef.current) {
          drivingDistanceCalculatedRef.current.add(locale._id);
          setDrivingDistances(prev => ({
            ...prev,
            [locale._id]: dist
          }));
        }
      } catch (error) {
        logger.debug('Failed to calculate driving distance for ' + locale.name, { error });
      }
    });
  }, [adminLocales, userLocation, locationPermissionGranted]);
  
  // Bookmark Stability: Track in-flight bookmark operations
  const bookmarkingKeysRef = useRef<Set<string>>(new Set());

  // Stale-while-revalidate cache for the saved-tab background URL refresh.
  // Maps localeId → last fetch timestamp (ms). loadSavedLocales skips
  // re-fetching a locale within 60s of the previous successful fetch.
  // Without this the user could thrash the backend by tab-switching.
  const bgRefreshCacheRef = useRef<Map<string, number>>(new Map());
  
  // Refs to prevent stale closure bugs in asynchronous/deferred calls like setTimeout and loadAdminLocalesRef
  const filtersRef = useRef(activeLocaleFilters);
  filtersRef.current = activeLocaleFilters;

  const searchQueryRef = useRef(searchLocaleQuery);
  searchQueryRef.current = searchLocaleQuery;

  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;

  const locationPermissionGrantedRef = useRef(locationPermissionGranted);
  locationPermissionGrantedRef.current = locationPermissionGranted;
  
  const applyFiltersRef = useRef<any>(null);
  const sortLocalesWithSnapshotRef = useRef<any>(null);
  
  const { theme, mode, isDark } = useTheme();
  const router = useRouter();

  const spotTypeOptions = [
    'Historical spots',
    'Cultural spots',
    'Natural spots',
    'Adventure spots',
    'Religious/spiritual spots',
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
      }

      if (!isLocationEnabled) {
        logger.debug('Location services are disabled on device');
        setLocationPermissionGranted(false);
        return;
      }

      // Get existing permission only (do not auto-request on tab open)
      let permissionStatus = 'undetermined';
      try {
        const currentPermission = await Location.getForegroundPermissionsAsync();
        permissionStatus = currentPermission.status;
      } catch (permissionError) {
        logger.debug('Error getting location permission status:', permissionError);
        setLocationPermissionGranted(false);
        return;
      }

      if (permissionStatus !== 'granted') {
        logger.debug('Location permission denied, distance sorting will be unavailable');
        setLocationPermissionGranted(false);
        return;
      }
      
      setLocationPermissionGranted(true);

      // Get cached location first for instant response (non-blocking)
      Location.getLastKnownPositionAsync()
        .then((lastKnown) => {
          if (lastKnown && lastKnown.coords && isMountedRef.current) {
            const coords = {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            };
            setUserLocation(coords);
            invalidateDistanceCacheIfMoved(coords.latitude, coords.longitude);
            logger.debug('✅ User last known location obtained:', coords);
          }
        })
        .catch((lastKnownError) => {
          logger.debug('Failed to get last known location:', lastKnownError);
        });

      // Clear any existing subscription
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }

      const tryGoogleReverseGeocode = function(c: { latitude: number, longitude: number }) {
        if (!isMountedRef.current) return;
        const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKey();
        if (!GOOGLE_MAPS_API_KEY) return;
        
        const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${c.latitude},${c.longitude}&key=${GOOGLE_MAPS_API_KEY}`;
        
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
              if (detectedCity || detectedCountryCode) {
                updateDynamicLocation(detectedCity || undefined, detectedCountryCode || undefined).catch((err) => {
                  logger.debug('Failed to sync dynamic location to backend', err);
                });
              }
            }
          })
          .catch(function(googleError: any) {
            logger.debug('⚠️ Google reverse geocoding error:', googleError);
          });
      };
      
      const performReverseGeocode = function(c: { latitude: number, longitude: number }) {
        if (!isMountedRef.current) return;
        
        Location.reverseGeocodeAsync(c)
          .then(function(expoResults: Location.LocationGeocodedAddress[]) {
            if (!isMountedRef.current) return;
            if (!expoResults || expoResults.length === 0) {
              tryGoogleReverseGeocode(c);
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
              if (expoCity || expoCountryCode) {
                updateDynamicLocation(expoCity || undefined, expoCountryCode || undefined).catch((err) => {
                  logger.debug('Failed to sync dynamic location to backend', err);
                });
              }
            }
            
            if (!expoState) {
              tryGoogleReverseGeocode(c);
            }
          })
          .catch(function(expoError: any) {
            logger.debug('⚠️ Expo reverse geocode failed:', expoError);
            tryGoogleReverseGeocode(c);
          });
      };

      const fallbackTimeoutId = setTimeout(() => {
        if (!isMountedRef.current) return;
        if (locationWatcherRef.current) {
          logger.debug('Location watch reached fallback timeout, accepting current location');
          setIsLocationAccurate(true);
          locationWatcherRef.current.remove();
          locationWatcherRef.current = null;
        }
      }, 12000);

      locationWatcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        (newLocation) => {
          if (!isMountedRef.current) return;
          if (newLocation && newLocation.coords) {
            const coords = newLocation.coords;
            const ts = newLocation.timestamp;
            
            let smoothed;
            if (!kalmanFilterRef.current) {
              kalmanFilterRef.current = new KalmanFilter(coords.latitude, coords.longitude, coords.accuracy || 20, ts);
              smoothed = { latitude: coords.latitude, longitude: coords.longitude };
            } else {
              smoothed = kalmanFilterRef.current.update(coords.latitude, coords.longitude, coords.accuracy || 20, ts, coords.speed || undefined);
            }

            setUserLocation(smoothed);
            invalidateDistanceCacheIfMoved(smoothed.latitude, smoothed.longitude);

            const accuracy = coords.accuracy ?? 1000;
            if (accuracy <= 20) {
              setIsLocationAccurate(true);
              
              if (fallbackTimeoutId) {
                clearTimeout(fallbackTimeoutId);
              }
              
              performReverseGeocode(smoothed);

              if (locationWatcherRef.current) {
                locationWatcherRef.current.remove();
                locationWatcherRef.current = null;
              }
            }
          }
        }
      );
    } catch (error: any) {
      setLocationPermissionGranted(false);
      logger.error('Error in location watching initialization:', error);
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
        isLocationResolvingRef.current = true;
        setIsLocationResolving(true);
        
        // Safety timeout to ensure location resolving is always unfrozen (max 4s)
        const safetyTimeout = setTimeout(() => {
          if (isLocationResolvingRef.current && isMountedRef.current) {
            logger.warn('Location resolving safety timeout reached, unfreezing');
            isLocationResolvingRef.current = false;
            setIsLocationResolving(false);
            setLoading(false);
          }
        }, 4000);

        // First, try to get user location (with retry)
        let locationRetries = 0;
        const maxLocationRetries = 2;
        
        while (locationRetries < maxLocationRetries && isMountedRef.current) {
          try {
            await getUserCurrentLocation();
            // Small delay to allow state update
            await new Promise(resolve => setTimeout(resolve, 500));
            // Continue regardless - location will be used when available
            break;
          } catch (error) {
            logger.debug(`Location fetch attempt ${locationRetries + 1} failed:`, error);
          }
          locationRetries++;
          if (locationRetries < maxLocationRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
          }
        }
        
        clearTimeout(safetyTimeout);
        
        if (isMountedRef.current) {
          isLocationResolvingRef.current = false;
          setIsLocationResolving(false);
        }
        
        // Then load other data
        await loadCountries();

        if (isMountedRef.current) {
          setLoading(false);
        }

        const loadTime = Date.now() - startTime;
        logger.debug(`[PERF] Locale screen initial data loaded in ${loadTime}ms`);
      } catch (error) {
        logger.error('Error initializing data:', error);
        if (isMountedRef.current) {
          isLocationResolvingRef.current = false;
          setIsLocationResolving(false);
          setLoading(false);
        }
      }
    };

    initializeData();
    
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
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
    };
  }, [getUserCurrentLocation]);

  const handleRequestLocationForSort = useCallback(async () => {
    setShowLocationDisclosure(true);
  }, []);

  const handleDisclosureContinue = useCallback(async () => {
    setShowLocationDisclosure(false);
    try {
      const fgResult = await Location.requestForegroundPermissionsAsync();
      if (fgResult.status === 'granted') {
        setLocationPermissionGranted(true);
        // Trigger location resolving
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          invalidateDistanceCacheIfMoved(loc.coords.latitude, loc.coords.longitude);
        } catch (err) {
          logger.warn('Failed to resolve current location after granting permission:', err);
        }
      }
    } catch (err) {
      logger.error('Error requesting location permission in locale tab:', err);
    }
  }, []);

  const handleDisclosureCancel = useCallback(() => {
    setShowLocationDisclosure(false);
  }, []);

  // Trigger fetches when location resolving is done
  useEffect(() => {
    if (!isLocationResolving) {
      logger.debug('🌍 Location resolving completed.');
      loadSavedLocalesRef.current();
    }
  }, [isLocationResolving]);

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
  // Returns null if location is not stable (missing lat/lon)
  const getLocationSnapshotKey = useCallback((): string | null => {
    if (!userLocation || !locationPermissionGranted) {
      return null;
    }
    
    const lat = userLocation.latitude;
    const lon = userLocation.longitude;
    
    // Location snapshot is stable if we have coordinates
    // city, region, and countryCode are optional but included in key for proper re-sorting when they become available
    if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
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
  }, [getLocationSnapshotKey, userLocation, userCity, userState, userCountryCode]);  const loadAdminLocales = useCallback(async (forceRefresh = false, isBackground = false) => {
    if (forceRefresh) {
      await refetch();
    } else {
      await fetchNextPage();
    }
  }, [refetch, fetchNextPage]);

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
        
        // Calculate distance with geocoded coordinates
        const userLat = userLocationRef.current ? roundCoord(userLocationRef.current.latitude) : null;
        const userLon = userLocationRef.current ? roundCoord(userLocationRef.current.longitude) : null;
        const distanceKm = userLat !== null && userLon !== null && locationPermissionGrantedRef.current
          ? calculateDistance(userLat, userLon, geocodedCoords.latitude, geocodedCoords.longitude)
          : null;
        
        // Return locale with coordinates and distance
        const updatedLocale = { 
          ...locale, 
          latitude: geocodedCoords.latitude, 
          longitude: geocodedCoords.longitude,
          distanceKm
        };
        
        // Update the locale in adminLocales state
        if (isMountedRef.current) {
          setAdminLocales(prev => {
            const updated = prev.map(l => l._id === locale._id ? updatedLocale : l);
            if (userLat !== null && userLon !== null && locationPermissionGrantedRef.current) {
              const INFINITY = Number.POSITIVE_INFINITY;
              return [...updated].sort((a, b) => {
                const dA = a.distanceKm;
                const dB = b.distanceKm;
                const effA = (dA !== null && dA !== undefined && !isNaN(dA)) ? dA : INFINITY;
                const effB = (dB !== null && dB !== undefined && !isNaN(dB)) ? dB : INFINITY;
                return effA - effB;
              });
            }
            return updated;
          });
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
    if (!userLocation) {
      return null;
    }

    // 1. Check shared distanceCache first for driving distance
    const userLat = roundCoord(userLocation.latitude);
    const userLon = roundCoord(userLocation.longitude);
    const cacheKey = `${locale._id}-${userLat}-${userLon}`;
    if (distanceCache.has(cacheKey)) {
      const cached = distanceCache.get(cacheKey);
      if (cached !== undefined && cached !== null) {
        return cached;
      }
    }

    // 2. First check if distanceKm is already stored in locale object (from updated state)
    if (locale.distanceKm !== undefined && locale.distanceKm !== null) {
      return locale.distanceKm;
    }
    
    // Use coordinates from locale (may be geocoded)
    const lat = locale.latitude;
    const lng = locale.longitude;
    
    if (!lat || !lng || lat === 0 || lng === 0) {
      return null;
    }
    
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
    
    // Bug: nearest locale should be shown on top when location is on.
    // Pure distance-first sort — same-city/state/country tiers previously
    // demoted closer out-of-region locales below farther in-region ones.
    const hasUserLocation = typeof snapshot.lat === 'number' && typeof snapshot.lon === 'number';
    if (hasUserLocation) {
      const INFINITY = Number.POSITIVE_INFINITY;
      sorted.sort((a, b) => {
        const dA = getLocaleDistance(a);
        const dB = getLocaleDistance(b);
        const effA = (dA !== null && dA !== undefined && !isNaN(dA)) ? dA : INFINITY;
        const effB = (dB !== null && dB !== undefined && !isNaN(dB)) ? dB : INFINITY;
        return effA - effB;
      });
      if (__DEV__ && sorted.length > 0) {
        logger.debug('✅ Pure distance sort - first 5 locales:', sorted.slice(0, 5).map(l => ({
          name: l.name, distance: (l as any).distanceKm
        })));
      }
      return sorted;
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
  
  sortLocalesWithSnapshotRef.current = sortLocalesWithSnapshot;
  
  const sortLocalesByDistance = useCallback((locales: Locale[]): Locale[] => {
    if (userLocation) {
      const INFINITY = Number.POSITIVE_INFINITY;
      return [...locales].sort((a, b) => {
        const dA = getLocaleDistance(a);
        const dB = getLocaleDistance(b);
        const effA = (dA !== null && dA !== undefined && !isNaN(dA)) ? dA : INFINITY;
        const effB = (dB !== null && dB !== undefined && !isNaN(dB)) ? dB : INFINITY;
        return effA - effB;
      });
    }
    
    // Fallback: sort by createdAt if no location
    return [...locales].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [userLocation, getLocaleDistance]);
  
  // Bookmark Stability: Load saved locales with defensive parsing
  const loadSavedLocales = useCallback(async () => {
    if (!isMountedRef.current) return;

    // Guard: Do not load saved locales until location has finished resolving
    if (isLocationResolvingRef.current) {
      logger.debug('loadSavedLocales skipped: location is resolving');
      return;
    }

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

      // Normalize every entry into a guaranteed-shape Locale so the saved-tab
      // renderer never sees objects where strings are expected (older app
      // versions occasionally persisted Buffer/ObjectId for `_id` or signed-
      // URL objects for `imageUrl`, which crashed the render). Anything that
      // can't be coerced to a usable string ID is dropped.
      const normalize = (raw: any): Locale | null => {
        if (!raw || typeof raw !== 'object') return null;
        const idStr =
          typeof raw._id === 'string'
            ? raw._id
            : raw._id && typeof raw._id.toString === 'function'
              ? String(raw._id)
              : '';
        if (!idStr) return null;
        const asString = (v: any): string => (typeof v === 'string' ? v : '');
        const asNumber = (v: any): number | undefined => {
          if (typeof v === 'number' && !Number.isNaN(v)) return v;
          if (typeof v === 'string' && v.trim() !== '') {
            const n = parseFloat(v);
            return Number.isNaN(n) ? undefined : n;
          }
          return undefined;
        };
        const imageUrls = Array.isArray(raw.imageUrls)
          ? raw.imageUrls.filter((u: any) => typeof u === 'string' && u)
          : [];
        const spotTypes = Array.isArray(raw.spotTypes)
          ? raw.spotTypes.filter((s: any) => typeof s === 'string' && s)
          : [];
        return {
          _id: idStr,
          name: asString(raw.name),
          country: asString(raw.country),
          countryCode: asString(raw.countryCode),
          stateProvince: asString(raw.stateProvince),
          stateCode: asString(raw.stateCode),
          city: asString(raw.city),
          description: asString(raw.description),
          imageUrl: asString(raw.imageUrl),
          imageUrls,
          spotTypes,
          travelInfo: asString(raw.travelInfo),
          latitude: asNumber(raw.latitude),
          longitude: asNumber(raw.longitude),
          isActive: raw.isActive !== false,
          createdAt: asString(raw.createdAt) || new Date(0).toISOString(),
        } as Locale;
      };

      const normalized = locales
        .map(normalize)
        .filter((l): l is Locale => l !== null);

      // Deduplicate by locale ID (now guaranteed to be a string)
      const localeMap = new Map<string, Locale>();
      normalized.forEach(locale => {
        localeMap.set(locale._id, locale);
      });
      const uniqueLocales = Array.from(localeMap.values());

      // Render the persisted data IMMEDIATELY so the Saved tab is
      // responsive. The previous flow awaited N parallel getLocaleById
      // calls + N getLocaleDistanceKm calls before calling setSavedLocales,
      // which on a slow connection or with 10+ saves blocked the list
      // from rendering for several seconds. Now we paint the cached data
      // first, then patch in fresh URLs / distances as they arrive.
      const cachedSorted = sortLocalesByDistance(uniqueLocales);
      if (isMountedRef.current) {
        setSavedLocales(cachedSorted);
        if (uniqueLocales.length !== locales.length) {
          // Self-heal AsyncStorage if normalization dropped bad entries.
          // Strip distanceKm before persisting — must always be recalculated from live GPS
          const stripped = cachedSorted.map(({ distanceKm, ...rest }: any) => rest);
          AsyncStorage.setItem('savedLocales', JSON.stringify(stripped)).catch(() => {});
        }
      }

      // Background refresh: signed URLs from the API. Each fetch resolves
      // independently and patches that single locale into state via a
      // functional setState — no await on the full set, so a slow API
      // response on one entry doesn't block the others.
      // Skip locales with synthetic ids (`admin-…`) — no server record.
      uniqueLocales.forEach((locale) => {
        if (!locale._id || locale._id.startsWith('admin-')) return;
        // Use a stale-while-revalidate cache to avoid hammering the API
        // when the user toggles tabs rapidly. Keyed by locale id, fresh
        // for 60s.
        const lastFetchAt = bgRefreshCacheRef.current.get(locale._id) || 0;
        if (Date.now() - lastFetchAt < 60_000) return;
        bgRefreshCacheRef.current.set(locale._id, Date.now());

        getLocaleById(locale._id)
          .then(async (fresh) => {
            if (!isMountedRef.current) return;
            if (!fresh || typeof fresh !== 'object') return;
            setSavedLocales((prev) => prev.map((existing) => {
              if (existing._id !== locale._id) return existing;
              return {
                ...existing,
                ...fresh,
                imageUrl: typeof fresh.imageUrl === 'string' && fresh.imageUrl
                  ? fresh.imageUrl
                  : existing.imageUrl,
                imageUrls: Array.isArray(fresh.imageUrls) && fresh.imageUrls.length > 0
                  ? fresh.imageUrls
                  : existing.imageUrls,
                _id: existing._id,
                distanceKm: (existing as any).distanceKm,
              } as Locale;
            }));

            // Persist the refreshed image URL back to AsyncStorage cache
            try {
              const saved = await AsyncStorage.getItem('savedLocales');
              if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                  const updated = parsed.map((existing: any) => {
                    const existingId = typeof existing._id === 'string' ? existing._id : String(existing._id || '');
                    if (existingId !== locale._id) return existing;
                    return {
                      ...existing,
                      ...fresh,
                      imageUrl: typeof fresh.imageUrl === 'string' && fresh.imageUrl
                        ? fresh.imageUrl
                        : existing.imageUrl,
                      imageUrls: Array.isArray(fresh.imageUrls) && fresh.imageUrls.length > 0
                        ? fresh.imageUrls
                        : existing.imageUrls,
                      _id: existingId,
                    };
                  });
                  const stripped = updated.map(({ distanceKm, ...rest }: any) => rest);
                  await AsyncStorage.setItem('savedLocales', JSON.stringify(stripped));
                }
              }
            } catch (err) {
              logger.warn('Failed to persist background-refreshed locales to AsyncStorage', err);
            }
          })
          .catch(() => {
            // Drop the cache so we'll retry on next load. Persisted URL
            // stays as the visible fallback meanwhile.
            bgRefreshCacheRef.current.delete(locale._id);
          });
      });

      // Background distance calc — only when user location is available.
      // Same pattern: per-locale promises that patch state as they finish.
      if (userLocation && locationPermissionGranted) {
        const userLat = roundCoord(userLocation.latitude);
        const userLon = roundCoord(userLocation.longitude);
        uniqueLocales.forEach((locale) => {
          getLocaleDistanceKm(
            locale._id.toString(),
            userLat,
            userLon,
            locale.latitude,
            locale.longitude
          )
            .then((distanceKm) => {
              if (!isMountedRef.current) return;
              if (distanceKm !== null && distanceKm !== undefined) {
                drivingDistanceCalculatedRef.current.add(locale._id);
                setSavedLocales((prev) => {
                  let changed = false;
                  const next = prev.map((existing) => {
                    if (existing._id !== locale._id) return existing;
                    if ((existing as any).distanceKm === distanceKm) return existing;
                    changed = true;
                    return { ...existing, distanceKm } as Locale;
                  });
                  return changed ? next : prev;
                });
              }
            })
            .catch(() => { /* leave previous distance as-is */ });
        });
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      logger.error('Error loading saved locales', error);
      setSavedLocales([]);
    }
    // userLocation/locationPermissionGranted MUST be deps. Without them the
    // closure captures whatever values existed at first render (typically
    // null userLocation), so saved-tab distances stay stale even after the
    // device location resolves.
  }, [sortLocalesByDistance, userLocation, locationPermissionGranted]);
  
  // Apply client-side filters (for spot types that API doesn't support and saved locales)
  const applyFilters = useCallback((locales: Locale[], isSavedTab = false) => {
    let filtered = [...locales];
    
    const currentFilters = isSavedTab ? activeSavedFilters : activeLocaleFilters;
    const currentSearchInput = isSavedTab ? searchSavedInput : searchLocaleInput;

    if (currentFilters.countryCode && currentFilters.countryCode.trim() !== '') {
      filtered = filtered.filter(locale => 
        locale.countryCode && locale.countryCode.toUpperCase() === currentFilters.countryCode.toUpperCase()
      );
    }
    
    if (currentFilters.stateCode && currentFilters.stateCode.trim() !== '') {
      filtered = filtered.filter(locale => {
        const queryCode = currentFilters.stateCode.trim().toUpperCase();
        const queryProvince = (currentFilters.stateProvince || '').trim().toLowerCase();
        
        const locCode = (locale.stateCode || '').trim().toUpperCase();
        const locProvince = (locale.stateProvince || '').trim().toLowerCase();
        
        // Match if stateCode matches code or name
        // Or if stateProvince matches code or name
        if (locCode) {
          if (locCode === queryCode || locCode.toLowerCase() === queryProvince) {
            return true;
          }
        }
        if (locProvince) {
          if (locProvince === queryProvince || locProvince.toUpperCase() === queryCode) {
            return true;
          }
        }
        return false;
      });
    }
    
    // Filter by spot types (if multiple selected, show locales that match any)
    // Case-insensitive so "Historical spots" matches "historical spots" in DB
    if (currentFilters.spotTypes && currentFilters.spotTypes.length > 0) {
      const lowerSpotTypes = currentFilters.spotTypes.map(t => t.toLowerCase());
      filtered = filtered.filter(locale =>
        locale.spotTypes && locale.spotTypes.some(type => lowerSpotTypes.includes(type.toLowerCase()))
      );
    }
    
    // Live text search (client-side on loaded locales)
    const searchText = currentSearchInput.trim().toLowerCase();
    if (searchText) {
      filtered = filtered.filter(locale =>
        locale?.name?.toLowerCase?.().includes(searchText) ||
        locale?.description?.toLowerCase?.().includes(searchText) ||
        locale?.countryCode?.toLowerCase?.().includes(searchText) ||
        locale?.stateProvince?.toLowerCase?.().includes(searchText) ||
        (Array.isArray(locale.spotTypes) &&
          locale.spotTypes.some((t) => typeof t === 'string' && t.toLowerCase().includes(searchText)))
      );
    }
    
    // Filter by search radius (if user location available)
    if (currentFilters.searchRadius && currentFilters.searchRadius.trim() !== '') {
      const radiusKm = parseFloat(currentFilters.searchRadius.trim());
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
        logger.warn(`Invalid search radius value: ${currentFilters.searchRadius}`);
      }
    }
    
    // Sort ONLY for the Saved tab (where input list isn't pre-sorted by distance/snapshot)
    if (isSavedTab) {
      return sortLocalesByDistance(filtered);
    }
    return filtered;
  }, [activeLocaleFilters, activeSavedFilters, searchLocaleInput, searchSavedInput, sortLocalesByDistance, userLocation, locationPermissionGranted, getLocaleDistance]);
  
  applyFiltersRef.current = applyFilters;
  
  // Memoized filtered saved locales for performance
  const filteredSavedLocales = useMemo(() => {
    if (isLocationResolving) return [];
    if (savedLocales.length > 0) {
      return applyFilters(savedLocales, true);
    }
    return savedLocales;
  }, [savedLocales, activeSavedFilters, searchSavedInput, applyFilters, userLocation, locationPermissionGranted, calculatingDistances, isLocationResolving]);

  // Whether any user-applied filter is active (search query or filter modal selection).
  // Lifted out of renderAdminLocales so the list renderer (FlatList) can read it
  // directly to decide between filteredLocales and sortedAdminLocales.
  const hasActiveFilters = useMemo(() => (
    !!filters.countryCode ||
    !!filters.stateCode ||
    filters.spotTypes.length > 0 ||
    !!(filters.searchRadius && filters.searchRadius.trim() !== '' && parseFloat(filters.searchRadius.trim()) > 0) ||
    searchInput.trim() !== ''
  ), [filters, searchInput]);

  // Memoized sorted admin locales - returns the stable adminLocales array
  // which is already sorted page-by-page. Order is frozen after initial render.
  const sortedAdminLocales = useMemo(() => {
    return adminLocales;
  }, [adminLocales]);

  // The list the locale-tab FlatList actually renders. Lifted from
  // renderAdminLocales() so the FlatList can read it directly and so it
  // doesn't re-allocate on every parent render.
  // Always derive display list from sorted data + live filters (search, spot types, radius)
  const localesToShow = useMemo(() => {
    if (isLocationResolving || sortedAdminLocales.length === 0) return [];
    const filtered = applyFilters(sortedAdminLocales, false);
    return filtered.slice(0, displayLimit);
  }, [sortedAdminLocales, applyFilters, searchLocaleInput, activeLocaleFilters, isLocationResolving, displayLimit]);

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
  }, [sortedAdminLocales, applyFilters, activeTab, activeLocaleFilters.spotTypes, activeLocaleFilters.searchRadius, activeLocaleFilters.countryCode, activeLocaleFilters.stateCode, searchLocaleInput, userLocation, locationPermissionGranted]);


  useEffect(() => {
    // Reload saved locales when the user opens the Saved tab AND whenever
    // loadSavedLocales updates (it re-creates when userLocation /
    // locationPermissionGranted change), so distances reflect the latest
    // device location instead of the stale captured snapshot.
    if (activeTab === 'saved') {
      loadSavedLocales();
    }
  }, [activeTab, loadSavedLocales]);

  // Grasp user's country code on location detection to default the country filter
  useEffect(() => {
    // Disabled defaulting the country filter to the user's country code
    // so we fetch and sort nearby locales globally based on user location proximity.
    /*
    if (userCountryCode && userCountryCode.trim() !== '' && !hasDefaultedCountryRef.current) {
      if (!activeLocaleFilters.countryCode) {
        logger.debug('🌍 Grasping country and setting default country filter to user country:', userCountryCode);
        
        hasDefaultedCountryRef.current = true;
        isCountryDefaultedRef.current = true;
        
        const matchedCountry = countries.find(c => c.code.toUpperCase() === userCountryCode.toUpperCase());
        const countryName = matchedCountry ? matchedCountry.name : (userCountry || userCountryCode);
        
        dispatchLocaleFilter({
          type: 'SET_COUNTRY',
          payload: {
            country: countryName,
            countryCode: userCountryCode.toUpperCase()
          }
        });

        // Trigger a fresh reload in the background using the new country filter
        // If we already have locales, do a background load to avoid showing the loading spinner!
        const hasData = allLocalesSortedRef.current && allLocalesSortedRef.current.length > 0;
        setTimeout(() => {
          if (isMountedRef.current) {
            loadAdminLocalesRef.current(true, hasData);
          }
        }, 100);
      }
    }
    */
  }, [userCountryCode, countries, userCountry, activeLocaleFilters.countryCode]);

  // Listen for bookmark changes from detail page.
  //
  // The listener used to depend on `loadSavedLocales`, which re-creates
  // its identity whenever userLocation / locationPermissionGranted change.
  // That re-binding tore down and re-subscribed the savedEvents listener
  // on every location tick; if the detail page emitted in that 1-tick
  // window the event vanished and the new bookmark only showed up after
  // the user manually reloaded. Pin the latest loadSavedLocales in a ref
  // so the subscription is registered exactly once on mount.
  const loadSavedLocalesRef = useRef(loadSavedLocales);
  useEffect(() => { loadSavedLocalesRef.current = loadSavedLocales; }, [loadSavedLocales]);

  useEffect(() => {
    const unsubscribe = savedEvents.addListener(() => {
      // Reload saved locales via the latest version of the callback.
      loadSavedLocalesRef.current?.();
    });
    return unsubscribe;
  }, []);

  // Navigation & Lifecycle Safety: Refresh bookmark status on focus (prevent refetch loops)
  useFocusEffect(
    useCallback(() => {
      if (!isMountedRef.current) return;

      // Only refresh saved locales (lightweight)
      loadSavedLocales();

      // Restore scroll offset when returning to screen
      if (savedScrollOffsetRef.current > 0 && flatListRef.current) {
        const offset = savedScrollOffsetRef.current;
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset, animated: false });
        }, 100);
      }
    }, [loadSavedLocales])
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
      
      // Atomic write — strip distanceKm before persisting (must always recalculate from live GPS)
      const strippedForStorage = sortedLocales.map(({ distanceKm, ...rest }: any) => rest);
      await AsyncStorage.setItem('savedLocales', JSON.stringify(strippedForStorage));
      
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
      
      // Atomic write — strip distanceKm before persisting (must always recalculate from live GPS)
      const strippedForStorage = sortedLocales.map(({ distanceKm, ...rest }: any) => rest);
      await AsyncStorage.setItem('savedLocales', JSON.stringify(strippedForStorage));
      
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

  const resolveLocaleDistance = useCallback((locale: Locale): number | null => {
    return getLocaleDistance(locale);
  }, [getLocaleDistance]);

  const checkIsDrivingDistance = useCallback((locale: Locale): boolean => {
    if (drivingDistanceCalculatedRef.current.has(locale._id)) {
      return true;
    }
    if (userLocation) {
      const userLat = roundCoord(userLocation.latitude);
      const userLon = roundCoord(userLocation.longitude);
      const cacheKey = `${locale._id}-${userLat}-${userLon}`;
      if (distanceCache.has(cacheKey)) {
        return true;
      }
    }
    return false;
  }, [userLocation]);

  const formatLocaleDistance = useCallback((locale: Locale) => {
    if (!isLocationAccurate) {
      return 'Calculating...';
    }
    const d = resolveLocaleDistance(locale);
    if (d !== null && d !== undefined) {
      return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
    }
    // If we are actually still loading or calculating distances, return 'Calculating...' to show the shimmer.
    // If everything is done and we still have no distance, show '-- km' (which hides the badge).
    if (loading || loadingLocales || calculatingDistances) {
      return 'Calculating...';
    }
    return '-- km';
  }, [resolveLocaleDistance, loading, loadingLocales, calculatingDistances, isLocationAccurate]);

  const openLocaleDetail = useCallback((locale: Locale) => {
    // Defensive: Coerce every field to a safe primitive so it never crashes.
    const safeName = typeof locale?.name === 'string' ? locale.name : '';
    const safeCountryCode = typeof locale?.countryCode === 'string' ? locale.countryCode : '';
    const safeDescription = typeof locale?.description === 'string' ? locale.description : '';
    const safeImageUrl = typeof locale?.imageUrl === 'string' && locale.imageUrl ? locale.imageUrl : '';
    const localeId = String(locale?._id || '');

    const d = resolveLocaleDistance(locale);
    const isDriving = checkIsDrivingDistance(locale);

    try {
      trackFeatureUsage('locale_open', { locale_id: localeId });
      router.push({
        pathname: '/tripscore/countries/[country]/locations/[location]',
        params: {
          country: safeCountryCode.toLowerCase(),
          location: safeName.toLowerCase().replace(/\s+/g, '-'),
          userId: 'admin-locale',
          localeId,
          imageUrl: safeImageUrl,
          galleryUrls:
            Array.isArray(locale?.imageUrls) && locale.imageUrls.length > 0
              ? locale.imageUrls.filter(u => typeof u === 'string').join('|||')
              : '',
          latitude: locale?.latitude != null && locale.latitude !== 0 ? locale.latitude.toString() : '',
          longitude: locale?.longitude != null && locale.longitude !== 0 ? locale.longitude.toString() : '',
          description: safeDescription,
          spotTypes: Array.isArray(locale?.spotTypes) ? locale.spotTypes.filter(s => typeof s === 'string').join(', ') : '',
          travelInfo: typeof locale?.travelInfo === 'string' ? locale.travelInfo : 'Drivable',
          distanceKm: d !== null && d !== undefined ? d.toString() : '',
          isDrivingDistance: isDriving ? 'true' : 'false',
        },
      });
    } catch (error) {
      logger.error('Error navigating to locale detail:', error);
      showError('Failed to open locale details');
    }
  }, [router, resolveLocaleDistance, checkIsDrivingDistance, showError]);

  const toCloudLocale = useCallback((locale: Locale): CloudLocaleCardData => ({
    _id: String(locale._id),
    name: locale.name,
    countryCode: locale.countryCode,
    imageUrl: locale.imageUrl,
    spotTypes: locale.spotTypes,
    travelInfo: locale.travelInfo,
    description: locale.description,
  }), []);

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
        setIsFetchingStates(false);
      }
      return;
    }
    
    // Create a timeout promise to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('States loading timeout')), 10000); // 10 second timeout
    });
    
    try {
      if (isMountedRef.current) {
        setIsFetchingStates(true);
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
        setIsFetchingStates(false);
      }
    }
  };

  const handleCountrySelect = async (country: Country) => {
    if (!isMountedRef.current || !country || !country.code) {
      return;
    }
    
    try {
      isCountryDefaultedRef.current = false;
      setShowCountryDropdown(false);
      setCountrySearchQuery('');
      if (isMountedRef.current) {
        setStates([]);
        setShowStateDropdown(false);
        setIsFetchingStates(false);
      }
      // Only update filter state; do not trigger list load (load only on Search button)
      dispatchFilter({ type: 'SET_COUNTRY', payload: { country: country.name, countryCode: country.code } });
    } catch (error) {
      logger.error('Error selecting country:', error);
      if (isMountedRef.current) {
        setShowCountryDropdown(false);
        setShowStateDropdown(false);
        setStates([]);
        setIsFetchingStates(false);
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

  const handleLoadMore = useCallback(() => {
    if (activeTab === 'locale' && !loadingLocales) {
      if (displayLimit < adminLocales.length) {
        setDisplayLimit(prev => prev + 20);
      } else if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }
  }, [activeTab, hasNextPage, isFetchingNextPage, loadingLocales, fetchNextPage, displayLimit, adminLocales.length]);

  // Pagination & Filter Race Safety: Refresh with guards
  const handleRefresh = useCallback(async () => {
    if (isSearchingRef.current || isPaginatingRef.current) {
      logger.debug('Refresh already in progress, skipping');
      return;
    }
    
    if (!isMountedRef.current) return;
    
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [refetch]);

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
      isCountryDefaultedRef.current = false;
      // Close modal first to prevent white screen
      setShowFilterModal(false);
      
      // Close dropdowns
      setShowCountryDropdown(false);
      setShowStateDropdown(false);
      
      // Clear states
      setStates([]);
      
      // Reset filters to empty state (not default country)
      dispatchFilter({ type: 'RESET' });
      setSearchInput('');
      setSearchQuery('');
      
      // CACHE: Invalidate cache when filters are cleared
      localeCache.invalidate();
      
      // Reset pagination
      currentPageRef.current = 1;
      setHasMore(false);
      setTotalPages(1);
      setDisplayedPage(1);
      setAllLocalesWithDistances([]); // Clear cached sorted locales
      allLocalesSortedRef.current = []; // Clear single source of truth
      locationSnapshotRef.current = null; // Reset location snapshot to allow re-sorting
      lastFetchKeyRef.current = null;
      loadedOnceRef.current = false;

      // Reload locales without filters (only for locale tab) - use setTimeout to avoid blocking UI
      if (activeTab === 'locale') {
        // Use loadAdminLocalesRef so the call uses the latest version (with cleared filters)
        setTimeout(() => {
          if (isMountedRef.current) {
            loadAdminLocalesRef.current(true).catch((err: any) => {
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

  // Sync local search radius visual input with the actual filter state (e.g. on Reset/Tab switch)
  useEffect(() => {
    setRadiusInput(filters.searchRadius);
  }, [filters.searchRadius]);

  // Debounced dispatch for search radius
  const debouncedDispatchRadius = useMemo(
    () =>
      debounce((text: string, currentDispatch: typeof dispatchFilter) => {
        currentDispatch({ type: 'SET_SEARCH_RADIUS', payload: text });
      }, 500),
    []
  );

  useEffect(() => {
    return () => {
      debouncedDispatchRadius.cancel();
    };
  }, [debouncedDispatchRadius]);

  // Pagination & Filter Race Safety: Reset pagination when filters change
  const handleSearch = useCallback(() => {
    if (!isMountedRef.current) return;
    
    try {
      // Flush pending radius changes immediately if they differ
      debouncedDispatchRadius.cancel();
      if (radiusInput !== filters.searchRadius) {
        dispatchFilter({ type: 'SET_SEARCH_RADIUS', payload: radiusInput });
      }

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
      allLocalesSortedRef.current = []; // Clear single source of truth
      // Reset fetch key and load guard to force a fresh fetch
      lastFetchKeyRef.current = null;
      loadedOnceRef.current = false;

      // Reload locales with filters applied (only for locale tab)
      // Use loadAdminLocalesRef so the call picks up the latest filter
      // state — the direct loadAdminLocales closure may still hold the
      // pre-dispatch values when this callback was captured.
      if (activeTab === 'locale') {
        setTimeout(() => {
          if (isMountedRef.current) {
            loadAdminLocalesRef.current(true).catch((err: any) => {
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
  }, [activeTab, radiusInput, filters.searchRadius, dispatchFilter, debouncedDispatchRadius]);
  
  // Manual-trigger search: searchInput is the live TextInput value, but
  // searchQuery only flips when the user explicitly taps the search icon
  // (or hits return on the keyboard). No auto-debounce — typing stays local
  // and the network/filter pipeline runs only on submit.
  const handleSearchSubmit = useCallback(() => {
    if (!isMountedRef.current) return;
    if (activeTab === 'locale') {
      const next = searchLocaleInput.trim();
      setSearchLocaleQuery(next);
      lastFetchKeyRef.current = null;
      loadedOnceRef.current = false;
      // Immediate client filter via localesToShow useMemo; API refetch follows searchLocaleQuery effect
      if (sortedAdminLocales.length > 0) {
        setFilteredLocales(applyFilters(sortedAdminLocales, false));
      }
    } else {
      const next = searchSavedInput.trim();
      setSearchSavedQuery(next);
    }
  }, [activeTab, searchLocaleInput, searchSavedInput, sortedAdminLocales, applyFilters]);

  // Live filter: clear committed API search as soon as the field is emptied
  useEffect(() => {
    if (activeTab !== 'locale') return;
    if (!searchLocaleInput.trim() && searchLocaleQuery.trim()) {
      setSearchLocaleQuery('');
      lastFetchKeyRef.current = null;
      loadedOnceRef.current = false;
      if (sortedAdminLocales.length > 0) {
        setFilteredLocales(applyFilters(sortedAdminLocales, false));
      }
      loadAdminLocalesRef.current(true);
    }
  }, [searchLocaleInput, searchLocaleQuery, activeTab, sortedAdminLocales, applyFilters]);

  // API search only when user commits via keyboard/search icon — not on every keystroke.
  // Client-side filter (searchInput in applyFilters) handles live typing on loaded locales.
  useEffect(() => {
    if (activeTab !== 'locale') return;
    if (!searchLocaleQuery.trim()) return;
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    if (isMountedRef.current && !isSearchingRef.current) {
      currentPageRef.current = 1;
      lastFetchKeyRef.current = null;
      loadAdminLocalesRef.current(true);
    }
  }, [searchLocaleQuery, activeTab]);

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
        statusBarTranslucent={true}
        onRequestClose={() => {
          setCountrySearchQuery('');
          setStateSearchQuery('');
          setShowFilterModal(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
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
                  <Text style={[styles.filterBadgeText, { color: isDark ? '#000000' : '#FFFFFF' }]}>{activeFilterCount}</Text>
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
            ref={filterScrollRef}
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
                    <LoadingGlobe size="small" color={theme.colors.primary} />
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
                      onFocus={() => {
                        setTimeout(() => {
                          filterScrollRef.current?.scrollTo({ y: 0, animated: true });
                        }, 100);
                      }}
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
                  {isFetchingStates ? (
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
                      onFocus={() => {
                        setTimeout(() => {
                          filterScrollRef.current?.scrollTo({ y: 150, animated: true });
                        }, 100);
                      }}
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
                      <Ionicons name="checkmark" size={16} color={isDark ? '#000000' : '#FFFFFF'} />
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
                  value={radiusInput}
                  onChangeText={(text) => {
                    if (text === '' || /^[0-9]*\.?[0-9]*$/.test(text)) {
                      setRadiusInput(text);
                      debouncedDispatchRadius(text, dispatchFilter);
                    }
                  }}
                  keyboardType="numeric"
                  onFocus={() => {
                    setTimeout(() => {
                      filterScrollRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  }}
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
                style={[styles.searchButton, { overflow: 'hidden' }]} 
                onPress={handleSearch}
              >
                <LinearGradient
                  colors={['#50C878', '#1C73B4']}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Ionicons 
                  name="search" 
                  size={18} 
                  color="#FFFFFF" 
                  style={{ marginRight: 6 }} 
                />
                <Text style={[styles.searchButtonText, { color: '#FFFFFF' }]}>
                  {activeFilterCount > 0 ? `Search (${activeFilterCount})` : 'Search'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    );
  };



  // Stable refs to prevent list item renderers from recreating on location/callback changes
  const openLocaleDetailRef = useRef(openLocaleDetail);
  const resolveLocaleDistanceRef = useRef(resolveLocaleDistance);
  const formatLocaleDistanceRef = useRef(formatLocaleDistance);
  const unsaveLocaleRef = useRef(unsaveLocale);

  useEffect(() => {
    openLocaleDetailRef.current = openLocaleDetail;
    resolveLocaleDistanceRef.current = resolveLocaleDistance;
    formatLocaleDistanceRef.current = formatLocaleDistance;
    unsaveLocaleRef.current = unsaveLocale;
  });

  const renderAdminLocaleItem = useCallback(
    ({ item, index }: { item: Locale; index: number }) => (
      <FeaturedLocaleCard
        locale={item}
        index={index}
        scrollY={scrollY}
        screenHeight={screenHeight}
        cardWidth={CARD_WIDTH}
        cardHeight={CARD_HEIGHT}
        userLocation={userLocationRef.current}
        resolveLocaleDistance={resolveLocaleDistanceRef.current}
        formatLocaleDistance={formatLocaleDistanceRef.current}
        openLocaleDetail={openLocaleDetailRef.current}
        skeletonAnim={skeletonAnim}
        theme={theme}
        isDark={isDark}
      />
    ),
    [scrollY, screenHeight, CARD_WIDTH, CARD_HEIGHT, skeletonAnim, theme, isDark]
  );

  const renderSavedLocaleItem = useCallback(
    ({ item, index }: { item: Locale; index: number }) => (
      <SavedLocaleCard
        locale={item}
        index={index}
        userLocation={userLocationRef.current}
        resolveLocaleDistance={resolveLocaleDistanceRef.current}
        formatLocaleDistance={formatLocaleDistanceRef.current}
        openLocaleDetail={openLocaleDetailRef.current}
        unsaveLocale={unsaveLocaleRef.current}
        skeletonAnim={skeletonAnim}
        styles={styles}
      />
    ),
    [skeletonAnim, styles]
  );

  const savedLocaleSeparator = useCallback(() => <View style={{ height: 20 }} />, []);

  const featuredExtraData = useMemo(() => ({
    userLocation,
    loadingLocales
  }), [userLocation, loadingLocales]);

  const savedExtraData = useMemo(() => ({
    userLocation,
    filteredSavedLocales
  }), [userLocation, filteredSavedLocales]);

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
          <LoadingGlobe size="small" color={theme.colors.primary} style={{ marginVertical: 20 }} />
        </View>
      );
    }

    if (localesToShow.length === 0) {
      return null;
    }

    return (
      <View style={styles.adminLocalesSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 16 }]}>Featured Locales</Text>
        <View style={styles.localesList}>
          {localesToShow.map((locale, index) => (
            <View key={locale._id}>
              <FeaturedLocaleCard
                locale={locale}
                index={index}
                scrollY={scrollY}
                screenHeight={screenHeight}
                cardWidth={CARD_WIDTH}
                cardHeight={CARD_HEIGHT}
                userLocation={userLocationRef.current}
                resolveLocaleDistance={resolveLocaleDistanceRef.current}
                formatLocaleDistance={formatLocaleDistanceRef.current}
                openLocaleDetail={openLocaleDetailRef.current}
                skeletonAnim={skeletonAnim}
                theme={theme}
                isDark={isDark}
              />
            </View>
          ))}
        </View>
        {/* Load More Button - Always visible when there are more locales */}
        {hasMore && !loadingMore && !loadingLocales && localesToShow.length > 0 && (
          <View style={styles.loadMoreButtonContainer}>
            <TouchableOpacity
              style={[styles.loadMoreButton, { overflow: 'hidden' }]}
              onPress={handleLoadMore}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#50C878', '#1C73B4']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={[styles.loadMoreText, { color: '#FFFFFF' }]}>Load More</Text>
              <Ionicons 
                name="chevron-down" 
                size={20} 
                color="#FFFFFF" 
                style={{ marginLeft: 8 }} 
              />
            </TouchableOpacity>
          </View>
        )}
        {loadingMore && (
          <View style={styles.loadMoreContainer}>
            <LoadingGlobe size="small" color={theme.colors.primary} />
            <Text style={[styles.loadMoreText, { color: theme.colors.textSecondary, marginLeft: 8 }]}>
              Loading more locales...
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Stable callbacks for the locale-tab FlatList are now declared above.

  const localeKeyExtractor = useCallback((item: Locale & { localeId?: string }) => {
    if (!item || (!item.localeId && !item._id)) {
      return `invalid-id-${item?.name || 'unknown'}`;
    }
    return String(item.localeId || item._id);
  }, []);

  const localeGetItemLayout = useCallback((_data: ArrayLike<Locale> | null | undefined, index: number) => {
    return { length: screenWidth, offset: screenWidth * index, index };
  }, [screenWidth]);

  const renderCustomLayout = useCallback(() => {
    return (
      <View style={{ paddingBottom: isTabletLocal ? 30 : 40 }}>
        {/* Admin-managed locales section */}
        {renderAdminLocales()}
      </View>
    );
  }, [filteredLocales, sortedAdminLocales, loadingLocales, theme, searchQuery, filters]);

  // SavedLocaleCard is now declared as a standalone component above.

  const renderEmptySavedState = () => null;


  if (loading && !calculatingDistances) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  const screenGradientColors =
    mode === 'dark'
      ? (['#000000', '#000000', '#000000'] as const)
      : (theme.colors.screenGradient as [string, string, ...string[]]);
  const screenGradientLocs = matchGradientLocations(
    screenGradientColors.length,
    mode === 'dark' ? [0, 0.28, 1] : [0, 0.22, 0.55, 1],
  );

  return (
    <ErrorBoundary level="route">
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <LinearGradient
        key={mode === 'dark' ? 'dark' : 'light'}
        colors={screenGradientColors}
        style={StyleSheet.absoluteFillObject}
        locations={screenGradientLocs}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TravelLoadingOverlay
          calculatingDistances={calculatingDistances}
          mode={mode}
          theme={theme}
        />
      
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          paddingTop: insets.top,
          borderBottomWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(28, 115, 180, 0.15)',
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 10,
          elevation: 4,
          overflow: 'hidden',
          ...(isWebLocal && {
            maxWidth: isTabletLocal ? 1200 : 1000,
            alignSelf: 'center',
            width: '100%',
          } as any),
        }}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <BlurView
          intensity={95}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.topNavigation}>
          <CloudSegmentedControl
            segments={[
              { key: 'locale', label: 'Locale' },
              { key: 'saved', label: 'Saved' },
            ]}
            value={activeTab}
            onChange={(tab) => setActiveTab(tab as 'locale' | 'saved')}
          />
        </View>

        <CloudSearchDock
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmit={handleSearchSubmit}
          onFilterPress={() => setShowFilterModal(true)}
          filterBadgeCount={activeFilterCount}
          placeholder="Search destinations"
          style={{ marginBottom: 12 }}
        />
        {!locationPermissionGranted && (
          <TouchableOpacity
            style={[
              {
                backgroundColor: theme.colors.surfaceSecondary,
                borderColor: theme.colors.border,
                borderWidth: 1,
                borderRadius: theme.borderRadius.md,
                flexDirection: 'row',
                alignItems: 'center',
                padding: 10,
                marginBottom: 12,
                justifyContent: 'center',
              },
            ]}
            onPress={handleRequestLocationForSort}
            activeOpacity={0.8}
          >
            <Ionicons name="location" size={16} color={isDark ? '#38BDF8' : '#1C73B4'} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 12, fontFamily: getFontFamily('600'), color: theme.colors.text }}>
              Sort by Distance (Enable Location)
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content
          Permanent fix for the saved-tab crash: previously this was
          `activeTab === 'locale' ? <FlatList /> : <FlatList />` which
          unmounted the locale FlatList (and all its native cells —
          ExpoImage + LinearGradient + RefreshControl) every time the
          user tapped Saved. On Android / Expo Go that mass-unmount of
          native views during one render frame was the source of the
          instant native crash. Both lists now stay mounted and we just
          toggle visibility via `display`. The off-screen list pays
          essentially zero render cost (no items virtualised, no scroll
          handlers active), so this is also fine for performance. */}
      <View style={[styles.listSlot, activeTab === 'locale' ? null : styles.hidden]} pointerEvents={activeTab === 'locale' ? 'auto' : 'none'}>
        <View style={{ flex: 1 }}>
          {isLocationResolving || (loadingLocales && (localesToShow || []).length === 0) ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <LoadingGlobe size="small" color={theme.colors.primary} />
            </View>
          ) : (
            <View style={{ flex: 1, position: 'relative' }}>
              <AnimatedFlashList
                ref={flatListRef}
                data={localesToShow || []}
                renderItem={renderAdminLocaleItem}
                keyExtractor={localeKeyExtractor}
                extraData={featuredExtraData}
                showsVerticalScrollIndicator={true}
                onScroll={handleVerticalScroll}
                scrollEventThrottle={16}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                drawDistance={screenHeight * 1.2}
                estimatedItemSize={220}
                contentContainerStyle={{
                  paddingHorizontal: isTabletLocal ? 24 : 16,
                  paddingTop: headerHeight > 0 ? headerHeight + 12 : 12,
                  paddingBottom: Platform.OS === 'ios' ? 120 : 140,
                  flexGrow: 1,
                }}
                ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
                ListHeaderComponent={
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: theme.colors.text, marginBottom: 16, paddingHorizontal: 4, marginTop: 12 },
                    ]}
                  >
                    Featured Locales
                  </Text>
                }
                ListEmptyComponent={
                  !loadingLocales ? (
                    <EmptyState
                      icon="location-outline"
                      title="No Locales Found"
                      description="Try adjusting your filters or search radius."
                    />
                  ) : null
                }
                ListFooterComponent={
                  (localesToShow || []).length > 0 ? (
                    <View style={{ paddingTop: 20, paddingBottom: 16 }}>
                      {hasMore && (
                        <View style={styles.loadMoreButtonContainer}>
                          <TouchableOpacity
                            style={[
                              styles.loadMoreButton,
                              {
                                overflow: 'hidden',
                                opacity: loadingMore ? 0.8 : 1,
                                backgroundColor: loadingMore ? 'rgba(255, 255, 255, 0.1)' : undefined,
                              },
                            ]}
                            onPress={handleLoadMore}
                            activeOpacity={0.7}
                            disabled={loadingMore}
                          >
                            {!loadingMore && (
                              <LinearGradient
                                colors={['#50C878', '#1C73B4']}
                                style={StyleSheet.absoluteFillObject}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                              />
                            )}
                            {loadingMore ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <ActivityIndicator size="small" color={theme.colors.primary} />
                                <Text style={[styles.loadMoreText, { color: theme.colors.text, marginLeft: 8 }]}>
                                  Loading Places...
                                </Text>
                              </View>
                            ) : (
                              <>
                                <Text style={[styles.loadMoreText, { color: '#FFFFFF' }]}>Load More Places</Text>
                                <Ionicons
                                  name="chevron-down"
                                  size={20}
                                  color="#FFFFFF"
                                  style={{ marginLeft: 8 }}
                                />
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ) : null
                }
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={theme.colors.secondary}
                    colors={[theme.colors.secondary]}
                    progressBackgroundColor={theme.colors.surface}
                    progressViewOffset={headerHeight}
                  />
                }
                style={{ flex: 1 }}
              />
            </View>
          )}
        </View>
      </View>

      <View style={[styles.listSlot, activeTab === 'saved' ? null : styles.hidden]} pointerEvents={activeTab === 'saved' ? 'auto' : 'none'}>
        {isLocationResolving ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <LoadingGlobe size="small" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredSavedLocales}
            renderItem={renderSavedLocaleItem}
            keyExtractor={(item) => {
              if (!item || !item._id) {
                return `invalid-saved-id-${item?.name || 'unknown'}`;
              }
              return String(item._id);
            }}
            extraData={savedExtraData}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ItemSeparatorComponent={savedLocaleSeparator}
            ListHeaderComponent={
              filteredSavedLocales.length > 0 ? (
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.text, marginBottom: 16, paddingHorizontal: 4, marginTop: 12 },
                  ]}
                >
                  Saved Locales 🔖
                </Text>
              ) : null
            }
            ListEmptyComponent={null}
            onScroll={(e) => {
              if (e.target !== e.currentTarget) return;
              handleScroll(e);
            }}
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
                tintColor={theme.colors.secondary}
                colors={[theme.colors.secondary]}
                progressBackgroundColor={theme.colors.surface}
                progressViewOffset={headerHeight}
              />
            }
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{
              paddingHorizontal: isTabletLocal ? 24 : 16,
              paddingTop: headerHeight > 0 ? headerHeight + 12 : 12,
              paddingBottom: Platform.OS === 'ios' ? 120 : 140,
            }}
          />
        )}
      </View>

      {/* Filter Modal */}
      {renderFilterModal()}
      
      {/* Location Disclosure Modal */}
      <LocationDisclosureModal
        visible={showLocationDisclosure}
        variant="foreground"
        onContinue={handleDisclosureContinue}
        onCancel={handleDisclosureCancel}
      />
      </KeyboardAvoidingView>
    </View>
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
      backgroundColor: '#EDF8FF',
      ...(isWebLocal && {
        maxWidth: isTabletLocal ? 1200 : 1000,
        alignSelf: 'center',
        width: '100%',
      } as any),
    },
    headerPanel: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    topNavigation: {
      paddingHorizontal: isTabletLocal ? theme.spacing.xl : theme.spacing.md,
      paddingTop: isTabletLocal ? theme.spacing.md : 12,
      paddingBottom: isTabletLocal ? theme.spacing.md : 12,
      borderBottomWidth: 0,
    },
    tabContainer: {
      flexDirection: 'row',
      borderRadius: 28,
      padding: 4,
      shadowColor: '#62B9FF',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.18,
      shadowRadius: 26,
      elevation: 8,
    },
    tabButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 24,
      flex: 1,
      gap: 8,
      overflow: 'hidden',
    },
    activeTab: {
      // backgroundColor applied inline via theme from useTheme()
    },
    tabText: {
      fontSize: 15,
      fontWeight: '600' as const,
      fontFamily: getFontFamily('600'),
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isTabletLocal ? theme.spacing.xl : 14,
      paddingVertical: isTabletLocal ? theme.spacing.md : 6,
      gap: 10,
      backgroundColor: 'transparent',
    },
    searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 22,
      paddingHorizontal: isTabletLocal ? theme.spacing.lg : 14,
      paddingVertical: isTabletLocal ? theme.spacing.md : 8,
      borderWidth: 1,
      maxWidth: isTabletLocal ? 800 : undefined,
      height: 38,
      shadowColor: '#72C3FF',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
      elevation: 5,
    },
    searchInput: {
      flex: 1,
      fontSize: isTabletLocal ? 16 : 15,
      fontFamily: getFontFamily('400'),
      marginLeft: isTabletLocal ? theme.spacing.md : 10,
      fontWeight: '400',
      paddingVertical: 0,
      ...(isWebLocal && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        outlineStyle: 'none',
      } as any),
    },
    filterButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 1,
      shadowColor: '#72C3FF',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
      elevation: 5,
      ...(isWebLocal && {
        cursor: 'pointer',
        ['transition']: 'all 0.2s ease',
      } as any),
    },
    listContainer: {
      paddingHorizontal: isTabletLocal ? theme.spacing.md : 12,
      // Add padding for tab bar (88px mobile, 70px web) + extra spacing for load more button
      paddingBottom: isWebLocal ? 140 : (isTabletLocal ? 160 : 150),
    },
    // Wraps each tab's FlatList. Both wrappers stay mounted; only one is
    // visible at a time (controlled via display:none) so toggling tabs
    // never unmounts the native cells inside the off-screen list.
    listSlot: {
      flex: 1,
    },
    hidden: {
      display: 'none',
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
      borderRadius: 24,
      overflow: 'hidden',
      position: 'relative',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 8,
      elevation: 4,
    },
    halfCard: {
      width: isTabletLocal ? (screenWidth - theme.spacing.xxl * 2 - theme.spacing.md) / 2 : (screenWidth - 36) / 2,
      height: isTabletLocal ? 220 : 180,
    },
    wideCard: {
      width: isTabletLocal ? screenWidth - theme.spacing.xxl * 2 : screenWidth - 40,
      height: isTabletLocal ? 220 : 176,
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
    fontSize: 14,
    fontWeight: '500',
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
    height: '60%',
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
      fontSize: isTabletLocal ? 18 : 16,
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
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: isTabletLocal ? 16 : 14,
      padding: isTabletLocal ? 8 : (isAndroidLocal ? 8 : 6),
      // Minimum touch target: 44x44 for iOS, 48x48 for Android
      minWidth: isAndroidLocal ? 48 : 44,
      minHeight: isAndroidLocal ? 48 : 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 14,
    padding: 6,
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
    fontSize: 17,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  travelLoadingSubtext: {
    fontSize: 14,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    textAlign: 'center',
    opacity: 0.7,
    letterSpacing: 0.1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  exploreButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  exploreButtonText: {
    color: 'white',
    fontSize: 15,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  savedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  savedText: {
    fontSize: 15,
    fontFamily: getFontFamily('400'),
    color: '#999999',
    textAlign: 'center',
  },
  adminLocalesSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: isTabletLocal ? 30 : 40, // Increased to ensure load more button is fully visible above bottom nav
  },
  sectionTitle: {
    fontSize: 19,
    fontFamily: getFontFamily('600'),
    fontWeight: '700',
    marginBottom: 16,
    marginTop: 8,
    letterSpacing: 0.2,
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
    borderRadius: theme.borderRadius.full,
    minWidth: isTabletLocal ? 200 : 160,
    shadowColor: '#32A8FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  loadMoreText: {
    fontSize: isTabletLocal ? 16 : 15,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    letterSpacing: 0.2,
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
    fontFamily: getFontFamily('400'),
    marginTop: 3,
    opacity: 1,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceBadgeAbsolute: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
    zIndex: 10,
  },
  distanceText: {
    fontSize: 11,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.28)',
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
    fontSize: 17,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 0.2,
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
    fontWeight: '600',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    fontSize: 15,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
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
    fontSize: 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.2,
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
    fontSize: 15,
    fontFamily: getFontFamily('400'),
    flex: 1,
  },
  dropdownIconContainer: {
    marginLeft: 12,
  },
  dropdownList: {
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 256,
    marginTop: 4,
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
    fontSize: 15,
    fontFamily: getFontFamily('400'),
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
    fontSize: 15,
    fontFamily: getFontFamily('400'),
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
    fontSize: 15,
    fontFamily: getFontFamily('400'),
    flex: 1,
  },
  radiusUnit: {
    fontSize: 14,
    fontFamily: getFontFamily('500'),
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
    fontSize: 15,
    fontFamily: getFontFamily('400'),
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
    fontSize: 15,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  searchButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    letterSpacing: 0.2,
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
    fontWeight: '600',
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
    fontSize: 15,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
    saveButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255, 255, 255, 0.24)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.36)',
    },
  });
};

const styles = createStyles();

