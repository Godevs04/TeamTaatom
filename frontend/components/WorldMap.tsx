import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import Constants from 'expo-constants';
import { getTravelMapData } from '../services/posts';
import logger from '../utils/logger';

interface TravelMapData {
  locations: Array<{
    number: number;
    latitude: number;
    longitude: number;
    address: string;
    date: string;
  }>;
  statistics: {
    totalLocations: number;
    totalDistance: number;
    totalDays: number;
  };
}

interface WorldMapProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

// Helper functions
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateTotalDistance(locations: TravelMapData['locations']): number {
  if (locations.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < locations.length; i++) {
    const prev = locations[i - 1];
    const curr = locations[i];
    totalDistance += calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
  }
  return totalDistance;
}

function calculateTotalDays(locations: TravelMapData['locations']): number {
  if (locations.length === 0) return 0;
  
  const dates = locations
    .map(loc => loc.date)
    .filter(date => date)
    .map(date => new Date(date!).toDateString())
    .filter((date, index, arr) => arr.indexOf(date) === index);
  
  return dates.length;
}

export default function WorldMap({ visible, userId, onClose }: WorldMapProps) {
  const { theme, mode } = useTheme();
  const [mapError, setMapError] = useState<string | null>(null);
  const [travelMapData, setTravelMapData] = useState<TravelMapData | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch travel map data when component becomes visible
  useEffect(() => {
    if (visible && userId) {
      fetchTravelMapData(false);
    }
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [visible, userId]);

  const fetchTravelMapData = async (silent: boolean = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setMapError(null);
      const data = await getTravelMapData(userId);
      setTravelMapData(data.data);
    } catch (error) {
      logger.error('Error fetching travel map data:', error);
      if (!silent) {
        setMapError('Failed to load travel data');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Define styles first
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: theme.typography.h3.fontSize,
      fontWeight: '700',
      color: theme.colors.text,
    },
    closeButton: {
      padding: theme.spacing.xs,
    },
    statsContainer: {
      flexDirection: 'row',
      backgroundColor: theme.colors.surface,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    mapContainer: {
      flex: 1,
    },
    map: {
      flex: 1,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    errorIcon: {
      marginBottom: theme.spacing.md,
    },
    errorTitle: {
      fontSize: theme.typography.h3.fontSize,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    errorMessage: {
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });

  // Use travel map data
  const displayLocations = travelMapData?.locations || [];
  const statistics = travelMapData?.statistics || {
    totalLocations: 0,
    totalDistance: 0,
    totalDays: 0
  };

  // Debug logging
  logger.debug('WorldMap - Travel map data:', travelMapData);
  logger.debug('WorldMap - Display locations:', displayLocations);
  logger.debug('WorldMap - Statistics:', statistics);

  // Validate locations have proper coordinates
  const validLocations = displayLocations.filter(loc => 
    loc.latitude && loc.longitude && 
    typeof loc.latitude === 'number' && 
    typeof loc.longitude === 'number' &&
    !isNaN(loc.latitude) && !isNaN(loc.longitude)
  );

  logger.debug('WorldMap - Valid locations:', validLocations);
  logger.debug('WorldMap - Valid locations count:', validLocations.length);

  // Use valid locations from travel map data
  const finalLocations = validLocations;

  logger.debug('WorldMap - Final locations:', finalLocations);
  logger.debug('WorldMap - Final locations count:', finalLocations.length);

  const getMapHTML = () => {
    // Calculate bounds to fit all locations
    const lats = finalLocations.map(loc => loc.latitude);
    const lngs = finalLocations.map(loc => loc.longitude);
    const minLat = lats.length > 0 ? Math.min(...lats) : 12.9716;
    const maxLat = lats.length > 0 ? Math.max(...lats) : 12.9716;
    const minLng = lngs.length > 0 ? Math.min(...lngs) : 77.5946;
    const maxLng = lngs.length > 0 ? Math.max(...lngs) : 77.5946;
    
    // Add padding to bounds
    const latPadding = Math.max((maxLat - minLat) * 0.2, 0.01);
    const lngPadding = Math.max((maxLng - minLng) * 0.2, 0.01);
    
    const bounds = {
      north: maxLat + latPadding,
      south: minLat - latPadding,
      east: maxLng + lngPadding,
      west: minLng - lngPadding
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />
        <style>
          body { 
            margin: 0; 
            padding: 0; 
            background: ${theme.colors.background}; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          #map { 
            width: 100vw; 
            height: 100vh; 
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
        <script>
          try {
            // Create map
            const map = L.map('map').fitBounds([
              [${bounds.south}, ${bounds.west}],
              [${bounds.north}, ${bounds.east}]
            ]);
            
            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors',
              maxZoom: 18
            }).addTo(map);
            
            // Create MarkerClusterGroup with custom style matching app theme
            const markersGroup = L.markerClusterGroup({
              iconCreateFunction: function(cluster) {
                const childCount = cluster.getChildCount();
                return L.divIcon({
                  html: '<div style="background: rgba(80, 200, 120, 0.6); backdrop-filter: blur(8px); border: 2px solid white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.15);">' + childCount + '</div>',
                  className: 'custom-marker-cluster',
                  iconSize: [40, 40],
                  iconAnchor: [20, 20]
                });
              }
            });
            
            // Add dynamic markers based on travel map data
            const locations = ${JSON.stringify(finalLocations)};
            
            locations.forEach((location, index) => {
              const marker = L.marker([location.latitude, location.longitude])
                .bindPopup(\`<b>\${location.address}</b><br/>📅 \${new Date(location.date).toLocaleDateString()}\`);
              
              const icon = L.divIcon({
                className: 'custom-marker',
                html: \`<div style="background: #FF3040; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 11px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">\${location.number}</div>\`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              });
              
              marker.setIcon(icon);
              markersGroup.addLayer(marker);
            });
            
            map.addLayer(markersGroup);
            
            // Listen to moveend event to notify React Native about region change
            map.on('moveend', function() {
              const center = map.getCenter();
              const zoom = map.getZoom();
              const bounds = map.getBounds();
              const message = {
                type: 'regionChange',
                center: { latitude: center.lat, longitude: center.lng },
                zoom: zoom,
                bounds: {
                  latitudeDelta: Math.abs(bounds.getNorth() - bounds.getSouth()),
                  longitudeDelta: Math.abs(bounds.getEast() - bounds.getWest()),
                }
              };
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(message));
              }
            });
            
          } catch (error) {
            document.body.innerHTML = '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f5f5f5; color: #333; font-family: Arial, sans-serif;"><div style="font-size: 48px; margin-bottom: 20px;">⚠️</div><div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">Map Error</div><div style="font-size: 16px; text-align: center;">Failed to load map. Please check your internet connection.</div></div>';
          }
        </script>
      </body>
      </html>
    `;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Travel Map</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{statistics.totalLocations}</Text>
            <Text style={styles.statLabel}>Locations</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{statistics.totalDistance}</Text>
            <Text style={styles.statLabel}>KM Traveled</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{statistics.totalDays}</Text>
            <Text style={styles.statLabel}>Days</Text>
          </View>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          {loading ? (
            <View style={styles.errorContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.errorTitle}>Loading Travel Map...</Text>
            </View>
          ) : mapError ? (
            <View style={styles.errorContainer}>
              <View style={styles.errorIcon}>
                <Ionicons name="warning" size={48} color={theme.colors.error} />
              </View>
              <Text style={styles.errorTitle}>Map Error</Text>
              <Text style={styles.errorMessage}>
                {mapError}. Please try again later.
              </Text>
            </View>
          ) : (
            <WebView
              style={styles.map}
              source={{ html: getMapHTML() }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              scalesPageToFit={true}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'regionChange') {
                    if (debounceTimerRef.current) {
                      clearTimeout(debounceTimerRef.current);
                    }
                    debounceTimerRef.current = setTimeout(() => {
                      fetchTravelMapData(true);
                    }, 400);
                  }
                } catch (e) {
                  logger.debug('Error parsing WebView message in WorldMap:', e);
                }
              }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                logger.error('WebView error: ', nativeEvent);
                setMapError('Failed to load map');
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                logger.error('WebView HTTP error: ', nativeEvent);
                setMapError('Failed to load map');
              }}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}