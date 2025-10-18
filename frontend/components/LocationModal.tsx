import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Linking,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import Constants from 'expo-constants';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;

interface LocationModalProps {
  visible: boolean;
  location: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  onClose: () => void;
}

export default function LocationModal({ visible, location, onClose }: LocationModalProps) {
  const { theme, mode } = useTheme();

  const getMapHTML = () => {
    const backgroundColor = theme.colors.background;
    const mapImageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${location.coordinates.latitude},${location.coordinates.longitude}&zoom=15&size=800x600&markers=color:red%7C${location.coordinates.latitude},${location.coordinates.longitude}&key=${GOOGLE_MAPS_API_KEY}`;
    
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
            display: flex;
            flex-direction: column;
            height: 100vh;
          }
          .map-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f0f0f0;
            position: relative;
          }
          .map-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .info-panel {
            background: ${theme.colors.surface};
            padding: 20px;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
            border-top-left-radius: 20px;
            border-top-right-radius: 20px;
          }
          .location-title {
            font-size: 18px;
            font-weight: 600;
            color: ${theme.colors.text};
            margin-bottom: 12px;
          }
          .open-maps-btn {
            background: #007AFF;
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            text-align: center;
            font-weight: 600;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.2s;
          }
          .open-maps-btn:hover {
            background: #0056CC;
          }
        </style>
      </head>
      <body>
        <div class="map-container">
          <img src="${mapImageUrl}" alt="Map" class="map-image" />
        </div>
        <div class="info-panel">
          <div class="location-title">📍 ${location.address}</div>
          <div class="open-maps-btn" onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}', '_blank')">
            Open in Google Maps
          </div>
        </div>
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Post Location</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={[styles.statsContainer, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>📍</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Location</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.text }]}>
              {new Date().toLocaleDateString()}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Date</Text>
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
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  map: {
    flex: 1,
  },
});
