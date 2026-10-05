import React, { useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoLocation from 'expo-location';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker as MlMarker,
  UserLocation,
  type CameraRef,
  type MapRef,
} from '@maplibre/maplibre-react-native';
import type { Anchor } from '@maplibre/maplibre-react-native';
import { CARTO_STYLE } from '../mapEngine';
import logger from '../logger';

type LatLng = { latitude: number; longitude: number };
type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };
type EdgePadding = { top?: number; right?: number; bottom?: number; left?: number };

type MapBridge = {
  swallowNextMapPress: () => void;
};

const MapBridgeContext = React.createContext<MapBridge | null>(null);

let annotationSeq = 0;
function nextAnnotationId(prefix: string) {
  annotationSeq += 1;
  return `${prefix}-${annotationSeq}`;
}

function latitudeDeltaToZoom(latitudeDelta?: number) {
  const delta = typeof latitudeDelta === 'number' && latitudeDelta > 0 ? latitudeDelta : 0.05;
  const zoom = Math.log2(360 / Math.min(delta, 180));
  return Math.max(0, Math.min(20, zoom));
}

function isFiniteCoord(coord: any): coord is LatLng {
  return !!coord && Number.isFinite(coord.latitude) && Number.isFinite(coord.longitude);
}

function toAnchor(anchor?: { x?: number; y?: number }): Anchor {
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return 'center';
  const x = (anchor.x as number) <= 0.25 ? 'left' : (anchor.x as number) >= 0.75 ? 'right' : 'center';
  const y = (anchor.y as number) <= 0.25 ? 'top' : (anchor.y as number) >= 0.75 ? 'bottom' : 'center';
  if (x === 'center' && y === 'center') return 'center';
  if (x === 'center') return y;
  if (y === 'center') return x;
  return `${y}-${x}` as Anchor;
}

function flattenMapChildren(childrenToSanitize: any): any[] {
  const flattened: any[] = [];
  React.Children.forEach(childrenToSanitize, (child) => {
    if (child === null || child === undefined || typeof child === 'boolean') return;
    if (child.type === React.Fragment) {
      if (child.props?.children) flattened.push(...flattenMapChildren(child.props.children));
      return;
    }
    flattened.push(child);
  });
  return flattened;
}

