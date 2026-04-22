import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
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
import * as Location from 'expo-location';

const GROWTH_GREEN = '#22C55E';
const ACTION_BLUE = '#3B82F6';
const ALERT_RED = '#EF4444';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Journey Home Screen
 *
 * Main entry point for journey tracking
 * - Shows current location on map
 * - Option to start new journey with optional title
 * - Shows summary if journey is paused
 * - Shows continue/end buttons if paused
 */
export default function NavigateIndexScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const {
    initialized,
    isTracking,
    isPaused,
    journey,
    distance,
    duration,
    startJourneyRecording,
    resumeJourneyRecording,
    stopJourneyRecording,
  } = useJourneyTracking();

  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Get current location on mount
  useEffect(() => {
    const getInitialLocation = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.granted) {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (err) {
        console.error('Failed to get location:', err);
      }
    };

    getInitialLocation();
  }, []);

  // Redirect to tracking screen if journey is active (only after hook initialized)
  useEffect(() => {
    if (initialized && isTracking && !isPaused) {
      router.replace('/navigate/tracking');
    }
  }, [initialized, isTracking, isPaused, router]);

  const handleStartJourney = async () => {
    try {
      setIsLoading(true);
      await startJourneyRecording(titleInput || undefined);
      setTitleInput('');
      setShowTitleInput(false);
      router.push('/navigate/tracking');
    } catch (err: any) {
      showAlert('Failed to start journey', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueJourney = async () => {
    try {
      setIsLoading(true);
      await resumeJourneyRecording();
      router.push('/navigate/tracking');
    } catch (err: any) {
      showAlert('Failed to continue journey', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndJourney = () => {
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
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Journey</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Map View */}
      {currentLocation && (
        <View style={styles.mapContainer}>
          {useWebViewFallback ? (() => {
            const WV_KEY = getGoogleMapsApiKeyForWebView();
            if (!WV_KEY) return <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' }]}><Ionicons name="map-outline" size={48} color="#9CA3AF" /></View>;
            const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>html,body,#map{height:100%;margin:0;padding:0}</style>
<script>function initMap(){var map=new google.maps.Map(document.getElementById('map'),{center:{lat:${currentLocation.latitude},lng:${currentLocation.longitude}},zoom:15,mapTypeId:'terrain'});new google.maps.Marker({position:{lat:${currentLocation.latitude},lng:${currentLocation.longitude}},map:map,title:'Current Location'});}</script></head><body><div id="map"></div>
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
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              onMapReady={() => setMapReady(true)}
            >
              {Marker && (
                <Marker coordinate={currentLocation} title="Current Location" pinColor={ACTION_BLUE} />
              )}
            </MapView>
          ) : (
            <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' }]}>
              <Ionicons name="map-outline" size={48} color="#9CA3AF" />
            </View>
          )}
        </View>
      )}

      {/* No Journey - Start Screen */}
      {!isTracking && !isPaused && (
        <View style={[styles.contentContainer, { backgroundColor: theme.colors.background }]}>
          {/* Title Input */}
          {showTitleInput && (
            <View style={[styles.titleInputContainer, { borderColor: theme.colors.border }]}>
              <TextInput
                style={[styles.titleInput, { color: theme.colors.text }]}
                placeholder="Give your journey a name (optional)"
                placeholderTextColor={theme.colors.textSecondary}
                value={titleInput}
                onChangeText={setTitleInput}
                maxLength={50}
              />
            </View>
          )}

          {/* Start Button */}
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: GROWTH_GREEN }]}
            onPress={() => {
              if (showTitleInput) {
                handleStartJourney();
              } else {
                setShowTitleInput(true);
              }
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="play-circle" size={24} color="white" />
                <Text style={styles.startButtonText}>Start Journey</Text>
              </>
            )}
          </TouchableOpacity>

          {showTitleInput && (
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
              onPress={() => {
                setShowTitleInput(false);
                setTitleInput('');
              }}
              disabled={isLoading}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Paused Journey - Summary Screen */}
      {isPaused && journey && (
        <View style={[styles.contentContainer, { backgroundColor: theme.colors.background }]}>
          {/* Journey Summary Card */}
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {/* Title */}
            {journey.title && (
              <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>
                {journey.title}
              </Text>
            )}

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              {/* Distance */}
              <View style={styles.statBox}>
                <Ionicons name="navigate" size={20} color={GROWTH_GREEN} />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {formatDistance()}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  Distance
                </Text>
              </View>

              {/* Duration */}
              <View style={styles.statBox}>
                <Ionicons name="time" size={20} color={ACTION_BLUE} />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {formatDuration()}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  Duration
                </Text>
              </View>

              {/* Waypoints Count */}
              <View style={styles.statBox}>
                <Ionicons name="location-sharp" size={20} color={ALERT_RED} />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {journey.waypoints?.length || 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  Waypoints
                </Text>
              </View>
            </View>

            {/* Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: ACTION_BLUE + '15' }]}>
              <Ionicons name="pause-circle" size={16} color={ACTION_BLUE} />
              <Text style={[styles.statusText, { color: ACTION_BLUE }]}>Journey Paused</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: GROWTH_GREEN }]}
            onPress={handleContinueJourney}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="play-circle" size={24} color="white" />
                <Text style={styles.startButtonText}>Continue Journey</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: ALERT_RED }]}
            onPress={handleEndJourney}
            disabled={isLoading}
          >
            <Ionicons name="stop-circle" size={20} color={ALERT_RED} />
            <Text style={[styles.secondaryButtonText, { color: ALERT_RED }]}>End Journey</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading State */}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  mapContainer: {
    width: '100%',
    height: screenHeight * 0.4,
    backgroundColor: '#E5E7EB',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
    gap: 12,
  },
  titleInputContainer: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  titleInput: {
    fontSize: 14,
    fontWeight: '500',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    minHeight: 56,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
    minHeight: 48,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statBox: {
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
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
