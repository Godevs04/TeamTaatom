import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import { MapView, Marker, getMapProvider } from '../../utils/mapsWrapper';
import { getTravelMapData } from '../../services/profile';
import { getGoogleMapsApiKey } from '../../utils/maps';
import logger from '../../utils/logger';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Location {
  number: number;
  latitude: number;
  longitude: number;
  address: string;
  date: string;
}

export default function AllLocationsMap() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<{
    totalLocations: number;
    totalDistance: number;
    totalDays: number;
  } | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme, mode } = useTheme();
  const userId = params.userId as string;
  const mapRef = useRef<any>(null);
  const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKey();

  useEffect(() => {
    if (userId) {
      loadLocations();
    } else {
      setError('User ID is required');
      setLoading(false);
    }
  }, [userId]);

  // Fit map to all locations when locations change - CRITICAL to show all visited places in single frame
  useEffect(() => {
    if (locations.length > 0 && mapRef.current && !loading) {
      const validCoords = locations
        .filter(loc => loc.latitude && loc.longitude && loc.latitude !== 0 && loc.longitude !== 0)
        .map(loc => ({
          latitude: loc.latitude,
          longitude: loc.longitude,
        }));
      
      if (validCoords.length > 0) {
        // Use multiple attempts with increased padding to ensure all locations are visible
        const fitMap = (attempt = 0) => {
          if (attempt > 3) return;
          
          const delay = Platform.OS === 'ios' ? (attempt === 0 ? 150 : 200) : (attempt === 0 ? 500 : 200);
          
          const timer = setTimeout(() => {
            try {
              if (mapRef.current && validCoords.length > 0) {
                // Use increased padding to ensure all markers are visible in single frame
                mapRef.current.fitToCoordinates(validCoords, {
                  edgePadding: { top: 100, right: 100, bottom: 100, left: 100 }, // Increased from 50
                  animated: attempt === 0 && Platform.OS !== 'ios', // Don't animate on iOS for faster rendering
                });
                logger.debug(`[${Platform.OS}] Refitted map to ${validCoords.length} coordinates (attempt ${attempt + 1})`);
                
                // On iOS, retry once more to ensure it sticks and shows all locations
                if (Platform.OS === 'ios' && attempt === 0) {
                  fitMap(1);
                }
              } else if (attempt < 3) {
                fitMap(attempt + 1);
              }
            } catch (err) {
              logger.warn(`Error refitting map (attempt ${attempt + 1}):`, err);
              if (attempt < 3) {
                fitMap(attempt + 1);
              }
            }
          }, delay);
          
          return () => clearTimeout(timer);
        };
        
        return fitMap();
      }
    }
  }, [locations, loading]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getTravelMapData(userId);
      const locationsData = response?.locations ?? [];
      const statisticsData = response?.statistics ?? null;
      setError(null);
      setLocations(locationsData);
      setStatistics(statisticsData);
      if (locationsData.length > 0) {
        setTimeout(() => {
          if (mapRef.current && locationsData.length > 0) {
            const validCoords = locationsData
              .filter((loc: Location) => loc.latitude && loc.longitude && loc.latitude !== 0 && loc.longitude !== 0)
              .map((loc: Location) => ({
                latitude: loc.latitude,
                longitude: loc.longitude,
              }));
            if (validCoords.length > 0) {
              try {
                mapRef.current.fitToCoordinates(validCoords, {
                  edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                  animated: true,
                });
              } catch (_err) {}
            }
          }
        }, 500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load locations');
      setLocations([]);
      setStatistics(null);
    } finally {
      setLoading(false);
    }
  };

  // Calculate map region to fit all markers with better padding
  const getMapRegion = () => {
    if (locations.length === 0) {
      return {
        latitude: 0,
        longitude: 0,
        latitudeDelta: 180,
        longitudeDelta: 360,
      };
    }

    const validLocations = locations.filter(loc => 
      loc.latitude && loc.longitude && 
      loc.latitude !== 0 && loc.longitude !== 0 &&
      !isNaN(loc.latitude) && !isNaN(loc.longitude)
    );

    if (validLocations.length === 0) {
      return {
        latitude: 0,
        longitude: 0,
        latitudeDelta: 180,
        longitudeDelta: 360,
      };
    }

    const latitudes = validLocations.map(loc => loc.latitude);
    const longitudes = validLocations.map(loc => loc.longitude);
    
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    // Add padding factor (2.0 instead of 1.5) to ensure all markers are visible with margin
    const latDelta = Math.max((maxLat - minLat) * 2.0, 0.1);
    const lngDelta = Math.max((maxLng - minLng) * 2.0, 0.1);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  };

  // Generate HTML for WebView map (web platform)
  const getWebMapHTML = () => {
    if (locations.length === 0) {
      logger.warn('No locations to display on web map');
      return '<html><body><div style="padding: 20px; text-align: center;">No locations to display</div></body></html>';
    }
    
    const region = getMapRegion();
    
    // Filter out invalid locations
    const validLocations = locations.filter(loc => 
      loc.latitude && loc.longitude && 
      loc.latitude !== 0 && loc.longitude !== 0 &&
      !isNaN(loc.latitude) && !isNaN(loc.longitude)
    );
    
    if (validLocations.length === 0) {
      logger.warn('No valid locations after filtering');
      return '<html><body><div style="padding: 20px; text-align: center;">No valid locations to display</div></body></html>';
    }
    
    const markersData = validLocations.map(loc => ({
      lat: loc.latitude,
      lng: loc.longitude,
      title: (loc.address || `Location #${loc.number}`).replace(/"/g, '&quot;'),
      number: loc.number
    }));
    
    logger.debug('Generating web map HTML with markers:', markersData.length);

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
              center: { lat: ${region.latitude}, lng: ${region.longitude} },
              zoom: ${Math.min(10, Math.max(2, Math.floor(15 - Math.log2(region.latitudeDelta))))},
              mapTypeId: 'terrain',
              language: 'en',
            });
            
            const markers = ${JSON.stringify(markersData)};
            const bounds = new google.maps.LatLngBounds();
            const infoWindows = [];
            
            markers.forEach((markerData, index) => {
              const position = new google.maps.LatLng(markerData.lat, markerData.lng);
              bounds.extend(position);
              
              const marker = new google.maps.Marker({
                position: position,
                map: map,
                title: markerData.title,
                label: {
                  text: String(markerData.number),
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '12px'
                },
                icon: {
                  url: 'data:image/svg+xml;utf-8,' + encodeURIComponent('<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="14" fill="%232563EB" stroke="white" stroke-width="2"/><text x="16" y="21" font-size="12" font-weight="bold" text-anchor="middle" fill="white">' + markerData.number + '</text></svg>'),
                  scaledSize: new google.maps.Size(32, 32),
                  anchor: new google.maps.Point(16, 16)
                }
              });
              
              const infoWindow = new google.maps.InfoWindow({
                content: '<div style="padding: 8px;"><strong>Location #' + markerData.number + '</strong><br/>' + markerData.title + '</div>',
              });
              
              marker.addListener('click', function() {
                // Close all other info windows
                infoWindows.forEach(iw => iw.close());
                infoWindow.open(map, marker);
              });
              
              infoWindows.push(infoWindow);
            });
            
            // Fit map to show all markers
            if (markers.length > 0) {
              map.fitBounds(bounds);
              // Set a max zoom level to prevent too much zoom
              google.maps.event.addListenerOnce(map, 'bounds_changed', function() {
                if (map.getZoom() > 15) {
                  map.setZoom(15);
                }
              });
            }
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
    if (!GOOGLE_MAPS_API_KEY) {
      return (
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <Ionicons name="map-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.loadingText, { color: theme.colors.text, marginTop: 16, textAlign: 'center' }]}>
            Map is unavailable. Configure Google Maps API key in your environment.
          </Text>
        </View>
      );
    }
    if (Platform.OS === 'web') {
      return (
        <View style={styles.mapContainer}>
          <WebView
            source={{ html: getWebMapHTML() }}
            style={styles.map}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            )}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              logger.error('WebView error: ', nativeEvent);
            }}
          />
        </View>
      );
    }

    // Native MapView for iOS/Android
    if (!MapView) {
      return (
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            Map not available on this platform
          </Text>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary, marginTop: 16 }]}>
            Loading verified locations...
          </Text>
        </View>
      );
    }
    if (locations.length === 0) {
      return (
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <Ionicons name="map-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.errorText, { color: theme.colors.text, marginTop: 16 }]}>
            No verified travel locations yet
          </Text>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary, marginTop: 8 }]}>
            Start posting with locations to see them here.
          </Text>
        </View>
      );
    }

    const region = getMapRegion();
    
    // Filter valid locations
    const validLocations = locations.filter(loc => 
      loc.latitude && loc.longitude && 
      loc.latitude !== 0 && loc.longitude !== 0 &&
      !isNaN(loc.latitude) && !isNaN(loc.longitude)
    );

    if (validLocations.length === 0) {
      return (
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <Ionicons name="map-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.errorText, { color: theme.colors.text, marginTop: 16 }]}>
            No valid coordinates to display
          </Text>
        </View>
      );
    }

    // Prepare coordinates for fitToCoordinates
    const coordinates = validLocations.map(loc => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
    }));

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={getMapProvider()}
        initialRegion={region}
        region={region} // Force region update to prevent defaulting to current location
        showsUserLocation={false} // CRITICAL: Disable current location display
        showsMyLocationButton={false} // CRITICAL: Disable location button
        followsUserLocation={false} // CRITICAL: Don't follow user location
        userLocationPriority="none" // CRITICAL: Don't prioritize user location
        showsCompass={true}
        showsScale={true}
        mapType="terrain"
        mapPadding={{ top: 100, right: 100, bottom: 100, left: 100 }} // Increased padding to ensure all markers are visible
        onMapReady={() => {
          logger.info('Map ready, displaying verified locations:', {
            count: validLocations.length,
            region,
            coordinatesCount: coordinates.length,
            platform: Platform.OS
          });
          
          // CRITICAL: Immediately fit map to all coordinates to show all visited places in single frame
          if (coordinates.length > 0 && mapRef.current) {
            // Use multiple attempts to ensure fitToCoordinates works reliably
            const fitMap = (attempt = 0) => {
              if (attempt > 5) {
                logger.warn('Failed to fit map after 5 attempts');
                return;
              }
              
              setTimeout(() => {
                try {
                  if (mapRef.current && coordinates.length > 0) {
                    // Force fit to coordinates with generous padding to show all locations in single frame
                    mapRef.current.fitToCoordinates(coordinates, {
                      edgePadding: { 
                        top: 100,    // Increased from 50 to ensure markers aren't cut off
                        right: 100, 
                        bottom: 100, 
                        left: 100 
                      },
                      animated: attempt === 0 && Platform.OS !== 'ios', // Don't animate on iOS first attempt for faster rendering
                    });
                    logger.debug(`[${Platform.OS}] Fitted map to ${coordinates.length} coordinates (attempt ${attempt + 1})`);
                    
                    // On iOS, also set camera directly after fitting to ensure it sticks
                    if (Platform.OS === 'ios' && attempt === 0) {
                      setTimeout(() => {
                        try {
                          if (mapRef.current) {
                            // Calculate zoom level that fits all coordinates
                            const zoomLevel = Math.min(15, Math.max(2, Math.floor(15 - Math.log2(region.latitudeDelta))));
                            mapRef.current.setCamera({
                              center: {
                                latitude: region.latitude,
                                longitude: region.longitude,
                              },
                              zoom: zoomLevel,
                            }, { animated: false });
                            logger.debug(`[iOS] Set camera to center: ${region.latitude}, ${region.longitude}, zoom: ${zoomLevel}`);
                          }
                        } catch (err) {
                          logger.debug('Error setting camera:', err);
                        }
                      }, 150);
                    }
                  } else {
                    fitMap(attempt + 1);
                  }
                } catch (err) {
                  logger.warn(`Error fitting map (attempt ${attempt + 1}):`, err);
                  if (attempt < 5) {
                    fitMap(attempt + 1);
                  }
                }
              }, attempt === 0 ? (Platform.OS === 'ios' ? 150 : 500) : 200);
            };
            
            fitMap();
          }
        }}
        onRegionChangeComplete={(newRegion: any) => {
          // Prevent map from changing back to current location
          // If region changes to something unexpected, refit to our coordinates
          const expectedCenterLat = region.latitude;
          const expectedCenterLng = region.longitude;
          const distance = Math.sqrt(
            Math.pow(newRegion.latitude - expectedCenterLat, 2) + 
            Math.pow(newRegion.longitude - expectedCenterLng, 2)
          );
          
          // If region moved too far from expected (more than 10 degrees), refit to show all locations
          if (distance > 10 && coordinates.length > 0 && mapRef.current) {
            logger.debug('Region moved unexpectedly, refitting to show all coordinates');
            try {
              mapRef.current.fitToCoordinates(coordinates, {
                edgePadding: { top: 100, right: 100, bottom: 100, left: 100 }, // Increased padding
                animated: false,
              });
            } catch (err) {
              logger.warn('Error refitting after region change:', err);
            }
          }
        }}
      >
        {validLocations.map((location, index) => (
          <Marker
            key={`marker-${location.number}-${location.latitude}-${location.longitude}-${index}`}
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title={location.address || `Location #${location.number}`}
            description={`Visit #${location.number}`}
          >
            <View style={styles.markerContainer}>
              <View style={[styles.markerCircle, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.markerText}>{location.number}</Text>
              </View>
            </View>
          </Marker>
        ))}
      </MapView>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>My Travel Locations</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading your travel locations...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>My Travel Locations</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>{error}</Text>
          <TouchableOpacity
            onPress={loadLocations}
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>My Travel Locations</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Statistics Bar */}
      {statistics && (
        <View style={[styles.statsContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View style={styles.statItem}>
            <Ionicons name="location" size={20} color={theme.colors.primary} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{statistics.totalLocations}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Locations</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="map" size={20} color={theme.colors.primary} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{statistics.totalDistance} km</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Traveled</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="calendar" size={20} color={theme.colors.primary} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{statistics.totalDays}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Days</Text>
          </View>
        </View>
      )}

      {/* Map Container */}
      <View style={styles.mapContainer}>
        {renderMap()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  markerText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