const MapLibreMapView = React.forwardRef((props: any, ref: any) => {
  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);
  const swallowRef = useRef(false);
  const initialRegionRef = useRef<Region | undefined>(props.initialRegion);
  const readyRef = useRef(false);

  const bridge = useMemo<MapBridge>(() => ({
    swallowNextMapPress: () => {
      swallowRef.current = true;
    },
  }), []);

  const mapStyleUrl = typeof props.mapStyle === 'string' ? props.mapStyle : CARTO_STYLE.light;
  const padding: EdgePadding | undefined = props.mapPadding;

  useImperativeHandle(ref, () => ({
    fitToCoordinates(coordinates: LatLng[], options?: { edgePadding?: EdgePadding; animated?: boolean }) {
      const coords = (coordinates || []).filter(isFiniteCoord);
      if (!coords.length || !cameraRef.current) return;
      const duration = options?.animated === false ? 0 : 500;
      if (coords.length === 1) {
        cameraRef.current.easeTo({
          center: [coords[0].longitude, coords[0].latitude],
          duration,
        });
        return;
      }
      let west = Infinity;
      let south = Infinity;
      let east = -Infinity;
      let north = -Infinity;
      coords.forEach((coord) => {
        west = Math.min(west, coord.longitude);
        east = Math.max(east, coord.longitude);
        south = Math.min(south, coord.latitude);
        north = Math.max(north, coord.latitude);
      });
      const pad = options?.edgePadding || {};
      cameraRef.current.fitBounds([west, south, east, north], {
        padding: {
          top: pad.top ?? 48,
          right: pad.right ?? 48,
          bottom: pad.bottom ?? 48,
          left: pad.left ?? 48,
        },
        duration,
      });
    },
    animateToRegion(region: Region, duration: number = 300) {
      if (!isFiniteCoord(region) || !cameraRef.current) return;
      cameraRef.current.easeTo({
        center: [region.longitude, region.latitude],
        zoom: latitudeDeltaToZoom(region.latitudeDelta),
        duration,
      });
    },
    async animateCamera(camera: any, options?: { duration?: number }) {
      if (!cameraRef.current) return;
      let center = camera?.center;
      if (!isFiniteCoord(center) && mapRef.current) {
        const current = await mapRef.current.getCenter();
        center = { longitude: current[0], latitude: current[1] };
      }
      if (!isFiniteCoord(center)) return;
      cameraRef.current.easeTo({
        center: [center.longitude, center.latitude],
        zoom: typeof camera?.zoom === 'number' ? camera.zoom : undefined,
        bearing: typeof camera?.heading === 'number' ? camera.heading : undefined,
        pitch: typeof camera?.pitch === 'number' ? camera.pitch : undefined,
        duration: options?.duration ?? 300,
      });
    },
    async getCamera() {
      if (!mapRef.current) return null;
      const [center, zoom, bearing, pitch] = await Promise.all([
        mapRef.current.getCenter(),
        mapRef.current.getZoom(),
        mapRef.current.getBearing(),
        mapRef.current.getPitch(),
      ]);
      return {
        center: { latitude: center[1], longitude: center[0] },
        zoom,
        heading: bearing,
        pitch,
        altitude: 0,
      };
    },
    injectJavaScript() {},
  }));

  const recenterOnUser = useCallback(async () => {
    try {
      const current = await ExpoLocation.getForegroundPermissionsAsync();
      let status = current.status;
      if (status !== 'granted') {
        const requested = await ExpoLocation.requestForegroundPermissionsAsync();
        status = requested.status;
      }
      if (status !== 'granted') return;
      const loc = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      cameraRef.current?.easeTo({
        center: [loc.coords.longitude, loc.coords.latitude],
        zoom: 15,
        duration: 400,
      });
    } catch (error) {
      logger.warn('MapLibre locate failed:', error);
    }
  }, []);

  const initial = initialRegionRef.current;
  const cleanChildren = props.children ? flattenMapChildren(props.children) : [];

  return (
    <MapBridgeContext.Provider value={bridge}>
      <View style={props.style}>
        <Map
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          mapStyle={mapStyleUrl}
          attribution
          attributionPosition={{ bottom: 8, left: 8 }}
          logo={false}
          compass={props.showsCompass === true}
          scaleBar={props.showsScale === true}
          dragPan={props.scrollEnabled !== false}
          touchZoom={props.zoomEnabled !== false}
          doubleTapZoom={props.zoomEnabled !== false}
          onPress={(event) => {
            if (swallowRef.current) {
              swallowRef.current = false;
              return;
            }
            const features = (event?.nativeEvent as { features?: unknown[] } | undefined)?.features;
            if (Array.isArray(features) && features.length > 0) return;
            props.onPress?.(event);
          }}
          onRegionDidChange={(event) => {
            const view = event.nativeEvent;
            const [west, south, east, north] = view.bounds;
            props.onRegionChangeComplete?.({
              latitude: view.center[1],
              longitude: view.center[0],
              latitudeDelta: Math.max(north - south, 0.0001),
              longitudeDelta: Math.max(Math.abs(east - west), 0.0001),
            });
          }}
          onDidFinishLoadingMap={() => {
            if (readyRef.current) return;
            readyRef.current = true;
            props.onMapReady?.();
          }}
        >
          <Camera
            ref={cameraRef}
            initialViewState={{
              center: initial && isFiniteCoord(initial)
                ? [initial.longitude, initial.latitude]
                : [0, 20],
              zoom: latitudeDeltaToZoom(initial?.latitudeDelta),
              padding,
            }}
            minZoom={typeof props.minZoomLevel === 'number' ? props.minZoomLevel : undefined}
            maxZoom={20}
            trackUserLocation={props.followsUserLocation ? 'default' : undefined}
          />
          {props.showsUserLocation ? <UserLocation animated accuracy /> : null}
          {cleanChildren}
        </Map>
        {props.showsMyLocationButton ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My location"
            onPress={recenterOnUser}
            style={styles.locateButton}
          >
            <Ionicons name="locate" size={22} color="#0F172A" />
          </Pressable>
        ) : null}
      </View>
    </MapBridgeContext.Provider>
  );
});

