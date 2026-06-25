import React, { useEffect, memo, useState } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import { Image as ExpoImage } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import LocationPin from './ui/LocationPin';
import { getApiUrl } from '../utils/config';
import { sanitizeLatitudeDelta } from '../utils/mapSafety';

const resolvePhotoUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return getApiUrl(cleanPath);
};

interface PremiumMapMarkerProps {
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  active?: boolean;
  isActive?: boolean;
  pointType?: 'start' | 'end' | 'default';
  label?: string;
  activeTitle?: string;
  activeSubtitle?: string;
  photo?: string;
  tracksViewChanges?: boolean;
  onImageLoad?: () => void;
  latitudeDelta?: number;
  renderAsDot?: boolean;
}

const getScaleFromDelta = (delta?: number) => {
  const safeDelta = sanitizeLatitudeDelta(delta, 1);
  const zoom = Math.log2(360 / safeDelta);
  if (!Number.isFinite(zoom)) return 1.0;
  if (zoom <= 8) return 0.55;
  if (zoom <= 11) return 0.7;
  if (zoom <= 14) return 0.85;
  if (zoom <= 15) return 1.0;
  if (zoom >= 18) return 0.5;
  return 1.0 - ((zoom - 15) / 3) * 0.5;
};

const PremiumMapMarker = memo(function PremiumMapMarker({
  icon = 'location',
  color,
  active = false,
  isActive,
  pointType = 'default',
  label = '',
  activeTitle,
  activeSubtitle,
  photo,
  tracksViewChanges: propTracksViewChanges,
  onImageLoad,
  latitudeDelta,
  renderAsDot = false,
}: PremiumMapMarkerProps) {
  const { isDark, theme } = useTheme();
  const activeState = isActive ?? active;
  const activeProgress = useSharedValue(activeState ? 1 : 0);
  const pulse = useSharedValue(1);
  const resolvedPhoto = resolvePhotoUrl(photo);
  const usesNativeIosMarker = Platform.OS === 'ios';

  const [tracksViewChanges, setTracksViewChanges] = useState(propTracksViewChanges ?? false);

  const zoomScaleShared = useSharedValue(1.0);

  useEffect(() => {
    const targetZoomScale = usesNativeIosMarker ? 1.0 : getScaleFromDelta(latitudeDelta);
    zoomScaleShared.value = withTiming(targetZoomScale, { duration: 200 });
  }, [latitudeDelta, usesNativeIosMarker, zoomScaleShared]);

  useEffect(() => {
    if (propTracksViewChanges !== undefined) {
      setTracksViewChanges(propTracksViewChanges);
    }
  }, [propTracksViewChanges]);

  const handleImageLoad = () => {
    setTracksViewChanges(true);
    if (onImageLoad) {
      onImageLoad();
    }
    setTimeout(() => {
      setTracksViewChanges(propTracksViewChanges ?? false);
    }, 0);
  };

  useEffect(() => {
    activeProgress.value = withTiming(activeState ? 1 : 0, {
      duration: 250,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [activeState, activeProgress]);

  useEffect(() => {
    if (usesNativeIosMarker) {
      pulse.value = 1;
      return;
    }

    pulse.value = withRepeat(
      withTiming(2.2, { duration: 1800, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, [pulse, usesNativeIosMarker]);

  const containerStyle = useAnimatedStyle(() => {
    const activeScale = renderAsDot ? 1.24 : 1.16;
    const baseScale = 1.0 + activeProgress.value * (activeScale - 1.0);
    const totalScale = baseScale * zoomScaleShared.value;
    return {
      transform: [{ scale: totalScale }],
    };
  });

  const pulseStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulse.value }],
      opacity: 1 - (pulse.value - 1) / 1.2,
    };
  });

  // Handle user current location marker (pulsating dot)
  if (icon === 'navigate') {
    const outerBg = isDark ? '#0F172A' : '#FFFFFF';
    return (
      <Animated.View style={[styles.userMarkerContainer, containerStyle]}>
        {/* Pulsating Ring */}
        {!usesNativeIosMarker && (
          <Animated.View style={[styles.pulsatingRing, pulseStyle]}>
            <LinearGradient
              colors={['#3B82F6', '#2DD4BF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 12 }]}
            />
          </Animated.View>
        )}
        
        {/* Static Inner Border */}
        <View style={[styles.userMarkerOuter, { backgroundColor: outerBg, borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)' }]}>
          <LinearGradient
            colors={['#3B82F6', '#2DD4BF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.userMarkerInner}
          />
        </View>
      </Animated.View>
    );
  }

  // Handle Journey Start / End points
  if (pointType === 'start' || pointType === 'end') {
    const badgeColors = pointType === 'start' 
      ? ['#10B981', '#059669'] as const
      : ['#EF4444', '#DC2626'] as const;
    return (
      <Animated.View style={[{ width: 22, height: 22, justifyContent: 'center', alignItems: 'center' }, containerStyle]}>
        <LinearGradient
          colors={badgeColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.journeyBadge}
        />
      </Animated.View>
    );
  }

  // Handle standard location markers as dots if specified
  if (renderAsDot) {
    const dotColors = activeState
      ? ['#FF6E7F', '#FF6B6B'] as const
      : ['#3B82F6', '#10B981'] as const;

    return (
      <Animated.View style={[styles.dotContainer, containerStyle]}>
        <LinearGradient
          colors={dotColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.dotCore,
            Platform.OS === 'android' && { elevation: 3 }
          ]}
        />
      </Animated.View>
    );
  }

  // Handle standard location markers (if inactive, render as Google Maps style gradient pin with custom landmark/icon)
  if (!activeState) {
    const isLandmark = icon === 'location';

    return (
      <Animated.View style={[styles.inactiveMarkerContainer, containerStyle]}>
        {/* Custom Svg Gradient Pin (Teardrop shape matching Google Maps logo, white border) */}
        <View style={styles.pinWrapper}>
          <LocationPin width={30} height={38} showLandmark={isLandmark} style={styles.svgPin} />
          
          {/* If not landmark, overlay the custom Ionicon in white */}
          {!isLandmark && (
            <View style={styles.iconOverlay}>
              <Ionicons name={icon} size={12} color="#FFFFFF" />
            </View>
          )}
        </View>
      </Animated.View>
    );
  }

  // Handle both Inactive Pin and Active Pin (No glassmorphic card preview anymore!)
  const isLandmark = icon === 'location';

  return (
    <Animated.View style={[styles.inactiveMarkerContainer, containerStyle]}>
      {/* Custom Svg Gradient Pin */}
      <View style={styles.pinWrapper}>
        <LocationPin width={30} height={38} showLandmark={isLandmark} style={styles.svgPin} />
        
        {/* If not landmark, overlay the custom Ionicon in white */}
        {!isLandmark && (
          <View style={styles.iconOverlay}>
            <Ionicons name={icon} size={12} color="#FFFFFF" />
          </View>
        )}
      </View>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.active === nextProps.active &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.icon === nextProps.icon &&
    prevProps.color === nextProps.color &&
    prevProps.pointType === nextProps.pointType &&
    prevProps.label === nextProps.label &&
    prevProps.activeTitle === nextProps.activeTitle &&
    prevProps.activeSubtitle === nextProps.activeSubtitle &&
    prevProps.photo === nextProps.photo &&
    prevProps.tracksViewChanges === nextProps.tracksViewChanges &&
    prevProps.onImageLoad === nextProps.onImageLoad &&
    prevProps.latitudeDelta === nextProps.latitudeDelta &&
    prevProps.renderAsDot === nextProps.renderAsDot
  );
});

export default PremiumMapMarker;

const styles = StyleSheet.create({
  pinWrapper: {
    width: 30,
    height: 38,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOverlay: {
    position: 'absolute',
    top: 10,
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveMarkerContainer: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  svgPin: {},
  journeyBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  journeyBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cockpitContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dotContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dotPulse: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  dotCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  activeBaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  cardWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  markerCard: {
    minWidth: 90,
    maxWidth: 160,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  markerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markerPhoto: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textColumn: {
    flexDirection: 'column',
    justifyContent: 'center',
    flex: 1,
  },
  markerLabelText: {
    fontSize: 11,
    fontWeight: '800',
  },
  activeSubtitleText: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  shadowDark: {},
  shadowLight: {},
  userMarkerContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  pulsatingRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  userMarkerOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  userMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
