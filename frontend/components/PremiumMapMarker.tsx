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
import { getApiUrl } from '../utils/config';

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
}

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
}: PremiumMapMarkerProps) {
  const { isDark, theme } = useTheme();
  const activeState = isActive ?? active;
  const activeProgress = useSharedValue(activeState ? 1 : 0);
  const pulse = useSharedValue(1);
  const resolvedPhoto = resolvePhotoUrl(photo);

  const [tracksViewChanges, setTracksViewChanges] = useState(propTracksViewChanges ?? false);

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
    pulse.value = withRepeat(
      withTiming(2.2, { duration: 1800, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => {
    const scale = activeState ? (isDark ? 1.15 : 1.1) : 1.0;
    return {
      transform: [{ scale: withTiming(scale, { duration: 200 }) }],
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
      <View style={styles.userMarkerContainer}>
        {/* Pulsating Ring */}
        <Animated.View style={[styles.pulsatingRing, pulseStyle]}>
          <LinearGradient
            colors={['#3B82F6', '#2DD4BF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 12 }]}
          />
        </Animated.View>
        
        {/* Static Inner Border */}
        <View style={[styles.userMarkerOuter, { backgroundColor: outerBg, borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)' }]}>
          <LinearGradient
            colors={['#3B82F6', '#2DD4BF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.userMarkerInner}
          />
        </View>
      </View>
    );
  }

  // Handle Journey Start / End points
  if (pointType === 'start' || pointType === 'end') {
    const badgeColors = pointType === 'start' 
      ? ['#10B981', '#059669'] as const
      : ['#EF4444', '#DC2626'] as const;
    return (
      <View style={isDark ? styles.shadowDark : styles.shadowLight}>
        <LinearGradient
          colors={badgeColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.journeyBadge}
        />
      </View>
    );
  }

  // Handle standard location markers (if inactive, render as small glowing dot)
  if (!activeState) {
    return (
      <View style={styles.dotContainer}>
        {/* Pulsating Ring */}
        <Animated.View style={[styles.dotPulse, pulseStyle]}>
          <LinearGradient
            colors={isDark ? ['rgba(45, 212, 191, 0.4)', 'rgba(59, 130, 246, 0.05)'] as const : ['rgba(59, 130, 246, 0.4)', 'rgba(45, 212, 191, 0.05)'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 15 }]}
          />
        </Animated.View>
        
        {/* Core Dot */}
        <LinearGradient
          colors={['#2DD4BF', '#3B82F6'] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.dotCore}
        />
      </View>
    );
  }

  // Handle Active State: Glassmorphism card + photo preview
  const showLabel = label || activeTitle || '';
  const displaySubtitle = activeSubtitle || 'Visited place';
  
  const outerBg = isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.75)';
  const borderCol = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.08)';
  const textColor = isDark ? '#FFFFFF' : '#0F172A';

  return (
    <Animated.View style={[styles.cockpitContainer, containerStyle]}>
      {/* Base Point Indicator */}
      <View style={[styles.activeBaseDot, { backgroundColor: isDark ? '#2DD4BF' : '#3B82F6' }]} />
      
      {/* Shadow wrapper (no overflow hidden to allow shadows on iOS, flat wrapper on Android) */}
      <View style={isDark ? styles.shadowDark : styles.shadowLight}>
        {/* Glassmorphic card body (clips inner contents like blur/image) */}
        <View style={styles.cardWrapper}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={40}
              tint={isDark ? 'dark' : 'light'}
              style={[
                styles.markerCard,
                {
                  backgroundColor: outerBg,
                  borderColor: borderCol,
                }
              ]}
            >
              <View style={styles.markerContentRow}>
                {resolvedPhoto ? (
                  <ExpoImage
                    source={{ uri: resolvedPhoto }}
                    style={[styles.markerPhoto, { borderColor: isDark ? '#2DD4BF' : '#3B82F6' }]}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    onLoad={handleImageLoad}
                  />
                ) : (
                  <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(45, 212, 191, 0.15)' : 'rgba(59, 130, 246, 0.1)' }]}>
                    <Ionicons
                      name={icon}
                      size={14}
                      color={isDark ? '#2DD4BF' : '#3B82F6'}
                    />
                  </View>
                )}
                
                <View style={styles.textColumn}>
                  {showLabel ? (
                    <Text style={[styles.markerLabelText, { color: textColor }]} numberOfLines={1}>
                      {showLabel}
                    </Text>
                  ) : null}
                  <Text style={[styles.activeSubtitleText, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                    {displaySubtitle}
                  </Text>
                </View>
              </View>
            </BlurView>
          ) : (
            <View
              style={[
                styles.markerCard,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: borderCol,
                  borderRadius: 14,
                }
              ]}
            >
              <View style={styles.markerContentRow}>
                {resolvedPhoto ? (
                  <ExpoImage
                    source={{ uri: resolvedPhoto }}
                    style={[styles.markerPhoto, { borderColor: isDark ? '#2DD4BF' : '#3B82F6' }]}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    onLoad={handleImageLoad}
                  />
                ) : (
                  <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(45, 212, 191, 0.15)' : 'rgba(59, 130, 246, 0.1)' }]}>
                    <Ionicons
                      name={icon}
                      size={14}
                      color={isDark ? '#2DD4BF' : '#3B82F6'}
                    />
                  </View>
                )}
                
                <View style={styles.textColumn}>
                  {showLabel ? (
                    <Text style={[styles.markerLabelText, { color: textColor }]} numberOfLines={1}>
                      {showLabel}
                    </Text>
                  ) : null}
                  <Text style={[styles.activeSubtitleText, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                    {displaySubtitle}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
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
    prevProps.onImageLoad === nextProps.onImageLoad
  );
});

export default PremiumMapMarker;

const styles = StyleSheet.create({
  journeyBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
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
});
