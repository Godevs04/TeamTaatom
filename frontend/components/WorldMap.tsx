import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import Constants from 'expo-constants';

interface Location {
  latitude: number;
  longitude: number;
  address: string;
  date?: string;
}

interface WorldMapProps {
  visible: boolean;
  locations: Location[];
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;

function getPolylineCoordinates(locations: Location[]) {
  return locations.map(loc => ({ latitude: loc.latitude, longitude: loc.longitude }));
}

export default function WorldMap({ visible, locations, onClose }: WorldMapProps) {
  const { theme, mode } = useTheme();
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  const getMapHTML = () => {
    const backgroundColor = theme.colors.background;
    const primaryLocation = locations[0];
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            margin: 0; 
            padding: 0; 
            background: ${backgroundColor}; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          #map { 
            width: 100vw; 
            height: 100vh; 
          }
          .info-panel {
            position: absolute;
            bottom: 20px;
            left: 20px;
            right: 20px;
            background: ${theme.colors.surface};
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          }
          .location-title {
            font-size: 18px;
            font-weight: 600;
            color: ${theme.colors.text};
            margin-bottom: 8px;
          }
          .location-address {
            font-size: 14px;
            color: ${theme.colors.textSecondary};
            margin-bottom: 4px;
          }
          .location-date {
            font-size: 12px;
            color: ${theme.colors.textSecondary};
          }
        </style>
        <script>
          function initMap() {
            const map = new google.maps.Map(document.getElementById('map'), {
              center: { lat: ${primaryLocation.latitude}, lng: ${primaryLocation.longitude} },
              zoom: 12,
              styles: ${mode === 'dark' ? JSON.stringify([
                { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
              ]) : '[]'}
            });

            ${locations.map((location, index) => `
              new google.maps.Marker({
                position: { lat: ${location.latitude}, lng: ${location.longitude} },
                map: map,
                title: '${location.address}',
                icon: {
                  url: 'data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                    <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="15" cy="15" r="12" fill="#FF3040" stroke="#fff" stroke-width="2"/>
                      <circle cx="15" cy="15" r="4" fill="#fff"/>
                    </svg>
                  `)}',
                  scaledSize: new google.maps.Size(30, 30),
                  anchor: new google.maps.Point(15, 15)
                }
              });
            `).join('')}

            ${locations.length > 1 ? `
              const path = [${locations.map(loc => `{ lat: ${loc.latitude}, lng: ${loc.longitude} }`).join(', ')}];
              new google.maps.Polyline({
                path: path,
                geodesic: true,
                strokeColor: '${theme.colors.primary}',
                strokeOpacity: 1.0,
                strokeWeight: 3,
                map: map
              });
            ` : ''}
          }
        </script>
      </head>
      <body>
        <div id="map"></div>
        <div class="info-panel">
          <div class="location-title">📍 ${primaryLocation.address}</div>
          ${primaryLocation.date ? `<div class="location-date">📅 ${new Date(primaryLocation.date).toLocaleDateString()}</div>` : ''}
        </div>
        <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
      </body>
      </html>
    `;
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.9)',
    },
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
    title: {
      fontSize: theme.typography.h3.fontSize,
      fontWeight: '700',
      color: theme.colors.text,
    },
    closeButton: {
      padding: theme.spacing.xs,
    },
    map: {
      flex: 1,
    },
    locationInfo: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderTopLeftRadius: theme.borderRadius.lg,
      borderTopRightRadius: theme.borderRadius.lg,
      ...theme.shadows.large,
    },
    locationTitle: {
      fontSize: theme.typography.h3.fontSize,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    locationAddress: {
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
    },
    locationDate: {
      fontSize: theme.typography.small.fontSize,
      color: theme.colors.textSecondary,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    statItem: {
      alignItems: 'center',
    },
    statNumber: {
      fontSize: theme.typography.h3.fontSize,
      fontWeight: '700',
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: theme.typography.small.fontSize,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Travel Map</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{locations.length}</Text>
            <Text style={styles.statLabel}>Locations</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {locations.length > 1 ? 
                Math.round(getPolylineCoordinates(locations).reduce((acc, curr, index, arr) => {
                  if (index === 0) return 0;
                  const prev = arr[index - 1];
                  // Simple distance calculation (not exact but gives an idea)
                  const distance = Math.sqrt(
                    Math.pow(curr.latitude - prev.latitude, 2) + 
                    Math.pow(curr.longitude - prev.longitude, 2)
                  ) * 111; // Rough km conversion
                  return acc + distance;
                }, 0)) : 0
              }
            </Text>
            <Text style={styles.statLabel}>KM Traveled</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {locations.length > 0 && locations[0].date ? 
                Math.ceil((new Date().getTime() - new Date(locations[0].date).getTime()) / (1000 * 60 * 60 * 24)) : 0
              }
            </Text>
            <Text style={styles.statLabel}>Days</Text>
          </View>
        </View>

        {/* Map */}
        <WebView
          style={styles.map}
          source={{ html: getMapHTML() }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
        />

        {/* Location Info Panel */}
        {selectedLocation && (
          <View style={styles.locationInfo}>
            <TouchableOpacity
              style={{ position: 'absolute', top: theme.spacing.sm, right: theme.spacing.sm }}
              onPress={() => setSelectedLocation(null)}
            >
              <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            
            <Text style={styles.locationTitle}>📍 Location Details</Text>
            <Text style={styles.locationAddress}>{selectedLocation.address}</Text>
            {selectedLocation.date && (
              <Text style={styles.locationDate}>
                📅 {new Date(selectedLocation.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