function MapLibreMarker(props: any) {
  const bridge = React.useContext(MapBridgeContext);
  const idRef = useRef(props.id || nextAnnotationId('marker'));
  if (!bridge || !isFiniteCoord(props.coordinate)) return null;

  const childList = React.Children.toArray(props.children).filter(
    (child) => child !== null && child !== undefined && typeof child !== 'boolean'
  );
  const child = childList.length === 1
    ? childList[0]
    : childList.length > 1
      ? <View>{childList}</View>
      : (
        <View
          style={[
            styles.defaultPin,
            { backgroundColor: props.pinColor || '#FF3B30' },
          ]}
        />
      );

  const handlePress = (event: any) => {
    if (props.tappable === false) return;
    bridge.swallowNextMapPress();
    event?.stopPropagation?.();
    props.onPress?.(event);
  };

  return (
    <MlMarker
      id={String(idRef.current)}
      lngLat={[props.coordinate.longitude, props.coordinate.latitude]}
      anchor={toAnchor(props.anchor)}
      onPress={props.tappable === false ? undefined : handlePress}
      style={{
        zIndex: props.zIndex,
        opacity: typeof props.opacity === 'number' ? props.opacity : 1,
      }}
    >
      {child as React.ReactElement}
    </MlMarker>
  );
}

function parseLineColor(input?: string): { color: string; opacity: number } {
  const raw = (input || '#06B6D4').trim();
  const rgba = raw.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgba) {
    const opacity = rgba[4] !== undefined ? Math.max(0, Math.min(1, Number(rgba[4]))) : 1;
    return { color: `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`, opacity };
  }
  const hex8 = raw.match(/^#([\da-f]{8})$/i);
  if (hex8) {
    const value = hex8[1];
    return {
      color: `#${value.slice(0, 6)}`,
      opacity: Math.max(0, Math.min(1, parseInt(value.slice(6, 8), 16) / 255)),
    };
  }
  return { color: raw, opacity: 1 };
}

function MapLibrePolyline(props: any) {
  const bridge = React.useContext(MapBridgeContext);
  const idRef = useRef(nextAnnotationId('route'));
  if (!bridge) return null;

  const coordinates = (props.coordinates || [])
    .filter(isFiniteCoord)
    .map((coord: LatLng) => [coord.longitude, coord.latitude]);
  if (coordinates.length < 2) return null;

  const data = {
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates,
    },
    properties: {},
  };

  const pressable = props.tappable !== false && typeof props.onPress === 'function';
  const line = parseLineColor(props.strokeColor);
  const lineWidth = typeof props.strokeWidth === 'number' ? props.strokeWidth : 2;

  return (
    <GeoJSONSource
      id={idRef.current}
      data={data}
      hitbox={{ top: 18, right: 18, bottom: 18, left: 18 }}
      onPress={pressable ? (event) => {
        bridge.swallowNextMapPress();
        event?.stopPropagation?.();
        props.onPress?.(event);
      } : undefined}
    >
      <Layer
        id={`${idRef.current}-line`}
        type="line"
        layout={{
          'line-cap': props.lineCap || 'round',
          'line-join': props.lineJoin || 'round',
        }}
        paint={{
          'line-color': line.color,
          'line-opacity': line.opacity,
          'line-width': lineWidth,
        }}
      />
    </GeoJSONSource>
  );
}

const styles = StyleSheet.create({
  locateButton: {
    position: 'absolute',
    right: 16,
    bottom: 28,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  defaultPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

export {
  MapLibreMapView as MapView,
  MapLibreMarker as Marker,
  MapLibrePolyline as Polyline,
};
