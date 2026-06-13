import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, Easing } from 'react-native-reanimated';
import { Marker, AnimatedRegion } from '../utils/mapsWrapper';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedMarker = Marker ? Marker.Animated : null;

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

  // Initialize at the cluster coordinate
  const animatedCoordinate = useRef(
    new AnimatedRegion({
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

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

  // Update coordinate when the centroid moves
  useEffect(() => {
    animatedCoordinate.timing({
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [cluster.latitude, cluster.longitude]);

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

  if (!AnimatedMarker) return null;

  const count = cluster.locations.length;
  
  // Calculate size according to count (number of merged places)
  let size = 20;
  let borderWidth = 2;
  if (count <= 3) {
    size = 20;
    borderWidth = 2;
  } else if (count <= 8) {
    size = 26;
    borderWidth = 2.5;
  } else if (count <= 20) {
    size = 32;
    borderWidth = 3;
  } else {
    size = 40;
    borderWidth = 3.5;
  }

  return (
    <AnimatedMarker
      coordinate={animatedCoordinate as any}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <Animated.View style={animatedStyle}>
        <View style={styles.clusterMarkerContainer}>
          {/* Pulsating Ring (under the merged dot) */}
          {!usesNativeIosMarker && (
            <Animated.View style={[styles.dotPulse, pulseStyle, { 
              width: size * 1.8, 
              height: size * 1.8, 
              borderRadius: (size * 1.8) / 2,
            }]}>
              <LinearGradient
                colors={['rgba(59, 130, 246, 0.4)', 'rgba(16, 185, 129, 0.05)'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFillObject, { borderRadius: (size * 1.8) / 2 }]}
              />
            </Animated.View>
          )}

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
              }, 
              Platform.OS === 'android' && { elevation: 3 }
            ]}
          />
        </View>
      </Animated.View>
    </AnimatedMarker>
  );
};

const styles = StyleSheet.create({
  clusterMarkerContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dotPulse: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotCore: {
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
});

export default React.memo(ClusteredGroupMarker);
