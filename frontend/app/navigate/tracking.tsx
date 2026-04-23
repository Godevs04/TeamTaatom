import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { WebView } from 'react-native-webview';
import { useJourneyTracking } from '../../hooks/useJourneyTracking';
import { MapView, Marker, useWebViewFallback } from '../../utils/mapsWrapper';
import { getGoogleMapsApiKeyForWebView } from '../../utils/maps';
import PolylineRenderer from '../../components/PolylineRenderer';
import GPSAccuracyChip from '../../components/GPSAccuracyChip';

const GROWTH_GREEN = '#22C55E';
const ACTION_BLUE = '#3B82F6';
const ALERT_RED = '#EF4444';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Journey Tracking Screen
 *
 * Real-time journey tracking with live map visualization
 * - Full-screen map showing user location and journey path
 * - Green polyline for journey route
 * - Photo waypoints on the map
 * - GPS accuracy chip at bottom
 * - Timer and distance counter in header
 * - Pause/Stop buttons in header
 */
export default function TrackingScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const {
    initialized,
    isTracking,
    isPaused,
    journey,
    polyline,
    distance,
    duration,
    accuracy,
    pauseJourneyRecording,
    stopJourneyRecording,
  } = useJourneyTracking();

  const [mapReady, setMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Derive current location from polyline's latest point (no duplicate watcher needed)
  const currentLocation = useMemo(() => {
    if (polyline.length === 0) return null;
    const last = polyline[polyline.length - 1];
    return { latitude: last.latitude, longitude: last.longitude };
  }, [polyline]);

  // Redirect to home if no journey (only after hook has initialized)
  useEffect(() => {
    if (initialized && !isTracking) {
      router.replace('/navigate');
    }
  }, [initialized, isTracking, router]);

  const handlePauseJourney = async () => {
    try {
      setIsLoading(true);
      await pauseJourneyRecording();
      showAlert('Journey paused', 'You can continue your journey anytime in the next 24 hours');
      router.push('/navigate');
    } catch (err: any) {
      showAlert('Failed to pause journey', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopJourney = () => {
    Alert.alert('End Journey?', 'This will complete your current journey. You can view it later in your profile.', [
      {
        text: 'Cancel',
        onPress: () => {},
        style: 'cancel',
      },
      {
        text: 'End Journey',
        onPress: async () => {
          try {
            setIsLoading(true);
            await stopJourneyRecording();
            router.push('/navigate/complete');
          } catch (err: any) {
            showAlert('Failed to end journey', err.message);
          } finally {
            setIsLoading(false);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const formatDistance = () => {
    if (distance < 1000) {
      return `${Math.round(distance)} m`;
    }
    return `${(distance / 1000).toFixed(1)} km`;
  };

  const formatDuration = () => {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const initialRegion = currentLocation || (polyline[0] ? {
    latitude: polyline[0].latitude,
    longitude: polyline[0].longitude,
  } : {
    latitude: 0,
    longitude: 0,
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="navigate" size={16} color={GROWTH_GREEN} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {formatDistance()}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statItem}>
            <Ionicons name="time" size={16} color={ACTION_BLUE} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {formatDuration()}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.headerButton, { borderColor: ALERT_RED }]}
            onPress={handlePauseJourney}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={ALERT_RED} />
            ) : (
              <Ionicons name="pause" size={20} color={ALERT_RED} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerButton, { borderColor: ALERT_RED }]}
            onPress={handleStopJourney}
            disabled={isLoading}
          >
            <Ionicons name="stop" size={20} color={ALERT_RED} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Map */}
      {initialRegion && (
        <View style={styles.mapContainer}>
          {useWebViewFallback ? (() => {
            const WV_KEY = getGoogleMapsApiKeyForWebView();
            if (!WV_KEY) return <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' }]}><Ionicons name="map-outline" size={48} color="#9CA3AF" /></View>;
            const polyCoords = JSON.stringify(polyline.filter(p => p.latitude && p.longitude).map(p => ({ lat: p.latitude, lng: p.longitude })));
            const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>html,body,#map{height:100%;margin:0;padding:0}</style>
<script>function initMap(){var map=new google.maps.Map(document.getElementById('map'),{center:{lat:${initialRegion.latitude},lng:${initialRegion.longitude}},zoom:15,mapTypeId:'terrain'});
var path=${polyCoords};if(path.length>1){new google.maps.Polyline({path:path,geodesic:true,strokeColor:'${GROWTH_GREEN}',strokeOpacity:1,strokeWeight:4,map:map});}
${currentLocation ? `new google.maps.Marker({position:{lat:${currentLocation.latitude},lng:${currentLocation.longitude}},map:map,title:'You'});` : ''}
}</script></head><body><div id="map"></div>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${WV_KEY}&language=en&callback=initMap"></script></body></html>`;
            return (
              <WebView
                style={styles.map}
                source={{ html }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={['https://*', 'http://*', 'data:*', 'about:*']}
                onShouldStartLoadWithRequest={(req) => req.url.startsWith('http') || req.url.startsWith('data:') || req.url.startsWith('about:')}
                {...(Platform.OS === 'android' && { mixedContentMode: 'compatibility' as const, setSupportMultipleWindows: false })}
              />
            );
          })() : MapView ? (
            <MapView
              style={styles.map}
              initialRegion={{
                ...initialRegion,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              onMapReady={() => setMapReady(true)}
              showsUserLocation={true}
              followsUserLocation={true}
              zoomEnabled={true}
              scrollEnabled={true}
            >
              {polyline.length > 1 && (
                <PolylineRenderer
                  coordinates={polyline}
                  color={GROWTH_GREEN}
                  strokeWidth={4}
                  simplifyDistance={5}
                  applyKalman={false}
                />
              )}
              {currentLocation && Marker && (
                <Marker coordinate={currentLocation} title="Current Location" pinColor={ACTION_BLUE} />
              )}
              {Marker && journey?.waypoints?.map((waypoint, index) => (
                <Marker
                  key={`waypoint-${index}`}
                  coordinate={{ latitude: waypoint.latitude, longitude: waypoint.longitude }}
                  title={`${waypoint.type === 'photo' ? 'Photo' : 'Video'} #${index + 1}`}
                  pinColor={waypoint.type === 'photo' ? GROWTH_GREEN : ACTION_BLUE}
                />
              ))}
            </MapView>
          ) : (
            <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' }]}>
              <Ionicons name="map-outline" size={48} color="#9CA3AF" />
            </View>
          )}

          {/* GPS Accuracy Chip */}
          <GPSAccuracyChip accuracy={accuracy} />
        </View>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={GROWTH_GREEN} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});
