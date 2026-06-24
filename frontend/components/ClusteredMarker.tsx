import React, { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Marker } from '../utils/mapsWrapper';


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
  const [shouldMount] = useState(true);

  // Manage mount lifecycle for exit animations
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, [visible]);



  // Animated opacity and scale for the custom marker graphics
  const opacity = useSharedValue(visible ? 1 : 0);
  const scale = useSharedValue(visible ? 1 : 0.55);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 240 });
    scale.value = withTiming(visible ? 1 : 0.55, { duration: 280 });
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
      }, 360);
      return () => clearTimeout(timer);
    }
  }, [targetCoordinate.latitude, targetCoordinate.longitude, visible, isSelected]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  const lastPressTime = useRef(0);

  if (!shouldMount || !Marker || (!visible && !isSelected)) return null;

  const markerWidth = isSelected ? 34 : 30;
  const markerHeight = isSelected ? 42 : 32;

  const handlePress = () => {
    const now = Date.now();
    if (now - lastPressTime.current < 500) return;
    lastPressTime.current = now;
    if (onPress) {
      onPress();
    }
  };

  return (
    <Marker
      coordinate={targetCoordinate}
      onPress={handlePress}
      onSelect={handlePress}
      tappable={visible || isSelected}
      tracksViewChanges={Platform.OS === 'ios' ? true : tracksViewChanges}
      anchor={{ x: 0.5, y: isSelected ? 0.86 : 0.5 }}
      opacity={visible || isSelected ? 1 : 0}
    >
      <Animated.View 
        pointerEvents="none" 
        style={[animatedStyle, { width: markerWidth, height: markerHeight, justifyContent: 'center', alignItems: 'center' }]}
      >
        {children}
      </Animated.View>
    </Marker>
  );
};

export default React.memo(ClusteredMarker);
