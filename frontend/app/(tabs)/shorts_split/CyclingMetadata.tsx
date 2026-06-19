import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) {
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    return 'System';
  }
  return 'Roboto';
};

interface CyclingMetadataProps {
  song?: {
    songId?: {
      title?: string;
      artist?: string;
    } | string | null;
  } | null;
  location?: {
    address?: string;
  } | null;
  onLocationPress: (e: any) => void;
}

export const CyclingMetadata = React.memo(({ song, location, onLocationPress }: CyclingMetadataProps) => {
  const songIdObj = typeof song?.songId === 'object' ? song?.songId : null;
  const songTitle = songIdObj?.title;
  const songArtist = songIdObj?.artist;
  const hasSong = !!(songTitle || songArtist);
  const hasLocation = !!location?.address;

  // If neither is present, show nothing
  if (!hasSong && !hasLocation) return null;

  // If only one is present, show it statically without animation
  if (hasSong && !hasLocation) {
    const displayText = `${songTitle || 'Unknown Song'} · ${songArtist || 'Unknown Artist'}`;
    return (
      <View style={styles.cyclingContainer}>
        <Ionicons name="musical-notes" size={12} color="#38BDF8" />
        <Text style={styles.cyclingText} numberOfLines={1}>
          {displayText}
        </Text>
      </View>
    );
  }

  if (!hasSong && hasLocation) {
    return (
      <TouchableOpacity 
        style={styles.cyclingContainer} 
        onPress={onLocationPress}
        activeOpacity={0.7}
      >
        <Ionicons name="location" size={12} color="#38BDF8" />
        <Text style={styles.cyclingText} numberOfLines={1}>
          {location.address}
        </Text>
      </TouchableOpacity>
    );
  }

  // Both song and location are present -> cycle every 2 seconds
  const [showLocation, setShowLocation] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      // Step 1: Fade out & Slide up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateAnim, {
          toValue: -10,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Step 2: Toggle content and position text below
        setShowLocation(prev => !prev);
        translateAnim.setValue(10);
        
        // Step 3: Fade in & Slide back to center
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(translateAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 2000); // 2 seconds delay

    return () => clearInterval(interval);
  }, [fadeAnim, translateAnim]);

  const songText = `${songTitle || 'Unknown Song'} · ${songArtist || 'Unknown Artist'}`;

  return (
    <Animated.View
      style={[
        styles.cyclingAnimatedWrapper,
        {
          opacity: fadeAnim,
          transform: [{ translateY: translateAnim }],
        }
      ]}
    >
      {showLocation ? (
        <TouchableOpacity 
          style={styles.cyclingContainer} 
          onPress={onLocationPress}
          activeOpacity={0.7}
        >
          <Ionicons name="location" size={12} color="#38BDF8" />
          <Text style={styles.cyclingText} numberOfLines={1}>
            {location.address}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.cyclingContainer}>
          <Ionicons name="musical-notes" size={12} color="#38BDF8" />
          <Text style={styles.cyclingText} numberOfLines={1}>
            {songText}
          </Text>
        </View>
      )}
    </Animated.View>
  );
});

CyclingMetadata.displayName = 'CyclingMetadata';

const styles = StyleSheet.create({
  cyclingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  cyclingText: {
    color: '#38BDF8',
    fontSize: 14,
    marginLeft: 6,
    fontFamily: getFontFamily('400'),
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  cyclingAnimatedWrapper: {
    height: 20,
    justifyContent: 'center',
    marginVertical: 4,
  },
});
