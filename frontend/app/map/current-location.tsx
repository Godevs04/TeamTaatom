import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import LoadingGlobe from '../../components/LoadingGlobe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import * as Location from 'expo-location';
import { MapView, Marker, getMapProvider, useWebViewFallback } from '../../utils/mapsWrapper';
import { getGoogleMapsApiKeyForWebView } from '../../utils/maps';
import { getApiUrl } from '../../utils/config';
import { calculateDistance } from '../../utils/locationUtils';
import GlassMapPanel from '../../components/GlassMapPanel';
import PremiumMapMarker from '../../components/PremiumMapMarker';
import PolylineRenderer from '../../components/PolylineRenderer';
import { DirectionsRoute, fetchDirectionsRoute, getManeuverIcon } from '../../services/directions';
import { useMapStyle } from '../../hooks/useMapStyle';
import logger from '../../utils/logger';
import { BlurView } from 'expo-blur';
import {
  isValidMapCoordinate,
  sanitizeLatitudeDelta,
  sanitizeMapRegion,
} from '../../utils/mapSafety';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Create styles function that uses the constants
const createStyles = (isDark: boolean) => {
  const isTabletLocal = screenWidth >= 768;
  const isAndroidLocal = Platform.OS === 'android';
  const isWebLocal = Platform.OS === 'web';

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    headerShadowWrapper: {
      position: 'absolute',
      zIndex: 1000,
    },
    headerFloating: {
      borderRadius: 24,
      borderWidth: 1,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.85)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(28, 115, 180, 0.15)',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 56,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    titleContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 16,
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
      ...StyleSheet.absoluteFillObject,
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
    
    // Bottom panel styling
    infoShadowWrapper: {
      position: 'absolute',
      left: 16,
      right: 16,
      zIndex: 1000,
      
      // Soft ambient glow shadow
      shadowColor: isDark ? '#38BDF8' : '#1C73B4',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.08 : 0.12,
      shadowRadius: 16,
      elevation: 4,
    },
    infoFloating: {
      borderRadius: 20,
      borderWidth: 1,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(15, 22, 35, 0.82)' : 'rgba(250, 252, 255, 0.85)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.35)',
    },
    locationInfo: {
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    locationDetails: {
      flex: 1,
      marginRight: 12,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
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
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    routePanel: {
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    routeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 4,
    },
    routeMeta: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    routeInstruction: {
      fontSize: 15,
      fontWeight: '700',
    },
  });
};

const GROWTH_GREEN = '#22C55E';

const resolvePhotoUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return getApiUrl(cleanPath);
};

