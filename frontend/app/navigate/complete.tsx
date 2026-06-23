import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  SafeAreaView,
  Dimensions,
  Platform,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { useJourney, useJourneyDuration } from '../../context/JourneyContext';
import { WebView } from 'react-native-webview';
import { MapView, Marker, getMapProvider, useWebViewFallback } from '../../utils/mapsWrapper';
import { getGoogleMapsApiKeyForWebView } from '../../utils/maps';
import PolylineRenderer from '../../components/PolylineRenderer';
import GlassMapPanel from '../../components/GlassMapPanel';
import PremiumMapMarker from '../../components/PremiumMapMarker';
import SafeMarker from '../../components/SafeMarker';
import { useMapStyle } from '../../hooks/useMapStyle';
import NavBar from '../../components/NavBar';
import { Image as ExpoImage } from 'expo-image';
import { getApiUrl } from '../../utils/config';

const resolvePhotoUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return getApiUrl(cleanPath);
};

const getWaypointPhotoUrl = (waypoint: any): string | undefined => {
  if (!waypoint || !waypoint.post) return undefined;
  const post = waypoint.post;
  if (typeof post === 'object') {
    const url = post.photo || post.imageUrl || post.mediaUrl || post.media?.url || post.thumbnailUrl;
    return resolvePhotoUrl(url);
  }
  return undefined;
};

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
// Module-level lock to prevent double-navigation in rapid succession
let navigatePostLock = false;

