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
import Svg, { Circle, Path, Defs, LinearGradient as SvgLinearGradient, Stop, G, ClipPath, Image as SvgImage } from 'react-native-svg';
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
    const baseScale = activeState ? (isDark ? 1.15 : 1.1) : 1.0;
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
      <Animated.View style={[isDark ? styles.shadowDark : styles.shadowLight, containerStyle]}>
        <LinearGradient
          colors={badgeColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.journeyBadge}
        />
      </Animated.View>
    );
  }

  // Always render the card if active, otherwise render the custom gradient star pin
  const shouldShowCard = activeState;

  if (!shouldShowCard) {
    return (
      <View style={styles.inactiveMarkerContainer}>
        <Animated.View style={[styles.flagPinContainer, containerStyle]}>
          <Svg viewBox="0 0 36 36" width={36} height={36}>
            <Defs>
              <SvgLinearGradient id="markerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#50C878" />
                <Stop offset="100%" stopColor="#1C73B4" />
              </SvgLinearGradient>
            </Defs>
            {/* The White Border Base */}
            <Circle cx="18" cy="18" r="16" fill="#FFFFFF" />
            
            {/* The Gradient Core */}
            <Circle cx="18" cy="18" r="13" fill="url(#markerGrad)" />
            
            {/* The White Star Icon */}
            <Path
              d="M18 23.27l6.18 3.73-1.64-7.03 5.46-4.73-7.19-0.61-2.81-6.63-2.81 6.63-7.19 0.61 5.46 4.73-1.64 7.03z"
              fill="#FFFFFF"
            />
          </Svg>
        </Animated.View>
      </View>
    );
  }

  // Handle Active State: Glassmorphism card + photo preview
  const showLabel = label || activeTitle || '';
  const displaySubtitle = activeSubtitle || 'Visited place';
  
  const cardBg = isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.95)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.12)';
  const cardTitleColor = isDark ? '#FFFFFF' : '#0F172A';
  const cardSubtitleColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <Animated.View style={[styles.pinActiveContainer, containerStyle]}>
      <View style={styles.pinSvgWrapper}>
        <Svg viewBox="0 0 52 64" width={52} height={64}>
          <Defs>
            {/* Strict mathematical clipping mask to safeguard the image layout */}
            <ClipPath id="circleView">
              <Circle cx="26" cy="26" r="21" />
            </ClipPath>
          </Defs>

          {/* Outer Premium Base Anchor: Clean, smooth, and unified */}
          <Path
            d="M26 62C38 48 48 38 48 26C48 13.8497 38.1503 4 26 4C13.8497 4 4 13.8497 4 26C4 38 14 48 26 62Z"
            fill="#FFFFFF"
          />

          {/* Inner Context Shadow Layer for High Contrast */}
          <Circle cx="26" cy="26" r="22" fill="#EAEAEA" />

          {/* Content Layer: Smoothly masked image context, zero clipping cuts */}
          {resolvedPhoto ? (
            <G clipPath="url(#circleView)">
              <SvgImage
                href={{ uri: resolvedPhoto }}
                width="46"
                height="46"
                x="3"
                y="3"
                preserveAspectRatio="xMidYMid slice"
                onLoad={handleImageLoad}
              />
            </G>
          ) : null}
        </Svg>
        {!resolvedPhoto && (
          <View style={styles.pinIconOverlay}>
            <Ionicons name={icon} size={22} color="#06B6D4" />
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
    prevProps.latitudeDelta === nextProps.latitudeDelta
  );
});

export default PremiumMapMarker;

const styles = StyleSheet.create({
  inactiveMarkerContainer: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  flagPinContainer: {
    width: 36,
    height: 36,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  svgPin: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
      },
      android: {},
    }),
  },
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
    width: 220,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dotContainer: {
    width: 36,
    height: 36,
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
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
      },
      android: {
        elevation: 0,
      },
    }),
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
    borderRadius: 22,
    overflow: 'hidden',
  },
  markerCard: {
    minWidth: 100,
    maxWidth: 180,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  markerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markerPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textColumn: {
    flexDirection: 'column',
    justifyContent: 'center',
    flex: 1,
  },
  markerLabelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeSubtitleText: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 1,
  },
  shadowDark: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
    },
    android: {},
  }) as any,
  shadowLight: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    android: {},
  }) as any,
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
  pinActiveContainer: {
    width: 52,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    // High-end depth simulation via decoupled layout shadows
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 4.65,
      },
      android: {
        elevation: 7,
      },
    }),
  },
  pinSvgWrapper: {
    width: 52,
    height: 64,
    position: 'relative',
  },
  pinIconOverlay: {
    position: 'absolute',
    left: 5,
    top: 5,
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
