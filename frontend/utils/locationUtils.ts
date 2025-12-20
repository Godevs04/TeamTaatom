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

let lastGeocodeTime = 0;
let pendingGeocodeRequest: Promise<string | null> | null = null;

// ============================================================================
// GOOGLE GEOCODING API FUNCTIONS
// ============================================================================

/**
 * Geocode an address to get coordinates using Google Geocoding API
 */
export const geocodeAddress = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    logger.debug('🌍 Geocoding address via Google API:', address);
    
    const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_MAPS_API_KEY) {
      logger.error('❌ Google Maps API key not found in environment variables');
      return null;
    }
    
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
    
    logger.debug('🔗 API URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    logger.debug('📡 API Response Status:', data.status);
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      const coordinates = {
        latitude: location.lat,
        longitude: location.lng
      };
      
      logger.debug('✅ Geocoding SUCCESS:', address, coordinates);
      return coordinates;
    } else {
      logger.error('❌ Geocoding FAILED:', data.status, data.error_message);
      return null;
    }
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
