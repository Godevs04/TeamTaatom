import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Text,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import PolylineRenderer from './PolylineRenderer';
import PhotoOverlay from './PhotoOverlay';
import GPSAccuracyChip from './GPSAccuracyChip';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export interface Waypoint {
  post?: {
    _id: string;
    images?: Array<{ url: string }>;
    thumbnailUrl?: string;
  };
  lat: number;
  lng: number;
  contentType: string;
}

export interface JourneyMapViewProps {
  journey: {
    polyline: Array<{ lat: number; lng: number; timestamp?: string }>;
    waypoints: Waypoint[];
    startCoords: { lat: number; lng: number };
    endCoords: { lat: number; lng: number };
  };
  showDistanceFromUser?: boolean;
  userLocation?: { latitude: number; longitude: number } | null;
  onWaypointPress?: (waypoint: Waypoint) => void;
  onNavigatePress?: (coords: { lat: number; lng: number }) => void;
}

const GROWTH_GREEN = '#22C55E';
const ACTION_BLUE = '#3B82F6';
const ALERT_RED = '#EF4444';

/**
 * JourneyMapView
 *
 * Full-screen map showing a completed journey
 * - Green polyline path from start to end
 * - Green start marker, red end marker
 * - Photo waypoint markers with images
 * - Tap waypoint → navigate or view photo
 * - Fit map to show entire journey
 */
