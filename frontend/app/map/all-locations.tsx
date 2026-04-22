import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as ExpoLocation from 'expo-location';
import { useTheme } from '../../context/ThemeContext';
import { MapView, Marker, getMapProvider, useWebViewFallback } from '../../utils/mapsWrapper';
import PolylineRenderer from '../../components/PolylineRenderer';
import PhotoOverlay from '../../components/PhotoOverlay';
import { getTravelMapData } from '../../services/profile';
import { getUserJourneys } from '../../services/journey';
import { getGoogleMapsApiKeyForWebView } from '../../utils/maps';
import logger from '../../utils/logger';
import { ErrorBoundary } from '../../utils/errorBoundary';
const GROWTH_GREEN = '#22C55E';
const ALERT_RED = '#EF4444';
const ACTION_BLUE = '#3B82F6';

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

interface LocationPin {
  number: number;
  latitude: number;
  longitude: number;
  address: string;
  date: string;
  photo?: string;
  postId?: string;
  contentType?: 'photo' | 'video';
}

interface JourneyPolyline {
  _id: string;
  title: string;
  polyline: Array<{ lat: number; lng: number; timestamp?: string }>;
  startCoords: { lat: number; lng: number };
  endCoords: { lat: number; lng: number };
  distanceTraveled: number;
  startedAt: string;
  completedAt: string;
  waypoints: any[];
}

