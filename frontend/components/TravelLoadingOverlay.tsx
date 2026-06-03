import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import LoadingGlobe from './LoadingGlobe';

const { width: screenWidth } = Dimensions.get('window');
const isTabletLocal = screenWidth >= 768;

const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

interface TravelLoadingOverlayProps {
  /** When true the overlay is mounted, animations spin up. Toggling false fades it out. */
  calculatingDistances: boolean;
  /** Theme.mode — 'dark' / 'light' / 'auto'. Only 'dark' selects the dark backdrop. */
  mode: 'light' | 'dark' | 'auto';
  /** Theme.colors — primary, text, textSecondary used inside the overlay. */
  theme: { colors: { primary: string; text: string; textSecondary: string } };
}

/**
 * Module-scope component (was previously declared inline inside LocaleScreen).
 * Defining it inline made every parent re-render unmount and remount the
 * overlay, restarting all 9 animation loops and producing the rare native-
 * animation-after-free crash that motivated the original cleanup pass.
 * Lifting it here gives it a stable identity across renders, so the
 * animation lifecycle is governed purely by `calculatingDistances`.
 */
const TravelLoadingOverlay: React.FC<TravelLoadingOverlayProps> = ({
  calculatingDistances,
  mode,
  theme,
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const globeRotateAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (calculatingDistances) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 4000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(floatAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        ),
        Animated.loop(
          Animated.timing(globeRotateAnim, {
            toValue: 1,
            duration: 8000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ),
        Animated.loop(
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ),
      ]).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      rotateAnim.stopAnimation();
      pulseAnim.stopAnimation();
      fadeAnim.stopAnimation();
      floatAnim.stopAnimation();
      globeRotateAnim.stopAnimation();
      shimmerAnim.stopAnimation();
    };
  }, [calculatingDistances, rotateAnim, pulseAnim, fadeAnim, floatAnim, globeRotateAnim, shimmerAnim]);

  const rotation = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -15] });
  const globeRotation = globeRotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const shimmerTranslate = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 100] });
  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.3, 0] });

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
          <Animated.View
            style={[
              styles.travelIconContainer,
              { transform: [{ rotate: rotation }, { scale }, { translateY }] },
            ]}
          >
            <Animated.View
              style={[
                styles.travelGlobeBackground,
                { transform: [{ rotate: globeRotation }], opacity: 0.12 },
              ]}
              pointerEvents="none"
            >
              <Ionicons name="earth" size={100} color={theme.colors.primary} />
            </Animated.View>

            <View style={styles.travelIconWrapper}>
              <Animated.View
                style={[
                  styles.travelShimmer,
                  { transform: [{ translateX: shimmerTranslate }], opacity: shimmerOpacity },
                ]}
                pointerEvents="none"
              />
              <Ionicons name="airplane" size={56} color={theme.colors.primary} style={styles.travelAirplaneIcon} />
            </View>
          </Animated.View>

          <View style={styles.travelDotsContainer}>
            <LoadingGlobe size="small" color={theme.colors.primary} />
          </View>

          <View style={styles.travelTextContainer}>
            <Text style={[styles.travelLoadingText, { color: theme.colors.text }]}>
              Capturing the best locales for you
            </Text>
            <Text style={[styles.travelLoadingSubtext, { color: theme.colors.textSecondary }]}>
              Calculating distances...
            </Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

// Styles cloned verbatim from the original locale.tsx StyleSheet so the
// extracted component renders identically.
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
    borderRadius: 32,
    backgroundColor: 'transparent',
    minWidth: 300,
    maxWidth: 340,
    overflow: 'hidden',
    position: 'relative',
  },
  travelIconContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    position: 'relative',
    width: 140,
    height: 140,
  },
  travelGlobeBackground: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -50,
    marginLeft: -50,
    zIndex: 0,
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(74, 144, 226, 0.2)',
    zIndex: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  travelShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 40,
    zIndex: 1,
  },
  travelAirplaneIcon: {
    zIndex: 3,
    position: 'relative',
  },
  travelDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 12,
    zIndex: 2,
  },

  travelTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  travelLoadingText: {
    fontSize: 17,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  travelLoadingSubtext: {
    fontSize: 14,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    textAlign: 'center',
    opacity: 0.7,
    letterSpacing: 0.1,
  },
});

export default React.memo(TravelLoadingOverlay);
