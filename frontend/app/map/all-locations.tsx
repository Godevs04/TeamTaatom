import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  TextInput,
  Modal,
  Animated,
  Alert,
  FlatList,
  Dimensions,
  ScrollView,
  Keyboard,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as ExpoLocation from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { useJourney } from '../../context/JourneyContext';
import { MapView, Marker, getMapProvider, useWebViewFallback } from '../../utils/mapsWrapper';
import PolylineRenderer from '../../components/PolylineRenderer';
import GlassMapPanel from '../../components/GlassMapPanel';
import PremiumMapMarker from '../../components/PremiumMapMarker';
import { getTravelMapData } from '../../services/profile';
import { getUserJourneys } from '../../services/journey';
import { getGoogleMapsApiKeyForWebView } from '../../utils/maps';
import { getApiUrl } from '../../utils/config';
import { useMapStyle } from '../../hooks/useMapStyle';
import logger from '../../utils/logger';
import { ErrorBoundary } from '../../utils/errorBoundary';
import {
  isValidMapCoordinate,
  sanitizeLatitudeDelta,
  sanitizeMapRegion,
} from '../../utils/mapSafety';
const GROWTH_GREEN = '#22C55E';
const ALERT_RED = '#EF4444';
const ACTION_BLUE = '#3B82F6';
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isAndroid = Platform.OS === 'android';


function safeDecodeUriComponent(value: string | string[] | undefined): string | null {
  if (value == null) return null;
  const str = Array.isArray(value) ? value[0] : value;
  if (typeof str !== 'string' || !str) return null;
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

const resolvePhotoUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return getApiUrl(cleanPath);
};

interface LocationPin {
  number: number;
  latitude: number;
  longitude: number;
  address: string;
  date: string;
  photo?: string;
  postId?: string;
  contentType?: string;
}

interface JourneyPolyline {
  _id: string;
  title: string;
  polyline: Array<{ lat: number; lng: number; timestamp?: string }>;
  sessions?: Array<{ startedAt: string; stoppedAt?: string }>;
  startCoords: { lat: number; lng: number };
  endCoords: { lat: number; lng: number };
  distanceTraveled: number;
  startedAt: string;
  completedAt: string;
  waypoints: any[];
  // Resolved city names (set on frontend after reverse geocoding)
  startCity?: string;
  endCity?: string;
}

function getJourneyPolylineCoords(journey: JourneyPolyline) {
  const sessionStarts = (journey.sessions || [])
    .slice(1)
    .map((session) => new Date(session.startedAt).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);

  const sortedPolyline = [...(journey.polyline || [])].sort((a, b) => {
    const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tA - tB;
  });

  return sortedPolyline.map((point, index, points) => {
    const timestamp = point.timestamp ? new Date(point.timestamp).getTime() : undefined;
    const prevTimestamp = index > 0 && points[index - 1].timestamp
      ? new Date(points[index - 1].timestamp).getTime()
      : undefined;
    const segmentBreak = !!timestamp && !!prevTimestamp &&
      sessionStarts.some((start) => start > prevTimestamp && start <= timestamp);

    return {
      latitude: point.lat,
      longitude: point.lng,
      timestamp,
      segmentBreak,
    };
  }).filter(isValidMapCoordinate);
}

interface OptimizedMarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  onPress: () => void;
  isActive: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  activeTitle?: string;
  activeSubtitle?: string;
  photo?: string;
  onImageLoad?: () => void;
  latitudeDelta?: number;
}