function AllLocationsMapInner() {
  const [locations, setLocations] = useState<LocationPin[]>([]);
  const [journeys, setJourneys] = useState<JourneyPolyline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCountry, setCurrentCountry] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<{
    totalLocations: number;
    totalDistance: number;
    totalDays: number;
  } | null>(null);

  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme, mode } = useTheme();
  const rawUserId = params.userId;
  const userId = typeof rawUserId === 'string' ? rawUserId : Array.isArray(rawUserId) ? rawUserId[0] : undefined;
  const displayName = safeDecodeUriComponent(params.userName as string | string[] | undefined);
  const headerTitle = displayName ? `${displayName}'s Locations` : 'My Locations';
  const mapRef = useRef<any>(null);
  const WEBVIEW_API_KEY = getGoogleMapsApiKeyForWebView();

  // Get current country via reverse geocoding
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const loc = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Low,
        });
        const geocode = await ExpoLocation.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geocode.length > 0 && geocode[0].country) {
          setCurrentCountry(geocode[0].country);
        }
      } catch (err) {
        logger.debug('[AllLocations] Country detection failed:', err);
      }
    };
    detectCountry();
  }, []);

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
        setLocations(response?.locations ?? []);
        setStatistics(response?.statistics ?? null);
      }

      // Process journey polylines
      if (journeysResult.status === 'fulfilled') {
        const data = journeysResult.value;
        const rawJourneys = data?.journeys ?? [];
        // Filter journeys that have polyline data
        const withPolylines = rawJourneys.filter(
          (j: any) => j.polyline && j.polyline.length > 1
        );
        setJourneys(withPolylines);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Fit map to show all markers + polylines after data loads
  useEffect(() => {
    if (loading || (!locations.length && !journeys.length)) return;
    if (!mapRef.current) return;

    const allCoords: Array<{ latitude: number; longitude: number }> = [];

    // Add post locations
    locations.forEach((loc) => {
      if (loc.latitude && loc.longitude && loc.latitude !== 0 && loc.longitude !== 0) {
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
            if (mapRef.current && allCoords.length > 0) {
              mapRef.current.fitToCoordinates(allCoords, {
                edgePadding: { top: 120, right: 80, bottom: 120, left: 80 },
                animated: attempt === 0 && Platform.OS !== 'ios',
              });
              if (Platform.OS === 'ios' && attempt === 0) fitMap(1);
            }
          } catch (err) {
            if (attempt < 3) fitMap(attempt + 1);
          }
        }, delay);
      };
      fitMap();
    }
  }, [locations, journeys, loading]);

  // Calculate region to fit all data
  const getMapRegion = useCallback(() => {
    const allLats: number[] = [];
    const allLngs: number[] = [];

    locations.forEach((loc) => {
      if (loc.latitude && loc.longitude && loc.latitude !== 0 && loc.longitude !== 0) {
        allLats.push(loc.latitude);
        allLngs.push(loc.longitude);
      }
    });

    journeys.forEach((j) => {
      if (j.polyline) {
        j.polyline.forEach((p) => {
          if (p.lat && p.lng) {
            allLats.push(p.lat);
            allLngs.push(p.lng);
          }
        });
      }
    });

    if (allLats.length === 0) {
      return { latitude: 20, longitude: 0, latitudeDelta: 140, longitudeDelta: 360 };
    }

    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLng = Math.min(...allLngs);
    const maxLng = Math.max(...allLngs);

    const latDelta = Math.max((maxLat - minLat) * 1.8, 0.1);
    const lngDelta = Math.max((maxLng - minLng) * 1.8, 0.1);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [locations, journeys]);

  // ──────────────────────────────────────────────────────
  // WebView HTML (used on Expo Go Android where native maps crash)
  // ──────────────────────────────────────────────────────
  const getWebMapHTML = useCallback(() => {
    const region = getMapRegion();
    const validLocations = locations.filter(
      (loc) => loc.latitude && loc.longitude && loc.latitude !== 0 && loc.longitude !== 0
    );
    const markersData = validLocations.map((loc) => ({
      lat: loc.latitude,
      lng: loc.longitude,
      title: (loc.address || `Location #${loc.number}`).replace(/"/g, '&quot;'),
      number: loc.number,
      photo: loc.photo || null,
      postId: loc.postId || null,
    }));
    const polylinePaths = journeys.map((j) => ({
      title: j.title || 'Journey',
      path: j.polyline.map((p) => ({ lat: p.lat, lng: p.lng })),
    }));
    const zoomLevel = Math.min(12, Math.max(2, Math.floor(15 - Math.log2(Math.max(region.latitudeDelta, 1)))));

    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>html,body,#map{height:100%;margin:0;padding:0}</style>
<script>
function initMap(){
  var map=new google.maps.Map(document.getElementById('map'),{
    center:{lat:${region.latitude},lng:${region.longitude}},
    zoom:${zoomLevel},mapTypeId:'terrain',language:'en'
  });
  var bounds=new google.maps.LatLngBounds();
  var activeOverlays=[];

  // Journey polylines
  var journeys=${JSON.stringify(polylinePaths)};
  journeys.forEach(function(j){
    if(j.path&&j.path.length>1){
      new google.maps.Polyline({path:j.path,geodesic:true,strokeColor:'${GROWTH_GREEN}',strokeOpacity:0.9,strokeWeight:4,map:map});
      j.path.forEach(function(p){bounds.extend(new google.maps.LatLng(p.lat,p.lng));});
    }
  });

  var markers=${JSON.stringify(markersData)};
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
    var clusters=[],used=new Array(items.length).fill(false);
    for(var i=0;i<items.length;i++){
      if(used[i])continue;
      var c={items:[items[i]],lat:items[i].lat,lng:items[i].lng};used[i]=true;
      for(var j=i+1;j<items.length;j++){
        if(used[j])continue;
        if(Math.abs(items[j].lat-c.lat)<gs&&Math.abs(items[j].lng-c.lng)<gs){c.items.push(items[j]);used[j]=true;}
      }
      var sLat=0,sLng=0;c.items.forEach(function(it){sLat+=it.lat;sLng+=it.lng;});
      c.lat=sLat/c.items.length;c.lng=sLng/c.items.length;clusters.push(c);
    }
    return clusters;
  }

  // Custom OverlayView class
  function PhotoOverlay(pos,el){this.position=pos;this.div=el;this.setMap(map);}
  PhotoOverlay.prototype=new google.maps.OverlayView();
  PhotoOverlay.prototype.onAdd=function(){this.getPanes().overlayMouseTarget.appendChild(this.div);};
  PhotoOverlay.prototype.draw=function(){var pt=this.getProjection().fromLatLngToDivPixel(this.position);if(pt){this.div.style.left=(pt.x-28)+'px';this.div.style.top=(pt.y-28)+'px';this.div.style.position='absolute';}};
  PhotoOverlay.prototype.onRemove=function(){if(this.div&&this.div.parentNode)this.div.parentNode.removeChild(this.div);};

  function renderClusters(){
    // Remove existing overlays
    activeOverlays.forEach(function(ov){ov.setMap(null);});
    activeOverlays=[];

    var zoom=map.getZoom()||${zoomLevel};
    var gs=getGridSize(zoom);
    var clusters=clusterMarkers(markers,gs);
    var sz=56;

    clusters.forEach(function(cluster){
      var pos=new google.maps.LatLng(cluster.lat,cluster.lng);
      var main=cluster.items[0],extra=cluster.items.length-1;
      var div=document.createElement('div');
      div.style.cssText='position:relative;width:'+sz+'px;height:'+sz+'px;cursor:pointer;';

      if(main.photo){
        var img=document.createElement('img');
        img.src=main.photo;
        img.crossOrigin='anonymous';
        img.style.cssText='width:'+sz+'px;height:'+sz+'px;border-radius:10px;border:3px solid white;object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,0.3);background:#E5E7EB;';
        img.onerror=function(){
          this.style.display='none';
          var fb=document.createElement('div');
          fb.style.cssText='width:'+sz+'px;height:'+sz+'px;border-radius:10px;border:3px solid white;background:${GROWTH_GREEN};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
          fb.innerHTML='<span style="color:white;font-weight:bold;font-size:14px;">#'+main.number+'</span>';
          div.insertBefore(fb,div.firstChild);
        };
        div.appendChild(img);
      }else{
        var ph=document.createElement('div');
        ph.style.cssText='width:'+sz+'px;height:'+sz+'px;border-radius:10px;border:3px solid white;background:${GROWTH_GREEN};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
        ph.innerHTML='<span style="color:white;font-weight:bold;font-size:14px;">#'+main.number+'</span>';
        div.appendChild(ph);
      }

      if(extra>0){
        var badge=document.createElement('div');
        badge.style.cssText='position:absolute;top:-8px;right:-8px;background:${ACTION_BLUE};color:white;font-size:11px;font-weight:700;min-width:22px;height:22px;line-height:22px;text-align:center;padding:0 5px;border-radius:11px;box-shadow:0 1px 4px rgba(0,0,0,0.3);';
        badge.textContent=extra+1;
        div.appendChild(badge);
      }

      // Tap handler: single marker → navigate to post, cluster → zoom in
      div.addEventListener('click',function(e){
        e.stopPropagation();
        if(cluster.items.length===1&&cluster.items[0].postId){
          // Navigate to post detail
          if(window.ReactNativeWebView){
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'navigatePost',postId:cluster.items[0].postId}));
          }
        }else if(cluster.items.length>1){
          // Zoom into the cluster area
          var cb=new google.maps.LatLngBounds();
          cluster.items.forEach(function(it){cb.extend(new google.maps.LatLng(it.lat,it.lng));});
          map.fitBounds(cb,60);
        }else if(cluster.items[0].postId){
          if(window.ReactNativeWebView){
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'navigatePost',postId:cluster.items[0].postId}));
          }
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
}
</script>
</head><body>
<div id="map"></div>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=${WEBVIEW_API_KEY || ''}&language=en&callback=initMap"></script>
</body></html>`;
  }, [locations, journeys, getMapRegion, WEBVIEW_API_KEY]);

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
          source={{ html: getWebMapHTML() }}
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
                router.push(`/post/${data.postId}`);
              }
            } catch (err) {
              logger.debug('[AllLocations] WebView message parse error:', err);
            }
          }}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
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
      (loc) => loc.latitude && loc.longitude && loc.latitude !== 0 && loc.longitude !== 0
    );

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={getMapProvider()}
        initialRegion={region}
        showsUserLocation={false}
        showsMyLocationButton={false}
        followsUserLocation={false}
        showsCompass={true}
        showsScale={true}
        mapType="terrain"
        mapPadding={{ top: 100, right: 80, bottom: 100, left: 80 }}
        onMapReady={() => {
          const allCoords = [
            ...validLocations.map((l) => ({ latitude: l.latitude, longitude: l.longitude })),
            ...journeys.flatMap((j) =>
              j.polyline?.map((p) => ({ latitude: p.lat, longitude: p.lng })) || []
            ),
          ];
          if (allCoords.length > 0 && mapRef.current) {
            setTimeout(() => {
              try {
                mapRef.current?.fitToCoordinates(allCoords, {
                  edgePadding: { top: 120, right: 80, bottom: 120, left: 80 },
                  animated: false,
                });
              } catch {}
            }, 300);
          }
        }}
      >
        {/* Journey polylines */}
        {journeys.map((j) => {
          if (!j.polyline || j.polyline.length < 2) return null;
          const coords = j.polyline.map((p) => ({ latitude: p.lat, longitude: p.lng }));
          return (
            <PolylineRenderer
              key={`polyline-${j._id}`}
              coordinates={coords}
              color={GROWTH_GREEN}
              strokeWidth={4}
              simplifyDistance={10}
              applyKalman={false}
            />
          );
        })}

        {/* Post location markers with photo thumbnails */}
        {validLocations.map((location, index) => (
          <Marker
            key={`marker-${location.number}-${index}`}
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            title={location.address || `Location #${location.number}`}
            description={`Visit #${location.number}`}
          >
            <View style={styles.markerContainer}>
              {location.photo ? (
                <View style={{ marginBottom: 4 }}>
                  <PhotoOverlay imageUrl={location.photo} label={`${location.number}`} onPress={() => {}} />
                </View>
              ) : (
                <View style={[styles.markerCircle, { backgroundColor: ALERT_RED }]}>
                  <Text style={styles.markerText}>{location.number}</Text>
                </View>
              )}
            </View>
          </Marker>
        ))}
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
          <ActivityIndicator size="large" color={theme.colors.primary} />
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header with back + title + journeys icon */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>{headerTitle}</Text>
          {currentCountry && (
            <View style={styles.countryChip}>
              <Ionicons name="flag" size={12} color={GROWTH_GREEN} />
              <Text style={[styles.countryText, { color: theme.colors.textSecondary }]}>{currentCountry}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => router.push(`/journeys?userId=${userId}`)}
        >
          <Ionicons name="list" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={[styles.statsContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.statItem}>
          <Ionicons name="location" size={18} color={ALERT_RED} />
          <Text style={[styles.statValue, { color: theme.colors.text }]}>{locations.length}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Posts</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.statItem}>
          <Ionicons name="map" size={18} color={GROWTH_GREEN} />
          <Text style={[styles.statValue, { color: theme.colors.text }]}>{journeys.length}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Journeys</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.statItem}>
          <Ionicons name="navigate" size={18} color={ACTION_BLUE} />
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {totalJourneyDistance >= 1000
              ? `${(totalJourneyDistance / 1000).toFixed(1)} km`
              : `${Math.round(totalJourneyDistance)} m`}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Traveled</Text>
        </View>
        {statistics?.totalDays ? (
          <>
            <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.statItem}>
              <Ionicons name="calendar" size={18} color={theme.colors.primary} />
              <Text style={[styles.statValue, { color: theme.colors.text }]}>{statistics.totalDays}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Days</Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Full-screen map */}
      <View style={styles.mapContainer}>
        {locations.length === 0 && journeys.length === 0 ? (
          <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
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

      {/* Floating Start Journey button */}
      <TouchableOpacity
        style={[styles.startJourneyFab, { backgroundColor: GROWTH_GREEN }]}
        onPress={() => router.push('/navigate')}
        activeOpacity={0.8}
      >
        <Ionicons name="play-circle" size={22} color="white" />
        <Text style={styles.startJourneyFabText}>Start Journey</Text>
      </TouchableOpacity>

    </SafeAreaView>
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
    fontSize: 18,
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: 'bold',
  },
  startJourneyFab: {
    position: 'absolute',
    bottom: 70,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    gap: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    zIndex: 20,
  },
  startJourneyFabText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
});
