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
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../../../../context/ThemeContext';
import api from '../../../../services/api';
import { MapView, Marker, getMapProvider } from '../../../../utils/mapsWrapper';
import logger from '../../../../utils/logger';
import PremiumMapMarker from '../../../../components/PremiumMapMarker';
import SafeMarker from '../../../../components/SafeMarker';
import GlassMapPanel from '../../../../components/GlassMapPanel';
import { LOCATION_PIN_SVG } from '../../../../components/ui/LocationPin';
import { useMapStyle } from '../../../../hooks/useMapStyle';
import {
  isValidMapCoordinate,
  sanitizeLatitudeDelta,
  sanitizeMapRegion,
} from '../../../../utils/mapSafety';
import { getGoogleMapsApiKeyForWebView } from '../../../../utils/maps';
import { savedEvents } from '../../../../utils/savedEvents';

const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKeyForWebView();

// Responsive dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

interface Location {
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
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  actualCoordinates?: {
    latitude: number;
    longitude: number;
  };
  imageUrl?: string;
  postType?: string;
  journeyId?: string | null;
}

interface TripScoreCountryResponse {
  success: boolean;
  country: string;
  countryScore: number;
  countryDistance: number;
  locations: Location[];
}

interface OptimizedVisitedMarkerProps {
  location: any;
  isSelected: boolean;
  index: number;
  latitudeDelta: number;
  selectedLocationId: string | null;
  renderedLocationId: string | null;
  onPress: () => void;
}

const OptimizedVisitedMarker = React.memo(({
  location,
  isSelected,
  index,
  latitudeDelta,
  selectedLocationId,
  renderedLocationId,
  onPress
}: OptimizedVisitedMarkerProps) => {
  const markerRef = useRef<any>(null);

  const handleImageLoad = useCallback(() => {
    markerRef.current?.repaint();
  }, []);

  return (
    <SafeMarker
      ref={markerRef}
      zIndex={isSelected ? 99999 : index}
      anchor={{ x: 0.5, y: 0.5 }}
      coordinate={{
        latitude: location.coordinates!.latitude,
        longitude: location.coordinates!.longitude,
      }}
      onPress={onPress}
      repaintTriggers={[isSelected, latitudeDelta, selectedLocationId, renderedLocationId]}
    >
      <PremiumMapMarker 
        active={isSelected} 
        activeTitle={location.name} 
        activeSubtitle={location.category?.typeOfSpot || 'Visited spot'} 
        photo={location.imageUrl} 
        onImageLoad={handleImageLoad}
        latitudeDelta={latitudeDelta}
        renderAsDot={true}
      />
    </SafeMarker>
  );
}, (prev, next) => {
  return (
    prev.isSelected === next.isSelected &&
    prev.selectedLocationId === next.selectedLocationId &&
    prev.renderedLocationId === next.renderedLocationId &&
    prev.index === next.index &&
    prev.latitudeDelta === next.latitudeDelta &&
    prev.location.stableId === next.location.stableId &&
    prev.location.imageUrl === next.location.imageUrl &&
    prev.location.name === next.location.name &&
    prev.location.coordinates?.latitude === next.location.coordinates?.latitude &&
    prev.location.coordinates?.longitude === next.location.coordinates?.longitude
  );
});

const { width, height } = Dimensions.get('window');

