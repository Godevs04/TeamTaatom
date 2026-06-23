import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  Image,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import NavBar from '../../components/NavBar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAlert } from '../../context/AlertContext';
import { useJourney } from '../../context/JourneyContext';
import { getJourneyDetail, updateJourneyTitle, deleteJourney } from '../../services/journey';
import { MapView, Marker, useWebViewFallback, getMapProvider } from '../../utils/mapsWrapper';
import { getGoogleMapsApiKeyForWebView } from '../../utils/maps';
import PolylineRenderer from '../../components/PolylineRenderer';
import GlassMapPanel from '../../components/GlassMapPanel';
import PremiumMapMarker from '../../components/PremiumMapMarker';
import SafeMarker from '../../components/SafeMarker';
import ShareModal from '../../components/ShareModal';
import { useMapStyle } from '../../hooks/useMapStyle';
import logger from '../../utils/logger';
import { Image as ExpoImage } from 'expo-image';
import { getApiUrl } from '../../utils/config';
import {
  isValidMapCoordinate,
  sanitizeLatitudeDelta,
  sanitizeMapRegion,
} from '../../utils/mapSafety';

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

function getJourneyPolylineCoords(journey: any) {
  const sessionStarts = (journey?.sessions || [])
    .slice(1)
    .map((session: any) => new Date(session.startedAt).getTime())
    .filter((time: number) => Number.isFinite(time))
    .sort((a: number, b: number) => a - b);

  return (journey?.polyline || []).map((point: any, index: number, points: any[]) => {
    const timestamp = point.timestamp ? new Date(point.timestamp).getTime() : undefined;
    const prevTimestamp = index > 0 && points[index - 1]?.timestamp
      ? new Date(points[index - 1].timestamp).getTime()
      : undefined;
    const segmentBreak = !!timestamp && !!prevTimestamp &&
      sessionStarts.some((start: number) => start > prevTimestamp && start <= timestamp);

    return {
      latitude: point.lat ?? point.latitude,
      longitude: point.lng ?? point.longitude,
      timestamp,
      accuracy: point.accuracy || 0,
      segmentBreak,
    };
  });
}

/**
 * Journey Detail Screen
 *
 * Shows a completed/active journey with:
 * - Map with polyline path and waypoint markers
 * - Journey stats (distance, duration, waypoints)
 * - List of posts made during the journey
 */
