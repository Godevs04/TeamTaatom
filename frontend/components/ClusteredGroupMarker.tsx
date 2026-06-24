import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, Easing } from 'react-native-reanimated';
import { Marker } from '../utils/mapsWrapper';
import { LinearGradient } from 'expo-linear-gradient';


interface ClusteredGroupMarkerProps {
  cluster: any;
  onPress: () => void;
  isDark: boolean;
}

const ClusteredGroupMarker = ({
  cluster,
  onPress,
  isDark,
}: ClusteredGroupMarkerProps) => {
  const isMounted = useRef(true);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const usesNativeIosMarker = Platform.OS === 'ios';



  // Pulse value for the dot pulse animation
  const pulse = useSharedValue(1);

  useEffect(() => {
    isMounted.current = true;
    setTracksViewChanges(true);
    const timer = setTimeout(() => {
      if (isMounted.current) {
        setTracksViewChanges(false);
      }
    }, 450);

    if (!usesNativeIosMarker) {
      pulse.value = withRepeat(
        withTiming(2.2, { duration: 1800, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
    }

    return () => {
      isMounted.current = false;
      clearTimeout(timer);
    };
  }, []);



  // Animate fade-in and scale-up of the badge
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    scale.value = withTiming(1, { duration: 300 });
  }, []);

  // Set tracksViewChanges during changes
  const prevCoords = useRef({ latitude: cluster.latitude, longitude: cluster.longitude });
  useEffect(() => {
    const coordsChanged = prevCoords.current.latitude !== cluster.latitude || prevCoords.current.longitude !== cluster.longitude;
    if (coordsChanged) {
      prevCoords.current = { latitude: cluster.latitude, longitude: cluster.longitude };
      setTracksViewChanges(true);
      const timer = setTimeout(() => {
        if (isMounted.current) {
          setTracksViewChanges(false);
        }
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [cluster.latitude, cluster.longitude]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  const pulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulse.value }],
      opacity: 1 - (pulse.value - 1) / 1.2,
    };
  });

  if (!Marker) return null;

  const count = cluster.locations.length;
  
  // Calculate size according to count (number of merged places)
  let size = 17;
  let borderWidth = 2;
  if (count === 2) {
    size = 15;
    borderWidth = 2;
  } else if (count >= 8) {
    size = 19;
    borderWidth = 2.25;
  } else {
    size = 17;
    borderWidth = 2;
  }

  return (
    <Marker
      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
      onPress={onPress}
      tracksViewChanges={Platform.OS === 'ios' ? true : tracksViewChanges}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <Animated.View style={[animatedStyle, { width: size + 8, height: size + 8, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={[styles.clusterMarkerContainer, { width: size + 8, height: size + 8 }]}>
          {/* Merged Dot Core (Bigger according to no of places, no numbers) */}
          <LinearGradient
            colors={['#3B82F6', '#10B981'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.dotCore, 
              { 
                width: size, 
                height: size, 
                borderRadius: size / 2, 
                borderWidth: borderWidth,
                borderColor: '#FFFFFF',
              }
            ]}
          />
        </View>
      </Animated.View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  clusterMarkerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 4,
  },
  dotPulse: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotCore: {},
});

export default React.memo(ClusteredGroupMarker);