export default function CurrentLocationMap() {
  const router = useRouter();
  const params = useLocalSearchParams();

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
  const hasValidCoordinates = isValidMapCoordinate({ latitude: postLatitude, longitude: postLongitude }) &&
                               postLatitude !== 0 && postLongitude !== 0;
  
  const isPostLocation = hasValidCoordinates; // Use valid coordinates check

  const [location, setLocation] = useState<Location.LocationObject | null>(() => {
    if (hasValidCoordinates) {
      return {
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
      } as Location.LocationObject;
    }
    return null;
  });
  const [loading, setLoading] = useState(!hasValidCoordinates);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [latitudeDelta, setLatitudeDelta] = useState(0.1);
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const insets = useSafeAreaInsets();
  const mapStyle = useMapStyle();
  const [route, setRoute] = useState<DirectionsRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [isRoutingActive, setIsRoutingActive] = useState(false);
  const [headerCardHeight, setHeaderCardHeight] = useState(60);
  const hasLoggedParamsRef = useRef<string>('');
  const mapRef = useRef<any>(null);

  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      setTracksViewChanges(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [location, route]);

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
          const currentPerm = await Location.getForegroundPermissionsAsync();
          let status = currentPerm.status;
          if (status === 'undetermined') {
            const requested = await Location.requestForegroundPermissionsAsync();
            status = requested.status;
          }
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
      const currentPerm = await Location.getForegroundPermissionsAsync();
      let status = currentPerm.status;
      if (status === 'undetermined') {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }
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
      const currentPerm = await Location.getForegroundPermissionsAsync();
      let status = currentPerm.status;
      if (status === 'undetermined') {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }
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
    if (isPostLocation && postLatitude && postLongitude) {
      if (mapRef.current) {
        if (useWebViewFallback) {
          const jsCode = `
            if (window.map) {
              window.map.panTo({ lat: ${postLatitude}, lng: ${postLongitude} });
              window.map.setZoom(15);
            }
          `;
          mapRef.current.injectJavaScript(jsCode);
        } else {
          mapRef.current.animateToRegion({
            latitude: postLatitude,
            longitude: postLongitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        }
      }
    } else {
      getCurrentLocation();
    }
  };

  const loadRoute = async () => {
    if (!hasValidCoordinates || !postLatitude || !postLongitude) return;
    try {
      setIsRoutingActive(true);
      setRouteLoading(true);
      let coords = userCoords;
      if (!coords) {
        const currentPerm = await Location.getForegroundPermissionsAsync();
        let status = currentPerm.status;
        if (status === 'undetermined') {
          const requested = await Location.requestForegroundPermissionsAsync();
          status = requested.status;
        }
        if (status === 'granted') {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          };
          setUserCoords(coords);
        }
      }

      if (!coords) {
        logger.error('Cannot load route: user location is not available');
        return;
      }

      const nextRoute = await fetchDirectionsRoute(
        coords,
        { latitude: postLatitude, longitude: postLongitude }
      );
      setRoute(nextRoute);
    } catch (err) {
      logger.error('Failed to load in-app route:', err);
    } finally {
      setRouteLoading(false);
    }
  };

  useEffect(() => {
    if (route?.coordinates && route.coordinates.length > 0 && mapRef.current && !useWebViewFallback) {
      if (typeof mapRef.current.fitToCoordinates === 'function') {
        mapRef.current.fitToCoordinates(route.coordinates, {
          edgePadding: { top: 120, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  }, [route, useWebViewFallback]);

  const renderMap = () => {
    if (loading) {
      return (
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <LoadingGlobe size="large" color={theme.colors.primary} />
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
      const userCoordsJson = userCoords ? JSON.stringify(userCoords) : 'null';
      const rawTitle = isPostLocation ? (postAddress || 'Post Location') : (locationName || 'Your Current Location');
      const htmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
html,body,#map{height:100%;margin:0;padding:0}
.glowing-dot-container {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pulse-ring {
  position: absolute;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: radial-gradient(circle, ${isDark ? 'rgba(45, 212, 191, 0.4)' : 'rgba(59, 130, 246, 0.4)'} 0%, rgba(59, 130, 246, 0) 70%);
  animation: pulse 1.8s infinite ease-out;
}
.core-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2DD4BF 0%, #3B82F6 100%);
  border: 2px solid #FFFFFF;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
}
@keyframes pulse {
  0% { transform: scale(0.6); opacity: 1; }
  100% { transform: scale(2.2); opacity: 0; }
}

.glass-marker-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 20px;
  background: ${isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.75)'};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.08)'};
  box-shadow: 0 8px 32px 0 ${isDark ? 'rgba(0, 0, 0, 0.37)' : 'rgba(31, 38, 135, 0.15)'};
  max-width: 180px;
  animation: floatCard 0.3s ease-out;
}
.marker-thumb {
  width: 26px;
  height: 26px;
  min-width: 26px;
  min-height: 26px;
  flex-shrink: 0;
  -webkit-flex-shrink: 0;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid ${isDark ? '#2DD4BF' : '#3B82F6'};
}
.marker-thumb-placeholder {
  width: 26px;
  height: 26px;
  min-width: 26px;
  min-height: 26px;
  flex-shrink: 0;
  -webkit-flex-shrink: 0;
  border-radius: 50%;
  background: ${isDark ? 'rgba(45, 212, 191, 0.15)' : 'rgba(59, 130, 246, 0.1)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.marker-info {
  display: flex;
  flex-direction: column;
  min-width: 60px;
  overflow: hidden;
}
.marker-title {
  font-size: 11px;
  font-weight: 700;
  color: ${isDark ? '#F8FAFC' : '#0F172A'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.marker-subtitle {
  font-size: 9px;
  font-weight: 500;
  color: ${isDark ? '#94A3B8' : '#64748B'};
  margin-top: 1px;
}
@keyframes floatCard {
  0% { transform: translateY(6px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
<script>
function initMap(){
  window.map=new google.maps.Map(document.getElementById('map'),{center:{lat:${lat},lng:${lng}},zoom:15,mapTypeId:'roadmap',language:'en',styles:${JSON.stringify(mapStyle.customMapStyle)},disableDefaultUI:true,zoomControl:true});
  var map=window.map;
  
  // Custom OverlayView class
  class PhotoOverlay extends google.maps.OverlayView {
    constructor(pos, el) {
      super();
      this.position = pos;
      this.div = el;
      this.setMap(map);
    }
    onAdd() {
      this.getPanes().overlayMouseTarget.appendChild(this.div);
    }
    draw() {
      var pt = this.getProjection().fromLatLngToDivPixel(this.position);
      if (pt) {
        this.div.style.left = pt.x + 'px';
        this.div.style.top = pt.y + 'px';
        this.div.style.position = 'absolute';
        var anchor = this.div.getAttribute('data-anchor') || 'bottom';
        if (anchor === 'center') {
          this.div.style.transform = 'translate(-50%, -50%)';
        } else {
          this.div.style.transform = 'translate(-50%, -100%)';
        }
      }
    }
    onRemove() {
      if (this.div && this.div.parentNode) {
        this.div.parentNode.removeChild(this.div);
      }
    }
  }

  var routePath=${JSON.stringify(route?.coordinates.map((coord) => ({ lat: coord.latitude, lng: coord.longitude })) || [])};
  if(routePath.length>1){
    new google.maps.Polyline({path:routePath,geodesic:true,strokeColor:'${mapStyle.routeGlowColor}',strokeOpacity:1,strokeWeight:14,map:map});
    new google.maps.Polyline({path:routePath,geodesic:true,strokeColor:'${mapStyle.routeColor}',strokeOpacity:1,strokeWeight:5,map:map});
    var bounds=new google.maps.LatLngBounds();routePath.forEach(function(p){bounds.extend(p);});map.fitBounds(bounds,64);
  }
  
  var userCoords=${userCoordsJson};
  if(routePath.length>1 && userCoords){
    var userDiv=document.createElement('div');
    userDiv.style.cssText='position:absolute;cursor:pointer;display:flex;align-items:center;justify-content:center;';
    userDiv.setAttribute('data-anchor', 'center');
    userDiv.innerHTML = '<div class="glowing-dot-container"><div class="pulse-ring"></div><div class="core-dot"></div></div>';
    new PhotoOverlay(new google.maps.LatLng(userCoords.latitude, userCoords.longitude), userDiv);
  }
  
  var div=document.createElement('div');
  div.style.cssText='position:absolute;cursor:pointer;display:flex;align-items:center;justify-content:center;';
  
  var isPostLoc = ${isPostLocation};
  if (isPostLoc) {
    var titleText = "${htmlEsc(locationName || postAddress || 'Location')}";
    var subtitleText = "${htmlEsc(params.spotTypes as string || params.description as string || 'Visited place')}";
    var photoUrl = "${params.imageUrl ? resolvePhotoUrl(params.imageUrl as string) : ''}";
    var imgHtml = photoUrl ? '<img src="' + photoUrl + '" class="marker-thumb" onerror="this.style.display=\'none\'" />' : '<div class="marker-thumb-placeholder">📍</div>';
    div.setAttribute('data-anchor', 'bottom');
    div.innerHTML = '<div class="glass-marker-card">' +
      imgHtml +
      '<div class="marker-info">' +
        '<div class="marker-title">' + titleText + '</div>' +
        '<div class="marker-subtitle">' + subtitleText + '</div>' +
      '</div>' +
    '</div>';
  } else if (routePath.length > 1) {
    div.setAttribute('data-anchor', 'bottom');
    div.innerHTML = '<svg width="30" height="40" viewBox="0 0 30 40" style="filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.35))"><defs><linearGradient id="htmlPinGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#50C878" /><stop offset="100%" stop-color="#1C73B4" /></linearGradient></defs><path d="M15 1C7.27 1 1 7.27 1 15c0 10 14 25 14 25s14-15 14-25c0-7.73-6.27-14-14-14zm0 19c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="url(#htmlPinGrad)" fill-rule="evenodd" stroke="#FFFFFF" stroke-width="1.5"/></svg>';
  } else {
    div.setAttribute('data-anchor', 'center');
    div.innerHTML = '<div class="glowing-dot-container"><div class="pulse-ring"></div><div class="core-dot"></div></div>';
  }
  new PhotoOverlay(new google.maps.LatLng(${lat}, ${lng}), div);
}
</script></head><body>
<div id="map"></div>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${WV_KEY}&language=en&callback=initMap"></script>
</body></html>`;
      return (
        <WebView
          ref={mapRef}
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
        ref={mapRef}
        style={[styles.map, Platform.OS === 'android' && { flex: 1, minHeight: 200 }]}
        provider={getMapProvider()}
        {...mapStyle.nativeMapProps}
        initialRegion={{
          latitude: isPostLocation ? postLatitude! : location.coords.latitude,
          longitude: isPostLocation ? postLongitude! : location.coords.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        onRegionChangeComplete={(region) => {
          const safeRegion = sanitizeMapRegion(region);
          if (safeRegion) {
            setLatitudeDelta(safeRegion.latitudeDelta);
          }
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        showsScale={true}
        mapType={mapStyle.mapType}
        followsUserLocation={!hasValidCoordinates && !route}
      >
        {route?.coordinates?.length > 1 && (
          <>
            <PolylineRenderer
              coordinates={route.coordinates}
              color={mapStyle.routeColor}
              glowColor={mapStyle.routeGlowColor}
              strokeWidth={5}
              simplifyDistance={4}
              applyKalman={false}
              latitudeDelta={sanitizeLatitudeDelta(latitudeDelta)}
            />
            <Marker
              coordinate={route.coordinates[0]}
              title="Start Point"
              description="Your starting point"
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <PremiumMapMarker pointType="start" active={false} latitudeDelta={sanitizeLatitudeDelta(latitudeDelta)} />
            </Marker>
          </>
        )}
        <Marker
          coordinate={
            isPostLocation
              ? { latitude: postLatitude!, longitude: postLongitude! }
              : { latitude: location.coords.latitude, longitude: location.coords.longitude }
          }
          tracksViewChanges={tracksViewChanges}
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
          anchor={{ x: 0.5, y: 1.0 }}
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
          <PremiumMapMarker 
            icon={isPostLocation ? 'location' : 'navigate'} 
            active={isPostLocation} 
            label={isPostLocation ? (locationName || postAddress || 'Location') : undefined}
            activeTitle={isPostLocation ? (locationName || postAddress || 'Location') : undefined}
            activeSubtitle={isPostLocation ? (params.spotTypes as string || params.description as string || 'Visited place') : undefined}
            photo={isPostLocation ? (params.imageUrl ? resolvePhotoUrl(params.imageUrl as string) : undefined) : undefined}
            latitudeDelta={sanitizeLatitudeDelta(latitudeDelta)}
          />
        </Marker>
      </MapView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent"
        translucent
      />
      
      {/* Map Container */}
      <View style={styles.mapContainer}>
        {renderMap()}
      </View>

      {/* Floating Header */}
      <View 
        onLayout={(e) => setHeaderCardHeight(e.nativeEvent.layout.height)}
        style={[
          styles.headerShadowWrapper, 
          { 
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            borderBottomWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(28, 115, 180, 0.15)',
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.3 : 0.1,
            shadowRadius: 10,
            elevation: 4,
            overflow: 'hidden',
          }
        ]}
      >
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                router.back();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#1C73B4', '#50C878']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={styles.titleContainer}>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
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
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="refresh" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Sub-top bar: Route panel integrated inside card */}
          {(routeLoading || route) && (
            <View style={[styles.routePanel, { borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }]}>
              <View style={styles.routeHeader}>
                <Ionicons
                  name={route ? getManeuverIcon(route.steps[0]?.maneuver) as any : 'navigate'}
                  size={18}
                  color={isDark ? '#38BDF8' : '#1C73B4'}
                />
                <Text style={[styles.routeMeta, { color: isDark ? '#38BDF8' : '#1C73B4' }]}>
                  {routeLoading ? 'Finding route' : `${route?.durationText || 'Route'} - ${route?.distanceText || ''}`}
                </Text>
              </View>
              <Text style={[styles.routeInstruction, { color: theme.colors.text }]} numberOfLines={2}>
                {routeLoading ? 'Preparing in-app navigation...' : route?.steps[0]?.instruction || 'Route ready inside Taatom'}
              </Text>
            </View>
          )}
      </View>

      {/* Floating Bottom Location Info Panel */}
      {location && (
        <View style={[styles.infoShadowWrapper, { bottom: insets.bottom + 16 }]}>
          <BlurView
            intensity={95}
            tint={isDark ? 'dark' : 'light'}
            style={styles.infoFloating}
          >
            <View style={styles.locationInfo}>
              <View style={styles.locationDetails}>
                {isPostLocation && postAddress && (
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={18} color={theme.colors.primary} />
                    <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
                      {postAddress}
                    </Text>
                  </View>
                )}
                {isRoutingActive && isPostLocation && userCoords && (
                  <View style={styles.locationRow}>
                    <Ionicons name="navigate" size={18} color={theme.colors.primary} />
                    <Text style={[styles.locationText, { color: theme.colors.text }]} numberOfLines={1}>
                      {(() => {
                        if (route?.distanceText) {
                          return `${route.distanceText.toLowerCase()} from you`;
                        }
                        const km = calculateDistance(
                          userCoords.latitude,
                          userCoords.longitude,
                          postLatitude!,
                          postLongitude!
                        );
                        return km < 1
                          ? `${Math.round(km * 1000)} m from you`
                          : `${km.toFixed(1)} km from you`;
                      })()}
                    </Text>
                  </View>
                )}
                {isApproximate && approximateLabel && (
                  <View style={[styles.locationRow, { marginTop: 4, backgroundColor: theme.colors.primary + '15', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 0 }]}>
                    <Ionicons name="information-circle-outline" size={14} color={theme.colors.primary} />
                    <Text style={[styles.locationText, { color: theme.colors.primary, fontSize: 11, marginLeft: 4 }]} numberOfLines={1}>
                      Showing nearest: {approximateLabel}
                    </Text>
                  </View>
                )}
                {!isPostLocation && location.coords.accuracy && location.coords.accuracy > 0 && (
                  <View style={[styles.locationRow, { marginBottom: 0 }]}>
                    <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                    <Text style={[styles.locationText, { color: theme.colors.text }]}>
                      Accuracy: ±{Math.round(location.coords.accuracy)}m
                    </Text>
                  </View>
                )}
              </View>

              {/* Action Buttons inside Info Panel */}
              {isPostLocation && postLatitude && postLongitude && (
                <TouchableOpacity
                  style={styles.directionButton}
                  onPress={loadRoute}
                  disabled={routeLoading}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#1C73B4', '#50C878']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  {routeLoading ? (
                    <LoadingGlobe color="white" size="small" />
                  ) : (
                    <Ionicons name="navigate" size={20} color="white" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </BlurView>
        </View>
      )}
    </View>
  );
}