export default function JourneyMapView({
  journey,
  showDistanceFromUser = false,
  userLocation,
  onWaypointPress,
  onNavigatePress,
}: JourneyMapViewProps) {
  const { theme } = useTheme();
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedWaypoint, setSelectedWaypoint] = useState<Waypoint | null>(null);

  // Calculate map region to fit all coordinates
  const calculateInitialRegion = () => {
    const allCoords = [
      journey.startCoords,
      journey.endCoords,
      ...journey.polyline.map(p => ({ lat: p.lat, lng: p.lng })),
      ...journey.waypoints.map(w => ({ lat: w.lat, lng: w.lng })),
    ];

    if (allCoords.length === 0) {
      // Fallback to center of world
      return {
        latitude: 0,
        longitude: 0,
        latitudeDelta: 90,
        longitudeDelta: 90,
      };
    }

    const lats = allCoords.map(c => c.lat);
    const lngs = allCoords.map(c => c.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Add 20% padding
    const latDelta = (maxLat - minLat) * 1.2 || 0.1;
    const lngDelta = (maxLng - minLng) * 1.2 || 0.1;

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  };

  // Convert polyline format (lat/lng) to MapView format (latitude/longitude)
  const polylineCoordinates = journey.polyline.map(p => ({
    latitude: p.lat,
    longitude: p.lng,
  }));

  const getPhotoUrl = (waypoint: Waypoint): string | null => {
    if (waypoint.post?.images && waypoint.post.images.length > 0) {
      return waypoint.post.images[0].url;
    }
    if (waypoint.post?.thumbnailUrl) {
      return waypoint.post.thumbnailUrl;
    }
    return null;
  };

  const handleWaypointPress = (waypoint: Waypoint) => {
    setSelectedWaypoint(waypoint);
    onWaypointPress?.(waypoint);
  };

  const handleNavigatePress = (coords: { lat: number; lng: number }) => {
    onNavigatePress?.(coords);
  };

  // Fit map to show entire journey
  const fitJourney = () => {
    if (!mapRef.current) return;

    try {
      const coordinates = [
        { latitude: journey.startCoords.lat, longitude: journey.startCoords.lng },
        { latitude: journey.endCoords.lat, longitude: journey.endCoords.lng },
        ...polylineCoordinates,
      ];

      if (Platform.OS === 'ios') {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      } else {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 150, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.warn('Error fitting map:', error);
    }
  };

  useEffect(() => {
    if (mapReady) {
      // Small delay to ensure map is fully rendered
      const timer = setTimeout(fitJourney, 300);
      return () => clearTimeout(timer);
    }
  }, [mapReady]);

  const initialRegion = calculateInitialRegion();

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        {/* Placeholder: Native MapView would render here */}
        {/* For WebView-based maps, implement with WebView + Google Maps API */}
        <View
          style={[
            styles.mapPlaceholder,
            { backgroundColor: theme.colors.background },
          ]}
        >
          {/* Map content would be rendered here by react-native-maps or WebView */}
          {/* This is a structural placeholder */}
          <View style={styles.mapCenterContent}>
            <Ionicons
              name="map"
              size={48}
              color={theme.colors.textSecondary}
            />
            <Text
              style={[styles.placeholderText, { color: theme.colors.textSecondary }]}
            >
              Map View
            </Text>
          </View>

          {/* Polyline would render via PolylineRenderer on native maps */}
          <PolylineRenderer
            coordinates={polylineCoordinates}
            color={GROWTH_GREEN}
            strokeWidth={4}
          />

          {/* Start Marker */}
          <View
            style={[
              styles.marker,
              styles.startMarker,
              {
                top: `${((journey.startCoords.lat - initialRegion.latitude + initialRegion.latitudeDelta / 2) / initialRegion.latitudeDelta) * 100}%`,
                left: `${((journey.startCoords.lng - initialRegion.longitude + initialRegion.longitudeDelta / 2) / initialRegion.longitudeDelta) * 100}%`,
              },
            ]}
          >
            <Ionicons name="location" size={24} color={GROWTH_GREEN} />
          </View>

          {/* End Marker */}
          <View
            style={[
              styles.marker,
              styles.endMarker,
              {
                top: `${((journey.endCoords.lat - initialRegion.latitude + initialRegion.latitudeDelta / 2) / initialRegion.latitudeDelta) * 100}%`,
                left: `${((journey.endCoords.lng - initialRegion.longitude + initialRegion.longitudeDelta / 2) / initialRegion.longitudeDelta) * 100}%`,
              },
            ]}
          >
            <Ionicons name="location" size={24} color={ALERT_RED} />
          </View>

          {/* Waypoint Markers with Photos */}
          {journey.waypoints.map((waypoint, idx) => {
            const photoUrl = getPhotoUrl(waypoint);
            return (
              <TouchableOpacity
                key={`${waypoint.lat}-${waypoint.lng}-${idx}`}
                style={[
                  styles.waypointMarker,
                  {
                    top: `${((waypoint.lat - initialRegion.latitude + initialRegion.latitudeDelta / 2) / initialRegion.latitudeDelta) * 100}%`,
                    left: `${((waypoint.lng - initialRegion.longitude + initialRegion.longitudeDelta / 2) / initialRegion.longitudeDelta) * 100}%`,
                  },
                ]}
                onPress={() => handleWaypointPress(waypoint)}
              >
                {photoUrl ? (
                  <PhotoOverlay
                    imageUrl={photoUrl}
                    onPress={() => handleWaypointPress(waypoint)}
                  />
                ) : (
                  <View style={styles.defaultWaypointMarker}>
                    <Ionicons
                      name="image-outline"
                      size={20}
                      color="white"
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Accuracy Chip */}
        {showDistanceFromUser && (
          <GPSAccuracyChip accuracy={null} />
        )}

        {/* Floating Action Buttons */}
        <View style={styles.floatingButtons}>
          {/* Fit to Journey Button */}
          <TouchableOpacity
            style={[styles.floatingButton, { backgroundColor: ACTION_BLUE }]}
            onPress={fitJourney}
          >
            <Ionicons name="locate" size={20} color="white" />
          </TouchableOpacity>

          {/* Navigate to End Button */}
          <TouchableOpacity
            style={[styles.floatingButton, { backgroundColor: GROWTH_GREEN }]}
            onPress={() => handleNavigatePress(journey.endCoords)}
          >
            <Ionicons name="navigate" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Sheet: Waypoint Details */}
      {selectedWaypoint && (
        <View
          style={[
            styles.bottomSheet,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <View style={styles.bottomSheetHandle} />

          {/* Photo Preview */}
          {getPhotoUrl(selectedWaypoint) && (
            <TouchableOpacity
              style={styles.waypointPhotoContainer}
              onPress={() =>
                handleNavigatePress({
                  lat: selectedWaypoint.lat,
                  lng: selectedWaypoint.lng,
                })
              }
            >
              <PhotoOverlay
                imageUrl={getPhotoUrl(selectedWaypoint)!}
              />
            </TouchableOpacity>
          )}

          {/* Waypoint Info */}
          <View style={styles.waypointInfoContainer}>
            <Text
              style={[styles.waypointTitle, { color: theme.colors.text }]}
            >
              Location
            </Text>
            <Text
              style={[
                styles.waypointCoords,
                { color: theme.colors.textSecondary },
              ]}
            >
              {selectedWaypoint.lat.toFixed(4)}, {selectedWaypoint.lng.toFixed(4)}
            </Text>

            {/* Navigate Button */}
            <TouchableOpacity
              style={[
                styles.navigateButton,
                { backgroundColor: ACTION_BLUE },
              ]}
              onPress={() =>
                handleNavigatePress({
                  lat: selectedWaypoint.lat,
                  lng: selectedWaypoint.lng,
                })
              }
            >
              <Ionicons name="navigate" size={18} color="white" />
              <Text style={styles.navigateButtonText}>Navigate Here</Text>
            </TouchableOpacity>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedWaypoint(null)}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mapCenterContent: {
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.3,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  marker: {
    position: 'absolute',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -20,
    marginTop: -20,
  },
  startMarker: {
    zIndex: 10,
  },
  endMarker: {
    zIndex: 10,
  },
  waypointMarker: {
    position: 'absolute',
    marginLeft: -30,
    marginTop: -30,
    zIndex: 11,
  },
  defaultWaypointMarker: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ACTION_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  floatingButtons: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    gap: 12,
    zIndex: 20,
  },
  floatingButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: screenHeight * 0.5,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  waypointPhotoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  waypointInfoContainer: {
    gap: 12,
  },
  waypointTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  waypointCoords: {
    fontSize: 12,
    fontWeight: '400',
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  navigateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
  },
});
