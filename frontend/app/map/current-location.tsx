import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
import { useTheme } from '../../context/ThemeContext';
import * as Location from 'expo-location';
import { MapView, Marker, PROVIDER_GOOGLE } from '../../utils/mapsWrapper';
import logger from '../../utils/logger';

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Create styles function that uses the constants
const createStyles = () => {
  const isTabletLocal = screenWidth >= 768;
  const isAndroidLocal = Platform.OS === 'android';
  const isWebLocal = Platform.OS === 'web';

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isTabletLocal ? 24 : 16,
      paddingTop: isAndroidLocal ? (isTabletLocal ? 18 : 16) : (isTabletLocal ? 14 : 12),
      paddingBottom: isTabletLocal ? 16 : 12,
      borderBottomWidth: 1,
      minHeight: isAndroidLocal ? (isTabletLocal ? 72 : 64) : (isTabletLocal ? 64 : 56),
    },
    backButton: {
      // Minimum touch target: 44x44 for iOS, 48x48 for Android
      minWidth: isAndroidLocal ? 48 : 44,
      minHeight: isAndroidLocal ? 48 : 44,
      justifyContent: 'center',
      alignItems: 'center',
      padding: isTabletLocal ? 10 : (isAndroidLocal ? 10 : 8),
      marginLeft: isTabletLocal ? -10 : -8,
      ...(isWebLocal && {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      } as any),
    },
    titleContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
    },
    watchingIndicator: {
      marginLeft: 8,
      padding: 2,
      borderRadius: 10,
      backgroundColor: 'rgba(76, 175, 80, 0.2)',
    },
    refreshButton: {
      padding: 8,
    },
    mapContainer: {
      flex: 1,
    },
    map: {
      width: '100%',
      height: '100%',
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      fontSize: 16,
      marginTop: 16,
      textAlign: 'center',
    },
    errorText: {
      fontSize: 16,
      marginTop: 16,
      textAlign: 'center',
      marginBottom: 20,
    },
    retryButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    locationInfo: {
      padding: 16,
      borderTopWidth: 1,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    locationText: {
      fontSize: 14,
      marginLeft: 8,
      flex: 1,
    },
    markerContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    customMarker: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'white',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
  });
};

const styles = createStyles();

