import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LoadingGlobe from './LoadingGlobe';

const { width: screenWidth } = Dimensions.get('window');

interface TravelLoadingOverlayProps {
  /** When true the overlay is mounted, animations spin up. Toggling false fades it out. */
  calculatingDistances: boolean;
  /** Theme.mode — 'dark' / 'light' / 'auto'. Only 'dark' selects the dark backdrop. */
  mode: 'light' | 'dark' | 'auto';
  /** Theme.colors — primary, text, textSecondary used inside the overlay. */
  theme: { colors: { primary: string; text: string; textSecondary: string } };
}

const TravelLoadingOverlay: React.FC<TravelLoadingOverlayProps> = ({
  calculatingDistances,
  mode,
  theme,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (calculatingDistances) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      fadeAnim.stopAnimation();
    };
  }, [calculatingDistances, fadeAnim]);

  if (!calculatingDistances) return null;

  return (
    <Animated.View
      style={[
        styles.travelLoadingOverlay,
        {
          opacity: fadeAnim,
          backgroundColor: mode === 'dark' ? 'rgba(0, 0, 0, 0.92)' : 'rgba(255, 255, 255, 0.98)',
        },
      ]}
      pointerEvents="box-none"
    >
      <LinearGradient
        colors={mode === 'dark'
          ? ['rgba(30, 30, 30, 0.95)', 'rgba(20, 20, 30, 0.95)']
          : ['rgba(255, 255, 255, 0.98)', 'rgba(245, 250, 255, 0.98)']}
        style={styles.travelLoadingGradient}
      >
        <View style={styles.travelLoadingContent}>
          <LoadingGlobe size={54} color={theme.colors.primary} />
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  travelLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  travelLoadingGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  travelLoadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: 'transparent',
  },
});

export default React.memo(TravelLoadingOverlay);
