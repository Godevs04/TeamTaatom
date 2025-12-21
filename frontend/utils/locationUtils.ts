// Comprehensive Location Utilities
// Combines geocoding, location services, and distance calculations
//
// REQUIRED ENVIRONMENT VARIABLE:
// EXPO_PUBLIC_GOOGLE_MAPS_API_KEY - Your Google Maps API key
// Add this to your .env file: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
// Note: EXPO_PUBLIC_ prefix is required for client-side access in Expo/React Native

import * as Location from 'expo-location';
import { Platform } from 'react-native';
import logger from './logger';

// ============================================================================
// CACHE AND RATE LIMITING
// ============================================================================

// Simple in-memory cache for geocoding results
const geocodeCache = new Map<string, { result: string | null; timestamp: number }>();
const GEOCODE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const GEOCODE_MIN_INTERVAL = 10000; // 10 seconds between requests

// Dynamic location name corrections cache (learns from successful geocoding)
// PRODUCTION-GRADE: Self-learning cache that improves over time
const locationCorrectionsCache = new Map<string, { correction: string; timestamp: number }>();
const CORRECTIONS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Cleanup old cache entries periodically
const cleanupCorrectionsCache = () => {
  const now = Date.now();
  for (const [key, value] of locationCorrectionsCache.entries()) {
    if (now - value.timestamp > CORRECTIONS_CACHE_DURATION) {
      locationCorrectionsCache.delete(key);
    }
  }
};

// Run cleanup every hour (safe for all platforms)
if (typeof setInterval !== 'undefined' && Platform.OS !== 'web') {
  // Only run interval on native platforms (web handles this differently)
  setInterval(cleanupCorrectionsCache, 60 * 60 * 1000);
}

let lastGeocodeTime = 0;
let pendingGeocodeRequest: Promise<string | null> | null = null;

// ============================================================================
// GOOGLE GEOCODING API FUNCTIONS
// ============================================================================

/**
 * Generate location name variations dynamically (no hardcoding)
 * PRODUCTION-GRADE: Creates variations based on formatting, not hardcoded corrections
 */
const generateLocationVariations = (locationName: string): string[] => {
  const normalized = locationName.trim();
  const variations: Set<string> = new Set([normalized]);
  
  // Check cached corrections first (learned from previous successful geocoding)
  cleanupCorrectionsCache(); // Clean old entries before checking
  const lowerName = normalized.toLowerCase();
  const cachedEntry = locationCorrectionsCache.get(lowerName);
  if (cachedEntry && cachedEntry.correction !== normalized) {
    variations.add(cachedEntry.correction);
    logger.debug(`💡 Using cached correction: "${normalized}" -> "${cachedEntry.correction}"`);
  }
  
  // Generate formatting variations dynamically
  // 1. Title case: "munnar" -> "Munnar"
  const titleCase = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  if (titleCase !== normalized) {
    variations.add(titleCase);
  }
  
  // 2. All lowercase
  const allLower = normalized.toLowerCase();
  if (allLower !== normalized) {
    variations.add(allLower);
  }
  
  // 3. All uppercase
  const allUpper = normalized.toUpperCase();
  if (allUpper !== normalized) {
    variations.add(allUpper);
  }
  
  // 4. Remove common suffixes/prefixes and try again
  const withoutCommonSuffixes = normalized.replace(/\s+(city|town|village|place|location)$/i, '').trim();
  if (withoutCommonSuffixes !== normalized && withoutCommonSuffixes.length > 0) {
    variations.add(withoutCommonSuffixes);
    variations.add(withoutCommonSuffixes.charAt(0).toUpperCase() + withoutCommonSuffixes.slice(1).toLowerCase());
  }
  
  return Array.from(variations);
};

/**
 * Get location suggestions from Google Places Autocomplete API
 * PRODUCTION-GRADE: Dynamic suggestions for misspelled locations
 */