export default function CurrentLocationMap() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  const hasLoggedParamsRef = useRef<string>('');

  // Check if we have location parameters (from locale or post)
  const postLatitude = params.latitude ? parseFloat(params.latitude as string) : null;
  const postLongitude = params.longitude ? parseFloat(params.longitude as string) : null;
  const postAddress = params.address as string || null;
  const locationName = params.locationName as string || null; // For locale navigation
  const countryParam = params.country as string || null;
  const userIdParam = params.userId as string || null;
  
  // Check if this is TripScore flow (country is not 'general' and userId is not 'admin-locale')
  const isTripScoreFlow = countryParam && countryParam !== 'general' && userIdParam !== 'admin-locale';
  
  // CRITICAL: Validate coordinates are valid (not 0 or undefined)
  const hasValidCoordinates = postLatitude && postLongitude && 
                               postLatitude !== 0 && postLongitude !== 0 &&
                               !isNaN(postLatitude) && !isNaN(postLongitude);
  
  const isPostLocation = hasValidCoordinates; // Use valid coordinates check

  useEffect(() => {
    // Create a unique key for these params to avoid duplicate logging
    const paramsKey = `${postLatitude || 'null'}-${postLongitude || 'null'}-${postAddress || 'null'}-${locationName || 'null'}`;
    
    // Only log once per unique param combination
    if (__DEV__ && hasLoggedParamsRef.current !== paramsKey) {
      hasLoggedParamsRef.current = paramsKey;
      
      // Only log when we have valid coordinates or when coordinates are expected but invalid
      // Don't log when coordinates are simply missing (expected for current location flow)
      const hasAnyLocationParam = postLatitude !== null || postLongitude !== null || postAddress || locationName;
      
      if (hasValidCoordinates) {
        logger.info('✅ Using EXACT coordinates from params:', { postLatitude, postLongitude });
      } else if (hasAnyLocationParam) {
        // Only log if we have some location params but they're invalid
        // This indicates a potential issue (e.g., invalid coordinates passed)
        logger.info('⚠️ Location params provided but invalid, will use current location or geocoding:', {
          postLatitude,
          postLongitude,
          postAddress,
          locationName,
        });
      }
      // Don't log when no params are provided - this is expected behavior for current location flow
    }
  }, [params, postLatitude, postLongitude, postAddress, locationName, hasValidCoordinates, isPostLocation]);

  useEffect(() => {
    // CRITICAL: Use exact coordinates from params if valid (for locale flow)
    if (hasValidCoordinates) {
      logger.info('📍 Setting map location with EXACT coordinates:', { postLatitude, postLongitude });
      setLocation({
        coords: {
          latitude: postLatitude!,
          longitude: postLongitude!,
          accuracy: 0,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
      setLoading(false);
    } else {
      // Get current location
      getCurrentLocation();
      
      // Start watching location for continuous updates
      let subscription: Location.LocationSubscription | undefined;
      watchLocation().then((sub) => {
        subscription = sub;
      });

      return () => {
        if (subscription) {
          subscription.remove();
          setIsWatching(false);
        }
      };
    }
  }, [hasValidCoordinates, postLatitude, postLongitude]);

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      setError(null);

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        setLoading(false);
        return;
      }

      // Get current location with best accuracy
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      setLocation(currentLocation);
      setLoading(false);
    } catch (err: any) {
      // Safely extract error message without causing Babel _construct issues
      let errorMessage = 'Failed to get current location';
      try {
        if (err && typeof err === 'object') {
          // Handle CodedError and other Expo errors safely
          errorMessage = err.message || err.toString() || 'Location error';
        } else if (typeof err === 'string') {
          errorMessage = err;
        }
      } catch (e) {
        // If error extraction fails, use safe fallback
        errorMessage = 'Location error';
      }
      
      // Log as debug to avoid Babel serialization issues with CodedError
      logger.info('Error getting location:', errorMessage);
      setError('Failed to get current location');
      setLoading(false);
    }
  };

  const watchLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      setIsWatching(true);
      // Watch position for more accurate updates
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (newLocation) => {
          setLocation(newLocation);
        }
      );

      return subscription;
    } catch (err) {
      logger.error('Error watching location:', err);
      setIsWatching(false);
    }
  };

  const handleRefresh = () => {
    getCurrentLocation();
  };

  // Generate HTML for WebView map (web platform)
  const getWebMapHTML = () => {
    if (!location) return '';
    
    const lat = location.coords.latitude;
    const lng = location.coords.longitude;
    const title = isPostLocation ? (postAddress || 'Post Location') : 'Your Current Location';
    const description = isPostLocation ? 'Post Location' : 'You are here';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          html, body, #map { 
            height: 100%; 
            margin: 0; 
            padding: 0; 
          }
        </style>
        <script>
          function initMap() {
            const map = new google.maps.Map(document.getElementById('map'), {
              center: { lat: ${lat}, lng: ${lng} },
              zoom: 15,
              mapTypeId: 'terrain',
              language: 'en',
            });
            
            const marker = new google.maps.Marker({
              position: { lat: ${lat}, lng: ${lng} },
              map: map,
              title: '${title}',
              icon: {
                url: 'data:image/svg+xml;utf-8,<svg width="30" height="30" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="white" stroke="%23FF0000" stroke-width="2"/><text x="15" y="20" font-size="16" text-anchor="middle" fill="%23FF0000">🏳️</text></svg>',
                scaledSize: new google.maps.Size(30, 30),
              },
            });
            
            const infoWindow = new google.maps.InfoWindow({
              content: '<div style="padding: 8px;"><strong>${title}</strong><br/>${description}</div>',
            });
            
            marker.addListener('click', function() {
              infoWindow.open(map, marker);
            });
            
            infoWindow.open(map, marker);
          }
        </script>
      </head>
      <body>
        <div id="map"></div>
        <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY || ''}&language=en&callback=initMap"></script>
      </body>
      </html>
    `;
  };

  const renderMap = () => {
    if (loading) {
      return (
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Getting your location...
          </Text>
        </View>
      );
    }

    if (error || !location) {
      return (
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <Ionicons name="location-outline" size={64} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {error || 'Unable to get location'}
          </Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleRefresh}
          >
            <Text style={[styles.retryButtonText, { color: theme.colors.surface }]}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (Platform.OS === 'web') {
      // WebView map for web platform
      return (
        <WebView
          style={styles.map}
          source={{ html: getWebMapHTML() }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          onMessage={(event) => {
            // Handle marker clicks from WebView
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'marker') {
                // For TripScore and locale flows, just go back to existing detail screen
                if (isTripScoreFlow || (locationName && params.userId === 'admin-locale')) {
                  router.back();
                } else {
                  // For general post locations, navigate to detail
                  if (isPostLocation && postAddress) {
                    const locationSlug = postAddress.toLowerCase().replace(/\s+/g, '-');
                    const countrySlug = 'general';
                    router.replace({
                      pathname: '/tripscore/countries/[country]/locations/[location]',
                      params: {
                        country: countrySlug,
                        location: locationSlug,
                        userId: 'current-user',
                      }
                    });
                  } else {
                    router.back();
                  }
                }
              }
            } catch (error) {
              logger.error('Error parsing WebView message:', error);
            }
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            logger.error('WebView error: ', nativeEvent);
          }}
        />
      );
    }

    if (!MapView) {
      return (
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            Map not available on this platform
          </Text>
        </View>
      );
    }

    // Native MapView for iOS/Android
    return (
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={satelliteTheme}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        showsScale={true}
        mapType="terrain"
        userLocationPriority="high"
        followsUserLocation={true}
      >
        <Marker
          coordinate={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }}
          title={isPostLocation ? (postAddress || 'Post Location') : 'Your Current Location'}
          description={isPostLocation ? 'Post Location' : 'You are here'}
          anchor={{ x: 0.5, y: 1 }}
          onPress={() => {
            // CRITICAL: For TripScore flow, just go back to existing detail screen
            // This prevents creating duplicate detail screens (third screen issue)
            if (isTripScoreFlow) {
              // TripScore flow: just go back to the detail screen that's already in stack
              router.back();
            } else if (locationName && params.userId === 'admin-locale') {
              // Locale flow: just go back to the detail screen that's already in stack
              router.back();
            } else if (isPostLocation && postAddress) {
              // Post location flow (general): navigate to detail
              const locationSlug = postAddress.toLowerCase().replace(/\s+/g, '-');
              const countrySlug = 'general';
              
              router.replace({
                pathname: '/tripscore/countries/[country]/locations/[location]',
                params: {
                  country: countrySlug,
                  location: locationSlug,
                  userId: 'current-user',
                }
              });
            } else {
              // Fallback: just go back
              router.back();
            }
          }}
        >
          <View style={styles.markerContainer}>
            <View style={styles.customMarker}>
              <Ionicons name="flag" size={20} color="#FF0000" />
            </View>
          </View>
        </Marker>
      </MapView>
    );
  };

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <StatusBar 
        barStyle={theme.colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.background} 
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            // CRITICAL: For TripScore and locale flows, just go back to existing detail screen
            // This prevents creating duplicate detail screens
            if (isTripScoreFlow || (locationName && params.userId === 'admin-locale')) {
              // TripScore or Locale flow: just go back to the detail screen that's already in stack
              router.back();
            } else {
              router.back();
            }
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {isPostLocation ? (postAddress || 'Post Location') : 'Current Location'}
          </Text>
          {isWatching && !isPostLocation && (
            <View style={styles.watchingIndicator}>
              <Ionicons name="radio" size={12} color={theme.colors.success} />
            </View>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Map Container */}
      <View style={styles.mapContainer}>
        {renderMap()}
      </View>

      {/* Location Info */}
      {location && (
        <View style={[styles.locationInfo, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          {isPostLocation && postAddress && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={20} color={theme.colors.primary} />
              <Text style={[styles.locationText, { color: theme.colors.text }]}>
                Location: {postAddress}
              </Text>
            </View>
          )}
          <View style={styles.locationRow}>
            <Ionicons name="location" size={20} color={theme.colors.primary} />
            <Text style={[styles.locationText, { color: theme.colors.text }]}>
              Latitude: {location.coords.latitude.toFixed(6)}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={20} color={theme.colors.primary} />
            <Text style={[styles.locationText, { color: theme.colors.text }]}>
              Longitude: {location.coords.longitude.toFixed(6)}
            </Text>
          </View>
          {!isPostLocation && location.coords.accuracy && location.coords.accuracy > 0 && (
            <View style={styles.locationRow}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
              <Text style={[styles.locationText, { color: theme.colors.text }]}>
                Accuracy: ±{Math.round(location.coords.accuracy)}m
              </Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const satelliteTheme = [
  // Base land geometry in light green (like first image)
  { elementType: 'geometry', stylers: [{ color: '#e8f5e8' }] },
  // Water in light blue
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a8d8ea' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2c3e50' }] },
  // Natural landscape in various light greens
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#d4edda' }] },
  { featureType: 'landscape.natural.terrain', elementType: 'geometry', stylers: [{ color: '#c3e6cb' }] },
  // Parks in slightly darker green
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#b8d4b8' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#155724' }] },
  // Roads in light gray (subtle)
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#f8f9fa' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e9ecef' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#495057' }] },
  // Buildings in very light gray
  { featureType: 'poi.business', elementType: 'geometry', stylers: [{ color: '#f1f3f4' }] },
  { featureType: 'poi.business', elementType: 'labels.text.fill', stylers: [{ color: '#343a40' }] },
  // Administrative boundaries in light gray
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#dee2e6' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#495057' }] },
  // Hide generic POIs for cleaner look
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  // Labels in dark gray for readability
  { elementType: 'labels.text.fill', stylers: [{ color: '#2c3e50' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
];
