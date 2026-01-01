import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
import { useTheme } from '../../../../context/ThemeContext';
import api from '../../../../services/api';
import { MapView, Marker, PROVIDER_GOOGLE } from '../../../../utils/mapsWrapper';
import logger from '../../../../utils/logger';

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
  const { theme } = useTheme();
  const router = useRouter();
  const { country, userId } = useLocalSearchParams();
  const mapRef = useRef<any>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hoveredIndex !== null) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: true })
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [hoveredIndex, pulseAnim]);

  useEffect(() => {
    loadCountryData();
  }, []);

  const loadCountryData = async () => {
    try {
      setLoading(true);
      const countryParam = Array.isArray(country) ? country[0] : country;
      // Convert slug back to proper country name for API
      const countryName = countryParam.replace(/-/g, ' ');
      const response = await api.get(`/profile/${userId}/tripscore/countries/${countryName}`);
      setData(response.data);
    } catch (error) {
      logger.error('Error loading country data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationPress = (location: Location) => {
    const locationSlug = location.name.toLowerCase().replace(/\s+/g, '-');
    const countryParam = Array.isArray(country) ? country[0] : country;
    // Navigate immediately to avoid any map roaming/animation side-effects
    router.push({
      pathname: '/tripscore/countries/[country]/locations/[location]',
      params: { country: countryParam as string, location: locationSlug, userId: (Array.isArray(userId) ? userId[0] : userId) as string }
    });
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

  const getRandomLatitude = (countryName: string) => {
    const center = getCountryCenter(countryName);
    const delta = getCountryDelta(countryName);
    return center.latitude + (Math.random() - 0.5) * delta.latitudeDelta;
  };

  const getRandomLongitude = (countryName: string) => {
    const center = getCountryCenter(countryName);
    const delta = getCountryDelta(countryName);
    return center.longitude + (Math.random() - 0.5) * delta.longitudeDelta;
  };

  // Get locations with coordinates for map rendering
  const getMapLocations = (countryDisplayName: string): Location[] => {
    if (!data) return [];
    const withCoords = data.locations.filter(
      loc => !!loc.coordinates?.latitude && !!loc.coordinates?.longitude
    );
    let markers = withCoords.length > 0
      ? withCoords
      : data.locations.map((loc) => ({
          ...loc,
          coordinates: {
            latitude: getRandomLatitude(countryDisplayName || ''),
            longitude: getRandomLongitude(countryDisplayName || ''),
          },
        }));
    if (markers.length === 0) {
      markers = [{
        name: countryDisplayName || 'Center',
        score: 0,
        date: new Date().toISOString(),
        caption: '',
        category: { fromYou: '', typeOfSpot: '' },
        coordinates: {
          latitude: getCountryCenter(countryDisplayName || '').latitude,
          longitude: getCountryCenter(countryDisplayName || '').longitude,
        },
      } as any];
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
      return `
        new google.maps.Marker({
          position: { lat: ${lat}, lng: ${lng} },
          map: map,
          icon: {
            url: 'data:image/svg+xml;utf-8,<svg width="30" height="30" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="white" stroke="%23FF5722" stroke-width="2"/><text x="15" y="20" font-size="16" text-anchor="middle" fill="%23FF5722">🏳️</text></svg>',
            scaledSize: new google.maps.Size(30, 30),
          },
          title: '${loc.name}',
          label: '${loc.name}',
        }).addListener('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', index: ${i} }));
        });
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
        </style>
        <script>
          function initMap() {
            const map = new google.maps.Map(document.getElementById('map'), {
              center: { lat: ${center.latitude}, lng: ${center.longitude} },
              zoom: ${Math.max(4, Math.min(10, Math.log2(360 / delta.latitudeDelta)))},
              mapTypeId: 'terrain',
            });
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
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const countryName = Array.isArray(country) ? country[0] : country;
  const displayCountryName = countryName?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

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

      {/* Map View */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          // WebView map for web platform
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
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            customMapStyle={forestStyle}
            initialRegion={{
              latitude: getCountryCenter(displayCountryName || '').latitude,
              longitude: getCountryCenter(displayCountryName || '').longitude,
              latitudeDelta: getCountryDelta(displayCountryName || '').latitudeDelta,
              longitudeDelta: getCountryDelta(displayCountryName || '').longitudeDelta,
            }}
            mapType="terrain"
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
            onSelect={() => setHoveredIndex(-1)}
            onDeselect={() => setHoveredIndex(null)}
          >
            <View style={styles.markerContainer}>
              {hoveredIndex === -1 && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.pulseRing,
                    {
                      opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                      transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }]
                    }
                  ]}
                />
              )}
              <View style={styles.customMarker}>
                <Ionicons name="flag" size={20} color="#FF5722" />
              </View>
            </View>
          </Marker>
          {/* Markers for visited locations */}
          {(() => {
            if (!data) return null;
            const withCoords = data.locations.filter(
              loc => !!loc.coordinates?.latitude && !!loc.coordinates?.longitude
            );
            let markers = withCoords.length > 0
              ? withCoords
              : data.locations.map((loc, i) => ({
                  ...loc,
                  coordinates: {
                    latitude: getRandomLatitude(displayCountryName || ''),
                    longitude: getRandomLongitude(displayCountryName || ''),
                  },
                }));
            if (markers.length === 0) {
              // As a last resort, show one marker at country center so the user sees a flag
              markers = [{
                name: displayCountryName || 'Center',
                score: 0,
                date: new Date().toISOString(),
                caption: '',
                category: { fromYou: '', typeOfSpot: '' },
                coordinates: {
                  latitude: getCountryCenter(displayCountryName || '').latitude,
                  longitude: getCountryCenter(displayCountryName || '').longitude,
                },
              } as any];
            }
            return markers.map((location, index) => (
              <Marker
                key={`${location.name}-${index}`}
                zIndex={9999}
                anchor={{ x: 0.5, y: 1 }}
                coordinate={{
                  latitude: location.coordinates!.latitude,
                  longitude: location.coordinates!.longitude,
                }}
                title={location.name}
                description={`Score: ${location.score}`}
                onPress={() => handleLocationPress(location)}
              // Navigate directly on press; keep single handler to avoid double triggers
              onCalloutPress={undefined}
              onSelect={() => setHoveredIndex(index)}
              onDeselect={() => setHoveredIndex(null)}
              >
                <View style={styles.markerContainer}>
                  {hoveredIndex === index && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.pulseRing,
                        {
                          opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                          transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }]
                        }
                      ]}
                    />
                  )}
                  <View style={styles.customMarker}>
                    <Ionicons name="flag" size={20} color="#FF5722" />
                  </View>
                </View>
              </Marker>
            ));
          })()}
          </MapView>
        ) : (
          // Fallback if MapView is not available
          <View style={[styles.map, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: theme.colors.text, fontSize: 16 }}>
              Map not available on this platform
            </Text>
          </View>
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
    fontSize: 18,
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF5722',
  },
});
