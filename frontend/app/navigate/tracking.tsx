import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
  Animated,
  AppState,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { WebView } from 'react-native-webview';
import { useJourney } from '../../context/JourneyContext';
import { MapView, Marker, getMapProvider, useWebViewFallback } from '../../utils/mapsWrapper';
import { getGoogleMapsApiKeyForWebView } from '../../utils/maps';
import PolylineRenderer from '../../components/PolylineRenderer';
import GPSAccuracyChip from '../../components/GPSAccuracyChip';
import GlassMapPanel from '../../components/GlassMapPanel';
import PremiumMapMarker from '../../components/PremiumMapMarker';
import { useMapStyle } from '../../hooks/useMapStyle';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

const GROWTH_GREEN = '#22C55E';
const ACTION_BLUE = '#3B82F6';
const ALERT_RED = '#EF4444';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Journey Tracking Screen
 *
 * Real-time journey tracking with live map visualization
 * - Full-screen background map showing user location and route
 * - Frosted glass status panel at top
 * - Collapsible slide-up details card at bottom for clean map view
 * - Live stats (Distance, Duration, Waypoints) and dynamic Pause/Resume
 */
export default function TrackingScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const mapStyle = useMapStyle();
  const { showAlert, showError, showOptions } = useAlert();
  const insets = useSafeAreaInsets();
  const {
    initialized,
    isTracking,
    isPaused,
    journey,
    polyline,
    distance,
    duration,
    accuracy,
    currentCoordinate,
    pauseJourneyRecording,
    resumeJourneyRecording,
    stopJourneyRecording,
  } = useJourney();

  const [mapReady, setMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [bgPermissionGranted, setBgPermissionGranted] = useState(true);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  
  const webViewRef = React.useRef<any>(null);
  const [webViewMapReady, setWebViewMapReady] = useState(false);

  // Compute initial map center once when tracking screen is loaded to prevent map shifting/reloads
  const initialMapCenter = useMemo(() => {
    if (polyline.length > 0) {
      return { latitude: polyline[0].latitude, longitude: polyline[0].longitude };
    }
    if (currentCoordinate) {
      return { latitude: currentCoordinate.latitude, longitude: currentCoordinate.longitude };
    }
    return { latitude: 12.9716, longitude: 77.5946 }; // Default fallback (e.g. Bangalore)
  }, []);

  // Set when the user intentionally ends — prevents the redirect
  // effect from competing with the deliberate navigation.
  const isNavigatingAwayRef = React.useRef(false);

  // Bottom Sheet animation states
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const sheetAnim = React.useRef(new Animated.Value(340)).current; // starts collapsed (translated down)

  const toggleBottomSheet = (expand: boolean) => {
    setIsSheetExpanded(expand);
    Animated.spring(sheetAnim, {
      toValue: expand ? 0 : 340,
      useNativeDriver: true,
      tension: 60,
      friction: 9,
    }).start();
  };

  // Auto-expand sheet when tracking is paused to highlight actions
  useEffect(() => {
    if (isPaused) {
      toggleBottomSheet(true);
    }
  }, [isPaused]);

  // Monitor background location permission status
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const checkBgPermissions = async () => {
      try {
        const { status } = await Location.getBackgroundPermissionsAsync();
        setBgPermissionGranted(status === 'granted');
      } catch (e) {
        // Safe fallback
      }
    };
    checkBgPermissions();
    // Recheck status whenever app state changes back to active (foreground)
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkBgPermissions();
      }
    });
    return () => subscription.remove();
  }, []);

  // Prefer the live GPS reading from the hook over the polyline tail
  const currentLocation = useMemo(() => {
    if (currentCoordinate) {
      return { latitude: currentCoordinate.latitude, longitude: currentCoordinate.longitude };
    }
    if (polyline.length === 0) return null;
    const last = polyline[polyline.length - 1];
    return { latitude: last.latitude, longitude: last.longitude };
  }, [currentCoordinate, polyline]);

  // Dynamic map path updates for WebView fallback (prevents page reloading on every coordinate update)
  useEffect(() => {
    if (useWebViewFallback && webViewMapReady && webViewRef.current) {
      const polyCoords = JSON.stringify(
        polyline
          .filter((p) => p.latitude && p.longitude)
          .map((p) => ({ lat: p.latitude, lng: p.longitude, timestamp: p.timestamp, segmentBreak: p.segmentBreak }))
      );
      const lat = currentLocation ? currentLocation.latitude : 'null';
      const lng = currentLocation ? currentLocation.longitude : 'null';
      const jsCode = `if (typeof window.updateMapData === 'function') { window.updateMapData(${polyCoords}, ${lat}, ${lng}); }`;
      webViewRef.current.injectJavaScript(jsCode);
    }
  }, [polyline, currentLocation, webViewMapReady]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    if (isTracking && !isPaused) {
      loop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => loop.stop();
  }, [isTracking, isPaused, pulseAnim]);

  // Redirect to home if no journey (only after hook has initialized).
  // Skip when the user intentionally stopped — the handler navigates
  // deliberately and a competing router.replace would crash the app.
  useEffect(() => {
    if (initialized && !isTracking && !isNavigatingAwayRef.current) {
      router.replace('/navigate');
    }
  }, [initialized, isTracking, router]);

  const handlePauseJourney = async () => {
    try {
      setIsLoading(true);
      await pauseJourneyRecording();
      showAlert('Journey paused', 'Tracking suspended. You can resume anytime.');
    } catch (err: any) {
      showAlert('Failed to pause journey', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeJourney = async () => {
    try {
      setIsLoading(true);
      await resumeJourneyRecording();
      showAlert('Journey resumed', 'Tracking has started again');
      // Collapse bottom sheet after resume to let map take focus
      toggleBottomSheet(false);
    } catch (err: any) {
      showAlert('Failed to resume journey', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopJourney = () => {
    showOptions(
      'End Journey?',
      [
        {
          text: 'Save Raw GPS Path',
          onPress: async () => {
            try {
              setIsLoading(true);
              await stopJourneyRecording({ snapToRoads: false });
              isNavigatingAwayRef.current = true;
              router.push('/navigate/complete');
            } catch (err: any) {
              showError(err.message || 'Unknown error', 'Failed to end journey');
            } finally {
              setIsLoading(false);
            }
          },
        },
        {
          text: 'Snap to Roads & Save',
          onPress: async () => {
            try {
              setIsLoading(true);
              await stopJourneyRecording({ snapToRoads: true });
              isNavigatingAwayRef.current = true;
              router.push('/navigate/complete');
            } catch (err: any) {
              showError(err.message || 'Unknown error', 'Failed to end journey');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
      'This will complete your current journey. Choose how you want to save the path:',
      true,
      'Cancel'
    );
  };

  const openJourneyCapture = (type: 'photo' | 'short') => {
    router.push({
      pathname: '/(tabs)/post',
      params: {
        journeyCapture: 'true',
        postType: type,
        source: 'journey',
      },
    });
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Background Map View spanning full height */}
      {initialRegion && (
        <View style={styles.mapContainer}>
          {useWebViewFallback ? (() => {
            const WV_KEY = getGoogleMapsApiKeyForWebView();
            if (!WV_KEY) return <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' }]}><Ionicons name="map-outline" size={48} color="#9CA3AF" /></View>;
            const polyCoords = JSON.stringify(polyline.filter(p => p.latitude && p.longitude).map(p => ({ lat: p.latitude, lng: p.longitude, timestamp: p.timestamp, segmentBreak: p.segmentBreak })));
            const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>
html,body,#map{height:100%;margin:0;padding:0}
.glowing-dot-container {
  position: relative;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pulse-ring {
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: radial-gradient(circle, ${isDark ? 'rgba(45, 212, 191, 0.4)' : 'rgba(59, 130, 246, 0.4)'} 0%, rgba(59, 130, 246, 0) 70%);
  animation: pulse 1.8s infinite ease-out;
}
.core-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2DD4BF 0%, #3B82F6 100%);
  border: 1.5px solid #FFFFFF;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
}
@keyframes pulse {
  0% { transform: scale(0.6); opacity: 1; }
  100% { transform: scale(2.2); opacity: 0; }
}
</style>
<script>
var map;
var polylines = [];
var userMarker = null;
var PhotoOverlay;

function initMap(){
  PhotoOverlay = class extends google.maps.OverlayView {
    constructor(pos, el) {
      super();
      this.position = pos;
      this.div = el;
      this.setMap(map);
    }
    onAdd() {
      this.getPanes().overlayMouseTarget.appendChild(this.div);
    }
    draw() {
      var pt = this.getProjection().fromLatLngToDivPixel(this.position);
      if (pt) {
        this.div.style.left = pt.x + 'px';
        this.div.style.top = pt.y + 'px';
        this.div.style.position = 'absolute';
        this.div.style.transform = 'translate(-50%,-50%)';
      }
    }
    onRemove() {
      if (this.div && this.div.parentNode) {
        this.div.parentNode.removeChild(this.div);
      }
    }
  };

  map=new google.maps.Map(document.getElementById('map'),{
    center:{lat:${initialMapCenter.latitude},lng:${initialMapCenter.longitude}},
    zoom:15,
    mapTypeId:'roadmap',
    styles:${JSON.stringify(mapStyle.customMapStyle)},
    disableDefaultUI:true,
    zoomControl:true
  });

  if (window.initialUpdateData) {
    window.initialUpdateData();
  }
}

window.updateMapData = function(path, currentLat, currentLng) {
  if (!map) {
    window.initialUpdateData = function() {
      window.updateMapData(path, currentLat, currentLng);
    };
    return;
  }

  polylines.forEach(function(p) { p.setMap(null); });
  polylines = [];

  if(path && path.length>1){
    var segments = [];
    var currentSegment = [];
    for(var i=0; i<path.length; i++){
      var p = path[i];
      if(currentSegment.length === 0){
        currentSegment.push(p);
      } else {
        var prev = currentSegment[currentSegment.length-1];
        var timeDiff = (p.timestamp && prev.timestamp) ? (p.timestamp - prev.timestamp)/1000 : 0;
        if(p.segmentBreak || timeDiff > 60){
          segments.push(currentSegment);
          currentSegment = [p];
        } else {
          currentSegment.push(p);
        }
      }
    }
    if(currentSegment.length > 0) segments.push(currentSegment);
    segments.forEach(function(seg){
      if(seg.length > 1){
        var glow = new google.maps.Polyline({path:seg,geodesic:true,strokeColor:'${mapStyle.routeGlowColor}',strokeOpacity:1.0,strokeWeight:14,map:map});
        var core = new google.maps.Polyline({path:seg,geodesic:true,strokeColor:'${mapStyle.routeColor}',strokeOpacity:1.0,strokeWeight:5,map:map});
        polylines.push(glow);
        polylines.push(core);
      }
    });
  }

  if (currentLat && currentLng) {
    var latLng = new google.maps.LatLng(currentLat, currentLng);
    if (userMarker) {
      userMarker.position = latLng;
      userMarker.draw();
    } else {
      var userDiv = document.createElement('div');
      userDiv.style.cssText = 'position:absolute;cursor:pointer;display:flex;align-items:center;justify-content:center;';
      userDiv.innerHTML = '<div class="glowing-dot-container"><div class="pulse-ring"></div><div class="core-dot"></div></div>';
      userMarker = new PhotoOverlay(latLng, userDiv);
    }
    map.panTo(latLng);
  }
}
</script></head><body><div id="map"></div>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${WV_KEY}&language=en&callback=initMap"></script></body></html>`;
            return (
              <WebView
                ref={webViewRef}
                style={styles.map}
                source={{ html }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={['https://*', 'http://*', 'data:*', 'about:*']}
                onShouldStartLoadWithRequest={(req) => req.url.startsWith('http') || req.url.startsWith('data:') || req.url.startsWith('about:')}
                onLoadEnd={() => setWebViewMapReady(true)}
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
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              onMapReady={() => setMapReady(true)}
              showsUserLocation={true}
              followsUserLocation={true}
              zoomEnabled={true}
              scrollEnabled={true}
              mapType={mapStyle.mapType}
            >
              {polyline.length > 1 && (
                <PolylineRenderer
                  coordinates={polyline}
                  color={mapStyle.routeColor}
                  glowColor={mapStyle.routeGlowColor}
                  strokeWidth={4}
                  simplifyDistance={5}
                  applyKalman={false}
                />
              )}
              {currentLocation && Marker && (
                <Marker coordinate={currentLocation} title="Current Location" anchor={{ x: 0.5, y: 0.5 }}>
                  <PremiumMapMarker icon="navigate" active />
                </Marker>
              )}
            </MapView>
          ) : (
            <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' }]}>
              <Ionicons name="map-outline" size={48} color="#9CA3AF" />
            </View>
          )}
        </View>
      )}

      {/* Floating Top Frosted Glass Status Panel */}
      <View 
        style={[
          styles.topPanel, 
          { 
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top,
            marginTop: 0,
            marginHorizontal: 0,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(28, 115, 180, 0.15)',
            borderWidth: 0,
            borderBottomWidth: 1,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.3 : 0.1,
            shadowRadius: 10,
            elevation: 4,
            overflow: 'hidden',
          }
        ]}
      >
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
        
        {/* Main Status Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
          <TouchableOpacity
            style={[styles.minimizeButton, { backgroundColor: theme.colors.background }]}
            onPress={() => router.push('/(tabs)/home')}
            accessibilityLabel="Minimize tracking map"
          >
            <Ionicons name="chevron-down" size={22} color={theme.colors.text} />
          </TouchableOpacity>

          <View style={styles.topBarDivider} />

          <View style={styles.topStatusInfo}>
            <View style={styles.recordingStatusRow}>
              <Animated.View
                style={[
                  styles.recordingDot,
                  {
                    backgroundColor: isPaused ? ACTION_BLUE : ALERT_RED,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />
              <Text style={[styles.recordingText, { color: isPaused ? ACTION_BLUE : ALERT_RED }]}>
                {isPaused ? 'Paused' : 'Recording'}
              </Text>
              <Text style={[styles.topTimer, { color: theme.colors.text }]}>
                {formatDuration()}
              </Text>
            </View>
            <Text style={[styles.journeyTitleSub, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {journey?.title || 'Active Journey'}
            </Text>
          </View>
        </View>

        {/* Nested warning banner inside card */}
        {!bgPermissionGranted && (
          <View style={[
            styles.warningBanner,
            { 
              position: 'relative', 
              top: 0, 
              left: 0, 
              right: 0,
              borderWidth: 0,
              borderTopWidth: 1,
              borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              borderRadius: 0,
              backgroundColor: 'rgba(217, 119, 6, 0.1)',
              paddingHorizontal: 12,
              paddingVertical: 8,
            }
          ]}>
            <Ionicons name="warning" size={16} color="#D97706" />
            <Text style={styles.warningText}>
              Background location disabled. Select "Always Allow" in Settings to track route in background.
            </Text>
          </View>
        )}
      </View>

      {/* Collapsed Handle Up-Arrow Button */}
      {!isSheetExpanded && (
        <TouchableOpacity
          style={[
            styles.upArrowButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={() => toggleBottomSheet(true)}
          activeOpacity={0.85}
          accessibilityLabel="Expand details bottom sheet"
        >
          <Ionicons name="chevron-up" size={18} color={theme.colors.text} />
          <Text style={[styles.upArrowText, { color: theme.colors.text }]}>View Details</Text>
        </TouchableOpacity>
      )}

      {/* GPS Accuracy Chip (only visible when bottom sheet is collapsed) */}
      {!isSheetExpanded && (
        <GPSAccuracyChip accuracy={accuracy} />
      )}

      {/* Sliding Bottom Sheet Details Card */}
      <Animated.View
        style={[
          styles.bottomSheetContainer,
          {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 16 : 20),
            transform: [{ translateY: sheetAnim }],
          },
        ]}
      >
        {/* Down Arrow Dismiss Handle */}
        <TouchableOpacity
          style={styles.downArrowButton}
          onPress={() => toggleBottomSheet(false)}
          accessibilityLabel="Collapse details bottom sheet"
        >
          <Ionicons name="chevron-down" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <View style={[styles.statIconContainer, { backgroundColor: GROWTH_GREEN + '15' }]}>
              <Ionicons name="navigate" size={18} color={GROWTH_GREEN} />
            </View>
            <Text style={[styles.statVal, { color: theme.colors.text }]}>{formatDistance()}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Distance</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={[styles.statIconContainer, { backgroundColor: ACTION_BLUE + '15' }]}>
              <Ionicons name="time" size={18} color={ACTION_BLUE} />
            </View>
            <Text style={[styles.statVal, { color: theme.colors.text }]}>{formatDuration()}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Duration</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={[styles.statIconContainer, { backgroundColor: ALERT_RED + '15' }]}>
              <Ionicons name="camera" size={18} color={ALERT_RED} />
            </View>
            <Text style={[styles.statVal, { color: theme.colors.text }]}>{journey?.waypoints?.length || 0}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Waypoints</Text>
          </View>
        </View>

        {/* Action Controls Row */}
        <View style={styles.controlsRow}>
          {isPaused ? (
            <TouchableOpacity
              style={[styles.controlBtn, { backgroundColor: GROWTH_GREEN }]}
              onPress={handleResumeJourney}
              disabled={isLoading}
              accessibilityLabel="Resume journey"
            >
              <Ionicons name="play" size={18} color="white" />
              <Text style={styles.controlBtnText}>Resume</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.controlBtn, { backgroundColor: ACTION_BLUE }]}
              onPress={handlePauseJourney}
              disabled={isLoading}
              accessibilityLabel="Pause journey"
            >
              <Ionicons name="pause" size={18} color="white" />
              <Text style={styles.controlBtnText}>Pause</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: ALERT_RED }]}
            onPress={handleStopJourney}
            disabled={isLoading}
            accessibilityLabel="Stop and complete journey"
          >
            <Ionicons name="stop" size={18} color="white" />
            <Text style={styles.controlBtnText}>End Journey</Text>
          </TouchableOpacity>
        </View>

        {/* Capture Panel Buttons */}
        <View style={styles.sheetCapturePanel}>
          <TouchableOpacity
            style={[styles.sheetCaptureBtn, { borderColor: ACTION_BLUE }]}
            onPress={() => openJourneyCapture('photo')}
            accessibilityLabel="Post photo waypoint"
          >
            <Ionicons name="camera" size={16} color={ACTION_BLUE} />
            <Text style={[styles.sheetCaptureText, { color: ACTION_BLUE }]}>Post Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sheetCaptureBtn, { borderColor: ALERT_RED }]}
            onPress={() => openJourneyCapture('short')}
            accessibilityLabel="Post reel waypoint"
          >
            <Ionicons name="videocam" size={16} color={ALERT_RED} />
            <Text style={[styles.sheetCaptureText, { color: ALERT_RED }]}>Post a Reel</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <LoadingGlobe size="large" color={GROWTH_GREEN} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  topPanel: {
    position: 'absolute',
    zIndex: 100,
  },
  minimizeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  topBarDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: 12,
  },
  topStatusInfo: {
    flex: 1,
  },
  recordingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingText: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 6,
  },
  topTimer: {
    fontSize: 13,
    fontWeight: '600',
  },
  journeyTitleSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  warningBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.2)',
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
    lineHeight: 16,
  },
  upArrowButton: {
    position: 'absolute',
    bottom: 80, // Sit nicely above the GPSAccuracyChip
    alignSelf: 'center',
    zIndex: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  upArrowText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bottomSheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  downArrowButton: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  controlBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  controlBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  sheetCapturePanel: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetCaptureBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  sheetCaptureText: {
    fontSize: 13,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});
