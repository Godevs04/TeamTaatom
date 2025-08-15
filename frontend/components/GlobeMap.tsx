import React, { useRef, useState } from 'react';
import { View, Modal, StyleSheet, Text, TouchableOpacity, Dimensions, Platform, Linking, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export interface GlobeLocation {
  latitude: number;
  longitude: number;
  address?: string;
  date?: string;
}

interface GlobeMapProps {
  locations: GlobeLocation[];
  title?: string;
  visible: boolean;
  onClose: () => void;
  onMarkerClick?: (location: GlobeLocation) => void;
}

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;

export default function GlobeMap({ locations, title = 'Travel Globe', visible, onClose, onMarkerClick }: GlobeMapProps) {
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fallback: open native Google Maps with route
  const openNativeMaps = () => {
    if (locations.length === 0) return;
    const waypoints = locations.map(loc => `${loc.latitude},${loc.longitude}`).join('/');
    const url = Platform.select({
      ios: `maps://?q=${waypoints}`,
      android: `geo:0,0?q=${waypoints}`,
      default: `https://www.google.com/maps/dir/${waypoints}`
    });
    Linking.openURL(url!);
  };

  // HTML for Google Maps 3D globe
  const getMapHTML = () => {
    // Polyline path
    const path = locations.map(loc => `{ lat: ${loc.latitude}, lng: ${loc.longitude} }`).join(', ');
    // Markers
    const markers = locations.map((loc, i) => `
      new google.maps.Marker({
        position: { lat: ${loc.latitude}, lng: ${loc.longitude} },
        map: map,
        icon: {
          url: 'data:image/svg+xml;utf-8,<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="%23FF3040"/></svg>',
          scaledSize: new google.maps.Size(24, 24),
        },
        title: '${loc.address || ''}',
      }).addListener('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', index: ${i} }));
      });
    `).join('');
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>html, body, #map { height: 100%; margin: 0; padding: 0; }</style>
        <script>
          function initMap() {
            const map = new google.maps.Map(document.getElementById('map'), {
              center: { lat: ${locations[0].latitude}, lng: ${locations[0].longitude} },
              zoom: 2,
              mapTypeId: 'terrain',
              tilt: 45,
            });
            ${markers}
            ${locations.length > 1 ? `
              const path = [${path}];
              new google.maps.Polyline({
                path: path,
                geodesic: true,
                strokeColor: '#FF3040',
                strokeOpacity: 1.0,
                strokeWeight: 2,
                map: map
              });
            ` : ''}
            // Fit bounds
            const bounds = new google.maps.LatLngBounds();
            [${locations.map(loc => `new google.maps.LatLng(${loc.latitude}, ${loc.longitude})`).join(',')}].forEach(marker => bounds.extend(marker));
            map.fitBounds(bounds);
          }
        </script>
      </head>
      <body>
        <div id="map"></div>
        <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
      </body>
      </html>
    `;
  };

  // Handle messages from WebView (marker click)
  const onWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'marker' && typeof data.index === 'number' && onMarkerClick) {
        onMarkerClick(locations[data.index]);
      }
    } catch {}
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
        </View>
        {loadError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to load Google Maps. Opening in native app...</Text>
            <TouchableOpacity onPress={openNativeMaps} style={styles.nativeButton}>
              <Ionicons name="map" size={24} color="#fff" />
              <Text style={styles.nativeButtonText}>Open in Google Maps</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            style={styles.webview}
            source={{ html: getMapHTML() }}
            javaScriptEnabled
            domStorageEnabled
            onError={() => setLoadError(true)}
            onLoadEnd={() => setLoading(false)}
            onMessage={onWebViewMessage}
            startInLoadingState
            renderLoading={() => <ActivityIndicator style={{ flex: 1 }} size="large" color="#FF3040" />}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  webview: {
    flex: 1,
    width: width,
    height: height,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3040',
    marginBottom: 16,
    textAlign: 'center',
  },
  nativeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3040',
    padding: 12,
    borderRadius: 8,
  },
  nativeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
});
