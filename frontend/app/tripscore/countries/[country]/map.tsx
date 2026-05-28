import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import LoadingGlobe from '../../../../components/LoadingGlobe';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../../../../context/ThemeContext';
import api from '../../../../services/api';
import { MapView, Marker, getMapProvider } from '../../../../utils/mapsWrapper';
import logger from '../../../../utils/logger';
import PremiumMapMarker from '../../../../components/PremiumMapMarker';
import GlassMapPanel from '../../../../components/GlassMapPanel';
import { useMapStyle } from '../../../../hooks/useMapStyle';

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;

// Responsive dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

interface Location {
  name: string;
  score: number;
  date: string;
  caption: string;
  category: {
    fromYou: string;
    typeOfSpot: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  imageUrl?: string;
  postType?: string;
}

interface TripScoreCountryResponse {
  success: boolean;
  country: string;
  countryScore: number;
  countryDistance: number;
  locations: Location[];
}

const { width, height } = Dimensions.get('window');

export default function CountryMapScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TripScoreCountryResponse | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [renderedLocation, setRenderedLocation] = useState<Location | null>(null);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (selectedLocation) {
      setRenderedLocation(selectedLocation);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setRenderedLocation(null);
      });
    }
  }, [selectedLocation]);
  const { theme, isDark } = useTheme();
  const mapStyle = useMapStyle();
  const router = useRouter();
  const { country, userId } = useLocalSearchParams();
  const mapRef = useRef<any>(null);
  // Cache markers to prevent re-rendering issues when navigating back
  const markersCacheRef = useRef<Array<any>>([]);

  const centerMapOnLocation = useCallback((loc: Location) => {
    if (!loc.coordinates?.latitude || !loc.coordinates?.longitude) return;
    if (mapRef.current) {
      if (Platform.OS === 'ios') {
        mapRef.current.animateToRegion({
          latitude: loc.coordinates.latitude,
          longitude: loc.coordinates.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 350);
      } else {
        mapRef.current.animateCamera({
          center: {
            latitude: loc.coordinates.latitude,
            longitude: loc.coordinates.longitude,
          },
          zoom: 12,
        }, { duration: 350 });
      }
    }
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      centerMapOnLocation(selectedLocation);
    }
  }, [selectedLocation, centerMapOnLocation]);

  // Load data on mount and when screen comes into focus (to persist markers after navigation)
  useEffect(() => {
    loadCountryData();
  }, []);

  // NOTE: We intentionally do not reload on focus. Re-fetching can re-order / change marker lists.
  // Markers are made stable via deterministic fallback coordinates + stable keys.

  const loadCountryData = async () => {
    try {
      setLoading(true);
      const countryParam = Array.isArray(country) ? country[0] : country;
      // Convert slug back to proper country name for API
      const countryName = countryParam.replace(/-/g, ' ');
      const response = await api.get(`/api/v1/profile/${userId}/tripscore/countries/${countryName}`);
      setData(response.data);
      if (response.data?.locations && response.data.locations.length > 0) {
        const firstWithCoords = response.data.locations.find(
          (loc: any) => loc.coordinates?.latitude && loc.coordinates?.longitude
        );
        setSelectedLocation(firstWithCoords || response.data.locations[0]);
      }
    } catch (error) {
      logger.error('Error loading country data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationPress = (location: Location) => {
    setSelectedLocation(location);
  };

  const getCountryCenter = (countryName: string) => {
    const centers: { [key: string]: { latitude: number; longitude: number } } = {
      'brazil': { latitude: -14.235, longitude: -51.9253 },
      'australia': { latitude: -25.2744, longitude: 133.7751 },
      'india': { latitude: 20.5937, longitude: 78.9629 },
      'united states': { latitude: 39.8283, longitude: -98.5795 },
      'usa': { latitude: 39.8283, longitude: -98.5795 },
      'canada': { latitude: 56.1304, longitude: -106.3468 },
      'china': { latitude: 35.8617, longitude: 104.1954 },
      'russia': { latitude: 61.5240, longitude: 105.3188 },
      'argentina': { latitude: -38.4161, longitude: -63.6167 },
      'chile': { latitude: -35.6751, longitude: -71.5430 },
      'peru': { latitude: -9.1900, longitude: -75.0152 },
      'colombia': { latitude: 4.5709, longitude: -74.2973 },
      'mexico': { latitude: 23.6345, longitude: -102.5528 },
      'france': { latitude: 46.2276, longitude: 2.2137 },
      'germany': { latitude: 51.1657, longitude: 10.4515 },
      'italy': { latitude: 41.8719, longitude: 12.5674 },
      'spain': { latitude: 40.4637, longitude: -3.7492 },
      'united kingdom': { latitude: 55.3781, longitude: -3.4360 },
      'uk': { latitude: 55.3781, longitude: -3.4360 },
      'japan': { latitude: 36.2048, longitude: 138.2529 },
      'south korea': { latitude: 35.9078, longitude: 127.7669 },
      'thailand': { latitude: 15.8700, longitude: 100.9925 },
      'vietnam': { latitude: 14.0583, longitude: 108.2772 },
      'indonesia': { latitude: -0.7893, longitude: 113.9213 },
      'philippines': { latitude: 12.8797, longitude: 121.7740 },
      'malaysia': { latitude: 4.2105, longitude: 101.9758 },
      'singapore': { latitude: 1.3521, longitude: 103.8198 },
      'egypt': { latitude: 26.0975, longitude: 30.0444 },
      'south africa': { latitude: -30.5595, longitude: 22.9375 },
      'nigeria': { latitude: 9.0820, longitude: 8.6753 },
      'kenya': { latitude: -0.0236, longitude: 37.9062 },
      'morocco': { latitude: 31.6295, longitude: -7.9811 },
      'ethiopia': { latitude: 9.1450, longitude: 40.4897 },
      'ghana': { latitude: 7.9465, longitude: -1.0232 },
    };
    
    const key = countryName.toLowerCase();
    return centers[key] || { latitude: 0, longitude: 0 };
  };

  const getCountryDelta = (countryName: string) => {
    const deltas: { [key: string]: { latitudeDelta: number; longitudeDelta: number } } = {
      'brazil': { latitudeDelta: 20, longitudeDelta: 20 },
      'australia': { latitudeDelta: 15, longitudeDelta: 15 },
      'india': { latitudeDelta: 15, longitudeDelta: 15 },
      'united states': { latitudeDelta: 25, longitudeDelta: 25 },
      'usa': { latitudeDelta: 25, longitudeDelta: 25 },
      'canada': { latitudeDelta: 30, longitudeDelta: 30 },
      'china': { latitudeDelta: 20, longitudeDelta: 20 },
      'russia': { latitudeDelta: 30, longitudeDelta: 30 },
      'argentina': { latitudeDelta: 15, longitudeDelta: 15 },
      'chile': { latitudeDelta: 10, longitudeDelta: 10 },
      'peru': { latitudeDelta: 10, longitudeDelta: 10 },
      'colombia': { latitudeDelta: 8, longitudeDelta: 8 },
      'mexico': { latitudeDelta: 10, longitudeDelta: 10 },
      'france': { latitudeDelta: 8, longitudeDelta: 8 },
      'germany': { latitudeDelta: 6, longitudeDelta: 6 },
      'italy': { latitudeDelta: 6, longitudeDelta: 6 },
      'spain': { latitudeDelta: 6, longitudeDelta: 6 },
      'united kingdom': { latitudeDelta: 4, longitudeDelta: 4 },
      'uk': { latitudeDelta: 4, longitudeDelta: 4 },
      'japan': { latitudeDelta: 6, longitudeDelta: 6 },
      'south korea': { latitudeDelta: 3, longitudeDelta: 3 },
      'thailand': { latitudeDelta: 8, longitudeDelta: 8 },
      'vietnam': { latitudeDelta: 6, longitudeDelta: 6 },
      'indonesia': { latitudeDelta: 12, longitudeDelta: 12 },
      'philippines': { latitudeDelta: 8, longitudeDelta: 8 },
      'malaysia': { latitudeDelta: 6, longitudeDelta: 6 },
      'singapore': { latitudeDelta: 0.5, longitudeDelta: 0.5 },
      'egypt': { latitudeDelta: 8, longitudeDelta: 8 },
      'south africa': { latitudeDelta: 10, longitudeDelta: 10 },
      'nigeria': { latitudeDelta: 8, longitudeDelta: 8 },
      'kenya': { latitudeDelta: 6, longitudeDelta: 6 },
      'morocco': { latitudeDelta: 6, longitudeDelta: 6 },
      'ethiopia': { latitudeDelta: 8, longitudeDelta: 8 },
      'ghana': { latitudeDelta: 4, longitudeDelta: 4 },
    };
    
    const key = countryName.toLowerCase();
    return deltas[key] || { latitudeDelta: 10, longitudeDelta: 10 };
  };

  /**
   * Stable fallback coordinates for locations that don't have real coordinates.
   * IMPORTANT: Must be deterministic across renders; otherwise markers appear to "disappear"
   * (they actually move to new random positions after navigation / rerender).
   *
   * NOTE: Declared as a function (not const) so it's hoisted and safe to use in hooks above/below.
   */
  function getStableFallbackCoordinates(
    countryDisplayName: string,
    locName: string,
    idx: number
  ): { latitude: number; longitude: number } {
    const center = getCountryCenter(countryDisplayName);
    const delta = getCountryDelta(countryDisplayName);

    // Deterministic hash -> unsigned 32-bit
    const hashString = (str: string) => {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };

    // Turn hash into two stable pseudo-random floats in [0, 1)
    const seed = hashString(`${countryDisplayName}|${locName}|${idx}`);
    const rand1 = ((seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const rand2 = (((seed ^ 0x9e3779b9) * 1664525 + 1013904223) >>> 0) / 4294967296;

    // Keep points reasonably close to center so they remain in-frame
    const latOffset = (rand1 - 0.5) * delta.latitudeDelta * 0.25;
    const lngOffset = (rand2 - 0.5) * delta.longitudeDelta * 0.25;

    return {
      latitude: center.latitude + latOffset,
      longitude: center.longitude + lngOffset,
    };
  }

  const countryParam = Array.isArray(country) ? country[0] : country;
  const displayCountryName = (countryParam ?? '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l: string) => l.toUpperCase());

  // Build visited markers once per data change (Rules of Hooks: top-level)
  // CRITICAL: Use stable dependencies and cache to prevent markers from disappearing
  const visitedMarkers = useMemo(() => {
    if (!data || !data.locations || data.locations.length === 0) {
      // If no data but we have cached markers, keep them to prevent disappearing
      if (markersCacheRef.current.length > 0) {
        return markersCacheRef.current;
      }
      return [];
    }

    // Create stable markers with deterministic coordinates
    const markers = data.locations.map((loc, i) => {
      const hasValidCoords =
        typeof loc.coordinates?.latitude === 'number' &&
        typeof loc.coordinates?.longitude === 'number' &&
        !Number.isNaN(loc.coordinates.latitude) &&
        !Number.isNaN(loc.coordinates.longitude) &&
        loc.coordinates.latitude !== 0 &&
        loc.coordinates.longitude !== 0 &&
        loc.coordinates.latitude >= -90 &&
        loc.coordinates.latitude <= 90 &&
        loc.coordinates.longitude >= -180 &&
        loc.coordinates.longitude <= 180;

      // Always use stable coordinates - either real ones or deterministic fallback
      const finalCoords = hasValidCoords
        ? loc.coordinates!
        : getStableFallbackCoordinates(
            displayCountryName || '',
            loc.name || `Location ${i + 1}`,
            i
          );

      // Create a unique stable ID for this marker (doesn't change across renders)
      const stableId = `${loc.name || `loc-${i}`}-${finalCoords.latitude.toFixed(6)}-${finalCoords.longitude.toFixed(6)}`;

      return {
        ...loc,
        stableId, // Add stable ID for key generation
        coordinates: finalCoords,
      };
    });

    // Dedupe by ~11m precision (4 decimal places) so multiple visits taken at
    // the exact same spot (or within GPS noise) collapse to one marker. Same
    // treatment as the My Location map — without this, overlapping pins look
    // like one marker but inflate any future cluster/badge counts.
    const seen = new Set<string>();
    const deduped: typeof markers = [];
    for (const m of markers) {
      const key = `${m.coordinates.latitude.toFixed(4)},${m.coordinates.longitude.toFixed(4)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(m);
      }
    }

    // Cache markers to preserve them when navigating back
    markersCacheRef.current = deduped;
    return deduped;
  }, [data?.locations?.length, displayCountryName]); // Only depend on locations count and country name (more stable)

  // Get locations with coordinates for map rendering
  // CRITICAL: Only show locations with valid coordinates (no random coordinates)
  const getMapLocations = (countryDisplayName: string): Location[] => {
    if (!data) return [];
    
    // Filter locations to only include those with valid coordinates
    const validMarkers = data.locations.filter(
      loc => loc.coordinates?.latitude &&
             loc.coordinates?.longitude &&
             loc.coordinates.latitude !== 0 &&
             loc.coordinates.longitude !== 0 &&
             !isNaN(loc.coordinates.latitude) &&
             !isNaN(loc.coordinates.longitude) &&
             loc.coordinates.latitude >= -90 &&
             loc.coordinates.latitude <= 90 &&
             loc.coordinates.longitude >= -180 &&
             loc.coordinates.longitude <= 180
    );

    // Dedupe by ~11m precision so GPS-noise variants of the same spot collapse
    // to one pin (matches the native visitedMarkers and the My Location map).
    const seen = new Set<string>();
    const markers: Location[] = [];
    for (const m of validMarkers) {
      const key = `${m.coordinates!.latitude.toFixed(4)},${m.coordinates!.longitude.toFixed(4)}`;
      if (!seen.has(key)) {
        seen.add(key);
        markers.push(m);
      }
    }

    // If no valid locations, show center marker as fallback
    if (markers.length === 0) {
      const center = getCountryCenter(countryDisplayName || '');
      return [{
        name: countryDisplayName || 'Center',
        score: 0,
        date: new Date().toISOString(),
        caption: '',
        category: { fromYou: '', typeOfSpot: '' },
        coordinates: {
          latitude: center.latitude,
          longitude: center.longitude,
        },
      } as Location];
    }
    
    return markers;
  };

  // Generate HTML for WebView map (web platform)
  const getWebMapHTML = (countryDisplayName: string) => {
    const locations = getMapLocations(countryDisplayName);
    const center = getCountryCenter(countryDisplayName || '');
    const delta = getCountryDelta(countryDisplayName || '');
    
    const markers = locations.map((loc, i) => {
      const lat = loc.coordinates?.latitude || center.latitude;
      const lng = loc.coordinates?.longitude || center.longitude;
      const isSelected = selectedLocation && (
        selectedLocation.name === loc.name &&
        selectedLocation.coordinates?.latitude === loc.coordinates?.latitude &&
        selectedLocation.coordinates?.longitude === loc.coordinates?.longitude
      );

      const photoUrl = loc.imageUrl || '';
      const escName = loc.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const subtitleText = (loc.category?.typeOfSpot || 'Visited spot').replace(/'/g, "\\'").replace(/"/g, '&quot;');

      return `
        var pos = new google.maps.LatLng(${lat}, ${lng});
        var div = document.createElement('div');
        div.style.cssText = 'position:absolute;cursor:pointer;display:flex;align-items:center;justify-content:center;';
        
        var isSel = ${!!isSelected};
        if (isSel) {
          var imgHtml = "${photoUrl}" ? '<img class="marker-thumb" src="${photoUrl}" onerror="this.style.display=\'none\'" />' : '<div class="marker-thumb-placeholder">📍</div>';
          div.innerHTML = '<div class="glass-marker-card">' +
            imgHtml +
            '<div class="marker-info">' +
              '<div class="marker-title">${escName}</div>' +
              '<div class="marker-subtitle">${subtitleText}</div>' +
            '</div>' +
          '</div>';
          div.style.zIndex = 99999;
        } else {
          div.innerHTML = '<div class="glowing-dot-container"><div class="pulse-ring"></div><div class="core-dot"></div></div>';
          div.style.zIndex = ${i};
        }
        
        div.addEventListener('click', function(e) {
          e.stopPropagation();
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', index: ${i} }));
          }
        });
        
        new PhotoOverlay(pos, div);
      `;
    }).join('');

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
          .glowing-dot-container {
            position: relative;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .pulse-ring {
            position: absolute;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: radial-gradient(circle, ${isDark ? 'rgba(45, 212, 191, 0.4)' : 'rgba(59, 130, 246, 0.4)'} 0%, rgba(59, 130, 246, 0) 70%);
            animation: pulse 1.8s infinite ease-out;
          }
          .core-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: linear-gradient(135deg, #2DD4BF 0%, #3B82F6 100%);
            border: 1.5px solid #FFFFFF;
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
            border-radius: 50%;
            object-fit: cover;
            border: 1.5px solid ${isDark ? '#2DD4BF' : '#3B82F6'};
          }
          .marker-thumb-placeholder {
            width: 26px;
            height: 26px;
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
          function initMap() {
            const map = new google.maps.Map(document.getElementById('map'), {
              center: { lat: ${center.latitude}, lng: ${center.longitude} },
              zoom: ${Math.max(4, Math.min(10, Math.log2(360 / delta.latitudeDelta)))},
              minZoom: 3,
              mapTypeId: 'roadmap',
              styles: ${JSON.stringify(mapStyle.customMapStyle)},
              disableDefaultUI: true,
              zoomControl: true
            });
            
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
                  this.div.style.transform = 'translate(-50%, -50%)';
                }
              }
              onRemove() {
                if (this.div && this.div.parentNode) {
                  this.div.parentNode.removeChild(this.div);
                }
              }
            }

            ${markers}
            
            // Fit bounds if we have multiple locations
            if (${locations.length} > 1) {
              const bounds = new google.maps.LatLngBounds();
              ${locations.map(loc => {
                const lat = loc.coordinates?.latitude || center.latitude;
                const lng = loc.coordinates?.longitude || center.longitude;
                return `bounds.extend(new google.maps.LatLng(${lat}, ${lng}));`;
              }).join('')}
              map.fitBounds(bounds);
            }
          }
        </script>
      </head>
      <body>
        <div id="map"></div>
        <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY || ''}&callback=initMap"></script>
      </body>
      </html>
    `;
  };

  // Handle WebView messages (marker clicks)
  const handleWebViewMessage = (event: any, countryDisplayName: string) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'marker' && typeof data.index === 'number') {
        const locations = getMapLocations(countryDisplayName);
        if (locations[data.index]) {
          handleLocationPress(locations[data.index]);
        }
      }
    } catch (error) {
      logger.error('Error handling WebView message:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView 
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={isTablet ? 28 : 24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {displayCountryName}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Map View - use WebView for web and Android so maps open reliably on Android */}
      <View style={styles.mapContainer}>
        {(Platform.OS === 'web' || Platform.OS === 'android') ? (
          <WebView
            style={styles.map}
            source={{ html: getWebMapHTML(displayCountryName || '') }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            onMessage={(event) => handleWebViewMessage(event, displayCountryName || '')}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              logger.error('WebView error: ', nativeEvent);
            }}
          />
        ) : MapView ? (
          // Native MapView for iOS/Android
          <MapView
            ref={(ref: any) => { mapRef.current = ref; }}
            provider={getMapProvider()}
            style={styles.map}
            {...mapStyle.nativeMapProps}
            minZoomLevel={3}
            initialRegion={{
              latitude: getCountryCenter(displayCountryName || '').latitude,
              longitude: getCountryCenter(displayCountryName || '').longitude,
              latitudeDelta: getCountryDelta(displayCountryName || '').latitudeDelta,
              longitudeDelta: getCountryDelta(displayCountryName || '').longitudeDelta,
            }}
            mapType={mapStyle.mapType}
          >
          {/* Always show a center marker to guarantee at least one visible flag */}
          <Marker
            key="country-center-flag"
            coordinate={{
              latitude: getCountryCenter(displayCountryName || '').latitude,
              longitude: getCountryCenter(displayCountryName || '').longitude,
            }}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => {
              const countryParam = Array.isArray(country) ? country[0] : country;
              const center = getCountryCenter(displayCountryName || '');
              if (data && data.locations && data.locations.length > 0) {
                // Find nearest location to center and open it
                const withCoords = data.locations.filter(
                  l => !!l.coordinates?.latitude && !!l.coordinates?.longitude
                );
                const list = withCoords.length ? withCoords : data.locations;
                const nearest = list.reduce((best, cur) => {
                  const clat = cur.coordinates?.latitude ?? center.latitude;
                  const clon = cur.coordinates?.longitude ?? center.longitude;
                  const blat = best.coordinates?.latitude ?? center.latitude;
                  const blon = best.coordinates?.longitude ?? center.longitude;
                  const dcur = Math.hypot(clat - center.latitude, clon - center.longitude);
                  const dbest = Math.hypot(blat - center.latitude, blon - center.longitude);
                  return dcur < dbest ? cur : best;
                }, list[0]);
                handleLocationPress(nearest as any);
              } else {
                // Fallback: open the locations list for this country
                router.push({ pathname: '/tripscore/countries/[country]/locations', params: { country: countryParam as string, userId: (Array.isArray(userId) ? userId[0] : userId) as string } });
              }
            }}
          >
            <PremiumMapMarker 
              active={true} 
              activeTitle={displayCountryName} 
              activeSubtitle="Country Center" 
              icon="flag" 
            />
          </Marker>
          {/* Markers for visited locations */}
          {visitedMarkers.map((location: any, index: number) => {
            const stableKey = location.stableId || `${location.name}-${location.coordinates!.latitude.toFixed(6)}-${location.coordinates!.longitude.toFixed(6)}`;
            const isSelected = selectedLocation && (
              selectedLocation.name === location.name &&
              selectedLocation.coordinates?.latitude === location.coordinates.latitude &&
              selectedLocation.coordinates?.longitude === location.coordinates.longitude
            );

            return (
              <Marker
                key={stableKey}
                zIndex={isSelected ? 99999 : index}
                anchor={{ x: 0.5, y: isSelected ? 0.9 : 0.5 }}
                coordinate={{
                  latitude: location.coordinates!.latitude,
                  longitude: location.coordinates!.longitude,
                }}
                onPress={() => handleLocationPress(location)}
              >
                <PremiumMapMarker 
                  active={!!isSelected} 
                  activeTitle={location.name} 
                  activeSubtitle={location.category?.typeOfSpot || 'Visited spot'} 
                  photo={location.imageUrl} 
                />
              </Marker>
            );
          })}
          </MapView>
        ) : (
          // Fallback if MapView is not available
          <View style={[styles.map, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: theme.colors.text, fontSize: 16 }}>
              Map not available on this platform
            </Text>
          </View>
        )}
        {renderedLocation && (
          <Animated.View
            style={[
              styles.previewCard,
              {
                transform: [{ translateY: slideAnim }],
                padding: 0,
              }
            ]}
          >
            <GlassMapPanel style={{ width: '100%', padding: 12, borderRadius: 30 }} tint="dark">
              <View style={styles.previewContent}>
                {renderedLocation.imageUrl ? (
                  <ExpoImage
                    source={{ uri: renderedLocation.imageUrl }}
                    style={styles.previewImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={180}
                  />
                ) : (
                  <View style={[styles.previewImage, styles.previewFallback]}>
                    <Ionicons name="image-outline" size={24} color="#FF3B30" />
                  </View>
                )}
                <View style={styles.previewText}>
                  <Text style={[styles.previewTitle, { color: theme.colors.text }]} numberOfLines={1}>
                    {renderedLocation.name}
                  </Text>
                  <Text style={[styles.previewMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    Score: {renderedLocation.score} {renderedLocation.category?.typeOfSpot ? `- ${renderedLocation.category.typeOfSpot}` : ''}
                  </Text>
                  <View style={styles.previewActions}>
                    <TouchableOpacity
                      style={[styles.previewButton, styles.previewPrimaryButton, { backgroundColor: '#FF3B30' }]}
                      onPress={() => {
                        const locationSlug = renderedLocation.name.toLowerCase().replace(/\s+/g, '-');
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
                    >
                      <Ionicons name="eye-outline" size={16} color="white" />
                      <Text style={[styles.previewButtonText, { color: 'white' }]}>Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.previewClose}
                  onPress={() => setSelectedLocation(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </GlassMapPanel>
          </Animated.View>
        )}
      </View>

    </SafeAreaView>
  );
}

const forestStyle = [
  // Base land geometry in soft green
  { elementType: 'geometry', stylers: [{ color: '#e5f3e9' }] },
  // Water cyan/teal
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bfe9e6' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2e4a4a' }] },
  // Natural landscape darker to create contrast/texture with terrain type
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#cfe9d4' }] },
  { featureType: 'landscape.natural.terrain', elementType: 'geometry', stylers: [{ color: '#c3e2c8' }] },
  // Parks and forests emphasized
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#a8d5a3' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#1b5e20' }] },
  // Roads light and unobtrusive with subtle borders
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ddeee0' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#c3d8c7' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#2e7d32' }] },
  // Boundaries subtle
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#b3d2ba' }] },
  // Hide generic POIs for a clean terrain look
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  // Labels readable
  { elementType: 'labels.text.fill', stylers: [{ color: '#2f4f4f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#e5f3e9' }] },
];

const styles = StyleSheet.create({
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: isTablet ? 22 : 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
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
  pulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF5722',
  },
  previewCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    padding: 12,
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(94, 162, 255, 0.14)',
  },
  previewText: {
    flex: 1,
    minWidth: 0,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  previewMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  previewButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewPrimaryButton: {
    borderWidth: 0,
  },
  previewButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  previewClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