export default function CompleteScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const mapStyle = useMapStyle();
  const { showAlert } = useAlert();
  const { journey, polyline, distance } = useJourney();
  const duration = useJourneyDuration();
  const params = useLocalSearchParams();

  const navigateToPost = (postId: string, contentType: string, userId: string) => {
    if (navigatePostLock) return;
    navigatePostLock = true;
    setTimeout(() => {
      navigatePostLock = false;
    }, 1000);

    if (contentType === 'short' || contentType === 'video') {
      router.push(`/user-shorts/${userId}?shortId=${postId}`);
    } else {
      router.push(`/post/${postId}`);
    }
  };

  const [mapReady, setMapReady] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  // Ensure we have a journey to display
  useEffect(() => {
    if (!journey) {
      router.replace('/navigate');
    }
  }, [journey, router]);

  // The backend returns Mongoose fields (distanceTraveled, startedAt, completedAt)
  // while the frontend type uses (distance, startTime, completedTime). Support both.
  const totalDistance = journey?.distanceTraveled ?? journey?.distance ?? distance ?? 0;
  const startedAt = journey?.startedAt || journey?.startTime || journey?.createdAt || '';
  const completedAt = journey?.completedAt || journey?.completedTime || '';

  const formatDistance = () => {
    if (!totalDistance) return '0 m';
    if (totalDistance < 1000) {
      return `${Math.round(totalDistance)} m`;
    }
    return `${(totalDistance / 1000).toFixed(1)} km`;
  };

  const formatDuration = () => {
    // Compute from timestamps if context duration is 0 (journey already completed)
    let secs = duration;
    if ((!secs || secs <= 0) && startedAt && completedAt) {
      const start = new Date(startedAt).getTime();
      const end = new Date(completedAt).getTime();
      if (!isNaN(start) && !isNaN(end)) {
        secs = Math.floor((end - start) / 1000);
      }
    }
    if (!secs || secs <= 0) return '0s';
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;

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
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContainer}>
          <LoadingGlobe size="large" color={GROWTH_GREEN} />
        </View>
      </View>
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <NavBar title="Journey Complete!" showBack={false} />

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Map View */}
        <View style={styles.mapContainer}>
          {useWebViewFallback ? (() => {
            const WV_KEY = getGoogleMapsApiKeyForWebView();
            if (!WV_KEY) return <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' }]}><Ionicons name="map-outline" size={48} color="#9CA3AF" /></View>;
            const polyCoords = JSON.stringify(polyline.filter(p => p.latitude && p.longitude).map(p => ({ lat: p.latitude, lng: p.longitude })));
            const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><style>
html,body,#map{height:100%;margin:0;padding:0}
</style>
<script>
function initMap(){
  var map=new google.maps.Map(document.getElementById('map'),{center:{lat:${initialRegion.latitude},lng:${initialRegion.longitude}},zoom:13,mapTypeId:'roadmap',styles:${JSON.stringify(mapStyle.customMapStyle)},gestureHandling:'greedy',zoomControl:true,isFractionalZoomEnabled:true,disableDefaultUI:true});
  var path=${polyCoords};
  if(path.length>1){
    new google.maps.Polyline({path:path,geodesic:true,strokeColor:'${mapStyle.routeGlowColor}',strokeOpacity:1,strokeWeight:12,map:map});
    new google.maps.Polyline({path:path,geodesic:true,strokeColor:'${mapStyle.routeColor}',strokeOpacity:1,strokeWeight:4,map:map});
    
    // Start marker
    new google.maps.Marker({
      position:path[0],
      map:map,
      title:'Start',
      icon:{
        url:'data:image/svg+xml;utf-8,'+encodeURIComponent('<svg width="30" height="30" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="#10B981" stroke="white" stroke-width="2"/></svg>'),
        size:new google.maps.Size(30,30),
        scaledSize:new google.maps.Size(30,30),
        anchor:new google.maps.Point(15,15)
      }
    });
    
    // End marker
    new google.maps.Marker({
      position:path[path.length-1],
      map:map,
      title:'End',
      icon:{
        url:'data:image/svg+xml;utf-8,'+encodeURIComponent('<svg width="30" height="30" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="#EF4444" stroke="white" stroke-width="2"/></svg>'),
        size:new google.maps.Size(30,30),
        scaledSize:new google.maps.Size(30,30),
        anchor:new google.maps.Point(15,15)
      }
    });
    
    var bounds=new google.maps.LatLngBounds();path.forEach(function(p){bounds.extend(p);});map.fitBounds(bounds,40);
  }
}
</script></head><body><div id="map"></div>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${WV_KEY}&language=en&callback=initMap"></script></body></html>`;
            return (
              <WebView
                style={styles.map}
                source={{ html }}
                scrollEnabled={true}
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
              provider={getMapProvider()}
              {...mapStyle.nativeMapProps}
              initialRegion={{
                ...initialRegion,
                latitudeDelta: 0.1,
                longitudeDelta: 0.1,
              }}
              onMapReady={() => setMapReady(true)}
              scrollEnabled={true}
              zoomEnabled={true}
              mapType={mapStyle.mapType}
            >
              {polyline.length > 1 && (
                <PolylineRenderer
                  coordinates={polyline}
                  color={mapStyle.routeColor}
                  glowColor={mapStyle.routeGlowColor}
                  strokeWidth={4}
                  simplifyDistance={10}
                  applyKalman={false}
                />
              )}
              {SafeMarker && journey.waypoints?.map((waypoint, index) => {
                const photoUrl = getWaypointPhotoUrl(waypoint);
                const postId = waypoint.postId || (waypoint as any).post?._id || (waypoint as any).post;
                const contentType = waypoint.type || (waypoint as any).contentType || (waypoint as any).post?.type || 'photo';
                const targetUserId = journey.userId || (journey as any).user?._id || (journey as any).user;
                const latitude = waypoint.latitude ?? (waypoint as any).lat;
                const longitude = waypoint.longitude ?? (waypoint as any).lng;

                if (latitude === undefined || longitude === undefined || isNaN(latitude) || isNaN(longitude)) return null;

                return (
                  <SafeMarker
                    key={`waypoint-${index}`}
                    coordinate={{ latitude, longitude }}
                    title={`${contentType === 'video' ? 'Video' : 'Photo'} #${index + 1}`}
                    anchor={photoUrl ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1.0 }}
                    onPress={() => {
                      if (postId) {
                        navigateToPost(postId, contentType, targetUserId);
                      }
                    }}
                    repaintTriggers={[waypoint.type, photoUrl, !!loadedImages[index]]}
                  >
                    {photoUrl ? (
                      <View style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: '#FFFFFF',
                        backgroundColor: '#FFFFFF',
                        overflow: 'hidden',
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 4,
                        elevation: 4,
                      }}>
                        <ExpoImage
                          source={{ uri: photoUrl }}
                          style={{ width: '100%', height: '100%', borderRadius: 14 }}
                          contentFit="cover"
                          onLoad={() => {
                            if (!loadedImages[index]) {
                              setLoadedImages(prev => ({ ...prev, [index]: true }));
                            }
                          }}
                        />
                      </View>
                    ) : (
                      <PremiumMapMarker icon={waypoint.type === 'photo' ? 'camera' : 'videocam'} />
                    )}
                  </SafeMarker>
                );
              })}
            </MapView>
          ) : (
            <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' }]}>
              <Ionicons name="map-outline" size={48} color="#9CA3AF" />
            </View>
          )}
          <GlassMapPanel style={styles.mapCompletePanel} tint={mapStyle.glassTint}>
            <Ionicons name="checkmark-circle" size={16} color={GROWTH_GREEN} />
            <Text style={[styles.mapCompleteText, { color: theme.colors.text }]}>
              Journey saved to your social map
            </Text>
          </GlassMapPanel>
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
              {startedAt && !isNaN(new Date(startedAt).getTime())
                ? `${new Date(startedAt).toLocaleDateString()} ${new Date(startedAt).toLocaleTimeString()}`
                : '—'}
            </Text>
          </View>
          <View style={[styles.detailDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Completed</Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
              {completedAt && !isNaN(new Date(completedAt).getTime())
                ? new Date(completedAt).toLocaleDateString()
                : '—'}
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
              <LoadingGlobe size="small" color={ACTION_BLUE} />
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
    </View>
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
  mapCompletePanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapCompleteText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
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