const OptimizedMarker = React.memo(({
  coordinate,
  title,
  description,
  onPress,
  isActive,
  icon = 'location',
  label = '',
  activeTitle,
  activeSubtitle,
  photo,
  onImageLoad,
  latitudeDelta
}: OptimizedMarkerProps) => {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  const handleImageLoad = useCallback(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      if (!isActive) {
        setTracksViewChanges(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      setTracksViewChanges(true);
    } else {
      const timer = setTimeout(() => {
        setTracksViewChanges(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  return (
    <Marker
      coordinate={coordinate}
      title={title}
      description={description}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 1.0 }}
    >
      <PremiumMapMarker
        icon={icon}
        isActive={isActive}
        label={label}
        activeTitle={activeTitle}
        activeSubtitle={activeSubtitle}
        photo={photo}
        onImageLoad={handleImageLoad}
        latitudeDelta={latitudeDelta}
      />
    </Marker>
  );
}, (prev, next) => {
  return (
    prev.isActive === next.isActive &&
    prev.coordinate.latitude === next.coordinate.latitude &&
    prev.coordinate.longitude === next.coordinate.longitude &&
    prev.title === next.title &&
    prev.description === next.description &&
    prev.icon === next.icon &&
    prev.label === next.label &&
    prev.activeTitle === next.activeTitle &&
    prev.activeSubtitle === next.activeSubtitle &&
    prev.photo === next.photo &&
    prev.latitudeDelta === next.latitudeDelta
  );
});

interface OptimizedClusterMarkerProps {
  cluster: any;
  onPress: () => void;
  isDark: boolean;
  photoUrl?: string;
  resolvePhotoUrl: (url?: string) => string | undefined;
}

const OptimizedClusterMarker = React.memo(({
  cluster,
  onPress,
  isDark,
  photoUrl,
  resolvePhotoUrl
}: OptimizedClusterMarkerProps) => {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  const handleImageLoad = useCallback(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      setTracksViewChanges(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      setTracksViewChanges(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [photoUrl]);

  return (
    <Marker
      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={markerStyles.clusterContainer}>
        <View style={markerStyles.clusterGlow}>
          <LinearGradient
            colors={isDark ? ['rgba(45, 212, 191, 0.4)', 'rgba(59, 130, 246, 0.4)'] : ['rgba(59, 130, 246, 0.3)', 'rgba(45, 212, 191, 0.3)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 20 }]}
          />
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={markerStyles.clusterBlur}>
              <LinearGradient
                colors={isDark ? ['rgba(15, 23, 42, 0.75)', 'rgba(30, 41, 59, 0.75)'] : ['rgba(255, 255, 255, 0.85)', 'rgba(241, 245, 249, 0.85)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[markerStyles.clusterContent, { borderRadius: 18.5 }]}
              >
                {photoUrl ? (
                  <ExpoImage
                    source={{ uri: resolvePhotoUrl(photoUrl) }}
                    style={markerStyles.clusterPhoto}
                    contentFit="cover"
                    onLoad={handleImageLoad}
                  />
                ) : (
                  <Ionicons name="location" size={16} color={isDark ? '#2DD4BF' : '#3B82F6'} />
                )}
              </LinearGradient>
            </BlurView>
          ) : (
            <View style={[markerStyles.clusterBlur, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
              <LinearGradient
                colors={isDark ? ['#0F172A', '#1E293B'] : ['#FFFFFF', '#F1F5F9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[markerStyles.clusterContent, { borderRadius: 18.5 }]}
              >
                {photoUrl ? (
                  <ExpoImage
                    source={{ uri: resolvePhotoUrl(photoUrl) }}
                    style={markerStyles.clusterPhoto}
                    contentFit="cover"
                    onLoad={handleImageLoad}
                  />
                ) : (
                  <Ionicons name="location" size={16} color={isDark ? '#2DD4BF' : '#3B82F6'} />
                )}
              </LinearGradient>
            </View>
          )}
        </View>
      </View>
    </Marker>
  );
}, (prev, next) => {
  return (
    prev.isDark === next.isDark &&
    prev.cluster.id === next.cluster.id &&
    prev.cluster.latitude === next.cluster.latitude &&
    prev.cluster.longitude === next.cluster.longitude &&
    prev.photoUrl === next.photoUrl
  );
});

function AllLocationsMapInner() {
  const [locations, setLocations] = useState<LocationPin[]>([]);
  const [journeys, setJourneys] = useState<JourneyPolyline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapFilter, setMapFilter] = useState<'posts' | 'journeys'>('posts');
  const [selectedLocation, setSelectedLocation] = useState<LocationPin | null>(null);
  const [renderedLocation, setRenderedLocation] = useState<LocationPin | null>(null);
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (selectedLocation) {
      setRenderedLocation(selectedLocation);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setRenderedLocation(null);
      });
    }
  }, [selectedLocation]);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [currentCountry, setCurrentCountry] = useState<string | null>(null);
  const [currentCountryCode, setCurrentCountryCode] = useState<string | null>(null);
  const [currentRegion, setCurrentRegion] = useState<any>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const [statistics, setStatistics] = useState<{
    totalLocations: number;
    totalDistance: number;
    totalDays: number;
  } | null>(null);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(140);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Helper to convert country code to flag emoji
  const getFlagEmoji = (countryCode: string) => {
    if (!countryCode) return '📍';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    try {
      return String.fromCodePoint(...codePoints);
    } catch {
      return '📍';
    }
  };

  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [headerCardHeight, setHeaderCardHeight] = useState(180);
  const { theme, mode, isDark } = useTheme();
  const mapStyle = useMapStyle();
  const { showAlert, showError, showSuccess, showDestructiveConfirm } = useAlert();

  const recenterOnUser = async () => {
    try {
      const currentPerm = await ExpoLocation.getForegroundPermissionsAsync();
      let status = currentPerm.status;
      if (status === 'undetermined') {
        const requested = await ExpoLocation.requestForegroundPermissionsAsync();
        status = requested.status;
      }
      if (status !== 'granted') {
        showError('Location permission is required to center on your location.', 'Permission Denied');
        return;
      }
      const loc = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      if (loc.coords && mapRef.current) {
        if (useWebViewFallback) {
          mapRef.current.injectJavaScript(`
            if (window.map) {
              window.map.panTo({ lat: ${loc.coords.latitude}, lng: ${loc.coords.longitude} });
              window.map.setZoom(14);
            }
            true;
          `);
        } else {
          mapRef.current.animateToRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }, 400);
        }
      }
    } catch (err) {
      logger.error('Failed to get current location for recenter:', err);
    }
  };

  const zoomIn = async () => {
    if (!mapRef.current) return;
    if (useWebViewFallback) {
      mapRef.current.injectJavaScript(`
        if (window.map) {
          var currentZoom = window.map.getZoom();
          window.map.setZoom(currentZoom + 1);
        }
        true;
      `);
      return;
    }
    try {
      const camera = await mapRef.current.getCamera();
      if (camera) {
        camera.zoom = (camera.zoom || 10) + 1;
        mapRef.current.animateCamera(camera, { duration: 300 });
      }
    } catch (err) {
      if (currentRegion) {
        const safeRegion = sanitizeMapRegion({
          ...currentRegion,
          latitudeDelta: currentRegion.latitudeDelta / 2,
          longitudeDelta: currentRegion.longitudeDelta / 2,
        }, currentRegion);
        if (safeRegion) {
          mapRef.current.animateToRegion(safeRegion, 300);
        }
      }
    }
  };

  const zoomOut = async () => {
    if (!mapRef.current) return;
    if (useWebViewFallback) {
      mapRef.current.injectJavaScript(`
        if (window.map) {
          var currentZoom = window.map.getZoom();
          window.map.setZoom(currentZoom - 1);
        }
        true;
      `);
      return;
    }
    try {
      const camera = await mapRef.current.getCamera();
      if (camera) {
        camera.zoom = (camera.zoom || 10) - 1;
        mapRef.current.animateCamera(camera, { duration: 300 });
      }
    } catch (err) {
      if (currentRegion) {
        const safeRegion = sanitizeMapRegion({
          ...currentRegion,
          latitudeDelta: currentRegion.latitudeDelta * 2,
          longitudeDelta: currentRegion.longitudeDelta * 2,
        }, currentRegion);
        if (safeRegion) {
          mapRef.current.animateToRegion(safeRegion, 300);
        }
      }
    }
  };
  const rawUserId = params.userId;
  const userId = typeof rawUserId === 'string' ? rawUserId : Array.isArray(rawUserId) ? rawUserId[0] : undefined;
  const displayName = safeDecodeUriComponent(params.userName as string | string[] | undefined);
  const headerTitle = displayName ? `${displayName}'s Locations` : 'My Locations';
  const mapRef = useRef<any>(null);
  const WEBVIEW_API_KEY = getGoogleMapsApiKeyForWebView();

  const getLocationMarkerId = useCallback((loc: LocationPin) => (
    loc.postId ? `post-${loc.postId}` : `location-${loc.number}`
  ), []);

  const validLocations = useMemo(() => {
    return locations
      .filter(
        (loc) => isValidMapCoordinate({ latitude: loc.latitude, longitude: loc.longitude }) &&
          loc.latitude !== 0 &&
          loc.longitude !== 0
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [locations]);

  const clusteredLocations = useMemo(() => {
    const latDelta = sanitizeLatitudeDelta(currentRegion?.latitudeDelta, 0.1);
    
    const dedupedLocations: LocationPin[] = [];
    const seenCoords = new Set<string>();
    validLocations.forEach((m) => {
      const key = `${m.latitude.toFixed(4)},${m.longitude.toFixed(4)}`;
      if (!seenCoords.has(key)) {
        seenCoords.add(key);
        dedupedLocations.push(m);
      }
    });

    if (!latDelta || latDelta < 0.05 || dedupedLocations.length < 5) {
      return dedupedLocations.map(loc => ({
        id: `single-${loc.postId || loc.number}`,
        isCluster: false,
        latitude: loc.latitude,
        longitude: loc.longitude,
        location: loc,
        locations: [loc],
      }));
    }

    const gridSize = Math.max(latDelta / 8.0, 0.0001);
    const grid: { [key: string]: LocationPin[] } = {};

    dedupedLocations.forEach((loc) => {
      const gridX = Math.floor(loc.longitude / gridSize);
      const gridY = Math.floor(loc.latitude / gridSize);
      const key = `${gridX},${gridY}`;
      if (!grid[key]) {
        grid[key] = [];
      }
      grid[key].push(loc);
    });

    return Object.keys(grid).map((key) => {
      const group = grid[key];
      if (group.length === 1) {
        return {
          id: `single-${group[0].postId || group[0].number}`,
          isCluster: false,
          latitude: group[0].latitude,
          longitude: group[0].longitude,
          location: group[0],
          locations: group,
        };
      }

      let sumLat = 0;
      let sumLng = 0;
      group.forEach((loc) => {
        sumLat += loc.latitude;
        sumLng += loc.longitude;
      });

      return {
        id: `cluster-${key}`,
        isCluster: true,
        latitude: sumLat / group.length,
        longitude: sumLng / group.length,
        locations: group,
      };
    });
  }, [validLocations, currentRegion]);

  const handleClusterPress = useCallback((cluster: any) => {
    if (!mapRef.current || useWebViewFallback) return;
    try {
      const coords = cluster.locations.map((loc: any) => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
      }));
      if (typeof mapRef.current.fitToCoordinates === 'function') {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
          animated: true,
        });
      }
    } catch (err) {
      logger.error('Error fitting to cluster coordinates:', err);
    }
  }, [useWebViewFallback]);

  const handleRegionChangeComplete = useCallback((newRegion: any) => {
    const safeRegion = sanitizeMapRegion(newRegion, currentRegion ?? undefined);
    if (!safeRegion) return;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      setCurrentRegion(safeRegion);
    }, 200);
  }, [currentRegion]);

  const carouselRef = useRef<FlatList>(null);
  const isScrollingCarouselRef = useRef(false);

  const centerMapOnLocation = useCallback((latitude: number, longitude: number) => {
    if (!mapRef.current) return;
    try {
      if (useWebViewFallback) {
        mapRef.current.injectJavaScript(`
          if (window.map) {
            window.map.panTo({ lat: ${latitude}, lng: ${longitude} });
            window.map.setZoom(15);
          }
          true;
        `);
      } else {
        if (typeof mapRef.current.animateToRegion === 'function') {
          mapRef.current.animateToRegion(
            {
              latitude,
              longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            },
            400
          );
        }
      }
    } catch (err) {
      logger.error('Error centering map on location:', err);
    }
  }, [useWebViewFallback]);

  const getCarouselItemLayout = useCallback((data: any, index: number) => ({
    length: screenWidth,
    offset: screenWidth * index,
    index,
  }), []);

  const handleCarouselScroll = useCallback((event: any) => {
    if (!isScrollingCarouselRef.current) return;
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / screenWidth);
    if (index >= 0 && index < validLocations.length) {
      const nextLocation = validLocations[index];
      if (selectedLocation?.number !== nextLocation.number || selectedLocation?.postId !== nextLocation.postId) {
        setSelectedLocation(nextLocation);
        setSelectedMarkerId(getLocationMarkerId(nextLocation));
        centerMapOnLocation(nextLocation.latitude, nextLocation.longitude);
      }
    }
  }, [validLocations, selectedLocation, centerMapOnLocation, getLocationMarkerId]);

  useEffect(() => {
    if (selectedLocation && !isScrollingCarouselRef.current) {
      const index = validLocations.findIndex(
        (loc) => loc.postId === selectedLocation.postId || loc.number === selectedLocation.number
      );
      if (index !== -1 && carouselRef.current) {
        setTimeout(() => {
          try {
            carouselRef.current?.scrollToIndex({
              index,
              animated: true,
            });
          } catch (err) {
            logger.warn('Failed to scroll carousel to index:', err);
          }
        }, 50);
      }
      centerMapOnLocation(selectedLocation.latitude, selectedLocation.longitude);
    }
  }, [selectedLocation, validLocations, centerMapOnLocation]);

  // Journey tracking — moved here from /map/current-location so the start /
  // active / paused controls live with the rest of the user's travel data
  // (past journeys, posts, stats).
  const {
    isTracking,
    isPaused,
    distance: journeyDistance,
    duration: journeyDuration,
    startJourneyRecording,
    pauseJourneyRecording,
    resumeJourneyRecording,
    stopJourneyRecording,
  } = useJourney();
  const [journeyTitleInput, setJourneyTitleInput] = useState('');
  const [showJourneyTitle, setShowJourneyTitle] = useState(false);
  const [journeyActionLoading, setJourneyActionLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructionCountdown, setInstructionCountdown] = useState(10);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

  // Live accuracy: separate from `currentCountry` because we want to refresh
  // it more often than once-on-mount. Only own-page (no userId mismatch).
  const isOwnPage = !displayName; // displayName only set when viewing someone else's
  const [deviceAccuracy, setDeviceAccuracy] = useState<number | null>(null);

  useEffect(() => {
    if (!isOwnPage) return;
    let cancelled = false;
    (async () => {
      try {
        const currentPerm = await ExpoLocation.getForegroundPermissionsAsync();
        let status = currentPerm.status;
        if (status === 'undetermined') {
          const requested = await ExpoLocation.requestForegroundPermissionsAsync();
          status = requested.status;
        }
        if (status !== 'granted' || cancelled) return;
        const loc = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
        });
        if (!cancelled && loc.coords?.accuracy && loc.coords.accuracy > 0) {
          setDeviceAccuracy(loc.coords.accuracy);
        }
      } catch {
        // Silent — accuracy chip is optional context, not critical.
      }
    })();
    return () => { cancelled = true; };
  }, [isOwnPage]);

  const formatJourneyDistance = () => {
    if (journeyDistance < 1000) return `${Math.round(journeyDistance)} m`;
    return `${(journeyDistance / 1000).toFixed(1)} km`;
  };

  const formatJourneyDuration = () => {
    const h = Math.floor(journeyDuration / 3600);
    const m = Math.floor((journeyDuration % 3600) / 60);
    const s = journeyDuration % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const handleStartJourney = async () => {
    try {
      setJourneyActionLoading(true);
      const countStr = await AsyncStorage.getItem('journeyStartCount');
      const count = countStr ? parseInt(countStr, 10) : 0;
      await AsyncStorage.setItem('journeyStartCount', String(count + 1));
      await startJourneyRecording(journeyTitleInput || undefined);
      setJourneyTitleInput('');
      setShowJourneyTitle(false);
    } catch (err: any) {
      showAlert('Failed to start journey', err?.message || 'Unknown error');
    } finally {
      setJourneyActionLoading(false);
    }
  };

  // Show instructions popup for the first 5 journeys.
  const handleStartPress = async () => {
    try {
      const countStr = await AsyncStorage.getItem('journeyStartCount');
      const count = countStr ? parseInt(countStr, 10) : 0;
      if (count < 5) {
        setInstructionCountdown(10);
        setShowInstructions(true);
        progressAnim.setValue(1);
        Animated.timing(progressAnim, {
          toValue: 0,
          duration: 10000,
          useNativeDriver: false,
        }).start();
        countdownRef.current = setInterval(() => {
          setInstructionCountdown((prev) => {
            if (prev <= 1) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        await handleStartJourney();
      }
    } catch {
      await handleStartJourney();
    }
  };

  const dismissInstructions = async () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    progressAnim.stopAnimation();
    setShowInstructions(false);
    await handleStartJourney();
  };

  // Auto-dismiss when countdown reaches 0
  useEffect(() => {
    if (showInstructions && instructionCountdown === 0) {
      const t = setTimeout(() => dismissInstructions(), 100);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructionCountdown, showInstructions]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handlePauseJourney = async () => {
    try {
      setJourneyActionLoading(true);
      await pauseJourneyRecording();
    } catch (err: any) {
      showAlert('Failed to pause', err?.message || 'Unknown error');
    } finally {
      setJourneyActionLoading(false);
    }
  };

  const handleResumeJourney = async () => {
    try {
      setJourneyActionLoading(true);
      await resumeJourneyRecording();
    } catch (err: any) {
      showAlert('Failed to resume', err?.message || 'Unknown error');
    } finally {
      setJourneyActionLoading(false);
    }
  };

  const handleStopJourney = async () => {
    try {
      setJourneyActionLoading(true);
      await stopJourneyRecording();
      showSuccess('Journey Saved!', 'Your journey has been saved successfully.');
      router.push('/navigate/complete');
    } catch (err: any) {
      showError(err?.message || 'Unknown error', 'Failed to end journey');
    } finally {
      setJourneyActionLoading(false);
    }
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

  // Get country/flag for header
  useEffect(() => {
    const detectCountry = async () => {
      try {
        let lat: number | null = null;
        let lng: number | null = null;

        // 1. Try to get device's live/last known location first (if viewing own page)
        if (isOwnPage) {
          try {
            const currentPerm = await ExpoLocation.getForegroundPermissionsAsync();
            let status = currentPerm.status;
            if (status === 'undetermined') {
              const requested = await ExpoLocation.requestForegroundPermissionsAsync();
              status = requested.status;
            }

            if (status === 'granted') {
              // Get last known location first ("last used of the app" - instant)
              const lastKnown = await ExpoLocation.getLastKnownPositionAsync();
              if (lastKnown) {
                lat = lastKnown.coords.latitude;
                lng = lastKnown.coords.longitude;
              } else {
                // Fallback to low accuracy current position
                const loc = await ExpoLocation.getCurrentPositionAsync({
                  accuracy: ExpoLocation.Accuracy.Low,
                });
                lat = loc.coords.latitude;
                lng = loc.coords.longitude;
              }
            }
          } catch (locErr) {
            logger.debug('[AllLocations] Live location check failed, using target location fallback:', locErr);
          }
        }

        // 2. Fall back to the first location in validLocations if live location is unavailable
        if ((lat === null || lng === null) && validLocations.length > 0) {
          lat = validLocations[0].latitude;
          lng = validLocations[0].longitude;
        }

        if (lat !== null && lng !== null) {
          const geocode = await ExpoLocation.reverseGeocodeAsync({
            latitude: lat,
            longitude: lng,
          });
          if (geocode.length > 0) {
            if (geocode[0].country) {
              setCurrentCountry(geocode[0].country);
            }
            if (geocode[0].isoCountryCode) {
              setCurrentCountryCode(geocode[0].isoCountryCode);
            }
          }
        }
      } catch (err) {
        logger.debug('[AllLocations] Country detection failed:', err);
      }
    };
    detectCountry();
  }, [validLocations.length, isOwnPage]);

  // Load locations + journeys
  useEffect(() => {
    const id = userId && String(userId).trim();
    if (id) {
      loadAllData(id);
    } else {
      setError('User ID is required');
      setLoading(false);
    }
  }, [userId]);

  const loadAllData = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch post locations and journey polylines in parallel
      const [travelMapResult, journeysResult] = await Promise.allSettled([
        getTravelMapData(id),
        getUserJourneys(id, 1, 50, true), // includePolyline = true
      ]);

      // Process post locations
      if (travelMapResult.status === 'fulfilled') {
        const response = travelMapResult.value;
        const fetchedLocations = response?.locations ?? [];
        setLocations(fetchedLocations);
        setStatistics(response?.statistics ?? null);

        // Auto-select first valid location if nothing is selected
        const validLocs = fetchedLocations.filter(
          (loc: any) => loc.latitude && loc.longitude && loc.latitude !== 0 && loc.longitude !== 0
        );
        if (validLocs.length > 0) {
          setSelectedLocation(validLocs[0]);
          setSelectedMarkerId(getLocationMarkerId(validLocs[0]));
        }
      }

      // Process journey polylines
      if (journeysResult.status === 'fulfilled') {
        const data = journeysResult.value;
        const rawJourneys = data?.journeys ?? [];
        // Filter journeys that have polyline data and sort reverse-chronologically
        const withPolylines = (rawJourneys.filter(
          (j: any) => j.polyline && j.polyline.length > 1
        ) as unknown as JourneyPolyline[]).sort(
          (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );
        setJourneys(withPolylines);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Cache for reverse geocoding results to avoid redundant API calls
  const geocodeCacheRef = useRef<Map<string, string>>(new Map());

  // Reverse geocode journey start/end coords to get city names
  useEffect(() => {
    if (journeys.length === 0) return;
    const cache = geocodeCacheRef.current;

    const geocode = async (lat: number, lng: number): Promise<string> => {
      const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
      if (cache.has(key)) return cache.get(key)!;
      try {
        const geo = await ExpoLocation.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const city = geo[0]?.city || geo[0]?.subregion || geo[0]?.region || '';
        cache.set(key, city);
        return city;
      } catch {
        return '';
      }
    };

    const resolveNames = async () => {
      const updated = await Promise.all(
        journeys.map(async (j) => {
          if (j.startCity && j.endCity) return j; // Already resolved
          const startCity = j.startCoords?.lat && j.startCoords?.lng
            ? await geocode(j.startCoords.lat, j.startCoords.lng) : '';
          const endCity = j.endCoords?.lat && j.endCoords?.lng
            ? await geocode(j.endCoords.lat, j.endCoords.lng) : '';
          return { ...j, startCity, endCity };
        })
      );
      const hasChanges = updated.some((j, i) => j.startCity !== journeys[i].startCity || j.endCity !== journeys[i].endCity);
      if (hasChanges) setJourneys(updated);
    };
    resolveNames();
  }, [journeys.length]); // Only run when journey count changes, not on every journeys update

  // Fit map to show all markers + polylines after data loads
  useEffect(() => {
    if (loading || (!locations.length && !journeys.length)) return;
    if (!mapRef.current) return;

    const allCoords: Array<{ latitude: number; longitude: number }> = [];

    // Add post locations
    locations.forEach((loc) => {
      if (isValidMapCoordinate({ latitude: loc.latitude, longitude: loc.longitude }) && loc.latitude !== 0 && loc.longitude !== 0) {
        allCoords.push({ latitude: loc.latitude, longitude: loc.longitude });
      }
    });

    // Add journey polyline points (just start + end for bounding, not every point)
    journeys.forEach((j) => {
      if (j.startCoords?.lat && j.startCoords?.lng) {
        allCoords.push({ latitude: j.startCoords.lat, longitude: j.startCoords.lng });
      }
      if (j.endCoords?.lat && j.endCoords?.lng) {
        allCoords.push({ latitude: j.endCoords.lat, longitude: j.endCoords.lng });
      }
    });

    if (allCoords.length > 0) {
      const fitMap = (attempt = 0) => {
        if (attempt > 3) return;
        const delay = Platform.OS === 'ios' ? (attempt === 0 ? 150 : 200) : (attempt === 0 ? 500 : 200);
        setTimeout(() => {
          try {
            if (mapRef.current && allCoords.length > 0 && !useWebViewFallback) {
              if (typeof mapRef.current.fitToCoordinates === 'function') {
                mapRef.current.fitToCoordinates(allCoords, {
                  edgePadding: { top: 120, right: 80, bottom: 120, left: 80 },
                  animated: attempt === 0 && Platform.OS !== 'ios',
                });
                if (Platform.OS === 'ios' && attempt === 0) fitMap(1);
              }
            }
          } catch (err) {
            if (attempt < 3) fitMap(attempt + 1);
          }
        }, delay);
      };
      fitMap();
    }
  }, [locations, journeys, loading]);

  // Calculate region to fit all data (memoized — only recalculates when data changes)
  const mapRegion = useMemo(() => {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    let hasCoords = false;

    locations.forEach((loc) => {
      if (isValidMapCoordinate({ latitude: loc.latitude, longitude: loc.longitude }) && loc.latitude !== 0 && loc.longitude !== 0) {
        if (loc.latitude < minLat) minLat = loc.latitude;
        if (loc.latitude > maxLat) maxLat = loc.latitude;
        if (loc.longitude < minLng) minLng = loc.longitude;
        if (loc.longitude > maxLng) maxLng = loc.longitude;
        hasCoords = true;
      }
    });

    journeys.forEach((j) => {
      if (isValidMapCoordinate({ latitude: j.startCoords?.lat, longitude: j.startCoords?.lng }) && j.startCoords.lat !== 0 && j.startCoords.lng !== 0) {
        if (j.startCoords.lat < minLat) minLat = j.startCoords.lat;
        if (j.startCoords.lat > maxLat) maxLat = j.startCoords.lat;
        if (j.startCoords.lng < minLng) minLng = j.startCoords.lng;
        if (j.startCoords.lng > maxLng) maxLng = j.startCoords.lng;
        hasCoords = true;
      }
      if (isValidMapCoordinate({ latitude: j.endCoords?.lat, longitude: j.endCoords?.lng }) && j.endCoords.lat !== 0 && j.endCoords.lng !== 0) {
        if (j.endCoords.lat < minLat) minLat = j.endCoords.lat;
        if (j.endCoords.lat > maxLat) maxLat = j.endCoords.lat;
        if (j.endCoords.lng < minLng) minLng = j.endCoords.lng;
        if (j.endCoords.lng > maxLng) maxLng = j.endCoords.lng;
        hasCoords = true;
      }
    });

    if (!hasCoords) {
      return { latitude: 20, longitude: 0, latitudeDelta: 120, longitudeDelta: 320 };
    }

    const latDelta = Math.max((maxLat - minLat) * 1.8, 0.1);
    const lngDelta = Math.max((maxLng - minLng) * 1.8, 0.1);

    return sanitizeMapRegion({
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    })!;
  }, [locations, journeys]);

  // Keep backward-compatible getter for WebView HTML builder
  const getMapRegion = useCallback(() => mapRegion, [mapRegion]);

  // ──────────────────────────────────────────────────────
  // WebView HTML (used on Expo Go Android where native maps crash)
  // ──────────────────────────────────────────────────────
  const getWebMapHTML = useCallback(() => {
    const region = getMapRegion();
    const validLocations = (mapFilter === 'posts')
      ? locations.filter((loc) => loc.latitude && loc.longitude && loc.latitude !== 0 && loc.longitude !== 0)
      : [];
    const markersData = validLocations.map((loc) => ({
      lat: loc.latitude,
      lng: loc.longitude,
      title: (loc.address || `Location #${loc.number}`).replace(/"/g, '&quot;'),
      cityName: (loc.address ? loc.address.split(',')[0].trim() : `Post #${loc.number}`).replace(/"/g, '&quot;'),
      address: loc.address || `Location #${loc.number}`,
      number: loc.number,
      photo: loc.photo ? resolvePhotoUrl(loc.photo) : null,
      postId: loc.postId || null,
      latitude: loc.latitude,
      longitude: loc.longitude,
      date: loc.date,
      contentType: loc.contentType || null,
    }));
    const filteredJourneys = (mapFilter === 'journeys') ? journeys : [];
    const polylinePaths = filteredJourneys.map((j) => ({
      title: j.title || 'Journey',
      path: j.polyline.map((p) => ({ lat: p.lat, lng: p.lng })),
      startCoords: j.startCoords,
      endCoords: j.endCoords,
      startLetter: j.startCity ? j.startCity[0].toUpperCase() : 'S',
      endLetter: j.endCity ? j.endCity[0].toUpperCase() : 'E',
      startCity: j.startCity || 'Start',
      endCity: j.endCity || 'End',
    }));

    const centerLat = selectedLocation ? selectedLocation.latitude : region.latitude;
    const centerLng = selectedLocation ? selectedLocation.longitude : region.longitude;
    const zoomLevel = Math.min(12, Math.max(2, Math.floor(15 - Math.log2(Math.max(region.latitudeDelta, 1)))));
    const zoomLevelVal = selectedLocation ? 14 : zoomLevel;

    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
html,body,#map{height:100%;margin:0;padding:0}
.glowing-dot-container {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pulse-ring {
  position: absolute;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: radial-gradient(circle, ${isDark ? 'rgba(80, 200, 120, 0.4)' : 'rgba(28, 115, 180, 0.4)'} 0%, rgba(28, 115, 180, 0) 70%);
  animation: pulse 1.8s infinite ease-out;
}
.core-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: linear-gradient(135deg, #50C878 0%, #1C73B4 100%);
  border: 2px solid #FFFFFF;
  box-shadow: 0 0 8px rgba(28, 115, 180, 0.6);
}
@keyframes pulse {
  0% { transform: scale(0.6); opacity: 1; }
  100% { transform: scale(2.2); opacity: 0; }
}

.glass-marker-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 20px;
  background: ${isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.75)'};
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.08)'};
  box-shadow: 0 8px 32px 0 ${isDark ? 'rgba(0, 0, 0, 0.37)' : 'rgba(31, 38, 135, 0.15)'};
  max-width: 180px;
  animation: floatCard 0.3s ease-out;
}
.marker-thumb {
  width: 26px;
  height: 26px;
  min-width: 26px;
  min-height: 26px;
  flex-shrink: 0;
  -webkit-flex-shrink: 0;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid ${isDark ? '#2DD4BF' : '#3B82F6'};
}
.marker-thumb-placeholder {
  width: 26px;
  height: 26px;
  min-width: 26px;
  min-height: 26px;
  flex-shrink: 0;
  -webkit-flex-shrink: 0;
  border-radius: 50%;
  background: ${isDark ? 'rgba(45, 212, 191, 0.15)' : 'rgba(59, 130, 246, 0.1)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.marker-info {
  display: flex;
  flex-direction: column;
  min-width: 60px;
  overflow: hidden;
}
.marker-title {
  font-size: 11px;
  font-weight: 700;
  color: ${isDark ? '#F8FAFC' : '#0F172A'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.marker-subtitle {
  font-size: 9px;
  font-weight: 500;
  color: ${isDark ? '#94A3B8' : '#64748B'};
  margin-top: 1px;
}
@keyframes floatCard {
  0% { transform: translateY(6px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

.glass-cluster {
  position: relative;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cluster-pulse {
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(33, 150, 243, 0.2)'};
  animation: pulse 2s infinite ease-out;
}
.cluster-glass-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${isDark 
    ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.75) 0%, rgba(30, 41, 59, 0.75) 100%)' 
    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(241, 245, 249, 0.85) 100%)'};
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1.5px solid ${isDark ? 'rgba(45, 212, 191, 0.4)' : 'rgba(59, 130, 246, 0.3)'};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px ${isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(31, 38, 135, 0.15)'};
  transition: transform 0.2s ease;
}
.cluster-glass-circle span {
  font-family: Arial, sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: ${isDark ? '#2DD4BF' : '#3B82F6'};
}
</style>
<script>
window.map = null;
window.bounds = null;
function initMap(){
  window.map = new google.maps.Map(document.getElementById('map'),{
    center:{lat:${centerLat},lng:${centerLng}},
    zoom:${zoomLevelVal},minZoom:3,mapTypeId:'roadmap',language:'en',styles:${JSON.stringify(mapStyle.customMapStyle)},disableDefaultUI:true,zoomControl:true
  });
  var map = window.map;
  window.bounds = new google.maps.LatLngBounds();
  var bounds = window.bounds;
  var activeOverlays=[];

  // Journey polylines + start/end markers
  var journeys=${JSON.stringify(polylinePaths)};
  journeys.forEach(function(j){
    if(j.path&&j.path.length>1){
      new google.maps.Polyline({path:j.path,geodesic:true,strokeColor:'${mapStyle.routeGlowColor}',strokeOpacity:1,strokeWeight:12,map:map});
      new google.maps.Polyline({path:j.path,geodesic:true,strokeColor:'${mapStyle.routeColor}',strokeOpacity:1,strokeWeight:4,map:map});
      j.path.forEach(function(p){bounds.extend(new google.maps.LatLng(p.lat,p.lng));});
    }
    // Start marker
    if(j.startCoords&&j.startCoords.lat&&j.startCoords.lng){
      new google.maps.Marker({
        position:{lat:j.startCoords.lat,lng:j.startCoords.lng},
        map:map,
        title:j.startCity||'Start',
        icon:{
          url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="${GROWTH_GREEN}" stroke="white" stroke-width="2"/></svg>'),
          scaledSize:new google.maps.Size(32,32),
          anchor:new google.maps.Point(16,16)
        }
      });
    }
    // End marker
    if(j.endCoords&&j.endCoords.lat&&j.endCoords.lng){
      new google.maps.Marker({
        position:{lat:j.endCoords.lat,lng:j.endCoords.lng},
        map:map,
        title:j.endCity||'End',
        icon:{
          url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="${ALERT_RED}" stroke="white" stroke-width="2"/></svg>'),
          scaledSize:new google.maps.Size(32,32),
          anchor:new google.maps.Point(16,16)
        }
      });
    }
  });

  var markers=${JSON.stringify(markersData)};
  // Dedupe by ~11m precision (4 decimal places) so multiple posts taken at
  // the exact same spot (or within GPS noise) collapse to one marker. Without
  // this, a single venue with 3 posts shows as a "+3" cluster badge when
  // zoomed out, then snaps to overlapping pins (looks like 1) on full zoom-in.
  (function(){
    var seen={},deduped=[];
    markers.forEach(function(m){
      var key=m.lat.toFixed(4)+','+m.lng.toFixed(4);
      if(!seen[key]){seen[key]=true;deduped.push(m);}
    });
    markers=deduped;
  })();
  markers.forEach(function(m){bounds.extend(new google.maps.LatLng(m.lat,m.lng));});

  // Zoom-aware grid size: smaller grid = less clustering when zoomed in
  function getGridSize(zoom){
    if(zoom>=15)return 0;
    if(zoom>=13)return 0.05;
    if(zoom>=11)return 0.15;
    if(zoom>=9)return 0.4;
    if(zoom>=7)return 1;
    if(zoom>=5)return 2;
    return 4;
  }

  function clusterMarkers(items,gs){
    if(gs===0){return items.map(function(it){return{items:[it],lat:it.lat,lng:it.lng};});}
    // O(n) grid-hash clustering instead of O(n²) pairwise comparison
    var buckets={};
    items.forEach(function(it){
      var key=Math.floor(it.lat/gs)+','+Math.floor(it.lng/gs);
      if(!buckets[key])buckets[key]={items:[],sLat:0,sLng:0};
      buckets[key].items.push(it);buckets[key].sLat+=it.lat;buckets[key].sLng+=it.lng;
    });
    var clusters=[];
    for(var k in buckets){
      var b=buckets[k];
      clusters.push({items:b.items,lat:b.sLat/b.items.length,lng:b.sLng/b.items.length});
    }
    return clusters;
  }

  // Custom OverlayView class
  class PhotoOverlay extends google.maps.OverlayView {
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
        var anchor = this.div.getAttribute('data-anchor') || 'bottom';
        if (anchor === 'center') {
          this.div.style.transform = 'translate(-50%, -50%)';
        } else {
          this.div.style.transform = 'translate(-50%, -100%)';
        }
      }
    }
    onRemove() {
      if (this.div && this.div.parentNode) {
        this.div.parentNode.removeChild(this.div);
      }
    }
  }

  function renderClusters(){
    // Remove existing overlays
    activeOverlays.forEach(function(ov){ov.setMap(null);});
    activeOverlays=[];

    var zoom=map.getZoom()||${zoomLevelVal};
    var gs=getGridSize(zoom);
    var clusters=clusterMarkers(markers,gs);

    clusters.forEach(function(cluster){
      var pos=new google.maps.LatLng(cluster.lat,cluster.lng);
      var div=document.createElement('div');
      div.style.cssText='position:absolute;cursor:pointer;display:flex;align-items:center;justify-content:center;';

      if (cluster.items.length === 1) {
        var main = cluster.items[0];
        var isViewingAny = ${selectedLocation !== null};
        var isSelected = isViewingAny && (main.number === ${selectedLocation?.number || -1} || main.postId === '${selectedLocation?.postId || ""}');
        
        if (isSelected) {
          var nameText = main.cityName || 'Post #' + main.number;
          var photoUrl = main.photo || '';
          var imgHtml = photoUrl ? '<img src="' + photoUrl + '" class="marker-thumb" />' : '<div class="marker-thumb-placeholder">📍</div>';
          div.setAttribute('data-anchor', 'bottom');
          div.innerHTML = '<div class="glass-marker-card">' +
            imgHtml +
            '<div class="marker-info">' +
              '<div class="marker-title">' + nameText + '</div>' +
              '<div class="marker-subtitle">1 post</div>' +
            '</div>' +
          '</div>';
        } else {
          div.setAttribute('data-anchor', 'bottom');
          div.innerHTML = '<svg width="30" height="40" viewBox="0 0 30 40" style="filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.3))"><defs><linearGradient id="htmlPinGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#50C878" /><stop offset="100%" stop-color="#1C73B4" /></linearGradient></defs><path d="M15 1C7.27 1 1 7.27 1 15c0 10 14 25 14 25s14-15 14-25c0-7.73-6.27-14-14-14zm0 19c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="url(#htmlPinGrad)" fill-rule="evenodd" stroke="#FFFFFF" stroke-width="1.5"/></svg>';
        }
      } else {
        div.setAttribute('data-anchor', 'center');
        var firstPhoto = null;
        for (var i = 0; i < cluster.items.length; i++) {
          if (cluster.items[i].photo) {
            firstPhoto = cluster.items[i].photo;
            break;
          }
        }
        if (firstPhoto) {
          div.innerHTML = '<div class="glass-cluster"><div class="cluster-pulse"></div><div class="cluster-glass-circle" style="padding: 1.5px; overflow: hidden;"><img src="' + firstPhoto + '" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" /></div></div>';
        } else {
          div.setAttribute('data-anchor', 'bottom');
          div.innerHTML = '<div class="glass-cluster"><div class="cluster-pulse"></div><div class="cluster-glass-circle"><span>📍</span></div></div>';
        }
      }

      // Tap handler: single marker opens the native preview card, cluster zooms in.
      div.addEventListener('click',function(e){
        e.stopPropagation();
        if(cluster.items.length===1){
          if(window.ReactNativeWebView){
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'selectLocation',location:cluster.items[0]}));
          }
        }else if(cluster.items.length>1){
          // Zoom into the cluster area
          var cb=new google.maps.LatLngBounds();
          cluster.items.forEach(function(it){cb.extend(new google.maps.LatLng(it.lat,it.lng));});
          map.fitBounds(cb,60);
        }
      });

      var ov=new PhotoOverlay(pos,div);
      activeOverlays.push(ov);
    });
  }

  // Initial render + re-render on zoom change
  if(markers.length>0||journeys.some(function(j){return j.path.length>0;})){
    if (!${selectedLocation !== null}) {
      map.fitBounds(bounds,40);
      google.maps.event.addListenerOnce(map,'bounds_changed',function(){
        if(map.getZoom()>15)map.setZoom(15);
        renderClusters();
      });
    } else {
      renderClusters();
    }
  }else{
    renderClusters();
  }
  map.addListener('zoom_changed',function(){renderClusters();});
}
</script>
</head><body>
<div id="map"></div>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${WEBVIEW_API_KEY || ''}&language=en&callback=initMap"></script>
</body></html>`;
  }, [locations, journeys, mapFilter, getMapRegion, WEBVIEW_API_KEY, mapStyle.customMapStyle, mapStyle.routeColor, mapStyle.routeGlowColor, selectedLocation]);

  const webViewSource = useMemo(() => ({ html: getWebMapHTML() }), [getWebMapHTML]);

  // ──────────────────────────────────────────────────────
  // renderMap — native MapView preferred, WebView fallback
  // ──────────────────────────────────────────────────────
  const renderMap = () => {
    // ── WebView fallback (Expo Go Android) ──
    if (useWebViewFallback) {
      if (!WEBVIEW_API_KEY) {
        return (
          <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="map-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.errorText, { color: theme.colors.text, marginTop: 16 }]}>
              Map unavailable — no API key configured
            </Text>
          </View>
        );
      }
      return (
        <WebView
          ref={mapRef}
          source={webViewSource}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          originWhitelist={['https://*', 'http://*', 'data:*', 'about:*']}
          onShouldStartLoadWithRequest={(request) => {
            if (request.url.startsWith('http') || request.url.startsWith('data:') || request.url.startsWith('about:')) return true;
            return false;
          }}
          {...(Platform.OS === 'android' && { mixedContentMode: 'compatibility' as const, setSupportMultipleWindows: false })}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'navigatePost' && data.postId) {
                const targetUserId = data.userId || userId;
                if (data.contentType === 'short') {
                  router.push(`/user-shorts/${targetUserId}?shortId=${data.postId}`);
                } else {
                  router.push(`/post/${data.postId}`);
                }
              } else if (data.type === 'selectLocation' && data.location) {
                setSelectedLocation({
                  number: data.location.number,
                  latitude: data.location.latitude ?? data.location.lat,
                  longitude: data.location.longitude ?? data.location.lng,
                  address: data.location.address || data.location.title || `Location #${data.location.number}`,
                  date: data.location.date || '',
                  photo: data.location.photo || undefined,
                  postId: data.location.postId || undefined,
                  contentType: data.location.contentType || undefined,
                });
                setSelectedMarkerId(data.location.postId ? `post-${data.location.postId}` : `location-${data.location.number}`);
              }
            } catch (err) {
              logger.debug('[AllLocations] WebView message parse error:', err);
            }
          }}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <LoadingGlobe size="large" color={theme.colors.primary} />
            </View>
          )}
          onError={(e) => logger.error('WebView error:', e.nativeEvent)}
        />
      );
    }

    // ── Native MapView (iOS / Android dev build) ──
    if (!MapView || !Marker) {
      return (
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <Ionicons name="map-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.errorText, { color: theme.colors.text, marginTop: 16 }]}>Map not available</Text>
        </View>
      );
    }

    const region = getMapRegion();
    const validLocations = locations.filter(
      (loc) => isValidMapCoordinate({ latitude: loc.latitude, longitude: loc.longitude }) &&
        loc.latitude !== 0 &&
        loc.longitude !== 0
    );
    const safeLatitudeDelta = sanitizeLatitudeDelta(currentRegion?.latitudeDelta, region.latitudeDelta);

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={getMapProvider()}
        {...mapStyle.nativeMapProps}
        minZoomLevel={3}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        // Show the OS-native current-location dot (with accuracy ring) on top
        // of the post/journey markers. Permission is already requested in the
        // useEffect at the top of this component, so the SDK silently no-ops
        // if the user denied it. `followsUserLocation` stays false so we don't
        // hijack the camera if the user pans away.
        showsUserLocation={true}
        showsMyLocationButton={true}
        followsUserLocation={false}
        showsCompass={true}
        showsScale={true}
        mapType={mapStyle.mapType}
        mapPadding={{ top: 100, right: 80, bottom: 100, left: 80 }}
        onMapReady={() => {
          const allCoords = [
            ...validLocations.map((l) => ({ latitude: l.latitude, longitude: l.longitude })),
            ...journeys.flatMap((j) =>
              j.polyline?.map((p) => ({ latitude: p.lat, longitude: p.lng })) || []
            ),
          ].filter(isValidMapCoordinate);
          if (allCoords.length > 0 && mapRef.current && !useWebViewFallback) {
            setTimeout(() => {
              try {
                if (typeof mapRef.current?.fitToCoordinates === 'function') {
                  mapRef.current.fitToCoordinates(allCoords, {
                    edgePadding: { top: 120, right: 80, bottom: 120, left: 80 },
                    animated: false,
                  });
                }
              } catch {}
            }, 300);
          }
        }}
      >
        {/* Journey polylines + start/end markers — hidden when filter is 'posts' */}
        {(mapFilter === 'journeys') && journeys.map((j) => {
          if (!j.polyline || j.polyline.length < 2) return null;
          const coords = getJourneyPolylineCoords(j);
          return (
            <React.Fragment key={`journey-${j._id}`}>
              <PolylineRenderer
                coordinates={coords}
                color={mapStyle.routeColor}
                glowColor={mapStyle.routeGlowColor}
                strokeWidth={4}
                simplifyDistance={10}
                applyKalman={false}
                latitudeDelta={safeLatitudeDelta}
              />
              {/* Start marker */}
              {isValidMapCoordinate({ latitude: j.startCoords?.lat, longitude: j.startCoords?.lng }) && (
                <Marker
                  coordinate={{ latitude: j.startCoords.lat, longitude: j.startCoords.lng }}
                  title={j.startCity || 'Start'}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <PremiumMapMarker pointType="start" isActive={false} />
                </Marker>
              )}
              {/* End marker */}
              {isValidMapCoordinate({ latitude: j.endCoords?.lat, longitude: j.endCoords?.lng }) && (
                <Marker
                  coordinate={{ latitude: j.endCoords.lat, longitude: j.endCoords.lng }}
                  title={j.endCity || 'End'}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <PremiumMapMarker pointType="end" isActive={false} />
                </Marker>
              )}
            </React.Fragment>
          );
        })}

        {/* Post location markers — hidden when filter is 'journeys' */}
        {(mapFilter === 'posts') && clusteredLocations.map((cluster) => {
          if (cluster.isCluster) {
            const firstPhotoLocation = cluster.locations.find((loc: any) => loc.photo);
            const photoUrl = firstPhotoLocation?.photo;
            return (
              <OptimizedClusterMarker
                key={cluster.id}
                cluster={cluster}
                onPress={() => handleClusterPress(cluster)}
                isDark={isDark}
                photoUrl={photoUrl}
                resolvePhotoUrl={resolvePhotoUrl}
              />
            );
          } else {
            const location = cluster.location!;
            const markerId = getLocationMarkerId(location);
            const isActive = selectedMarkerId === markerId;
            const city = location.address ? location.address.split(',')[0].trim() : `Post #${location.number}`;
            return (
              <OptimizedMarker
                key={`${cluster.id}-${isActive ? 'active' : 'inactive'}`}
                coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                title={location.address || `Location #${location.number}`}
                description={`Visit #${location.number}`}
                onPress={() => {
                  setSelectedLocation(location);
                  setSelectedMarkerId(markerId);
                }}
                isActive={isActive}
                icon="location"
                label={city}
                activeTitle={city}
                activeSubtitle={location.contentType === 'short' ? '1 short' : '1 post'}
                photo={location.photo}
                latitudeDelta={safeLatitudeDelta}
              />
            );
          }
        })}
      </MapView>
    );
  };

  // --- Loading state ---
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>{headerTitle}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading locations &amp; journeys...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>{headerTitle}</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>{error}</Text>
          <TouchableOpacity
            onPress={() => userId && loadAllData(userId)}
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalJourneyDistance = journeys.reduce((sum, j) => sum + (j.distanceTraveled || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#121212' : '#F5F7FA' }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Fallback/Base Background Gradient for Day Theme (Frosted Atlas) */}
      {!isDark && (
        <LinearGradient
          colors={['#FFFFFF', '#F5F7FA', '#EDF2F7']}
          locations={[0, 0.4, 1.0]}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Full-screen map */}
      <View style={StyleSheet.absoluteFill}>
        {locations.length === 0 && journeys.length === 0 ? (
          <View style={[styles.centerContainer, { backgroundColor: isDark ? '#121212' : '#F5F7FA' }]}>
            <Ionicons name="map-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.errorText, { color: theme.colors.text, marginTop: 16 }]}>
              No travel data yet
            </Text>
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary, marginTop: 8 }]}>
              Post with locations or record journeys to build your map
            </Text>
          </View>
        ) : (
          renderMap()
        )}
      </View>

      {/* Floating Cockpit Header overlay */}
      <View 
        onLayout={(e) => setHeaderCardHeight(e.nativeEvent.layout.height)}
        style={[
          styles.floatingHeaderContainer,
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
            shadowOpacity: isDark ? 0.3 : 0.1,
          }
        ]}
      >
        {Platform.OS !== 'android' ? (
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)' }]} />
        )}
        <View style={styles.floatingHeaderContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>{headerTitle}</Text>
            {currentCountry && (
              <View style={styles.countryChip}>
                <Text style={[styles.countryText, { color: theme.colors.textSecondary }]}>
                  {getFlagEmoji(currentCountryCode || '')} {currentCountry}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => router.push(`/journeys?userId=${userId}&userName=${encodeURIComponent(displayName || '')}`)}
          >
            <Ionicons name="list" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Segmented Glass Tabs overlay inside Header */}
        <View style={styles.floatingTabsContainer}>
          {(['posts', 'journeys'] as const).map((filter) => {
            const isActive = mapFilter === filter;
            const label = filter === 'posts' ? 'Posts' : 'Journeys';
            const activeColor = filter === 'posts' ? ALERT_RED : GROWTH_GREEN;
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.floatingTabItem,
                  isActive && {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.9)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.05)',
                    borderWidth: 1,
                  }
                ]}
                onPress={() => setMapFilter(filter)}
                activeOpacity={0.7}
              >
                {isActive && <View style={[styles.activeTabIndicator, { backgroundColor: activeColor }]} />}
                <Text style={[
                  styles.floatingTabText,
                  {
                    color: isActive
                      ? (isDark ? '#FFFFFF' : '#121212')
                      : (isDark ? '#8A8A8A' : '#667085'),
                    fontWeight: isActive ? '700' : '500',
                  }
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Floating Map Zoom & Locate Controls overlay */}
      <View style={[styles.floatingMapControls, { top: insets.top + (isAndroid ? 6 : 4) + headerCardHeight + 12 }]}>
        <TouchableOpacity
          style={[
            styles.floatingControlBtn,
            isDark ? styles.controlBtnDark : styles.controlBtnLight,
            isDark ? styles.shadowDark : styles.shadowLight
          ]}
          onPress={zoomIn}
        >
          {Platform.OS !== 'android' ? (
            <BlurView pointerEvents="none" intensity={75} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(20, 24, 33, 0.9)' : 'rgba(255, 255, 255, 0.9)' }]} />
          )}
          <Ionicons name="add" size={24} color={isDark ? '#FFFFFF' : '#121212'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.floatingControlBtn,
            isDark ? styles.controlBtnDark : styles.controlBtnLight,
            isDark ? styles.shadowDark : styles.shadowLight
          ]}
          onPress={zoomOut}
        >
          {Platform.OS !== 'android' ? (
            <BlurView pointerEvents="none" intensity={75} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(20, 24, 33, 0.9)' : 'rgba(255, 255, 255, 0.9)' }]} />
          )}
          <Ionicons name="remove" size={24} color={isDark ? '#FFFFFF' : '#121212'} />
        </TouchableOpacity>
        {isOwnPage && (
          <TouchableOpacity
            style={[
              styles.floatingControlBtn,
              isDark ? styles.controlBtnDark : styles.controlBtnLight,
              isDark ? styles.shadowDark : styles.shadowLight
            ]}
            onPress={recenterOnUser}
          >
            {Platform.OS !== 'android' ? (
              <BlurView pointerEvents="none" intensity={75} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            ) : (
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(20, 24, 33, 0.9)' : 'rgba(255, 255, 255, 0.9)' }]} />
            )}
            <Ionicons name="locate" size={24} color={isDark ? '#FFFFFF' : '#121212'} />
          </TouchableOpacity>
        )}
      </View>

      {/* Preview Card Carousel */}
      {validLocations.length > 0 && renderedLocation && (
        <Animated.View
          style={[
            styles.carouselContainer,
            {
              transform: [{ translateY: slideAnim }],
              bottom: isOwnPage ? insets.bottom + bottomPanelHeight + 8 : insets.bottom + 8,
            }
          ]}
        >
          <FlatList
            ref={carouselRef}
            data={validLocations}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={screenWidth}
            decelerationRate="fast"
            onScrollBeginDrag={() => {
              isScrollingCarouselRef.current = true;
            }}
            onMomentumScrollEnd={handleCarouselScroll}
            getItemLayout={getCarouselItemLayout}
            keyExtractor={(item, idx) => `carousel-${item.postId || item.number}-${idx}`}
            style={styles.carouselFlatList}
            contentContainerStyle={styles.carouselContent}
            renderItem={({ item }) => {
              const isSelected = selectedLocation?.postId === item.postId || selectedLocation?.number === item.number;
              return (
                <View style={styles.carouselCardWrapper}>
                  <GlassMapPanel style={[styles.previewCard, isSelected && styles.previewCardActive]} tint={mapStyle.glassTint}>
                    <View style={styles.previewContent}>
                      {item.photo ? (
                        <ExpoImage
                          source={{ uri: resolvePhotoUrl(item.photo) }}
                          style={styles.previewImage}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={180}
                        />
                      ) : (
                        <View style={[styles.previewImage, styles.previewFallback]}>
                          <Ionicons name="image-outline" size={24} color={mapStyle.routeColor} />
                        </View>
                      )}
                      <View style={styles.previewText}>
                        <Text style={[styles.previewTitle, { color: theme.colors.text }]} numberOfLines={1}>
                          {item.address || `Location #${item.number}`}
                        </Text>
                        <Text style={[styles.previewMeta, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                          Shared destination {item.contentType ? `- ${item.contentType}` : ''}
                        </Text>
                        <View style={styles.previewActions}>
                          {item.postId ? (
                            item.contentType === 'short' ? (
                              <TouchableOpacity
                                style={[styles.previewButton, { borderColor: theme.colors.border }]}
                                onPress={() => router.push(`/user-shorts/${userId}?shortId=${item.postId}`)}
                              >
                                <Ionicons name="videocam-outline" size={16} color={theme.colors.text} />
                                <Text style={[styles.previewButtonText, { color: theme.colors.text }]}>Shorts</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={[styles.previewButton, { borderColor: theme.colors.border }]}
                                onPress={() => router.push(`/post/${item.postId}`)}
                              >
                                <Ionicons name="images-outline" size={16} color={theme.colors.text} />
                                <Text style={[styles.previewButtonText, { color: theme.colors.text }]}>Post</Text>
                              </TouchableOpacity>
                            )
                          ) : null}
                          <TouchableOpacity
                            style={[styles.previewButton, styles.previewPrimaryButton, { backgroundColor: mapStyle.routeColor }]}
                            onPress={() => router.push({
                              pathname: '/map/current-location',
                              params: {
                                latitude: String(item.latitude),
                                longitude: String(item.longitude),
                                address: item.address || `Location #${item.number}`,
                              },
                            })}
                          >
                            <Ionicons name="navigate" size={16} color="white" />
                            <Text style={[styles.previewButtonText, { color: 'white' }]}>Direction</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.previewClose}
                        onPress={() => {
                          setSelectedLocation(null);
                          setSelectedMarkerId(null);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </GlassMapPanel>
                </View>
              );
            }}
          />
        </Animated.View>
      )}

      {/* Floating Bottom Cockpit Overlay */}
      {isOwnPage && (
        <View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0) setBottomPanelHeight(h);
          }}
          style={[
            styles.floatingBottomPanel,
            {
              bottom: insets.bottom + 8 + keyboardHeight,
              backgroundColor: isDark ? 'rgba(20, 24, 33, 0.75)' : 'rgba(255, 255, 255, 0.75)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
              borderRadius: isDark ? 24 : 30,
            },
            isDark ? styles.shadowDark : styles.shadowLight
          ]}
        >
          {Platform.OS !== 'android' ? (
            <BlurView intensity={75} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(20, 24, 33, 0.9)' : 'rgba(255, 255, 255, 0.9)' }]} />
          )}

          {/* GPS Accuracy row */}
          {deviceAccuracy !== null && (
            <View style={journeyStyles.accuracyRow}>
              <Ionicons name="checkmark-circle" size={16} color={GROWTH_GREEN} />
              <Text style={[journeyStyles.accuracyText, { color: theme.colors.textSecondary }]}>
                ✓ GPS accuracy ±{Math.round(deviceAccuracy)}m
              </Text>
            </View>
          )}

          {/* No active journey — show Start button */}
          {!isTracking && !isPaused && (
            <>
              {showJourneyTitle && (
                <View style={[journeyStyles.titleRow, { borderColor: theme.colors.border, backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)' }]}>
                  <TextInput
                    style={[journeyStyles.titleInput, { color: theme.colors.text }]}
                    placeholder="Journey name (optional)"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={journeyTitleInput}
                    onChangeText={setJourneyTitleInput}
                    maxLength={50}
                  />
                  <TouchableOpacity onPress={() => { setShowJourneyTitle(false); setJourneyTitleInput(''); }}>
                    <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                onPress={() => {
                  if (showJourneyTitle) {
                    handleStartPress();
                  } else {
                    setShowJourneyTitle(true);
                  }
                }}
                style={styles.actionBtnTouch}
                disabled={journeyActionLoading}
              >
                <LinearGradient
                  colors={isDark ? ['rgba(255, 255, 255, 0.14)', 'rgba(255, 255, 255, 0.08)'] : ['#53A7FF', '#2B7FFF']}
                  style={[
                    styles.actionBtnGradient,
                    {
                      borderTopWidth: isDark ? 1 : 0,
                      borderColor: 'rgba(255,255,255,0.12)',
                    },
                    !isDark && styles.shadowActionBtn
                  ]}
                >
                  {journeyActionLoading ? (
                    <LoadingGlobe color="white" />
                  ) : (
                    <>
                      <Ionicons name="play" size={18} color="#FFFFFF" />
                      <Text style={[styles.actionBtnText, { color: '#FFFFFF', fontWeight: '700' }]}>Start Journey</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* Journey active — show recording stats + pause + end */}
          {isTracking && !isPaused && (
            <>
              <View style={journeyStyles.statsRow}>
                <View style={journeyStyles.statChip}>
                  <Ionicons name="navigate" size={14} color={GROWTH_GREEN} />
                  <Text style={[journeyStyles.statText, { color: theme.colors.text }]}>{formatJourneyDistance()}</Text>
                </View>
                <View style={journeyStyles.statChip}>
                  <Ionicons name="time" size={14} color={ACTION_BLUE} />
                  <Text style={[journeyStyles.statText, { color: theme.colors.text }]}>{formatJourneyDuration()}</Text>
                </View>
                <View style={[journeyStyles.liveDot, { backgroundColor: GROWTH_GREEN }]} />
                <Text style={[journeyStyles.liveText, { color: GROWTH_GREEN }]}>Recording</Text>
              </View>
              <View style={journeyStyles.consolidatedRow}>
                <TouchableOpacity
                  style={[journeyStyles.circularBtn, { borderColor: ACTION_BLUE }]}
                  onPress={() => openJourneyCapture('photo')}
                >
                  <Ionicons name="camera" size={18} color={ACTION_BLUE} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[journeyStyles.circularBtn, { borderColor: ALERT_RED }]}
                  onPress={() => openJourneyCapture('short')}
                >
                  <Ionicons name="videocam" size={18} color={ALERT_RED} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[journeyStyles.pauseBtn, { borderColor: '#F59E0B' }]}
                  onPress={handlePauseJourney}
                  disabled={journeyActionLoading}
                >
                  <Ionicons name="pause" size={16} color="#F59E0B" />
                  <Text style={[journeyStyles.pauseBtnText, { color: '#F59E0B' }]}>Pause</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[journeyStyles.stopBtn, { borderColor: ALERT_RED }]}
                  onPress={handleStopJourney}
                  disabled={journeyActionLoading}
                >
                  <Ionicons name="stop" size={16} color={ALERT_RED} />
                  <Text style={[journeyStyles.pauseBtnText, { color: ALERT_RED }]}>End</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Journey paused — show resume / end */}
          {isPaused && (
            <>
              <View style={journeyStyles.statsRow}>
                <View style={journeyStyles.statChip}>
                  <Ionicons name="navigate" size={14} color={GROWTH_GREEN} />
                  <Text style={[journeyStyles.statText, { color: theme.colors.text }]}>{formatJourneyDistance()}</Text>
                </View>
                <View style={journeyStyles.statChip}>
                  <Ionicons name="time" size={14} color={ACTION_BLUE} />
                  <Text style={[journeyStyles.statText, { color: theme.colors.text }]}>{formatJourneyDuration()}</Text>
                </View>
                <View style={[journeyStyles.liveDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[journeyStyles.liveText, { color: '#F59E0B' }]}>Paused</Text>
              </View>
              <View style={journeyStyles.consolidatedRow}>
                <TouchableOpacity
                  style={[journeyStyles.circularBtn, { borderColor: ACTION_BLUE }]}
                  onPress={() => openJourneyCapture('photo')}
                >
                  <Ionicons name="camera" size={18} color={ACTION_BLUE} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[journeyStyles.circularBtn, { borderColor: ALERT_RED }]}
                  onPress={() => openJourneyCapture('short')}
                >
                  <Ionicons name="videocam" size={18} color={ALERT_RED} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1.5 }}
                  onPress={handleResumeJourney}
                  disabled={journeyActionLoading}
                >
                  <LinearGradient
                    colors={isDark ? ['rgba(255, 255, 255, 0.14)', 'rgba(255, 255, 255, 0.08)'] : ['#53A7FF', '#2B7FFF']}
                    style={journeyStyles.startBtn}
                  >
                    {journeyActionLoading ? (
                      <LoadingGlobe color="white" size="small" />
                    ) : (
                      <>
                        <Ionicons name="play" size={16} color="white" />
                        <Text style={journeyStyles.startBtnText}>Continue</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[journeyStyles.stopBtn, { borderColor: ALERT_RED }]}
                  onPress={handleStopJourney}
                  disabled={journeyActionLoading}
                >
                  <Ionicons name="stop" size={16} color={ALERT_RED} />
                  <Text style={[journeyStyles.pauseBtnText, { color: ALERT_RED }]}>End</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}

      {/* First-5 Journey Instructions Modal */}
      <Modal
        visible={showInstructions}
        transparent
        animationType="fade"
        onRequestClose={dismissInstructions}
      >
        <View style={instructionStyles.overlay}>
          <View style={[instructionStyles.modal, { backgroundColor: theme.colors.surface }]}>
            <View style={instructionStyles.header}>
              <View style={[instructionStyles.iconWrap, { backgroundColor: GROWTH_GREEN + '12' }]}>
                <Ionicons name="compass-outline" size={28} color={GROWTH_GREEN} />
              </View>
              <Text style={[instructionStyles.title, { color: theme.colors.text }]}>How Journeys Work</Text>
            </View>
            <View style={instructionStyles.list}>
              <View style={instructionStyles.item}>
                <View style={[instructionStyles.tipIcon, { backgroundColor: GROWTH_GREEN + '12' }]}>
                  <Ionicons name="pause-circle-outline" size={20} color={GROWTH_GREEN} />
                </View>
                <Text style={[instructionStyles.text, { color: theme.colors.text }]}>
                  You can <Text style={{ fontWeight: '700' }}>pause and resume</Text> your journey anytime you want.
                </Text>
              </View>
              <View style={instructionStyles.item}>
                <View style={[instructionStyles.tipIcon, { backgroundColor: ACTION_BLUE + '12' }]}>
                  <Ionicons name="location-outline" size={20} color={ACTION_BLUE} />
                </View>
                <Text style={[instructionStyles.text, { color: theme.colors.text }]}>
                  If your <Text style={{ fontWeight: '700' }}>location is turned off</Text>, the journey will automatically pause.
                </Text>
              </View>
              <View style={instructionStyles.item}>
                <View style={[instructionStyles.tipIcon, { backgroundColor: ALERT_RED + '12' }]}>
                  <Ionicons name="time-outline" size={20} color={ALERT_RED} />
                </View>
                <Text style={[instructionStyles.text, { color: theme.colors.text }]}>
                  If paused for more than <Text style={{ fontWeight: '700' }}>24 hours</Text>, the journey ends automatically at your last known location.
                </Text>
              </View>
              <View style={instructionStyles.item}>
                <View style={[instructionStyles.tipIcon, { backgroundColor: '#8B5CF6' + '12' }]}>
                  <Ionicons name="camera-outline" size={20} color="#8B5CF6" />
                </View>
                <Text style={[instructionStyles.text, { color: theme.colors.text }]}>
                  <Text style={{ fontWeight: '700' }}>Add posts</Text> along the way to mark waypoints on your route.
                </Text>
              </View>
            </View>
            <View style={instructionStyles.footer}>
              <View style={[instructionStyles.progressBg, { backgroundColor: theme.colors.border }]}>
                <Animated.View
                  style={[
                    instructionStyles.progressFill,
                    {
                      backgroundColor: GROWTH_GREEN,
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <TouchableOpacity
                style={[instructionStyles.gotItBtn, { backgroundColor: GROWTH_GREEN }]}
                onPress={dismissInstructions}
                activeOpacity={0.8}
              >
                <Text style={instructionStyles.gotItText}>
                  Got it, start! ({instructionCountdown}s)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function AllLocationsMap() {
  return (
    <ErrorBoundary level="route">
      <AllLocationsMapInner />
    </ErrorBoundary>
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
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  countryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  placeholder: {
    width: 40,
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 36,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
    minHeight: 200,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  markerText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  carouselContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 180,
  },
  carouselFlatList: {
    width: '100%',
    height: '100%',
  },
  carouselContent: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  carouselCardWrapper: {
    width: screenWidth,
    height: 180,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  previewCard: {
    width: '100%',
    padding: 12,
    borderRadius: 30,
  },
  previewCardActive: {
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
  },
  previewFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(94, 162, 255, 0.14)',
  },
  previewText: {
    flex: 1,
    minWidth: 0,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  previewMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  previewButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewPrimaryButton: {
    borderWidth: 0,
  },
  previewButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  previewClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingHeaderContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  floatingHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  floatingStatsDarkContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 8,
  },
  darkStatsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  darkStatChip: {
    flex: 1,
    height: 38,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  darkStatText: {
    color: '#E8F4FF',
    fontSize: 12,
    fontWeight: '600',
  },
  floatingStatsLightContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  lightStatCard: {
    flex: 1,
    height: 70,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.70)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    overflow: 'hidden',
  },
  lightStatIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  lightStatVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#121212',
  },
  lightStatLbl: {
    fontSize: 9,
    fontWeight: '600',
    color: '#667085',
  },
  statsSliderContainer: {
    height: 44,
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  statsSliderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  statsSliderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  statsSliderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  floatingTabsContainer: {
    borderRadius: 20,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    marginHorizontal: 16,
    marginBottom: 14,
  },
  floatingTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 5,
  },
  activeTabIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  floatingTabText: {
    fontSize: 12,
  },
  floatingMapControls: {
    position: 'absolute',
    right: 16,
    gap: 12,
    zIndex: 9999,
    elevation: 9999,
  },
  floatingControlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  controlBtnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  controlBtnLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  floatingBottomPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 1,
    gap: 8,
    overflow: 'hidden',
  },
  actionBtnTouch: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
  actionBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontSize: 15,
  },
  shadowActionBtn: {
    shadowColor: '#2B7FFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 6,
  },
  shadowDark: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.60,
    shadowRadius: 32,
    elevation: 10,
  },
  shadowLight: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
});

const markerStyles = StyleSheet.create({
  journeyMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GROWTH_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  journeyMarkerEnd: {
    backgroundColor: ALERT_RED,
  },
  journeyMarkerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  clusterContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  clusterGlow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 1.5,
    backgroundColor: 'transparent',
  },
  clusterBlur: {
    flex: 1,
    borderRadius: 18.5,
    overflow: 'hidden',
  },
  clusterContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clusterText: {
    fontSize: 13,
    fontWeight: '800',
  },
  clusterPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
});

// Journey controls — moved verbatim from /map/current-location's journeyStyles
// so the visual treatment of Start / pause / resume / end is identical.
const journeyStyles = StyleSheet.create({
  journeyBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    gap: 10,
  },
  accuracyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accuracyText: {
    fontSize: 12,
    fontWeight: '500',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  titleInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    minHeight: 36,
    paddingVertical: 4,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    gap: 8,
  },
  startBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
  },
  consolidatedRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  circularBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pauseBtn: {
    flex: 1.5,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 6,
  },
  stopBtn: {
    flex: 1.2,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 6,
  },
  pauseBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

const instructionStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  list: {
    gap: 16,
    marginBottom: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    gap: 12,
  },
  progressBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  gotItBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  gotItText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
});
