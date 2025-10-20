import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CurrentLocationMap() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
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
  }, []);

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
    } catch (err) {
      console.error('Error getting location:', err);
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
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (newLocation) => {
          setLocation(newLocation);
        }
      );

      return subscription;
    } catch (err) {
      console.error('Error watching location:', err);
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

    return (
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          customMapStyle={satelliteTheme}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
          showsScale={true}
          mapType="terrain"
          userLocationPriority="high"
          followsUserLocation={true}
        >
        <Marker
          coordinate={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }}
          title="Your Current Location"
          description="You are here"
          anchor={{ x: 0.5, y: 1 }}
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar 
        barStyle={theme.colors.text === '#FFFFFF' ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.background} 
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Current Location
          </Text>
          {isWatching && (
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

      {/* Map Container */}
      <View style={styles.mapContainer}>
        {renderMap()}
      </View>

      {/* Location Info */}
      {location && (
        <View style={[styles.locationInfo, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={20} color={theme.colors.primary} />
            <Text style={[styles.locationText, { color: theme.colors.text }]}>
              Latitude: {location.coords.latitude.toFixed(6)}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={20} color={theme.colors.primary} />
            <Text style={[styles.locationText, { color: theme.colors.text }]}>
              Longitude: {location.coords.longitude.toFixed(6)}
            </Text>
          </View>
          {location.coords.accuracy && (
            <View style={styles.locationRow}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
              <Text style={[styles.locationText, { color: theme.colors.text }]}>
                Accuracy: ±{Math.round(location.coords.accuracy)}m
              </Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
