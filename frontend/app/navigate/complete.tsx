import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { useJourneyTracking } from '../../hooks/useJourneyTracking';
import { WebView } from 'react-native-webview';
import { MapView, Marker, useWebViewFallback } from '../../utils/mapsWrapper';
import { getGoogleMapsApiKeyForWebView } from '../../utils/maps';
import PolylineRenderer from '../../components/PolylineRenderer';

const GROWTH_GREEN = '#22C55E';
const ACTION_BLUE = '#3B82F6';
const ALERT_RED = '#EF4444';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Journey Complete Screen
 *
 * Shown after journey completion
 * - Journey summary (total distance, duration, countries visited)
 * - Full polyline map with all waypoints
 * - TripScore points earned (large number, Growth Green)
 * - Share button
 * - Done button → profile
 */
export default function CompleteScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { showAlert } = useAlert();
  const { journey, polyline } = useJourneyTracking();
  const params = useLocalSearchParams();

  const [mapReady, setMapReady] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Ensure we have a journey to display
  useEffect(() => {
    if (!journey) {
      router.replace('/navigate');
    }
  }, [journey, router]);

  const formatDistance = () => {
    if (!journey) return '0 km';
    if (journey.distance < 1000) {
      return `${Math.round(journey.distance)} m`;
    }
    return `${(journey.distance / 1000).toFixed(1)} km`;
  };

  const formatDuration = () => {
    if (!journey) return '0m';
    const hours = Math.floor(journey.duration / 3600);
    const minutes = Math.floor((journey.duration % 3600) / 60);
    const seconds = journey.duration % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  };

  const handleShare = async () => {
    try {
      setIsSharing(true);
      const shareText = `I just completed a journey of ${formatDistance()} in ${formatDuration()}! ${journey?.title ? `"${journey.title}"` : ''}`;

      await Share.share({
        message: shareText,
        title: 'My Journey',
      });
    } catch (err: any) {
      showAlert('Share failed', err.message);
    } finally {
      setIsSharing(false);
    }
  };

  if (!journey) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={GROWTH_GREEN} />
        </View>
      </SafeAreaView>
    );
  }

  const initialRegion = polyline[0] ? {
    latitude: polyline[0].latitude,
    longitude: polyline[0].longitude,
  } : {
    latitude: 0,
    longitude: 0,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Journey Complete!</Text>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Map View */}
        <View style={styles.mapContainer}>
          {useWebViewFallback ? (() => {
            const WV_KEY = getGoogleMapsApiKeyForWebView();
            if (!WV_KEY) return <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' }]}><Ionicons name="map-outline" size={48} color="#9CA3AF" /></View>;
            const polyCoords = JSON.stringify(polyline.filter(p => p.latitude && p.longitude).map(p => ({ lat: p.latitude, lng: p.longitude })));
            const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>html,body,#map{height:100%;margin:0;padding:0}</style>
<script>function initMap(){var map=new google.maps.Map(document.getElementById('map'),{center:{lat:${initialRegion.latitude},lng:${initialRegion.longitude}},zoom:13,mapTypeId:'terrain',gestureHandling:'none',zoomControl:false});
var path=${polyCoords};if(path.length>1){new google.maps.Polyline({path:path,geodesic:true,strokeColor:'${GROWTH_GREEN}',strokeOpacity:1,strokeWeight:4,map:map});var bounds=new google.maps.LatLngBounds();path.forEach(function(p){bounds.extend(p);});map.fitBounds(bounds,40);}
}</script></head><body><div id="map"></div>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${WV_KEY}&language=en&callback=initMap"></script></body></html>`;
            return (
              <WebView
                style={styles.map}
                source={{ html }}
                scrollEnabled={false}
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
                latitudeDelta: 0.1,
                longitudeDelta: 0.1,
              }}
              onMapReady={() => setMapReady(true)}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              {polyline.length > 1 && (
                <PolylineRenderer
                  coordinates={polyline}
                  color={GROWTH_GREEN}
                  strokeWidth={4}
                  simplifyDistance={10}
                  applyKalman={false}
                />
              )}
              {Marker && journey.waypoints?.map((waypoint, index) => (
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
        </View>

        {/* Journey Title */}
        {journey.title && (
          <Text style={[styles.journeyTitle, { color: theme.colors.text }]}>
            {journey.title}
          </Text>
        )}

        {/* Summary Stats */}
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.statsGrid}>
            {/* Distance */}
            <View style={styles.statBox}>
              <View style={[styles.statIconContainer, { backgroundColor: GROWTH_GREEN + '15' }]}>
                <Ionicons name="navigate" size={24} color={GROWTH_GREEN} />
              </View>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {formatDistance()}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Distance
              </Text>
            </View>

            {/* Duration */}
            <View style={styles.statBox}>
              <View style={[styles.statIconContainer, { backgroundColor: ACTION_BLUE + '15' }]}>
                <Ionicons name="time" size={24} color={ACTION_BLUE} />
              </View>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {formatDuration()}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Duration
              </Text>
            </View>

            {/* Waypoints */}
            <View style={styles.statBox}>
              <View style={[styles.statIconContainer, { backgroundColor: ALERT_RED + '15' }]}>
                <Ionicons name="location-sharp" size={24} color={ALERT_RED} />
              </View>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {journey.waypoints?.length || 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Waypoints
              </Text>
            </View>
          </View>
        </View>

        {/* Journey Details */}
        <View style={[styles.detailsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Started</Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
              {new Date(journey.startTime).toLocaleDateString()} {new Date(journey.startTime).toLocaleTimeString()}
            </Text>
          </View>
          <View style={[styles.detailDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Completed</Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
              {journey.completedTime ? new Date(journey.completedTime).toLocaleDateString() : '—'}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.shareButton, { borderColor: ACTION_BLUE }]}
            onPress={handleShare}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color={ACTION_BLUE} />
            ) : (
              <>
                <Ionicons name="share-social" size={20} color={ACTION_BLUE} />
                <Text style={[styles.shareButtonText, { color: ACTION_BLUE }]}>Share</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: GROWTH_GREEN }]}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.doneButtonText}>View in Profile</Text>
            <Ionicons name="chevron-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    minHeight: 56,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContainer: {
    width: '100%',
    height: screenHeight * 0.35,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  journeyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    gap: 8,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailsCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailDivider: {
    height: 1,
    width: '100%',
  },
  actionsContainer: {
    gap: 12,
    paddingBottom: 20,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
    minHeight: 48,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    minHeight: 52,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
