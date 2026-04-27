import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
  Modal,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import * as Location from 'expo-location';
import { MapView, Marker, getMapProvider, useWebViewFallback } from '../../utils/mapsWrapper';
import { getGoogleMapsApiKeyForWebView } from '../../utils/maps';
import { calculateDistance, openDirections } from '../../utils/locationUtils';
import { useJourneyTracking } from '../../hooks/useJourneyTracking';
import logger from '../../utils/logger';

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
    },
    directionButton: {
      position: 'absolute',
      bottom: 16,
      right: 16,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
  });
};

const styles = createStyles();

const GROWTH_GREEN = '#22C55E';

export default function CurrentLocationMap() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [journeyTitleInput, setJourneyTitleInput] = useState('');
  const [showJourneyTitle, setShowJourneyTitle] = useState(false);
  const [journeyActionLoading, setJourneyActionLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructionCountdown, setInstructionCountdown] = useState(10);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const hasLoggedParamsRef = useRef<string>('');

  // Journey tracking
  const {
    isTracking,
    isPaused,
    journey,
    distance: journeyDistance,
    duration: journeyDuration,
    startJourneyRecording,
    pauseJourneyRecording,
    resumeJourneyRecording,
    stopJourneyRecording,
  } = useJourneyTracking();

  const formatJourneyDistance = () => {
    if (journeyDistance < 1000) return `${Math.round(journeyDistance)} m`;
    return `${(journeyDistance / 1000).toFixed(1)} km`;
  };

  const formatJourneyDuration = () => {
    const h = Math.floor(journeyDuration / 3600);
    const m = Math.floor((journeyDuration % 3600) / 60);
    const s = journeyDuration % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const handleStartJourney = async () => {
    try {
      setJourneyActionLoading(true);
      // Increment journey start count
      const countStr = await AsyncStorage.getItem('journeyStartCount');
      const count = countStr ? parseInt(countStr, 10) : 0;
      await AsyncStorage.setItem('journeyStartCount', String(count + 1));
      await startJourneyRecording(journeyTitleInput || undefined);
      setJourneyTitleInput('');
      setShowJourneyTitle(false);
    } catch (err: any) {
      showAlert('Failed to start journey', err.message);
    } finally {
      setJourneyActionLoading(false);
    }
  };

  // Show instructions popup for the first 5 journeys
  const handleStartPress = async () => {
    try {
      const countStr = await AsyncStorage.getItem('journeyStartCount');
      const count = countStr ? parseInt(countStr, 10) : 0;
      if (count < 5) {
        setInstructionCountdown(10);
        setShowInstructions(true);
        progressAnim.setValue(1);
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 10000,
          useNativeDriver: false,
        }).start();
        countdownRef.current = setInterval(() => {
          setInstructionCountdown((prev) => {
            if (prev <= 1) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        await handleStartJourney();
      }
    } catch {
      await handleStartJourney();
    }
  };

  const dismissInstructions = async () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    progressAnim.stopAnimation();
    setShowInstructions(false);
    await handleStartJourney();
  };

  // Auto-dismiss when countdown reaches 0
  useEffect(() => {
    if (showInstructions && instructionCountdown === 0) {
      const t = setTimeout(() => dismissInstructions(), 100);
      return () => clearTimeout(t);
    }
  }, [instructionCountdown, showInstructions]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handlePauseJourney = async () => {
    try {
      setJourneyActionLoading(true);
      await pauseJourneyRecording();
    } catch (err: any) {
      showAlert('Failed to pause', err.message);
    } finally {
      setJourneyActionLoading(false);
    }
  };

  const handleResumeJourney = async () => {
    try {
      setJourneyActionLoading(true);
      await resumeJourneyRecording();
    } catch (err: any) {
      showAlert('Failed to resume', err.message);
    } finally {
      setJourneyActionLoading(false);
    }
  };

  const handleStopJourney = () => {
    Alert.alert('End Journey?', 'This will complete your current journey.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Journey',
        style: 'destructive',
        onPress: async () => {
          try {
            setJourneyActionLoading(true);
            await stopJourneyRecording();
            router.push('/navigate/complete');
          } catch (err: any) {
            showAlert('Failed to end journey', err.message);
          } finally {
            setJourneyActionLoading(false);
          }
        },
      },
    ]);
  };

  // Check if we have location parameters (from locale or post)
  const postLatitude = params.latitude ? parseFloat(params.latitude as string) : null;
  const postLongitude = params.longitude ? parseFloat(params.longitude as string) : null;
  const postAddress = params.address as string || null;
  const locationName = params.locationName as string || null; // For locale navigation
  const countryParam = params.country as string || null;
  const userIdParam = params.userId as string || null;
  const isApproximate = params.isApproximate === 'true';
  const approximateLabel = params.approximateLabel as string || null;
  
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
    // These coordinates come from the database (admin locale) and should be used instead of current location
    if (hasValidCoordinates) {
      logger.info('📍 Setting map location with EXACT database coordinates from locale:', { 
        postLatitude, 
        postLongitude,
        locationName,
        userId: userIdParam
      });
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
      // Don't watch location when showing a specific locale location
      setIsWatching(false);

      // Still fetch the user's current GPS in the background so we can show
      // distance from here to the destination pin.
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') return;
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserCoords({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          });
        } catch (e) {
          logger.info('Unable to fetch user coords for distance readout');
        }
      })();
    } else {
      // Only get current location if no coordinates were passed
      // This is for the "current location" flow, not locale navigation
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
  }, [hasValidCoordinates, postLatitude, postLongitude, locationName, userIdParam]);

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
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 20, // Update every 20 meters — reduces jitter from small GPS noise
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

    // ── WebView fallback (Expo Go Android) ──
    if (useWebViewFallback) {
      const WV_KEY = getGoogleMapsApiKeyForWebView();
      if (!WV_KEY) {
        return (
          <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="map-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.errorText, { color: theme.colors.text }]}>Map unavailable — no API key</Text>
          </View>
        );
      }
      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      const rawTitle = isPostLocation ? (postAddress || 'Post Location') : (locationName || 'Your Current Location');
      const safeTitle = JSON.stringify(rawTitle);
      const htmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const infoHtml = JSON.stringify(`<div style="padding:8px;"><strong>${htmlEsc(rawTitle)}</strong></div>`);
      const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>html,body,#map{height:100%;margin:0;padding:0}</style>
<script>
function initMap(){
  var map=new google.maps.Map(document.getElementById('map'),{center:{lat:${lat},lng:${lng}},zoom:15,mapTypeId:'terrain',language:'en'});
  var marker=new google.maps.Marker({position:{lat:${lat},lng:${lng}},map:map,title:${safeTitle}});
  var iw=new google.maps.InfoWindow({content:${infoHtml}});
  marker.addListener('click',function(){iw.open(map,marker);});
  iw.open(map,marker);
}
</script></head><body>
<div id="map"></div>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${WV_KEY}&language=en&callback=initMap"></script>
</body></html>`;
      return (
        <WebView
          style={styles.map}
          source={{ html }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          originWhitelist={['https://*', 'http://*', 'data:*', 'about:*']}
          onShouldStartLoadWithRequest={(req) => req.url.startsWith('http') || req.url.startsWith('data:') || req.url.startsWith('about:')}
          {...(Platform.OS === 'android' && { mixedContentMode: 'compatibility' as const, setSupportMultipleWindows: false })}
          onError={(e) => logger.error('WebView error:', e.nativeEvent)}
        />
      );
    }

    // ── Native MapView (iOS / Android dev build) ──
    if (!MapView) {
      return (
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.errorText, { color: theme.colors.text }]}>Map not available</Text>
        </View>
      );
    }

    return (
      <MapView
        style={[styles.map, Platform.OS === 'android' && { flex: 1, minHeight: 200 }]}
        provider={getMapProvider()}
        {...(Platform.OS === 'ios' ? { customMapStyle: satelliteTheme } : {})}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation={!isPostLocation && !hasValidCoordinates}
        showsMyLocationButton={!isPostLocation && !hasValidCoordinates}
        showsCompass={true}
        showsScale={true}
        mapType="terrain"
        userLocationPriority={hasValidCoordinates ? "none" : "high"}
        followsUserLocation={!hasValidCoordinates}
      >
        <Marker
          coordinate={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }}
          title={
            isPostLocation
              ? (postAddress || 'Post Location')
              : (locationName || 'Your Current Location')
          }
          description={
            isPostLocation
              ? 'Post Location'
              : (locationName ? `${locationName} Location` : 'You are here')
          }
          anchor={{ x: 0.5, y: 1 }}
          onPress={() => {
            if (isTripScoreFlow) {
              router.back();
            } else if (locationName && params.userId === 'admin-locale') {
              router.back();
            } else if (isPostLocation && postAddress) {
              const locationSlug = postAddress.toLowerCase().replace(/\s+/g, '-');
              router.replace({
                pathname: '/tripscore/countries/[country]/locations/[location]',
                params: { country: 'general', location: locationSlug, userId: 'current-user' }
              });
            } else {
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
            {isApproximate ? 'Approximate Location' : isPostLocation ? (postAddress || 'Post Location') : 'Current Location'}
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
      {/* Map Container */}
      <View style={styles.mapContainer}>
        {renderMap()}

        {/* Direction Button */}
        {isPostLocation && postLatitude && postLongitude && (
          <TouchableOpacity
            style={[styles.directionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              openDirections(postLatitude, postLongitude, postAddress || 'Destination');
            }}
          >
            <Ionicons name="map" size={20} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* Location Info */}
      {location && (
        <View style={[styles.locationInfo, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          {isPostLocation && postAddress && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={20} color={theme.colors.primary} />
              <Text style={[styles.locationText, { color: theme.colors.text }]}>
                {postAddress}
              </Text>
            </View>
          )}
          {isPostLocation && userCoords && (
            <View style={styles.locationRow}>
              <Ionicons name="navigate" size={20} color={theme.colors.primary} />
              <Text style={[styles.locationText, { color: theme.colors.text }]}>
                {(() => {
                  const km = calculateDistance(
                    userCoords.latitude,
                    userCoords.longitude,
                    postLatitude!,
                    postLongitude!
                  );
                  return km < 1
                    ? `${Math.round(km * 1000)} m from your current location`
                    : `${km.toFixed(1)} km from your current location`;
                })()}
              </Text>
            </View>
          )}
          {isApproximate && approximateLabel && (
            <View style={[styles.locationRow, { marginTop: 6, backgroundColor: theme.colors.primary + '15', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
              <Text style={[styles.locationText, { color: theme.colors.primary, fontSize: 12, marginLeft: 6 }]}>
                Exact address not found on maps. Showing nearest area: {approximateLabel}
              </Text>
            </View>
          )}
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

      {/* Journey Controls — only on current location view (not post location) */}
      {!isPostLocation && (
        <View style={[journeyStyles.journeyBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          {/* No active journey — show Start button */}
          {!isTracking && !isPaused && (
            <>
              {showJourneyTitle && (
                <View style={[journeyStyles.titleRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                  <TextInput
                    style={[journeyStyles.titleInput, { color: theme.colors.text, backgroundColor: theme.colors.background }]}
                    placeholder="Journey name (optional)"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={journeyTitleInput}
                    onChangeText={setJourneyTitleInput}
                    maxLength={50}
                  />
                  <TouchableOpacity onPress={() => { setShowJourneyTitle(false); setJourneyTitleInput(''); }}>
                    <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={[journeyStyles.startBtn, { backgroundColor: GROWTH_GREEN }]}
                onPress={() => {
                  if (showJourneyTitle) {
                    handleStartPress();
                  } else {
                    setShowJourneyTitle(true);
                  }
                }}
                disabled={journeyActionLoading}
              >
                {journeyActionLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="play-circle" size={22} color="white" />
                    <Text style={journeyStyles.startBtnText}>Start Journey</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Journey active — show recording stats + pause */}
          {isTracking && !isPaused && (
            <>
              <View style={journeyStyles.statsRow}>
                <View style={journeyStyles.statChip}>
                  <Ionicons name="navigate" size={14} color={GROWTH_GREEN} />
                  <Text style={[journeyStyles.statText, { color: theme.colors.text }]}>{formatJourneyDistance()}</Text>
                </View>
                <View style={journeyStyles.statChip}>
                  <Ionicons name="time" size={14} color="#3B82F6" />
                  <Text style={[journeyStyles.statText, { color: theme.colors.text }]}>{formatJourneyDuration()}</Text>
                </View>
                <View style={[journeyStyles.liveDot, { backgroundColor: GROWTH_GREEN }]} />
                <Text style={[journeyStyles.liveText, { color: GROWTH_GREEN }]}>Recording</Text>
              </View>
              <View style={journeyStyles.actionRow}>
                <TouchableOpacity
                  style={[journeyStyles.pauseBtn, { borderColor: '#F59E0B' }]}
                  onPress={handlePauseJourney}
                  disabled={journeyActionLoading}
                >
                  <Ionicons name="pause" size={18} color="#F59E0B" />
                  <Text style={[journeyStyles.pauseBtnText, { color: '#F59E0B' }]}>Pause</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[journeyStyles.stopBtn, { borderColor: '#EF4444' }]}
                  onPress={handleStopJourney}
                  disabled={journeyActionLoading}
                >
                  <Ionicons name="stop" size={18} color="#EF4444" />
                  <Text style={[journeyStyles.pauseBtnText, { color: '#EF4444' }]}>End</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Journey paused — show resume/end */}
          {isPaused && (
            <>
              <View style={journeyStyles.statsRow}>
                <View style={journeyStyles.statChip}>
                  <Ionicons name="navigate" size={14} color={GROWTH_GREEN} />
                  <Text style={[journeyStyles.statText, { color: theme.colors.text }]}>{formatJourneyDistance()}</Text>
                </View>
                <View style={journeyStyles.statChip}>
                  <Ionicons name="time" size={14} color="#3B82F6" />
                  <Text style={[journeyStyles.statText, { color: theme.colors.text }]}>{formatJourneyDuration()}</Text>
                </View>
                <View style={[journeyStyles.liveDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[journeyStyles.liveText, { color: '#F59E0B' }]}>Paused</Text>
              </View>
              <View style={journeyStyles.actionRow}>
                <TouchableOpacity
                  style={[journeyStyles.startBtn, { backgroundColor: GROWTH_GREEN, flex: 1 }]}
                  onPress={handleResumeJourney}
                  disabled={journeyActionLoading}
                >
                  {journeyActionLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="play" size={20} color="white" />
                      <Text style={journeyStyles.startBtnText}>Continue</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[journeyStyles.stopBtn, { borderColor: '#EF4444' }]}
                  onPress={handleStopJourney}
                  disabled={journeyActionLoading}
                >
                  <Ionicons name="stop" size={18} color="#EF4444" />
                  <Text style={[journeyStyles.pauseBtnText, { color: '#EF4444' }]}>End</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}
      </KeyboardAvoidingView>

      {/* Journey Instructions Modal */}
      <Modal
        visible={showInstructions}
        transparent
        animationType="fade"
        onRequestClose={dismissInstructions}
      >
        <View style={instructionStyles.overlay}>
          <View style={[instructionStyles.modal, { backgroundColor: theme.colors.surface }]}>
            {/* Header */}
            <View style={instructionStyles.header}>
              <View style={[instructionStyles.iconWrap, { backgroundColor: GROWTH_GREEN + '12' }]}>
                <Ionicons name="compass-outline" size={28} color={GROWTH_GREEN} />
              </View>
              <Text style={[instructionStyles.title, { color: theme.colors.text }]}>
                How Journeys Work
              </Text>
            </View>

            {/* Tips */}
            <View style={instructionStyles.list}>
              <View style={instructionStyles.item}>
                <View style={[instructionStyles.tipIcon, { backgroundColor: GROWTH_GREEN + '12' }]}>
                  <Ionicons name="pause-circle-outline" size={20} color={GROWTH_GREEN} />
                </View>
                <Text style={[instructionStyles.text, { color: theme.colors.text }]}>
                  You can <Text style={{ fontWeight: '700' }}>pause and resume</Text> your journey anytime you want.
                </Text>
              </View>

              <View style={instructionStyles.item}>
                <View style={[instructionStyles.tipIcon, { backgroundColor: '#3B82F6' + '12' }]}>
                  <Ionicons name="location-outline" size={20} color="#3B82F6" />
                </View>
                <Text style={[instructionStyles.text, { color: theme.colors.text }]}>
                  If your <Text style={{ fontWeight: '700' }}>location is turned off</Text>, the journey will automatically pause.
                </Text>
              </View>

              <View style={instructionStyles.item}>
                <View style={[instructionStyles.tipIcon, { backgroundColor: '#EF4444' + '12' }]}>
                  <Ionicons name="time-outline" size={20} color="#EF4444" />
                </View>
                <Text style={[instructionStyles.text, { color: theme.colors.text }]}>
                  If paused for more than <Text style={{ fontWeight: '700' }}>24 hours</Text>, the journey ends automatically at your last known location.
                </Text>
              </View>

              <View style={instructionStyles.item}>
                <View style={[instructionStyles.tipIcon, { backgroundColor: '#8B5CF6' + '12' }]}>
                  <Ionicons name="camera-outline" size={20} color="#8B5CF6" />
                </View>
                <Text style={[instructionStyles.text, { color: theme.colors.text }]}>
                  <Text style={{ fontWeight: '700' }}>Add posts</Text> along the way to mark waypoints on your route.
                </Text>
              </View>
            </View>

            {/* Progress bar + button */}
            <View style={instructionStyles.footer}>
              <View style={[instructionStyles.progressBg, { backgroundColor: theme.colors.border }]}>
                <Animated.View
                  style={[
                    instructionStyles.progressFill,
                    {
                      backgroundColor: GROWTH_GREEN,
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <TouchableOpacity
                style={[instructionStyles.gotItBtn, { backgroundColor: GROWTH_GREEN }]}
                onPress={dismissInstructions}
                activeOpacity={0.8}
              >
                <Text style={instructionStyles.gotItText}>
                  Got it, start! ({instructionCountdown}s)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const instructionStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  list: {
    gap: 16,
    marginBottom: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    gap: 14,
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  gotItBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  gotItText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
});

const journeyStyles = StyleSheet.create({
  journeyBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  titleInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    minHeight: 36,
    paddingVertical: 4,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    minHeight: 50,
  },
  startBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pauseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 6,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 6,
  },
  pauseBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

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
