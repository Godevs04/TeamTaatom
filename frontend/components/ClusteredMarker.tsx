import React, { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Marker, AnimatedRegion } from '../utils/mapsWrapper';

const AnimatedMarker = Marker ? Marker.Animated : null;

interface ClusteredMarkerProps {
  location: any;
  targetCoordinate: { latitude: number; longitude: number };
  visible: boolean;
  isSelected: boolean;
  showPin: boolean;
  onPress: () => void;
  children: React.ReactNode;
}

const ClusteredMarker = ({
  location,
  targetCoordinate,
  visible,
  isSelected,
  showPin,
  onPress,
  children,
}: ClusteredMarkerProps) => {
  const isMounted = useRef(true);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const [shouldMount, setShouldMount] = useState(visible);

  // Manage mount lifecycle for exit animations
  useEffect(() => {
    isMounted.current = true;
    if (visible) {
      setShouldMount(true);
    } else {
      const timer = setTimeout(() => {
        if (isMounted.current) {
          setShouldMount(false);
        }
      }, 350); // Wait for slide & fade out animation
      return () => clearTimeout(timer);
    }
    return () => {
      isMounted.current = false;
    };
  }, [visible]);

  // Initialize AnimatedRegion at targetCoordinate
  const animatedCoordinate = useRef(
    new AnimatedRegion({
      latitude: targetCoordinate.latitude,
      longitude: targetCoordinate.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  // Animate position on coordinate change
  useEffect(() => {
    animatedCoordinate.timing({
      latitude: targetCoordinate.latitude,
      longitude: targetCoordinate.longitude,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [targetCoordinate.latitude, targetCoordinate.longitude]);

  // Animated opacity and scale for the custom marker graphics
  const opacity = useSharedValue(visible ? 1 : 0);
  const scale = useSharedValue(visible ? 1 : 0.2);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
    scale.value = withTiming(visible ? 1 : 0.2, { duration: 300 });
  }, [visible]);

  // Set tracksViewChanges to true during animations (position, visibility, selection changes)
  // then toggle back to false
  const prevVisible = useRef(visible);
  const prevCoords = useRef(targetCoordinate);
  const prevSelected = useRef(isSelected);

  useEffect(() => {
    const coordsChanged = prevCoords.current.latitude !== targetCoordinate.latitude || prevCoords.current.longitude !== targetCoordinate.longitude;
    const visibilityChanged = prevVisible.current !== visible;
    const selectionChanged = prevSelected.current !== isSelected;

    if (coordsChanged || visibilityChanged || selectionChanged) {
      prevCoords.current = targetCoordinate;
      prevVisible.current = visible;
      prevSelected.current = isSelected;

      setTracksViewChanges(true);
      const timer = setTimeout(() => {
        if (isMounted.current) {
          setTracksViewChanges(false);
        }
      }, 450); // 350ms animation + 100ms safety
      return () => clearTimeout(timer);
    }
  }, [targetCoordinate.latitude, targetCoordinate.longitude, visible, isSelected]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  if (!shouldMount || !AnimatedMarker) return null;

  const markerWidth = showPin || isSelected ? 36 : 36;
  const markerHeight = showPin || isSelected ? 44 : 36;

  return (
    <AnimatedMarker
      coordinate={animatedCoordinate as any}
      onPress={onPress}
      tappable={visible || isSelected}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: showPin || isSelected ? 0.86 : 0.5 }}
    >
      <Animated.View style={[animatedStyle, { width: markerWidth, height: markerHeight, justifyContent: 'center', alignItems: 'center' }]}>
        {children}
      </Animated.View>
    </AnimatedMarker>
  );
};

export default React.memo(ClusteredMarker);