const getPlaceSuggestions = async (
  input: string,
  countryCode?: string
): Promise<string[]> => {
  try {
    const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_MAPS_API_KEY) {
      return [];
    }
    
    // Build autocomplete query
    let query = input;
    const components = countryCode ? `&components=country:${countryCode}` : '';
    const encodedInput = encodeURIComponent(query);
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodedInput}${components}&key=${GOOGLE_MAPS_API_KEY}&types=(cities)`;
    
    logger.debug('🔍 Getting place suggestions for:', input);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.predictions && data.predictions.length > 0) {
      // Extract suggested location names
      const suggestions = data.predictions
        .map((pred: any) => {
          // Extract main location name (usually first part before comma)
          const mainText = pred.structured_formatting?.main_text || pred.description;
          return mainText ? mainText.split(',')[0].trim() : null;
        })
        .filter((name: string | null): name is string => name !== null && name.length > 0);
      
      logger.debug(`✅ Got ${suggestions.length} place suggestions:`, suggestions);
      return suggestions;
    }
    
    return [];
  } catch (error) {
    logger.error('💥 Error getting place suggestions:', error);
    return [];
  }
};

/**
 * Calculate string similarity using Levenshtein distance (fuzzy matching)
 * Returns a score between 0 and 1 (1 = identical, 0 = completely different)
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;
  
  // Simple Levenshtein distance calculation
  const matrix: number[][] = [];
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  const maxLength = Math.max(s1.length, s2.length);
  const distance = matrix[s2.length][s1.length];
  return 1 - (distance / maxLength);
};

/**
 * Geocode an address to get coordinates using Google Geocoding API
 * PRODUCTION-GRADE: Dynamic location name handling with Places Autocomplete and fuzzy matching
 * No hardcoded corrections - learns and adapts dynamically
 */
export const geocodeAddress = async (
  address: string, 
  countryCode?: string
): Promise<{ latitude: number; longitude: number } | null> => {
  if (!address || address.trim() === '') {
    logger.warn('⚠️ Empty address provided for geocoding');
    return null;
  }
  
  try {
    const countryContext = countryCode ? `(country: ${countryCode})` : '';
    logger.debug(`🌍 Geocoding address via Google API: ${address} ${countryContext}`);
    
    const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_MAPS_API_KEY) {
      logger.error('❌ Google Maps API key not found in environment variables');
      return null;
    }
    
    // Step 1: Generate dynamic variations (formatting-based, no hardcoding)
    const variations = generateLocationVariations(address);
    logger.debug(`📝 Generated ${variations.length} location variations:`, variations);
    
    // Step 2: Try each variation with geocoding API
    for (let i = 0; i < variations.length; i++) {
      const query = variations[i];
      
      // Build query with country context if available
      let searchQuery = query;
      if (countryCode) {
        searchQuery = `${query}, ${countryCode}`;
      }
      
      const encodedAddress = encodeURIComponent(searchQuery);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
      
      logger.debug(`🔗 Geocoding attempt ${i + 1}/${variations.length}:`, searchQuery);
      
      try {
        const response = await fetch(url);
        const data = await response.json();
        
        logger.debug('📡 API Response Status:', data.status);
        
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const result = data.results[0];
          const location = result.geometry.location;
          const coordinates = {
            latitude: location.lat,
            longitude: location.lng
          };
          
          // PRODUCTION-GRADE: Learn from successful geocoding - cache the correction
          // If we used a variation that's different from original, cache it for future use
          if (query !== address) {
            const originalLower = address.toLowerCase();
            const correctedName = result.formatted_address.split(',')[0].trim();
            locationCorrectionsCache.set(originalLower, {
              correction: correctedName,
              timestamp: Date.now()
            });
            logger.debug(`💾 Cached location correction: "${address}" -> "${correctedName}"`);
          }
          
          logger.debug(`✅ Geocoding SUCCESS: ${searchQuery}`, coordinates);
          return coordinates;
        } else if (data.status === 'ZERO_RESULTS') {
          // Try next variation
          logger.debug(`⚠️ ZERO_RESULTS for "${searchQuery}", trying next variation...`);
          continue;
        } else {
          logger.error('❌ Geocoding FAILED:', data.status, data.error_message);
          // If it's a permanent error (not ZERO_RESULTS), stop trying
          if (data.status !== 'ZERO_RESULTS') {
            break;
          }
        }
      } catch (fetchError) {
        logger.error('💥 Fetch error for geocoding:', fetchError);
        continue;
      }
    }
    
    // Step 3: If all variations failed, use Google Places Autocomplete for dynamic suggestions
    logger.debug('🔍 All direct geocoding attempts failed, trying Places Autocomplete...');
    const suggestions = await getPlaceSuggestions(address, countryCode);
    
    if (suggestions.length > 0) {
      // Try geocoding each suggestion, prioritizing by similarity to original
      const suggestionsWithSimilarity = suggestions.map(suggestion => ({
        name: suggestion,
        similarity: calculateSimilarity(address, suggestion)
      })).sort((a, b) => b.similarity - a.similarity); // Sort by similarity (highest first)
      
      logger.debug(`🎯 Trying ${suggestionsWithSimilarity.length} autocomplete suggestions (sorted by similarity)`);
      
      for (const { name: suggestion } of suggestionsWithSimilarity) {
        let searchQuery = suggestion;
        if (countryCode) {
          searchQuery = `${suggestion}, ${countryCode}`;
        }
        
        const encodedAddress = encodeURIComponent(searchQuery);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
        
        try {
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.status === 'OK' && data.results && data.results.length > 0) {
            const result = data.results[0];
            const location = result.geometry.location;
            const coordinates = {
              latitude: location.lat,
              longitude: location.lng
            };
            
            // Cache the successful correction
            const originalLower = address.toLowerCase();
            const correctedName = result.formatted_address.split(',')[0].trim();
            locationCorrectionsCache.set(originalLower, {
              correction: correctedName,
              timestamp: Date.now()
            });
            logger.debug(`💾 Cached autocomplete correction: "${address}" -> "${correctedName}"`);
            
            logger.debug(`✅ Geocoding SUCCESS via autocomplete: ${suggestion}`, coordinates);
            return coordinates;
          }
        } catch (suggestionError) {
          logger.debug(`⚠️ Suggestion "${suggestion}" failed, trying next...`);
          continue;
        }
      }
    }
    
    // Step 4: Final fallback - try with country name context
    const countryName = countryCode === 'IN' ? 'India' : 
                       countryCode === 'US' ? 'United States' :
                       countryCode === 'GB' ? 'United Kingdom' :
                       countryCode ? countryCode : 'India';
    
    const fallbackQuery = `${variations[0]}, ${countryName}`;
    const encodedAddress = encodeURIComponent(fallbackQuery);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
    
    logger.debug(`🔗 Final fallback attempt with country context:`, fallbackQuery);
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        const coordinates = {
          latitude: location.lat,
          longitude: location.lng
        };
        
        logger.debug(`✅ Geocoding SUCCESS with country context: ${fallbackQuery}`, coordinates);
        return coordinates;
      }
    } catch (finalError) {
      logger.error('💥 Final geocoding attempt failed:', finalError);
    }
    
    logger.error('❌ All geocoding attempts failed for:', address);
    return null;
  } catch (error) {
    logger.error('💥 Geocoding ERROR:', error);
    return null;
  }
};

/**
 * Reverse geocode coordinates to get address using Google Geocoding API
 */
export const getLocationDetails = async (latitude: number, longitude: number): Promise<string | null> => {
  try {
    logger.debug('🔄 Reverse geocoding coordinates:', { latitude, longitude });
    
    const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_MAPS_API_KEY) {
      logger.error('❌ Google Maps API key not found in environment variables');
      return null;
    }
    
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const address = data.results[0].formatted_address;
      logger.debug('✅ Reverse geocoding SUCCESS:', address);
      return address;
    } else {
      logger.error('❌ Reverse geocoding FAILED:', data.status, data.error_message);
      return null;
    }
  } catch (error) {
    logger.error('💥 Reverse geocoding ERROR:', error);
    return null;
  }
};

// ============================================================================
// EXPO LOCATION FUNCTIONS
// ============================================================================

/**
 * Get current device location using Expo Location
 */
export const getCurrentLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied');
  }
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
};

/**
 * Get address from coordinates with caching and rate limiting
 * Uses Google Geocoding API first, falls back to Expo Location
 */
export const getAddressFromCoords = async (latitude: number, longitude: number): Promise<string> => {
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  
  // Check cache first
  const cached = geocodeCache.get(cacheKey);
  const now = Date.now();
  if (cached && (now - cached.timestamp) < GEOCODE_CACHE_DURATION) {
    return cached.result || 'Unknown Location';
  }

  // Rate limiting - if there's a pending request, return cached or unknown
  if (pendingGeocodeRequest) {
    logger.debug('📋 Rate limit active, waiting for pending request...');
    try {
      return await pendingGeocodeRequest || 'Unknown Location';
    } catch {
      return cached?.result || 'Unknown Location';
    }
  }

  // Check time since last geocode
  const timeSinceLastGeocode = now - lastGeocodeTime;
  if (timeSinceLastGeocode < GEOCODE_MIN_INTERVAL) {
    logger.debug('⏳ Rate limiting geocode request...');
    return cached?.result || 'Unknown Location';
  }

  lastGeocodeTime = now;

  // Create the geocode request
  pendingGeocodeRequest = (async (): Promise<string | null> => {
    try {
      // Try Google Geocoding API first (more reliable on iOS)
      const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (GOOGLE_MAPS_API_KEY) {
        try {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.status === 'OK' && data.results && data.results.length > 0) {
            const address = data.results[0].formatted_address;
            logger.debug('✅ Google reverse geocoding SUCCESS:', address);
            
            // Cache the result
            geocodeCache.set(cacheKey, { result: address, timestamp: now });
            
            // Limit cache size
            if (geocodeCache.size > 100) {
              const firstKey = geocodeCache.keys().next().value;
              geocodeCache.delete(firstKey as string);
            }
            
            return address;
          }
        } catch (googleError) {
          logger.debug('⚠️ Google geocoding failed, trying fallback...', googleError);
        }
      }

      // Fallback to Expo Location (works better on Android, rate-limited on iOS)
      if (Platform.OS === 'android') {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (results.length > 0) {
          const a = results[0];
          const parts = [a.name || a.street, a.city, a.region, a.country].filter(Boolean);
          const address = parts.join(', ');
          
          // Cache the result
          geocodeCache.set(cacheKey, { result: address, timestamp: now });
          
          return address;
        }
      }
      
      // If both fail, return a basic format
      const result = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      geocodeCache.set(cacheKey, { result, timestamp: now });
      return result;
      
    } catch (e: any) {
      logger.error('❌ All geocoding methods failed:', e.message);
      // Return unknown location but cache it to prevent repeated requests
      geocodeCache.set(cacheKey, { result: 'Unknown Location', timestamp: now });
      return 'Unknown Location';
    }
  })();

  try {
    const result = await pendingGeocodeRequest;
    pendingGeocodeRequest = null;
    return result || 'Unknown Location';
  } catch (e) {
    pendingGeocodeRequest = null;
    return cached?.result || 'Unknown Location';
  }
};

// ============================================================================
// DISTANCE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Calculate total distance traveled between multiple coordinates
 * @param coordinates Array of {latitude, longitude} objects
 * @returns Total distance in kilometers
 */
export const calculateTotalDistance = (coordinates: { latitude: number; longitude: number }[]): number => {
  if (coordinates.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];
    totalDistance += calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
  }
  
  return totalDistance;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format distance for display
 * @param distance Distance in kilometers
 * @returns Formatted distance string
 */
export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  } else if (distance < 10) {
    return `${distance.toFixed(1)}km`;
  } else {
    return `${Math.round(distance)}km`;
  }
};

/**
 * Validate if coordinates are within reasonable bounds
 * @param latitude Latitude value
 * @param longitude Longitude value
 * @returns True if coordinates are valid
 */
export const validateCoordinates = (latitude: number, longitude: number): boolean => {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
};

/**
 * Get coordinates from location string (supports various formats)
 * @param locationString Location string (e.g., "12.9716,77.5946" or "Bangalore, India")
 * @returns Coordinates object or null
 */
export const parseLocationString = async (locationString: string): Promise<{ latitude: number; longitude: number } | null> => {
  // Check if it's already coordinates
  const coordMatch = locationString.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
  if (coordMatch) {
    const latitude = parseFloat(coordMatch[1]);
    const longitude = parseFloat(coordMatch[2]);
    if (validateCoordinates(latitude, longitude)) {
      return { latitude, longitude };
    }
  }
  
  // Otherwise, geocode the address
  return await geocodeAddress(locationString);
};
