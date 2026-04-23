import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Dimensions,
  Image,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAlert } from '../../context/AlertContext';
import { getJourneyDetail, updateJourneyTitle, deleteJourney } from '../../services/journey';
import { MapView, Marker, useWebViewFallback } from '../../utils/mapsWrapper';
import { getGoogleMapsApiKeyForWebView } from '../../utils/maps';
import PolylineRenderer from '../../components/PolylineRenderer';
import logger from '../../utils/logger';

const GROWTH_GREEN = '#22C55E';
const ACTION_BLUE = '#3B82F6';
const ALERT_RED = '#EF4444';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
  const { theme } = useTheme();
  const journeyId = typeof params.journeyId === 'string' ? params.journeyId : '';

  const { showAlert } = useAlert();
  const [journey, setJourney] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
              // Clear from AsyncStorage if this is the active journey
              const storedId = await AsyncStorage.getItem('activeJourneyId');
              if (storedId === journeyId) {
                await AsyncStorage.removeItem('activeJourneyId');
              }
              await deleteJourney(journeyId);
              showAlert('Deleted', 'Journey has been deleted');
              router.back();
            } catch (err: any) {
              showAlert('Error', err.message || 'Failed to delete journey');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Journey</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={GROWTH_GREEN} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !journey) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Journey</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={ALERT_RED} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>{error || 'Journey not found'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.retryBtn, { backgroundColor: GROWTH_GREEN }]}>
            <Text style={styles.retryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const waypointPosts = (journey.waypoints || []).filter((w: any) => w.post);
  const statusColor = getStatusColor(journey.status);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {journey.title || 'Journey'}
        </Text>
        <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.backBtn}>
          <Ionicons name="ellipsis-vertical" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Dropdown Menu */}
      {showMenu && (
        <View style={[styles.menuDropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
                  <ActivityIndicator size="small" color="white" />
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
            const polyCoords = JSON.stringify(journey.polyline.map((p: any) => ({ lat: p.lat, lng: p.lng })));
            const wps = (journey.waypoints || []).filter((w: any) => w.lat && w.lng);
            const wpMarkers = wps.map((w: any, i: number) =>
              `new google.maps.Marker({position:{lat:${w.lat},lng:${w.lng}},map:map,title:'Post #${i+1}',icon:{url:'data:image/svg+xml;utf-8,<svg width="28" height="28" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="11" fill="white" stroke="%23EF4444" stroke-width="2.5"/><text x="14" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="%23EF4444">${i+1}</text></svg>',scaledSize:new google.maps.Size(28,28),anchor:new google.maps.Point(14,14)}});`
            ).join('\n');
            const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>html,body,#map{height:100%;margin:0;padding:0}</style>
<script>
function initMap(){
  var map=new google.maps.Map(document.getElementById('map'),{center:{lat:${center.lat},lng:${center.lng}},zoom:13,mapTypeId:'terrain',language:'en'});
  var path=${polyCoords};
  new google.maps.Polyline({path:path,geodesic:true,strokeColor:'${GROWTH_GREEN}',strokeOpacity:1,strokeWeight:4,map:map});
  if(path.length>0)new google.maps.Marker({position:path[0],map:map,title:'Start',icon:{url:'data:image/svg+xml;utf-8,<svg width="30" height="30" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="${encodeURIComponent(GROWTH_GREEN)}" stroke="white" stroke-width="2"/><text x="15" y="20" text-anchor="middle" font-size="14" font-weight="bold" fill="white">S</text></svg>',scaledSize:new google.maps.Size(30,30),anchor:new google.maps.Point(15,15)}});
  if(path.length>1)new google.maps.Marker({position:path[path.length-1],map:map,title:'End',icon:{url:'data:image/svg+xml;utf-8,<svg width="30" height="30" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="${encodeURIComponent(ALERT_RED)}" stroke="white" stroke-width="2"/><text x="15" y="20" text-anchor="middle" font-size="14" font-weight="bold" fill="white">E</text></svg>',scaledSize:new google.maps.Size(30,30),anchor:new google.maps.Point(15,15)}});
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
                scrollEnabled={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={['https://*', 'http://*', 'data:*', 'about:*']}
                onShouldStartLoadWithRequest={(req) => req.url.startsWith('http') || req.url.startsWith('data:') || req.url.startsWith('about:')}
                {...(Platform.OS === 'android' && { mixedContentMode: 'compatibility' as const, setSupportMultipleWindows: false })}
              />
            );
          })() : MapView && Marker ? (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: journey.startCoords?.lat || 0,
                longitude: journey.startCoords?.lng || 0,
                latitudeDelta: 0.1,
                longitudeDelta: 0.1,
              }}
              mapType="terrain"
              showsCompass={true}
            >
              {journey.polyline?.length > 1 && (
                <PolylineRenderer
                  coordinates={journey.polyline.map((p: any) => ({
                    latitude: p.lat,
                    longitude: p.lng,
                    timestamp: new Date(p.timestamp).getTime(),
                    accuracy: p.accuracy || 0,
                  }))}
                  color={GROWTH_GREEN}
                  strokeWidth={4}
                  simplifyDistance={10}
                  applyKalman={false}
                />
              )}
              {journey.startCoords?.lat && journey.startCoords?.lng && (
                <Marker coordinate={{ latitude: journey.startCoords.lat, longitude: journey.startCoords.lng }} title="Start" pinColor={GROWTH_GREEN} />
              )}
              {journey.endCoords?.lat && journey.endCoords?.lng && (
                <Marker coordinate={{ latitude: journey.endCoords.lat, longitude: journey.endCoords.lng }} title="End" pinColor={ALERT_RED} />
              )}
              {journey.waypoints?.map((w: any, i: number) => (
                w.lat && w.lng && (
                  <Marker key={`wp-${i}`} coordinate={{ latitude: w.lat, longitude: w.lng }} title={`${w.contentType || 'Photo'} #${i + 1}`} pinColor={ALERT_RED} />
                )
              ))}
            </MapView>
          ) : (
            <View style={[styles.map, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' }]}>
              <Ionicons name="map-outline" size={48} color="#9CA3AF" />
            </View>
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
                const imageUrl = post.storageKeys?.[0]?.url || post.storageKeys?.[0]?.signedUrl;
                return (
                  <TouchableOpacity
                    key={`post-${index}`}
                    style={[styles.postCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                    onPress={() => router.push(`/post/${post._id}`)}
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
    fontSize: 18,
    fontWeight: '700',
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
    height: screenHeight * 0.35,
    backgroundColor: '#E5E7EB',
  },
  map: {
    width: '100%',
    height: '100%',
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
    fontWeight: '700',
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
    fontSize: 18,
    fontWeight: '700',
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
    fontWeight: '700',
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
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
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
    fontSize: 18,
    fontWeight: '700',
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