export default function JourneyDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme, isDark } = useTheme();
  const mapStyle = useMapStyle();
  const journeyId = typeof params.journeyId === 'string' ? params.journeyId : '';
  const insets = useSafeAreaInsets();

  const navigateToPost = (postId: string, contentType: string, userId: string) => {
    const globalObj = global as any;
    if (globalObj.navigationLock) return;
    globalObj.navigationLock = true;
    setTimeout(() => {
      globalObj.navigationLock = false;
    }, 1000);

    if (contentType === 'short' || contentType === 'video') {
      router.push(`/user-shorts/${userId}?shortId=${postId}`);
    } else {
      router.push(`/post/${postId}`);
    }
  };

  const { showAlert, showSuccess, showError: showErrorAlert } = useAlert();
  const { discardActiveJourney } = useJourney();
  const [journey, setJourney] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [latitudeDelta, setLatitudeDelta] = useState(0.1);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchJourney = async () => {
      if (!journeyId) {
        setError('No journey ID provided');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getJourneyDetail(journeyId);
        setJourney(data.journey);
      } catch (err: any) {
        logger.error('[JourneyDetail] Failed to load journey:', err);
        setError(err.message || 'Failed to load journey');
      } finally {
        setLoading(false);
      }
    };
    fetchJourney();
  }, [journeyId]);

  const formatDistance = (meters: number) => {
    if (!meters) return '0 m';
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  };

  const formatDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const seconds = Math.floor((end - start) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return GROWTH_GREEN;
      case 'paused': return ACTION_BLUE;
      case 'completed': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const handleShare = () => {
    setShowMenu(false);
    setShowShareModal(true);
  };

  const handleEditTitle = () => {
    setEditTitle(journey?.title || '');
    setShowMenu(false);
    setShowEditModal(true);
  };

  const handleSaveTitle = async () => {
    if (!journeyId) return;
    try {
      setIsSaving(true);
      await updateJourneyTitle(journeyId, editTitle);
      setJourney((prev: any) => ({ ...prev, title: editTitle.trim() }));
      setShowEditModal(false);
      showAlert('Updated', 'Journey name updated successfully');
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to update title');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    setShowMenu(false);
    Alert.alert(
      'Delete Journey?',
      'This will permanently delete this journey. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear from AsyncStorage and reset local state if this is the active journey
              const storedId = await AsyncStorage.getItem('activeJourneyId');
              if (storedId === journeyId) {
                await discardActiveJourney().catch(() => {});
              }
              await deleteJourney(journeyId);
              router.back();
              // Small delay so the previous screen is visible when the alert appears
              setTimeout(() => {
                showSuccess('Journey has been deleted');
              }, 300);
            } catch (err: any) {
              showErrorAlert(err.message || 'Failed to delete journey');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title="Journey" showBack={true} onBack={() => router.back()} />
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={GROWTH_GREEN} />
        </View>
      </View>
    );
  }

  if (error || !journey) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <NavBar title="Journey" showBack={true} onBack={() => router.back()} />
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={ALERT_RED} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>{error || 'Journey not found'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.retryBtn, { backgroundColor: GROWTH_GREEN }]}>
            <Text style={styles.retryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const waypointPosts = (journey.waypoints || []).filter((w: any) => w.post);
  const statusColor = getStatusColor(journey.status);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <NavBar
        title={journey.title || 'Journey'}
        showBack={true}
        onBack={() => router.back()}
        rightComponent={
          <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.backBtn}>
            <Ionicons name="ellipsis-vertical" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        }
      />

      {/* Dropdown Menu */}
      {showMenu && (
        <View style={[styles.menuDropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, top: insets.top + 70 }]}>
          <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={18} color={theme.colors.text} />
            <Text style={[styles.menuItemText, { color: theme.colors.text }]}>Share Journey</Text>
          </TouchableOpacity>
          <View style={[styles.menuDivider, { backgroundColor: theme.colors.border }]} />
          <TouchableOpacity style={styles.menuItem} onPress={handleEditTitle}>
            <Ionicons name="pencil" size={18} color={theme.colors.text} />
            <Text style={[styles.menuItemText, { color: theme.colors.text }]}>Edit Name</Text>
          </TouchableOpacity>
          <View style={[styles.menuDivider, { backgroundColor: theme.colors.border }]} />
          <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
            <Ionicons name="trash" size={18} color={ALERT_RED} />
            <Text style={[styles.menuItemText, { color: ALERT_RED }]}>Delete Journey</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Edit Title Modal */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowEditModal(false)}
        >
          <View
            style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit Journey Name</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Journey name"
              placeholderTextColor={theme.colors.textSecondary}
              maxLength={100}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: theme.colors.border, borderWidth: 1 }]}
                onPress={() => setShowEditModal(false)}
                disabled={isSaving}
              >
                <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: GROWTH_GREEN }]}
                onPress={handleSaveTitle}
                disabled={isSaving}
              >
                {isSaving ? (
                  <LoadingGlobe size="small" color="white" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: 'white' }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false} onScrollBeginDrag={() => showMenu && setShowMenu(false)}>
        {/* Map */}
        <View style={styles.mapContainer}>
          {useWebViewFallback ? (() => {
            const WV_KEY = getGoogleMapsApiKeyForWebView();
            if (!WV_KEY || !journey.polyline?.length) {
              return (
                <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' }]}>
                  <Ionicons name="map-outline" size={48} color="#9CA3AF" />
                </View>
              );
            }
            const center = journey.polyline[Math.floor(journey.polyline.length / 2)];
            const polyCoords = JSON.stringify(getJourneyPolylineCoords(journey).map((p) => ({
              lat: p.latitude,
              lng: p.longitude,
              segmentBreak: p.segmentBreak,
            })));
            const wps = (journey.waypoints || []).filter((w: any) => w.lat && w.lng);
            const wpMarkers = wps.map((w: any, i: number) => {
              const photoUrl = getWaypointPhotoUrl(w);
              const postId = w.post?._id || w.post;
              const contentType = w.contentType || w.post?.type || 'photo';
              const targetUserId = journey.user?._id || journey.user;

              if (photoUrl) {
                return `
                  (function() {
                    var pos = new google.maps.LatLng(${w.lat}, ${w.lng});
                    var div = document.createElement('div');
                    div.style.cssText = 'position:absolute;cursor:pointer;display:flex;align-items:center;justify-content:center;';
                    div.setAttribute('data-anchor', 'center');
                    div.innerHTML = '<div style="width: 32px; height: 32px; border-radius: 50%; border: 2.5px solid #FFFFFF; overflow: hidden; background-image: url(\\'${photoUrl}\\'); background-size: cover; background-position: center; transition: transform 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.25);"></div>';
                    
                    div.firstChild.addEventListener('mouseenter', function() {
                      div.firstChild.style.transform = 'scale(1.1)';
                    });
                    div.firstChild.addEventListener('mouseleave', function() {
                      div.firstChild.style.transform = 'scale(1.0)';
                    });
                    div.addEventListener('click', function(e) {
                      e.stopPropagation();
                      if(window.ReactNativeWebView){
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'navigatePost',
                          postId: '${postId}',
                          contentType: '${contentType}',
                          userId: '${targetUserId}'
                        }));
                      }
                    });
                    new PhotoOverlay(pos, div);
                  })();
                `;
              } else {
                const wpIcon = contentType === 'video' 
                  ? '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="' + (isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)') + '" stroke="' + (isDark ? 'rgba(45,212,191,0.6)' : 'rgba(59,130,246,0.6)') + '" stroke-width="1.5"/><path d="M16 9.5l-3 2v-3.5a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5v-1.5l3 2a.3.3 0 0 0 .5-.2v-5.6a.3.3 0 0 0-.5-.2z" fill="' + (isDark ? '#2DD4BF' : '#3B82F6') + '"/></svg>'
                  : '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="' + (isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)') + '" stroke="' + (isDark ? 'rgba(45,212,191,0.6)' : 'rgba(59,130,246,0.6)') + '" stroke-width="1.5"/><circle cx="12" cy="12" r="3" fill="' + (isDark ? '#2DD4BF' : '#3B82F6') + '"/></svg>';
                return `new google.maps.Marker({position:{lat:${w.lat},lng:${w.lng}},map:map,title:'Post #${i+1}',icon:{url:'data:image/svg+xml;utf-8,'+encodeURIComponent('${wpIcon}'),size:new google.maps.Size(24,24),scaledSize:new google.maps.Size(24,24),anchor:new google.maps.Point(12,12)}});`;
              }
            }).join('\n');
            const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<style>html,body,#map{height:100%;margin:0;padding:0}</style>
<script>
function initMap(){
  var map=new google.maps.Map(document.getElementById('map'),{center:{lat:${center.lat},lng:${center.lng}},zoom:13,mapTypeId:'roadmap',language:'en',styles:${JSON.stringify(mapStyle.customMapStyle)},disableDefaultUI:true,zoomControl:true,gestureHandling:'greedy',isFractionalZoomEnabled:true});
  
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
        this.div.style.transform = 'translate(-50%, -50%)';
      }
    }
    onRemove() {
      if (this.div && this.div.parentNode) {
        this.div.parentNode.removeChild(this.div);
      }
    }
  }

  var path=${polyCoords};
  var segments = [];
  var currentSegment = [];
  path.forEach(function(p){
    if (p.segmentBreak && currentSegment.length > 0) {
      segments.push(currentSegment);
      currentSegment = [p];
    } else {
      currentSegment.push(p);
    }
  });
  if(currentSegment.length > 0) segments.push(currentSegment);
  segments.forEach(function(segment){
    if(segment.length < 2) return;
    new google.maps.Polyline({path:segment,geodesic:true,strokeColor:'${mapStyle.routeGlowColor}',strokeOpacity:1,strokeWeight:12,map:map});
    new google.maps.Polyline({path:segment,geodesic:true,strokeColor:'${mapStyle.routeColor}',strokeOpacity:1,strokeWeight:4,map:map});
  });
  if(path.length>0)new google.maps.Marker({position:path[0],map:map,title:'Start',icon:{url:'data:image/svg+xml;utf-8,'+encodeURIComponent('<svg width="30" height="30" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="#10B981" stroke="white" stroke-width="2"/></svg>'),size:new google.maps.Size(30,30),scaledSize:new google.maps.Size(30,30),anchor:new google.maps.Point(15,15)}});
  if(path.length>1)new google.maps.Marker({position:path[path.length-1],map:map,title:'End',icon:{url:'data:image/svg+xml;utf-8,'+encodeURIComponent('<svg width="30" height="30" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="#EF4444" stroke="white" stroke-width="2"/></svg>'),size:new google.maps.Size(30,30),scaledSize:new google.maps.Size(30,30),anchor:new google.maps.Point(15,15)}});
  ${wpMarkers}
  var bounds=new google.maps.LatLngBounds();path.forEach(function(p){bounds.extend(p);});map.fitBounds(bounds,40);
}
</script></head><body>
<div id="map"></div>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${WV_KEY}&language=en&callback=initMap"></script>
</body></html>`;
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
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'navigatePost' && data.postId) {
                      const targetUserId = data.userId || journey?.user?._id || journey?.user;
                      navigateToPost(data.postId, data.contentType || 'photo', targetUserId);
                    }
                  } catch (err) {
                    logger.error('[JourneyDetail] WebView message parse error:', err);
                  }
                }}
              />
            );
          })() : MapView && Marker ? (
            <MapView
              style={styles.map}
              provider={getMapProvider()}
              {...mapStyle.nativeMapProps}
              initialRegion={{
                latitude: journey.startCoords?.lat || 0,
                longitude: journey.startCoords?.lng || 0,
                latitudeDelta: 0.1,
                longitudeDelta: 0.1,
              }}
              onRegionChangeComplete={(region) => {
                const safeRegion = sanitizeMapRegion(region);
                if (safeRegion) {
                  setLatitudeDelta(safeRegion.latitudeDelta);
                }
              }}
              mapType={mapStyle.mapType}
              showsCompass={true}
            >
              {journey.polyline?.length > 1 && (
                <PolylineRenderer
                  coordinates={getJourneyPolylineCoords(journey)}
                  color={mapStyle.routeColor}
                  glowColor={mapStyle.routeGlowColor}
                  strokeWidth={4}
                  simplifyDistance={10}
                  applyKalman={false}
                  latitudeDelta={sanitizeLatitudeDelta(latitudeDelta)}
                />
              )}
              {isValidMapCoordinate({ latitude: journey.startCoords?.lat, longitude: journey.startCoords?.lng }) && (
                <SafeMarker coordinate={{ latitude: journey.startCoords.lat, longitude: journey.startCoords.lng }} title="Start" anchor={{ x: 0.5, y: 0.5 }} repaintTriggers={[latitudeDelta]}>
                  <PremiumMapMarker icon="play" latitudeDelta={sanitizeLatitudeDelta(latitudeDelta)} />
                </SafeMarker>
              )}
              {isValidMapCoordinate({ latitude: journey.endCoords?.lat, longitude: journey.endCoords?.lng }) && (
                <SafeMarker coordinate={{ latitude: journey.endCoords.lat, longitude: journey.endCoords.lng }} title="End" anchor={{ x: 0.5, y: 1.0 }} repaintTriggers={[latitudeDelta]}>
                  <PremiumMapMarker icon="flag" active latitudeDelta={sanitizeLatitudeDelta(latitudeDelta)} />
                </SafeMarker>
              )}
              {journey.waypoints?.map((w: any, i: number) => {
                const photoUrl = getWaypointPhotoUrl(w);
                const postId = w.post?._id || w.post;
                const contentType = w.contentType || w.post?.type || 'photo';
                const targetUserId = journey.user?._id || journey.user;
                const latitude = w.latitude ?? w.lat;
                const longitude = w.longitude ?? w.lng;
                
                if (!isValidMapCoordinate({ latitude, longitude })) return null;
                
                return (
                  <SafeMarker
                    key={`wp-${i}`}
                    coordinate={{ latitude, longitude }}
                    title={`${contentType === 'video' ? 'Video' : 'Photo'} #${i + 1}`}
                    anchor={photoUrl ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1.0 }}
                    onPress={() => {
                      if (postId) {
                        navigateToPost(postId, contentType, targetUserId);
                      }
                    }}
                    repaintTriggers={[latitudeDelta, w.contentType, photoUrl, !!loadedImages[i]]}
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
                            if (!loadedImages[i]) {
                              setLoadedImages(prev => ({ ...prev, [i]: true }));
                            }
                          }}
                        />
                      </View>
                    ) : (
                      <PremiumMapMarker icon={w.contentType === 'video' ? 'videocam' : 'camera'} latitudeDelta={sanitizeLatitudeDelta(latitudeDelta)} />
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
          {journey.polyline?.length > 1 && (
            <GlassMapPanel style={styles.mapSummaryPanel} tint={mapStyle.glassTint}>
              <Ionicons name="navigate" size={16} color={mapStyle.routeColor} />
              <Text style={[styles.mapSummaryText, { color: theme.colors.text }]} numberOfLines={1}>
                {formatDistance(journey.distanceTraveled)} - {formatDuration(journey.startedAt, journey.completedAt)}
              </Text>
            </GlassMapPanel>
          )}
        </View>

        {/* Status Badge */}
        <View style={styles.contentPadding}>
          <View style={[styles.statusRow]}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {journey.status === 'active' ? 'Active' : journey.status === 'paused' ? 'Paused' : 'Completed'}
              </Text>
            </View>
            <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
              {formatDate(journey.startedAt)}
              {journey.completedAt ? ` — ${formatDate(journey.completedAt)}` : ''}
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={[styles.statsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.statItem}>
              <Ionicons name="navigate" size={20} color={GROWTH_GREEN} />
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {formatDistance(journey.distanceTraveled)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Distance</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.statItem}>
              <Ionicons name="time" size={20} color={ACTION_BLUE} />
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {formatDuration(journey.startedAt, journey.completedAt)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Duration</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.statItem}>
              <Ionicons name="camera" size={20} color={ALERT_RED} />
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {journey.waypoints?.length || 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Posts</Text>
            </View>
          </View>

          {/* Countries */}
          {journey.countries?.length > 0 && (
            <View style={styles.countriesRow}>
              <Ionicons name="globe-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.countriesText, { color: theme.colors.textSecondary }]}>
                {journey.countries.join(', ')}
              </Text>
            </View>
          )}

          {/* Posts Section */}
          {waypointPosts.length > 0 && (
            <View style={styles.postsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Posts during this journey
              </Text>
              {waypointPosts.map((waypoint: any, index: number) => {
                const post = waypoint.post;
                if (!post) return null;

                const getPostPreviewUrl = (p: any): string | null => {
                  if (!p) return null;
                  if (p.images?.length > 0) {
                    const img = p.images[0];
                    return typeof img === 'string' ? img : img?.url || img?.signedUrl || null;
                  }
                  if (p.storageKeys?.length > 0) {
                    const sk = p.storageKeys[0];
                    if (typeof sk === 'string') return sk;
                    return sk?.signedUrl || sk?.url || null;
                  }
                  if (p.imageUrl) return p.imageUrl;
                  if (p.thumbnailUrl) return p.thumbnailUrl;
                  return null;
                };
                const imageUrl = getPostPreviewUrl(post);
                const hasCoords =
                  typeof waypoint.lat === 'number' && typeof waypoint.lng === 'number' &&
                  waypoint.lat !== 0 && waypoint.lng !== 0 &&
                  !Number.isNaN(waypoint.lat) && !Number.isNaN(waypoint.lng);
                return (
                  <TouchableOpacity
                    key={`post-${index}`}
                    style={[styles.postCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                    onPress={() => {
                      const targetUserId = journey.user?._id || journey.user;
                      navigateToPost(post._id, waypoint.contentType || post.type || 'photo', targetUserId);
                    }}
                    activeOpacity={0.7}
                  >
                    {imageUrl && (
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.postImage}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.postInfo}>
                      <Text style={[styles.postCaption, { color: theme.colors.text }]} numberOfLines={2}>
                        {post.caption || 'No caption'}
                      </Text>
                      <View style={styles.postMeta}>
                        <Ionicons name={waypoint.contentType === 'video' ? 'videocam' : 'image'} size={12} color={theme.colors.textSecondary} />
                        <Text style={[styles.postMetaText, { color: theme.colors.textSecondary }]}>
                          {waypoint.contentType || 'photo'}
                        </Text>
                      </View>
                    </View>
                    {hasCoords && (
                      <TouchableOpacity
                        style={styles.directionsBtn}
                        onPress={() => router.push({
                          pathname: '/map/current-location',
                          params: {
                            latitude: String(waypoint.lat),
                            longitude: String(waypoint.lng),
                            address: post.caption || post.location?.address || `Waypoint ${index + 1}`,
                            photo: post.imageUrl || '',
                          },
                        })}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Get directions"
                        accessibilityRole="button"
                      >
                        <Ionicons name="navigate" size={18} color={ACTION_BLUE} />
                      </TouchableOpacity>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Empty posts state */}
          {waypointPosts.length === 0 && (
            <View style={styles.emptyPosts}>
              <Ionicons name="images-outline" size={36} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyPostsText, { color: theme.colors.textSecondary }]}>
                No posts were made during this journey
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Share Modal */}
      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        journey={journey ? {
          _id: journey._id,
          title: journey.title,
          distanceTraveled: journey.distanceTraveled,
          startedAt: journey.startedAt,
          completedAt: journey.completedAt,
          status: journey.status,
        } : undefined}
      />
    </View>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 12,
  },
  retryBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  scrollContainer: {
    flex: 1,
  },
  mapContainer: {
    width: '100%',
    height: screenHeight * 0.75,
    backgroundColor: '#E5E7EB',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapSummaryPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapSummaryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  contentPadding: {
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statsCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: '70%',
    alignSelf: 'center',
  },
  countriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  countriesText: {
    fontSize: 13,
    fontWeight: '500',
  },
  postsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  postCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  postImage: {
    width: 60,
    height: 60,
  },
  postInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  postCaption: {
    fontSize: 13,
    fontWeight: '500',
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postMetaText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  directionsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    marginRight: 8,
  },
  emptyPosts: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyPostsText: {
    fontSize: 13,
    textAlign: 'center',
  },
  menuDropdown: {
    position: 'absolute',
    top: 100,
    right: 16,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 170,
    zIndex: 100,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    marginHorizontal: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