export default function CountryMapScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TripScoreCountryResponse | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [pinnedLocation, setPinnedLocation] = useState<Location | null>(null);
  const [renderedLocation, setRenderedLocation] = useState<Location | null>(null);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const [latitudeDelta, setLatitudeDelta] = useState(0.1);

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
    if (!isValidMapCoordinate(loc.coordinates)) return;
    if (mapRef.current) {
      if (Platform.OS === 'web' || Platform.OS === 'android') {
        const jsCode = `
          if (window.map) {
            window.map.panTo({ lat: ${loc.coordinates.latitude}, lng: ${loc.coordinates.longitude} });
            window.map.setZoom(12);
          }
          true;
        `;
        mapRef.current.injectJavaScript(jsCode);
      } else {
        if (Platform.OS === 'ios') {
          const region = sanitizeMapRegion({
            latitude: loc.coordinates.latitude,
            longitude: loc.coordinates.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
          if (region) {
            mapRef.current.animateToRegion(region, 350);
          }
        } else {
          if (typeof mapRef.current.animateCamera === 'function') {
            mapRef.current.animateCamera({
              center: {
                latitude: loc.coordinates.latitude,
                longitude: loc.coordinates.longitude,
              },
              zoom: 12,
            }, { duration: 350 });
          }
        }
      }
    }
  }, []);



  const loadCountryData = useCallback(async () => {
    try {
      setLoading(true);
      const countryParam = Array.isArray(country) ? country[0] : country;
      // Convert slug back to proper country name for API
      const countryName = countryParam.replace(/-/g, ' ');
      const response = await api.get(`/api/v1/profile/${userId}/tripscore/countries/${countryName}`);
      setData(response.data);
      if (response.data?.locations && response.data.locations.length > 0) {
        // Do not auto-select location on startup so the map shows all markers as a whole and does not show overlay
      }
    } catch (error) {
      logger.error('Error loading country data:', error);
    } finally {
      setLoading(false);
    }
  }, [country, userId]);

  useFocusEffect(
    useCallback(() => {
      setSelectedLocation(null);
      setPinnedLocation(null);
      setRenderedLocation(null);
      loadCountryData();
    }, [loadCountryData])
  );

  useEffect(() => {
    return savedEvents.addFeedInvalidateListener(loadCountryData);
  }, [loadCountryData]);

  const handleLocationPress = useCallback((location: Location) => {
    const isAlreadyPinned = pinnedLocation && (pinnedLocation as any).stableId === (location as any).stableId;

    if (isAlreadyPinned) {
      // Toggle off
      setPinnedLocation(null);
      setSelectedLocation(null);
    } else {
      // Pin and select
      setPinnedLocation(location);
      setSelectedLocation(location);
    }
  }, [pinnedLocation]);

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

    const coordinateBuckets = new Map<string, number[]>();
    data.locations.forEach((loc, i) => {
      if (!isValidMapCoordinate(loc.coordinates)) return;
      const key = `${loc.coordinates.latitude.toFixed(3)},${loc.coordinates.longitude.toFixed(3)}`;
      const bucket = coordinateBuckets.get(key) || [];
      bucket.push(i);
      coordinateBuckets.set(key, bucket);
    });

    const bucketPositions = new Map<number, { index: number; total: number }>();
    coordinateBuckets.forEach((indexes) => {
      indexes.forEach((locationIndex, bucketIndex) => {
        bucketPositions.set(locationIndex, { index: bucketIndex, total: indexes.length });
      });
    });

    // Create stable markers with deterministic coordinates.
    // `coordinates` is the tappable/display coordinate; `actualCoordinates` is the source-of-truth destination.
    const markers = data.locations.map((loc, i) => {
      const hasValidCoords =
        isValidMapCoordinate(loc.coordinates) &&
        loc.coordinates.latitude !== 0 &&
        loc.coordinates.longitude !== 0;

      // Always use stable coordinates - either real ones or deterministic fallback
      const finalCoords = hasValidCoords
        ? loc.coordinates!
        : getStableFallbackCoordinates(
            displayCountryName || '',
            loc.name || `Location ${i + 1}`,
            i
          );

      // Create a unique stable ID for this marker (doesn't change across renders)
      const stableId = loc.tripVisitId || `${loc.name || `loc-${i}`}-${finalCoords.latitude.toFixed(6)}-${finalCoords.longitude.toFixed(6)}-${i}`;
      const bucketPosition = bucketPositions.get(i);
      let displayCoords = finalCoords;

      if (hasValidCoords && bucketPosition && bucketPosition.total > 1) {
        const angle = (Math.PI * 2 * bucketPosition.index) / bucketPosition.total;
        const radius = 0.00014 + Math.min(bucketPosition.total, 6) * 0.000025;
        const latRad = (finalCoords.latitude * Math.PI) / 180;
        const lngScale = Math.max(Math.cos(latRad), 0.25);
        displayCoords = {
          latitude: finalCoords.latitude + Math.sin(angle) * radius,
          longitude: finalCoords.longitude + (Math.cos(angle) * radius) / lngScale,
        };
      }

      return {
        ...loc,
        stableId, // Add stable ID for key generation
        coordinates: displayCoords,
        actualCoordinates: finalCoords,
        hasValidCoords,
      };
    });

    // Keep every approved TripVisit visible/selectable, even when points are
    // near each other or share the same coordinates.
    markersCacheRef.current = markers;
    return markers;
  }, [data?.locations, displayCountryName]);



  // Keep the pinned location in sync with the selected location (e.g. on carousel swipe)
  useEffect(() => {
    if (selectedLocation) {
      setPinnedLocation(selectedLocation);
    }
  }, [selectedLocation]);

  useEffect(() => {
    const webLocations = getMapLocations(displayCountryName || '');
    const webSelectedIndex = selectedLocation ? webLocations.findIndex(
      (loc) => (loc as any).stableId === (selectedLocation as any).stableId
    ) : -1;

    if (mapRef.current && (Platform.OS === 'web' || Platform.OS === 'android')) {
      const jsCode = `
        if (window.markersList) {
          window.markersList.forEach((div, idx) => {
            if (div) {
              const coreDot = div.querySelector('.core-dot');
              if (coreDot) {
                if (idx === ${webSelectedIndex}) {
                  coreDot.classList.add('active');
                  div.style.zIndex = '99999';
                } else {
                  coreDot.classList.remove('active');
                  div.style.zIndex = idx;
                }
              }
            }
          });
        }
        true;
      `;
      mapRef.current.injectJavaScript(jsCode);
    }

    if (selectedLocation) {
      centerMapOnLocation(selectedLocation);
    }
  }, [selectedLocation, centerMapOnLocation, displayCountryName]);

  // Get locations with coordinates for map rendering
  // CRITICAL: Only show locations with valid coordinates (no random coordinates)
  const getMapLocations = (countryDisplayName: string): Location[] => {
    const valid = visitedMarkers.filter((m: any) => m.hasValidCoords);
    if (valid.length === 0) {
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
        stableId: 'fallback-center',
        hasValidCoords: true,
      } as any];
    }
    return valid;
  };

  // Generate HTML for WebView map (web platform)
  const getWebMapHTML = useCallback((countryDisplayName: string) => {
    const locations = getMapLocations(countryDisplayName);
    const center = getCountryCenter(countryDisplayName || '');
    const delta = getCountryDelta(countryDisplayName || '');
    const apiKey = getGoogleMapsApiKeyForWebView() || '';
    
    const markers = locations.map((loc, i) => {
      const lat = loc.coordinates?.latitude || center.latitude;
      const lng = loc.coordinates?.longitude || center.longitude;

      return `
        var pos = new google.maps.LatLng(${lat}, ${lng});
        var div = document.createElement('div');
        div.style.cssText = 'position:absolute;cursor:pointer;display:flex;align-items:center;justify-content:center;';
        
        div.setAttribute('data-anchor', 'center');
        div.innerHTML = '<div class="glowing-dot-container"><div class="pulse-ring"></div><div class="core-dot"></div></div>';
        div.style.zIndex = ${i};
        
        div.addEventListener('click', function(e) {
          e.stopPropagation();
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', stableId: '${(loc as any).stableId}' }));
          }
        });
        
        new PhotoOverlay(pos, div);
        window.markersList = window.markersList || [];
        window.markersList[${i}] = div;
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
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
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: linear-gradient(135deg, #2DD4BF 0%, #3B82F6 100%);
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
          }
          .core-dot.active {
            background: linear-gradient(135deg, #FF6E7F 0%, #FF6B6B 100%) !important;
            transform: scale(1.25);
            box-shadow: 0 0 12px rgba(255, 110, 127, 0.8) !important;
          }
          @keyframes pulse {
            0% { transform: scale(0.6); opacity: 1; }
            100% { transform: scale(2.2); opacity: 0; }
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
              zoomControl: false,
              gestureHandling: 'greedy',
              isFractionalZoomEnabled: true
            });
            window.map = map;
            
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
        <script async defer src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap"></script>
      </body>
      </html>
    `;
  }, [data, isDark, mapStyle.customMapStyle]);

  const webViewSource = useMemo(() => ({
    html: getWebMapHTML(displayCountryName || ''),
    baseUrl: 'https://maps.googleapis.com'
  }), [getWebMapHTML, displayCountryName]);

  // Handle WebView messages (marker clicks)
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'marker' && data.stableId) {
        const matchedLocation = visitedMarkers.find(loc => loc.stableId === data.stableId);
        if (matchedLocation) {
          handleLocationPress(matchedLocation);
        }
      }
    } catch (error) {
      logger.error('Error handling WebView message:', error);
    }
  }, [visitedMarkers, handleLocationPress]);

  const handleWebViewError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    logger.error('WebView error: ', nativeEvent);
  }, []);

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
            ref={mapRef}
            style={styles.map}
            source={webViewSource}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            cacheEnabled={true}
            cacheMode="LOAD_CACHE_ELSE_NETWORK"
            androidHardwareAccelerationDisabled={false}
            startInLoadingState={true}
            scalesPageToFit={true}
            originWhitelist={['https://*', 'http://*', 'data:*', 'about:*']}
            onMessage={handleWebViewMessage}
            onError={handleWebViewError}
          />
        ) : MapView ? (
          // Native MapView for iOS/Android
          <MapView
            ref={(ref: any) => { mapRef.current = ref; }}
            provider={getMapProvider()}
            style={styles.map}
            {...mapStyle.nativeMapProps}
            minZoomLevel={3}
            cameraZoomRange={Platform.OS === 'ios' ? {
              minCenterCoordinateDistance: 500,
              maxCenterCoordinateDistance: 20000000,
            } : undefined}
            initialRegion={{
              latitude: getCountryCenter(displayCountryName || '').latitude,
              longitude: getCountryCenter(displayCountryName || '').longitude,
              latitudeDelta: getCountryDelta(displayCountryName || '').latitudeDelta,
              longitudeDelta: getCountryDelta(displayCountryName || '').longitudeDelta,
            }}
            onRegionChangeComplete={(region) => {
              const safeRegion = sanitizeMapRegion(region);
              if (safeRegion) {
                setLatitudeDelta(safeRegion.latitudeDelta);
              }
            }}
            mapType={mapStyle.mapType}
          >
          {/* Show a center marker to guarantee at least one visible flag when no visited locations exist */}
          {visitedMarkers.length === 0 && (
            <SafeMarker
              key="country-center-flag"
              coordinate={{
                latitude: getCountryCenter(displayCountryName || '').latitude,
                longitude: getCountryCenter(displayCountryName || '').longitude,
              }}
              anchor={{ x: 0.5, y: 1.0 }}
              onPress={() => {
                const countryParam = Array.isArray(country) ? country[0] : country;
                router.push({
                  pathname: '/tripscore/countries/[country]/locations',
                  params: {
                    country: countryParam as string,
                    userId: (Array.isArray(userId) ? userId[0] : userId) as string,
                  },
                });
              }}
              repaintTriggers={[latitudeDelta]}
            >
              <PremiumMapMarker 
                active={true} 
                activeTitle={displayCountryName} 
                activeSubtitle="Country Center" 
                icon="flag" 
                latitudeDelta={sanitizeLatitudeDelta(latitudeDelta)}
              />
            </SafeMarker>
          )}
          {/* Markers for visited locations */}
          {visitedMarkers.map((location: any, index: number) => {
            const isPinned = Boolean(
              pinnedLocation &&
              (pinnedLocation as any).stableId &&
              (pinnedLocation as any).stableId === location.stableId
            );

            return (
              <OptimizedVisitedMarker
                key={location.stableId}
                location={location}
                isSelected={isPinned}
                index={index}
                latitudeDelta={sanitizeLatitudeDelta(latitudeDelta)}
                selectedLocationId={selectedLocation?.stableId || null}
                renderedLocationId={renderedLocation?.stableId || null}
                onPress={() => handleLocationPress(location)}
              />
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
        {visitedMarkers.length > 0 && renderedLocation && (
          <Animated.View
            style={[
              styles.carouselContainer,
              {
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <View style={styles.carouselCardWrapper}>
              <GlassMapPanel style={[styles.previewCard, styles.previewCardActive]} tint="dark">
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
                      <Ionicons name="image-outline" size={18} color="#FF3B30" />
                    </View>
                  )}
                  <View style={styles.previewText}>
                    <Text style={[styles.previewTitle, { color: '#FFFFFF' }]} numberOfLines={1}>
                      {renderedLocation.name}
                    </Text>
                    <Text style={[styles.previewMeta, { color: '#94A3B8' }]} numberOfLines={1}>
                      Score: {renderedLocation.score} {renderedLocation.category?.typeOfSpot ? `- ${renderedLocation.category.typeOfSpot}` : ''}
                    </Text>
                    <View style={styles.previewActions}>
                      <TouchableOpacity
                        style={[styles.previewButton, styles.previewPrimaryButton, { backgroundColor: '#FF3B30' }]}
                        onPress={() => {
                          const locationSlug = renderedLocation.name.toLowerCase().replace(/\s+/g, '-');
                          const countryParam = Array.isArray(country) ? country[0] : country;
                          const actualCoords = renderedLocation.actualCoordinates || renderedLocation.coordinates;
                          router.push({
                            pathname: '/tripscore/countries/[country]/locations/[location]',
                            params: {
                              country: countryParam as string,
                              location: locationSlug,
                              userId: (Array.isArray(userId) ? userId[0] : userId) as string,
                              tripVisitId: renderedLocation.tripVisitId || renderedLocation.stableId || '',
                              stableId: renderedLocation.stableId || '',
                              latitude: actualCoords?.latitude?.toString() || '',
                              longitude: actualCoords?.longitude?.toString() || '',
                            }
                          });
                        }}
                      >
                        <Ionicons name="eye-outline" size={12} color="white" />
                        <Text style={[styles.previewButtonText, { color: 'white' }]}>Details</Text>
                      </TouchableOpacity>
                      {renderedLocation.journeyId ? (
                        <TouchableOpacity
                          style={[styles.previewButton, { borderColor: '#50C878', borderWidth: 1 }]}
                          onPress={() => {
                            router.push({
                              pathname: '/navigate/detail',
                              params: {
                                journeyId: renderedLocation.journeyId || '',
                              }
                            });
                          }}
                        >
                          <Ionicons name="navigate-outline" size={12} color="#50C878" />
                          <Text style={[styles.previewButtonText, { color: '#50C878' }]}>Journey</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.previewClose}
                    onPress={() => setSelectedLocation(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={14} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </GlassMapPanel>
            </View>
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
  carouselContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 126,
    bottom: 18,
  },
  carouselFlatList: {
    width: '100%',
    height: '100%',
  },
  carouselContent: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  carouselCardWrapper: {
    width: screenWidth,
    height: 126,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  previewCard: {
    width: '100%',
    padding: 8,
    borderRadius: 20,
  },
  previewCardActive: {
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
    fontSize: 13,
    fontWeight: '700',
  },
  previewMeta: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  previewButton: {
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewPrimaryButton: {
    borderWidth: 0,
  },
  previewButtonText: {
    fontSize: 10,
    fontWeight: '700',
  },
  previewClose: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
