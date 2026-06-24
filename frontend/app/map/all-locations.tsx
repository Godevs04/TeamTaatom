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
import { useJourney, useJourneyDuration } from '../../context/JourneyContext';
import { MapView, Marker, getMapProvider, useWebViewFallback } from '../../utils/mapsWrapper';
import PolylineRenderer from '../../components/PolylineRenderer';
import GlassMapPanel from '../../components/GlassMapPanel';
import PremiumMapMarker from '../../components/PremiumMapMarker';
import SafeMarker from '../../components/SafeMarker';
import ClusteredMarker from '../../components/ClusteredMarker';
import ClusteredGroupMarker from '../../components/ClusteredGroupMarker';
import { LOCATION_PIN_SVG } from '../../components/ui/LocationPin';
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

const getWaypointPhotoUrl = (waypoint: any): string | undefined => {
  if (!waypoint || !waypoint.post) return undefined;
  const post = waypoint.post;
  if (typeof post === 'object') {
    const url = post.photo || post.imageUrl || post.mediaUrl || post.media?.url;
    return resolvePhotoUrl(url);
  }
  return undefined;
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

const getLocationIdentity = (loc: Pick<LocationPin, 'postId' | 'number'>) => (
  loc.postId ? `post-${loc.postId}` : `location-${loc.number}`
);

interface JourneyPolyline {
  _id: string;
  title: string;
  user?: any;
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

  const sortedPolyline = [...(journey.polyline || [])]
    .filter((p) => p && (p.lat !== undefined || (p as any).latitude !== undefined))
    .sort((a, b) => {
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
      latitude: point.lat ?? (point as any).latitude,
      longitude: point.lng ?? (point as any).longitude,
      timestamp,
      segmentBreak,
    };
  }).filter(isValidMapCoordinate);
}



// Module-level lock to prevent double-navigation in rapid succession
let navigatePostLock = false;

function AllLocationsMapInner() {
  const [locations, setLocations] = useState<LocationPin[]>([]);
  const [journeys, setJourneys] = useState<JourneyPolyline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapFilter, setMapFilter] = useState<'posts' | 'journeys'>('posts');
  const [selectedPost, setSelectedPost] = useState<LocationPin | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<JourneyPolyline | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  const carouselRef = useRef<FlatList>(null);
  const isScrollingCarouselRef = useRef(false);

  const journeysWithOffsets = useMemo(() => {
    const coordsCount: { [key: string]: number } = {};
    return journeys.map((j) => {
      const startLat = j.startCoords?.lat ?? (j.startCoords as any)?.latitude;
      const startLng = j.startCoords?.lng ?? (j.startCoords as any)?.longitude;
      if (!startLat || !startLng) return j;
      const key = `${startLat.toFixed(4)},${startLng.toFixed(4)}`;
      const count = coordsCount[key] || 0;
      coordsCount[key] = count + 1;
      const offsetLat = startLat + count * 0.00018; // approx 20 meters vertical shift
      return {
        ...j,
        renderCoords: { lat: offsetLat, lng: startLng }
      };
    });
  }, [journeys]);

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

  useEffect(() => {
    setSelectedPost(null);
    setSelectedJourney(null);
  }, [mapFilter]);

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

  const navigateToPost = (postId: string, contentType: string, targetUserId: string) => {
    if (navigatePostLock) return;
    navigatePostLock = true;
    setTimeout(() => {
      navigatePostLock = false;
    }, 1000);

    if (contentType === 'short' || contentType === 'video') {
      router.push(`/user-shorts/${targetUserId}?shortId=${postId}`);
    } else {
      router.push(`/post/${postId}`);
    }
  };

  const renderSelectedPostCard = () => {
    if (!selectedPost || mapFilter === 'journeys') return null;
    const selectedIdentity = getLocationIdentity(selectedPost);
    const selectedIndex = validLocations.findIndex((loc) => getLocationIdentity(loc) === selectedIdentity);
    const carouselLocations = selectedIndex > 0
      ? [
          validLocations[selectedIndex],
          ...validLocations.slice(0, selectedIndex),
          ...validLocations.slice(selectedIndex + 1),
        ]
      : validLocations;

    return (
      <View
        style={[
          styles.carouselContainer,
          {
            bottom: insets.bottom + 8 + keyboardHeight,
          }
        ]}
      >
        <FlatList
          ref={carouselRef}
          data={carouselLocations}
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
          keyExtractor={(item) => `carousel-${getLocationIdentity(item)}`}
          renderItem={({ item }) => {
            const resolvedPhoto = resolvePhotoUrl(item.photo);
            const dateStr = item.date ? new Date(item.date).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }) : '';

            const isShort = item.contentType === 'short' || item.contentType === 'video';

            return (
              <View style={styles.carouselCardWrapper}>
                <View
                  style={[
                    styles.carouselCard,
                    {
                      backgroundColor: isDark ? 'rgba(20, 24, 33, 0.65)' : 'rgba(255, 255, 255, 0.65)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
                    },
                    isDark ? styles.shadowDark : styles.shadowLight,
                  ]}
                >
                  {Platform.OS !== 'android' ? (
                    <BlurView intensity={85} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(20, 24, 33, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]} />
                  )}

                  {/* Close Button */}
                  <TouchableOpacity
                    onPress={() => setSelectedPost(null)}
                    style={styles.previewCloseBtn}
                  >
                    <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
                  </TouchableOpacity>

                  <View style={styles.previewContent}>
                    {/* Photo / Thumbnail */}
                    {resolvedPhoto ? (
                      <ExpoImage
                        source={{ uri: resolvedPhoto }}
                        style={styles.previewThumbnail}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={[styles.previewThumbnailPlaceholder, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                        <Ionicons name={isShort ? 'videocam' : 'image'} size={20} color={theme.colors.textSecondary} />
                      </View>
                    )}

                    {/* Details Column */}
                    <View style={styles.previewTextCol}>
                      <Text style={[styles.previewTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {item.address || 'Posted Location'}
                      </Text>
                      <View style={styles.previewMetaRow}>
                        {dateStr ? (
                          <Text style={[styles.previewDate, { color: theme.colors.textSecondary }]}>
                            {dateStr}
                          </Text>
                        ) : null}
                        <View style={[styles.previewTypeBadge, { backgroundColor: isShort ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)' }]}>
                          <Text style={[styles.previewTypeBadgeText, { color: isShort ? '#EF4444' : '#3B82F6' }]}>
                            {isShort ? 'Short' : 'Post'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Action Button Row */}
                  <View style={styles.previewActionRow}>
                    {/* Directions Button */}
                    <TouchableOpacity
                      onPress={() => {
                        const routePost = item;
                        router.push({
                          pathname: '/map/current-location',
                          params: {
                            latitude: routePost.latitude.toString(),
                            longitude: routePost.longitude.toString(),
                            address: routePost.address || '',
                            locationName: routePost.address || '',
                            imageUrl: routePost.photo || '',
                            postId: routePost.postId || '',
                            userId: userId || 'current-user',
                            autoRoute: 'true',
                          }
                        });
                      }}
                      style={styles.previewDirectionBtn}
                    >
                      <LinearGradient
                        colors={['#3B82F6', '#10B981']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.previewBtnGradient}
                      >
                        <Ionicons name="navigate" size={14} color="#FFFFFF" />
                        <Text style={styles.previewBtnText}>Directions</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Open Details Button */}
                    <TouchableOpacity
                      onPress={() => {
                        const targetUserId = userId;
                        navigateToPost(item.postId || '', isShort ? 'short' : 'photo', targetUserId);
                        setSelectedPost(null);
                      }}
                      style={styles.previewViewBtn}
                    >
                      <View style={[styles.previewInnerViewBtn, { borderColor: theme.colors.border }]}>
                        <Ionicons name="eye" size={14} color={theme.colors.text} />
                        <Text style={[styles.previewBtnText, { color: theme.colors.text }]}>View Details</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      </View>
    );
  };

  const renderSelectedJourneyCard = () => {
    if (!selectedJourney || mapFilter !== 'journeys') return null;

    const startDateStr = selectedJourney.startedAt
      ? new Date(selectedJourney.startedAt).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';

    const distanceStr = selectedJourney.distanceTraveled != null
      ? `${(selectedJourney.distanceTraveled / 1000).toFixed(1)} km`
      : '0 km';

    const journeyTitle = selectedJourney.title || 
      (selectedJourney.startCity && selectedJourney.endCity 
        ? `${selectedJourney.startCity} to ${selectedJourney.endCity}`
        : selectedJourney.startCity 
          ? `Journey from ${selectedJourney.startCity}`
          : 'Saved Journey');

    return (
      <View
        style={[
          styles.previewCard,
          {
            bottom: insets.bottom + 8 + keyboardHeight,
            backgroundColor: isDark ? 'rgba(20, 24, 33, 0.65)' : 'rgba(255, 255, 255, 0.65)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
          },
          isDark ? styles.shadowDark : styles.shadowLight,
        ]}
      >
        {Platform.OS !== 'android' ? (
          <BlurView intensity={85} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(20, 24, 33, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]} />
        )}

        {/* Close Button */}
        <TouchableOpacity
          onPress={() => setSelectedJourney(null)}
          style={styles.previewCloseBtn}
        >
          <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.previewContent}>
          {/* Icon/Visual Badge */}
          <View style={[styles.previewThumbnailPlaceholder, { backgroundColor: 'rgba(80, 200, 120, 0.12)', width: 44, height: 44, borderRadius: 12 }]}>
            <Ionicons name="map" size={24} color="#50C878" />
          </View>

          {/* Details Column */}
          <View style={[styles.previewTextCol, { marginLeft: 12 }]}>
            <Text style={[styles.previewTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {journeyTitle}
            </Text>
            <View style={styles.previewMetaRow}>
              {startDateStr ? (
                <Text style={[styles.previewDate, { color: theme.colors.textSecondary }]}>
                  {startDateStr}
                </Text>
              ) : null}
              <View style={[styles.previewTypeBadge, { backgroundColor: 'rgba(80, 200, 120, 0.12)' }]}>
                <Text style={[styles.previewTypeBadgeText, { color: '#50C878' }]}>
                  {distanceStr}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Button Row */}
        <View style={styles.previewActionRow}>
          {/* View Details Button */}
          <TouchableOpacity
            onPress={() => {
              router.push(`/navigate/detail?journeyId=${selectedJourney._id}`);
              setSelectedJourney(null);
            }}
            style={[styles.previewDirectionBtn, { flex: 1 }]}
          >
            <LinearGradient
              colors={['#3B82F6', '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.previewBtnGradient}
            >
              <Ionicons name="eye" size={14} color="#FFFFFF" />
              <Text style={styles.previewBtnText}>View Details</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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

  const validLocations = useMemo(() => {
    return locations
      .map((loc) => ({
        ...loc,
        latitude: typeof loc.latitude === 'string' ? parseFloat(loc.latitude) : loc.latitude,
        longitude: typeof loc.longitude === 'string' ? parseFloat(loc.longitude) : loc.longitude,
      }))
      .filter(
        (loc) => isValidMapCoordinate({ latitude: loc.latitude, longitude: loc.longitude }) &&
          loc.latitude !== 0 &&
          loc.longitude !== 0
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [locations]);

  // Sync map center on selectedPost
  useEffect(() => {
    if (selectedPost && mapRef.current) {
      if (useWebViewFallback) {
        mapRef.current.injectJavaScript(`
          if (window.map) {
            window.map.panTo({ lat: ${selectedPost.latitude}, lng: ${selectedPost.longitude} });
          }
          true;
        `);
      } else {
        mapRef.current.animateToRegion({
          latitude: selectedPost.latitude,
          longitude: selectedPost.longitude,
          latitudeDelta: currentRegion?.latitudeDelta || 0.015,
          longitudeDelta: currentRegion?.longitudeDelta || 0.015,
        }, 300);
      }
    }
  }, [selectedPost]);

  // Zoom to fit selected journey polyline
  useEffect(() => {
    if (selectedJourney && mapRef.current) {
      let coords = getJourneyPolylineCoords(selectedJourney);
      if (coords.length === 0) {
        const startLat = selectedJourney.startCoords?.lat ?? (selectedJourney.startCoords as any)?.latitude;
        const startLng = selectedJourney.startCoords?.lng ?? (selectedJourney.startCoords as any)?.longitude;
        const endLat = selectedJourney.endCoords?.lat ?? (selectedJourney.endCoords as any)?.latitude;
        const endLng = selectedJourney.endCoords?.lng ?? (selectedJourney.endCoords as any)?.longitude;
        if (startLat && startLng) {
          coords.push({
            latitude: startLat,
            longitude: startLng,
            timestamp: Date.now(),
            segmentBreak: false,
          });
        }
        if (endLat && endLng) {
          coords.push({
            latitude: endLat,
            longitude: endLng,
            timestamp: Date.now(),
            segmentBreak: false,
          });
        }
      }
      if (coords.length > 0) {
        if (useWebViewFallback) {
          const boundsJson = JSON.stringify(coords.map(c => ({ lat: c.latitude, lng: c.longitude })));
          mapRef.current.injectJavaScript(`
            if (window.map) {
              var coords = ${boundsJson};
              var bounds = new google.maps.LatLngBounds();
              coords.forEach(function(c) {
                bounds.extend(new google.maps.LatLng(c.lat, c.lng));
              });
              window.map.fitBounds(bounds);
            }
            true;
          `);
        } else {
          setTimeout(() => {
            try {
              if (typeof mapRef.current?.fitToCoordinates === 'function') {
                mapRef.current.fitToCoordinates(coords, {
                  edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
                  animated: true,
                });
              }
            } catch (err) {
              logger.error('Error fitting to journey coordinates:', err);
            }
          }, 100);
        }
      }
    }
  }, [selectedJourney, useWebViewFallback]);

  // Scroll carousel to index when selectedPost is changed externally
  useEffect(() => {
    if (selectedPost && !isScrollingCarouselRef.current) {
      const selectedIdentity = getLocationIdentity(selectedPost);
      const idx = validLocations.findIndex(l => getLocationIdentity(l) === selectedIdentity);
      if (idx !== -1 && carouselRef.current) {
        carouselRef.current.scrollToIndex({ index: 0, animated: false });
      }
    }
  }, [selectedPost, validLocations]);

  const handleCarouselScroll = useCallback((event: any) => {
    if (!isScrollingCarouselRef.current) return;
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / screenWidth);
    if (index >= 0 && selectedPost) {
      const selectedIdentity = getLocationIdentity(selectedPost);
      const selectedIndex = validLocations.findIndex((loc) => getLocationIdentity(loc) === selectedIdentity);
      const carouselLocations = selectedIndex > 0
        ? [
            validLocations[selectedIndex],
            ...validLocations.slice(0, selectedIndex),
            ...validLocations.slice(selectedIndex + 1),
          ]
        : validLocations;
      if (index < carouselLocations.length) {
        const nextLoc = carouselLocations[index];
        if (getLocationIdentity(selectedPost) !== getLocationIdentity(nextLoc)) {
          setSelectedPost(nextLoc);
        }
      }
    }
    isScrollingCarouselRef.current = false;
  }, [validLocations, selectedPost]);

  const getCarouselItemLayout = useCallback((data: any, index: number) => ({
    length: screenWidth,
    offset: screenWidth * index,
    index,
  }), []);

  const clusteredLocations = useMemo(() => {
    const latDelta = sanitizeLatitudeDelta(currentRegion?.latitudeDelta, 0.1);
    
    const dedupedLocations: LocationPin[] = [];
    const seenLocationIds = new Set<string>();
    validLocations.forEach((m) => {
      const key = getLocationIdentity(m);
      if (!seenLocationIds.has(key)) {
        seenLocationIds.add(key);
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

  const clusterState = useMemo(() => {
    const mapping = new Map<string, { isCluster: boolean; latitude: number; longitude: number; clusterId: string }>();
    clusteredLocations.forEach((c) => {
      c.locations.forEach((loc) => {
        const id = getLocationIdentity(loc);
        mapping.set(String(id), {
          isCluster: c.isCluster,
          latitude: c.latitude,
          longitude: c.longitude,
          clusterId: c.id,
        });
      });
    });
    return mapping;
  }, [clusteredLocations]);

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



  // Journey tracking — moved here from /map/current-location so the start /
  // active / paused controls live with the rest of the user's travel data
  // (past journeys, posts, stats).
  const {
    isTracking,
    isPaused,
    distance: journeyDistance,
    startJourneyRecording,
    pauseJourneyRecording,
    resumeJourneyRecording,
    stopJourneyRecording,
  } = useJourney();
  const journeyDuration = useJourneyDuration();
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


      }

      // Process journey polylines
      if (journeysResult.status === 'fulfilled') {
        const data = journeysResult.value;
        const rawJourneys = data?.journeys ?? [];
        // Filter journeys that have start coordinates or polyline data, and sort reverse-chronologically
        const withPolylines = (rawJourneys.filter(
          (j: any) => (j.polyline && j.polyline.length > 1) || (j.startCoords && (j.startCoords.lat ?? j.startCoords.latitude) && (j.startCoords.lng ?? j.startCoords.longitude))
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
          const startLat = j.startCoords?.lat ?? (j.startCoords as any)?.latitude;
          const startLng = j.startCoords?.lng ?? (j.startCoords as any)?.longitude;
          const endLat = j.endCoords?.lat ?? (j.endCoords as any)?.latitude;
          const endLng = j.endCoords?.lng ?? (j.endCoords as any)?.longitude;
          const startCity = startLat && startLng
            ? await geocode(startLat, startLng) : '';
          const endCity = endLat && endLng
            ? await geocode(endLat, endLng) : '';
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
      const startLat = j.startCoords?.lat ?? (j.startCoords as any)?.latitude;
      const startLng = j.startCoords?.lng ?? (j.startCoords as any)?.longitude;
      const endLat = j.endCoords?.lat ?? (j.endCoords as any)?.latitude;
      const endLng = j.endCoords?.lng ?? (j.endCoords as any)?.longitude;
      if (startLat && startLng) {
        allCoords.push({ latitude: startLat, longitude: startLng });
      }
      if (endLat && endLng) {
        allCoords.push({ latitude: endLat, longitude: endLng });
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

    validLocations.forEach((loc) => {
      if (isValidMapCoordinate({ latitude: loc.latitude, longitude: loc.longitude }) && loc.latitude !== 0 && loc.longitude !== 0) {
        if (loc.latitude < minLat) minLat = loc.latitude;
        if (loc.latitude > maxLat) maxLat = loc.latitude;
        if (loc.longitude < minLng) minLng = loc.longitude;
        if (loc.longitude > maxLng) maxLng = loc.longitude;
        hasCoords = true;
      }
    });

    journeys.forEach((j) => {
      const startLat = j.startCoords?.lat ?? (j.startCoords as any)?.latitude;
      const startLng = j.startCoords?.lng ?? (j.startCoords as any)?.longitude;
      const endLat = j.endCoords?.lat ?? (j.endCoords as any)?.latitude;
      const endLng = j.endCoords?.lng ?? (j.endCoords as any)?.longitude;
      if (isValidMapCoordinate({ latitude: startLat, longitude: startLng }) && startLat !== 0 && startLng !== 0) {
        if (startLat < minLat) minLat = startLat;
        if (startLat > maxLat) maxLat = startLat;
        if (startLng < minLng) minLng = startLng;
        if (startLng > maxLng) maxLng = startLng;
        hasCoords = true;
      }
      if (isValidMapCoordinate({ latitude: endLat, longitude: endLng }) && endLat !== 0 && endLng !== 0) {
        if (endLat < minLat) minLat = endLat;
        if (endLat > maxLat) maxLat = endLat;
        if (endLng < minLng) minLng = endLng;
        if (endLng > maxLng) maxLng = endLng;
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
    }) || { latitude: 20, longitude: 0, latitudeDelta: 120, longitudeDelta: 320 };
  }, [validLocations, journeys]);

  const pinRatio = useMemo(() => {
    const delta = currentRegion?.latitudeDelta ?? mapRegion?.latitudeDelta ?? 0.1;
    if (delta <= 0.02) return 1.0;
    if (delta >= 0.05) return 0.0;
    return (0.05 - delta) / (0.05 - 0.02);
  }, [currentRegion, mapRegion]);

  // Keep backward-compatible getter for WebView HTML builder
  const getMapRegion = useCallback(() => mapRegion || { latitude: 20, longitude: 0, latitudeDelta: 120, longitudeDelta: 320 }, [mapRegion]);

  // ──────────────────────────────────────────────────────
  // WebView HTML (used on Expo Go Android where native maps crash)
  // ──────────────────────────────────────────────────────
  const getWebMapHTML = useCallback(() => {
    const region = getMapRegion();
    const markersData = (mapFilter === 'posts') ? validLocations.map((loc) => ({
      lat: loc.latitude,
      lng: loc.longitude,
      photo: resolvePhotoUrl(loc.photo),
      cityName: loc.address,
      number: loc.number,
      postId: loc.postId,
      contentType: loc.contentType,
      userId: userId,
    })) : [];
    const filteredJourneys = (mapFilter === 'journeys') ? journeysWithOffsets : [];
    const polylinePaths = filteredJourneys.map((j) => {
      const startLat = j.startCoords?.lat ?? (j.startCoords as any)?.latitude;
      const startLng = j.startCoords?.lng ?? (j.startCoords as any)?.longitude;
      const endLat = j.endCoords?.lat ?? (j.endCoords as any)?.latitude;
      const endLng = j.endCoords?.lng ?? (j.endCoords as any)?.longitude;
      const renderLat = (j as any).renderCoords?.lat ?? (j as any).renderCoords?.latitude ?? startLat;
      const renderLng = (j as any).renderCoords?.lng ?? (j as any).renderCoords?.longitude ?? startLng;
      return {
        _id: j._id,
        title: (j.startCity && j.endCity) ? `${j.startCity} to ${j.endCity}` : (j.title || 'Saved Journey'),
        path: j.polyline ? j.polyline
          .map((p) => ({ latitude: p.lat ?? (p as any).latitude, longitude: p.lng ?? (p as any).longitude }))
          .filter(isValidMapCoordinate)
          .map((p) => ({ lat: p.latitude, lng: p.longitude })) : [],
        startCoords: { lat: startLat, lng: startLng },
        renderCoords: { lat: renderLat, lng: renderLng },
        endCoords: { lat: endLat, lng: endLng },
        startLetter: j.startCity ? j.startCity[0].toUpperCase() : 'S',
        endLetter: j.endCity ? j.endCity[0].toUpperCase() : 'E',
        startCity: j.startCity || 'Start',
        endCity: j.endCity || 'End',
        waypoints: (j.waypoints || []).map((w) => {
          const photoUrl = getWaypointPhotoUrl(w);
          const postId = w.post?._id || w.post;
          const contentType = w.contentType || w.post?.type || 'photo';
          return {
            lat: w.lat ?? w.latitude,
            lng: w.lng ?? w.longitude,
            photo: photoUrl,
            postId: typeof postId === 'string' ? postId : postId?.toString(),
            contentType,
            userId: j.user?._id || j.user || userId,
          };
        }).filter((w) => (w.lat ?? (w as any).latitude) && (w.lng ?? (w as any).longitude) && w.photo),
      };
    });

    const centerLat = region?.latitude ?? 20;
    const centerLng = region?.longitude ?? 0;
    const regionDelta = region?.latitudeDelta ?? 0.1;
    const zoomLevel = Math.min(12, Math.max(2, Math.floor(15 - Math.log2(Math.max(regionDelta, 1)))));
    const zoomLevelVal = zoomLevel;

    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
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
.map-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, ${isDark ? '#2DD4BF' : '#3B82F6'} 0%, #10B981 100%);
  border: 2.5px solid #FFFFFF;
}
.map-cluster-dot-2 {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, ${isDark ? '#2DD4BF' : '#3B82F6'} 0%, #10B981 100%);
  border: 2.5px solid #FFFFFF;
}
.map-cluster-dot-3plus {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, ${isDark ? '#2DD4BF' : '#3B82F6'} 0%, #10B981 100%);
  border: 2.5px solid #FFFFFF;
}
</style>
<script>
window.map = null;
window.bounds = null;
function initMap(){
  var isDark = ${isDark};
  window.map = new google.maps.Map(document.getElementById('map'),{
    center:{lat:${centerLat},lng:${centerLng}},
    zoom:${zoomLevelVal},minZoom:3,mapTypeId:'roadmap',language:'en',styles:${JSON.stringify(mapStyle.customMapStyle)},disableDefaultUI:true,zoomControl:true,gestureHandling:'greedy',isFractionalZoomEnabled:true
  });
  var map = window.map;
  window.bounds = new google.maps.LatLngBounds();
  var bounds = window.bounds;
  var activeOverlays=[];

  // Journey polylines + start/end markers
  var journeys=${JSON.stringify(polylinePaths)};
  var selectedJourneyId=${selectedJourney ? JSON.stringify(selectedJourney._id) : 'null'};

  journeys.forEach(function(j){
    var isSelected = selectedJourneyId && selectedJourneyId === j._id;
    var selectJourneyHandler = function() {
      if(window.ReactNativeWebView){
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'selectJourney',
          journeyId: j._id
        }));
      }
    };

    var markerPos = j.renderCoords || j.startCoords;

    // 1. Representing Marker (Always show for all journeys)
    if(markerPos&&markerPos.lat&&markerPos.lng){
      var size = 36;
      var fill, strokeColor, iconColor;
      if (isSelected) {
        fill = 'url(#activeGrad)';
        strokeColor = '#FFFFFF';
        iconColor = '#FFFFFF';
      } else {
        fill = isDark ? 'rgba(20, 24, 33, 0.85)' : 'rgba(255, 255, 255, 0.9)';
        strokeColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.1)';
        iconColor = isDark ? '#94A3B8' : '#64748B';
      }
      
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">' +
        '<defs>' +
        '  <linearGradient id="activeGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
        '    <stop offset="0%" stop-color="#3B82F6" />' +
        '    <stop offset="100%" stop-color="#10B981" />' +
        '  </linearGradient>' +
        '</defs>' +
        '<circle cx="18" cy="18" r="16" fill="' + fill + '" stroke="' + strokeColor + '" stroke-width="2" />' +
        '<g transform="translate(6, 6) scale(0.9)" fill="' + iconColor + '">' +
        '  <path d="M19 10h-6V8h3c.6 0 1-.4 1-1s-.4-1-1-1h-3V4c0-.6-.4-1-1-1s-1 .4-1 1v2H8c-.6 0-1 .4-1 1s.4 1 1 1h3v2H5c-.6 0-1 .4-1 1s.4 1 1 1h6v6c0 .6.4 1 1 1s1-.4 1-1v-6h6c.6 0 1-.4 1-1s-.4-1-1-1z"/>' +
        '</g>' +
        '</svg>';

      var repMarker = new google.maps.Marker({
        position: {lat: markerPos.lat, lng: markerPos.lng},
        map: map,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
          size: new google.maps.Size(size, size),
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(size/2, size/2)
        },
        zIndex: isSelected ? 100 : 10
      });
      repMarker.addListener('click', selectJourneyHandler);
      
      // Extend bounds to start coordinate for all journeys
      bounds.extend(new google.maps.LatLng(markerPos.lat, markerPos.lng));
    }

    // 2. Polyline Path + End marker (ONLY show if selected)
    if(isSelected) {
      if(j.path&&j.path.length>1){
        var glowPoly = new google.maps.Polyline({
          path: j.path,
          geodesic: true,
          strokeColor: '${mapStyle.routeColor}',
          strokeOpacity: 0.22,
          strokeWeight: 12,
          map: map
        });
        var corePoly = new google.maps.Polyline({
          path: j.path,
          geodesic: true,
          strokeColor: '${mapStyle.routeColor}',
          strokeOpacity: 1,
          strokeWeight: 4,
          map: map
        });
        glowPoly.addListener('click', selectJourneyHandler);
        corePoly.addListener('click', selectJourneyHandler);
        j.path.forEach(function(p){bounds.extend(new google.maps.LatLng(p.lat,p.lng));});
      }
      
      // End marker (Omit title to satisfy single name requirement)
      if(j.endCoords&&j.endCoords.lat&&j.endCoords.lng){
        var endPos = new google.maps.LatLng(j.endCoords.lat, j.endCoords.lng);
        var endDiv = document.createElement('div');
        endDiv.style.cssText = 'position:absolute;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:90;';
        endDiv.setAttribute('data-anchor', 'center');
        endDiv.innerHTML = '<div style="width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid #FFFFFF; background-color: ${ALERT_RED};"></div>';
        endDiv.addEventListener('click', selectJourneyHandler);
        new PhotoOverlay(endPos, endDiv);
        bounds.extend(endPos);
      }

      // Draw waypoints (photos posted along the way)
      if(j.waypoints && j.waypoints.length > 0) {
        j.waypoints.forEach(function(wp) {
          if (wp.lat && wp.lng && wp.photo) {
            var wpPos = new google.maps.LatLng(wp.lat, wp.lng);
            var wpDiv = document.createElement('div');
            wpDiv.style.cssText = 'position:absolute;cursor:pointer;display:flex;align-items:center;justify-content:center;';
            wpDiv.setAttribute('data-anchor', 'center');
            wpDiv.innerHTML = '<div style="width: 32px; height: 32px; border-radius: 50%; border: 2.5px solid #FFFFFF; overflow: hidden; background-image: url(\\'' + wp.photo + '\\'); background-size: cover; background-position: center; transition: transform 0.2s ease;"></div>';
            
            // Highlight / hover effects
            wpDiv.firstChild.addEventListener('mouseenter', function() {
              wpDiv.firstChild.style.transform = 'scale(1.1)';
            });
            wpDiv.firstChild.addEventListener('mouseleave', function() {
              wpDiv.firstChild.style.transform = 'scale(1.0)';
            });

            wpDiv.addEventListener('click', function(e) {
              e.stopPropagation();
              if(window.ReactNativeWebView){
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'navigatePost',
                  postId: wp.postId,
                  contentType: wp.contentType,
                  userId: wp.userId
                }));
              }
            });

            new PhotoOverlay(wpPos, wpDiv);
            bounds.extend(wpPos);
          }
        });
      }
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
      var key=m.postId ? ('post-' + m.postId) : ('location-' + m.number);
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
    items.forEach(function(it, idx){ it.idx = idx; });
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
    var pinRatio=0;
    if(zoom>=15){
      pinRatio=1.0;
    }else if(zoom<=12){
      pinRatio=0.0;
    }else{
      pinRatio=(zoom-12)/3.0;
    }

    var gs=getGridSize(zoom);
    var clusters=clusterMarkers(markers,gs);
    var selectedPostId = ${selectedPost ? JSON.stringify(selectedPost.postId) : 'null'};

    clusters.forEach(function(cluster){
      var pos=new google.maps.LatLng(cluster.lat,cluster.lng);
      var div=document.createElement('div');
      div.style.cssText='position:absolute;cursor:pointer;display:flex;align-items:center;justify-content:center;';

      if (cluster.items.length === 1) {
        var main = cluster.items[0];
        var isViewingAny = false;
        var isSelected = selectedPostId && selectedPostId === main.postId;
        
        var totalCount = markers.length;
        var showPin = main.idx < Math.round(pinRatio * totalCount);

        if (isSelected || showPin) {
          div.setAttribute('data-anchor', 'bottom');
          div.innerHTML = \`${LOCATION_PIN_SVG}\`;
        } else {
          div.setAttribute('data-anchor', 'center');
          div.innerHTML = '<div class="map-dot"></div>';
        }
      } else if (cluster.items.length === 2) {
        div.setAttribute('data-anchor', 'center');
        div.innerHTML = '<div class="map-cluster-dot-2"></div>';
      } else {
        div.setAttribute('data-anchor', 'center');
        div.innerHTML = '<div class="map-cluster-dot-3plus"></div>';
      }

      // Tap handler: single marker triggers selectPost event, cluster zooms in.
      div.addEventListener('click',function(e){
        e.stopPropagation();
        if(cluster.items.length===1){
          if(window.ReactNativeWebView){
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'selectPost',
              location: cluster.items[0]
            }));
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
    map.fitBounds(bounds,40);
    google.maps.event.addListenerOnce(map,'bounds_changed',function(){
      if(map.getZoom()>15)map.setZoom(15);
      renderClusters();
    });
  }else{
    renderClusters();
  }
  map.addListener('zoom_changed',function(){renderClusters();});
  map.addListener('click',function(){
    if(window.ReactNativeWebView){
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'clearSelection' }));
    }
  });
}
</script>
</head><body>
<div id="map"></div>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${WEBVIEW_API_KEY || ''}&language=en&callback=initMap"></script>
</body></html>`;
  }, [locations, journeys, mapFilter, getMapRegion, WEBVIEW_API_KEY, mapStyle.customMapStyle, mapStyle.routeColor, mapStyle.routeGlowColor, selectedJourney, selectedPost, pinRatio]);

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
                navigateToPost(data.postId, data.contentType || 'photo', targetUserId);
              } else if (data.type === 'selectPost' && data.location) {
                const loc = {
                  ...data.location,
                  latitude: typeof data.location.latitude === 'string'
                    ? parseFloat(data.location.latitude)
                    : data.location.latitude ?? data.location.lat,
                  longitude: typeof data.location.longitude === 'string'
                    ? parseFloat(data.location.longitude)
                    : data.location.longitude ?? data.location.lng,
                };
                setSelectedPost(loc);
              } else if (data.type === 'selectJourney' && data.journeyId) {
                const j = journeys.find(item => item._id === data.journeyId);
                if (j) {
                  setSelectedJourney(j);
                }
              } else if (data.type === 'clearSelection') {
                setSelectedPost(null);
                setSelectedJourney(null);
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

    const region = getMapRegion() || { latitude: 20, longitude: 0, latitudeDelta: 120, longitudeDelta: 320 };
    const safeLatitudeDelta = sanitizeLatitudeDelta(currentRegion?.latitudeDelta, region?.latitudeDelta ?? 0.1);

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={getMapProvider()}
        {...mapStyle.nativeMapProps}
        minZoomLevel={3}
        cameraZoomRange={Platform.OS === 'ios' ? {
          minCenterCoordinateDistance: 500,
          maxCenterCoordinateDistance: 20000000,
        } : undefined}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={() => {
          setSelectedPost(null);
          setSelectedJourney(null);
        }}
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
              j.polyline?.map((p) => ({ latitude: p.lat ?? (p as any).latitude, longitude: p.lng ?? (p as any).longitude })) || []
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
        {/* Journey representing markers */}
        {(mapFilter === 'journeys') && journeysWithOffsets.map((j) => {
          const isSelected = selectedJourney && selectedJourney._id === j._id;
          
          const startLat = (j as any).renderCoords?.lat || j.startCoords?.lat;
          const startLng = (j as any).renderCoords?.lng || j.startCoords?.lng;
          const hasStartCoords = isValidMapCoordinate({ latitude: startLat, longitude: startLng });

          if (!hasStartCoords) return null;

          return (
            <SafeMarker
              key={`rep-${j._id}`}
              coordinate={{ latitude: startLat, longitude: startLng }}
              onPress={() => setSelectedJourney(j)}
              anchor={{ x: 0.5, y: 0.5 }}
              repaintTriggers={[isSelected, isDark]}
            >
              <View style={styles.journeyRepMarker} pointerEvents="none">
                {isSelected ? (
                  <LinearGradient
                    colors={['#3B82F6', '#10B981']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.journeyRepGradient, styles.journeyRepSelectedGradient]}
                  >
                    <Ionicons name="trail-sign" size={16} color="#FFFFFF" />
                  </LinearGradient>
                ) : (
                  <View style={[
                    styles.journeyRepGradient,
                    {
                      backgroundColor: isDark ? 'rgba(20, 24, 33, 0.85)' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.08)',
                    }
                  ]}>
                    <Ionicons
                      name="trail-sign-outline"
                      size={16}
                      color={isDark ? '#94A3B8' : '#64748B'}
                    />
                  </View>
                )}
              </View>
            </SafeMarker>
          );
        })}

        {/* Selected journey's route polyline, end marker, and waypoints */}
        {(mapFilter === 'journeys') && selectedJourney && (() => {
          const selectedJWithOffset = journeysWithOffsets.find(j => j._id === selectedJourney._id);
          const j = selectedJWithOffset || selectedJourney;
          const elements: React.ReactNode[] = [];

          if (j.polyline && j.polyline.length >= 2) {
            const coords = getJourneyPolylineCoords(j);
            elements.push(
              <PolylineRenderer
                key={`polyline-${j._id}`}
                coordinates={coords}
                color={mapStyle.routeColor}
                glowColor={mapStyle.routeGlowColor}
                strokeWidth={4}
                simplifyDistance={10}
                applyKalman={false}
                latitudeDelta={safeLatitudeDelta}
                onPress={() => setSelectedJourney(j)}
              />
            );
          }

          const endLat = j.endCoords?.lat ?? (j.endCoords as any)?.latitude;
          const endLng = j.endCoords?.lng ?? (j.endCoords as any)?.longitude;
          if (isValidMapCoordinate({ latitude: endLat, longitude: endLng })) {
            elements.push(
              <SafeMarker
                key={`end-${j._id}`}
                coordinate={{ latitude: endLat, longitude: endLng }}
                anchor={{ x: 0.5, y: 0.5 }}
                onPress={() => setSelectedJourney(j)}
                repaintTriggers={[true]}
              >
                <PremiumMapMarker pointType="end" isActive={true} />
              </SafeMarker>
            );
          }

          if (j.waypoints && j.waypoints.length > 0) {
            j.waypoints.forEach((wp, wpIdx) => {
              const photoUrl = getWaypointPhotoUrl(wp);
              const postId = wp.post?._id || wp.post;
              const contentType = wp.contentType || wp.post?.type || 'photo';
              const wpLat = wp.lat ?? wp.latitude;
              const wpLng = wp.lng ?? wp.longitude;
              if (photoUrl && isValidMapCoordinate({ latitude: wpLat, longitude: wpLng })) {
                const wpKey = `${j._id}-${wpIdx}`;
                elements.push(
                  <SafeMarker
                    key={`wp-${j._id}-${wpIdx}`}
                    coordinate={{ latitude: wpLat, longitude: wpLng }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    onPress={() => {
                      const targetUserId = j.user?._id || j.user || userId;
                      navigateToPost(postId, contentType, targetUserId);
                    }}
                    repaintTriggers={[photoUrl, !!loadedImages[wpKey]]}
                  >
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
                          if (!loadedImages[wpKey]) {
                            setLoadedImages(prev => ({ ...prev, [wpKey]: true }));
                          }
                        }}
                      />
                    </View>
                  </SafeMarker>
                );
              }
            });
          }

          return elements;
        })()}

        {/* Post markers — shown when filter is 'posts' */}
        {(mapFilter === 'posts') && (() => {
          const seen = new Set<string>();
          const dedupedLocations: typeof validLocations = [];
          validLocations.forEach((loc) => {
            const identity = getLocationIdentity(loc);
            if (!seen.has(identity)) {
              seen.add(identity);
              dedupedLocations.push(loc);
            }
          });
          return (
            <>
              {dedupedLocations.map((loc) => {
                const identity = getLocationIdentity(loc);
                const state = clusterState.get(identity);
                const isSelected = !!selectedPost && getLocationIdentity(selectedPost) === identity;
                const locIndex = validLocations.findIndex(l => getLocationIdentity(l) === identity);
                const totalCount = validLocations.length;
                const showPin = locIndex !== -1 && (locIndex < Math.round(pinRatio * totalCount));

                const targetLat = state ? state.latitude : loc.latitude;
                const targetLng = state ? state.longitude : loc.longitude;
                const visible = state ? !state.isCluster : true;

                return (
                  <ClusteredMarker
                    key={`loc-${identity}`}
                    location={loc}
                    targetCoordinate={{ latitude: targetLat, longitude: targetLng }}
                    visible={visible || isSelected}
                    isSelected={isSelected}
                    showPin={showPin}
                    onPress={() => setSelectedPost(loc)}
                  >
                    <PremiumMapMarker 
                      isActive={isSelected} 
                      icon="location" 
                      renderAsDot={!showPin && !isSelected}
                    />
                  </ClusteredMarker>
                );
              })}
              {clusteredLocations.filter(c => c.isCluster).map((cluster) => (
                <ClusteredGroupMarker
                  key={cluster.id}
                  cluster={cluster}
                  onPress={() => handleClusterPress(cluster)}
                  isDark={isDark}
                />
              ))}
            </>
          );
        })()}

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



      {/* Floating Bottom Cockpit Overlay */}
      {isOwnPage && mapFilter === 'journeys' && !selectedPost && (
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

      {/* Google Maps style glassy compact preview card */}
      {renderSelectedPostCard()}
      {renderSelectedJourneyCard()}
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
  floatingBottomPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    gap: 6,
    overflow: 'hidden',
  },
  actionBtnTouch: {
    width: '100%',
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  previewCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    overflow: 'hidden',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 16,
  },
  previewThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  previewThumbnailPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  previewTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  previewTypeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  previewActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  previewDirectionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewViewBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewInnerViewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    gap: 6,
  },
  previewBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  previewBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  clusterMarkerContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clusterMarkerCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  clusterMarkerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  clusterDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  carouselContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
  },
  carouselCardWrapper: {
    width: screenWidth,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  carouselCard: {
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    overflow: 'hidden',
  },
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
  journeyRepMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyRepGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  journeyRepSelectedGradient: {
    borderColor: '#FFFFFF',
    shadowColor: '#10B981',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  journeyRepText: {
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 140,
  },
  journeyRepSelectedText: {
    color: '#FFFFFF',
  },
  journeyRepArrow: {
    width: 0,
    height: 0,
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
