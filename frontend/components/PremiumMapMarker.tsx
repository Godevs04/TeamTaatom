import React, { useEffect, memo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

interface PremiumMapMarkerProps {
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  active?: boolean;
  isActive?: boolean;
  pointType?: 'start' | 'end' | 'default';
  label?: string;
  activeTitle?: string;
  activeSubtitle?: string;
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
}: PremiumMapMarkerProps) {
  const { isDark, theme } = useTheme();
  const activeState = isActive ?? active;
  const activeProgress = useSharedValue(activeState ? 1 : 0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    activeProgress.value = withTiming(activeState ? 1 : 0, {
      duration: 250,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [activeState, activeProgress]);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(2.2, { duration: 1500, easing: Easing.out(Easing.ease) }),
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
    const outerBg = isDark ? '#000000' : '#FFFFFF';
    const dotColor = isDark ? '#FFFFFF' : '#000000';
    return (
      <View style={styles.userMarkerContainer}>
        {/* Pulsating Ring */}
        <Animated.View style={[styles.pulsatingRing, pulseStyle]}>
          <LinearGradient
            colors={['#1C73B4', '#50C878']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
        
        {/* Static Inner Border */}
        <View style={[styles.userMarkerOuter, { backgroundColor: outerBg, borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)' }]}>
          <View style={[styles.userMarkerInner, { backgroundColor: dotColor }]} />
        </View>
      </View>
    );
  }

  // Handle Journey Start / End points
  if (pointType === 'start' || pointType === 'end') {
    const badgeColor = pointType === 'start' ? '#22C55E' : '#EF4444';
    const textLabel = pointType === 'start' ? 'S' : 'E';
    return (
      <View style={[styles.journeyBadge, { backgroundColor: badgeColor }]}>
        <Text style={styles.journeyBadgeText}>{textLabel}</Text>
      </View>
    );
  }

  // Handle standard location markers
  const showLabel = label || '';
  const displayTitle = activeState && activeTitle ? activeTitle : '';
  const displaySubtitle = activeState && activeSubtitle ? activeSubtitle : '';

  // Theme-based colors
  const cardBg = activeState
    ? (isDark ? '#38BDF8' : '#1C73B4')
    : isDark
      ? 'rgba(0, 0, 0, 0.75)'
      : 'rgba(255, 255, 255, 0.85)';

  const cardBorder = activeState
    ? 'rgba(56, 189, 248, 0.2)'
    : theme.colors.border;

  const textColor = activeState
    ? '#FFFFFF'
    : (isDark ? '#FFFFFF' : '#000000');

  const dotColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <Animated.View style={[styles.cockpitContainer, containerStyle]}>
      {/* Top Dot (●) */}
      <View style={[styles.markerDot, { backgroundColor: dotColor, borderColor: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.1)' }]} />

      {/* Card Body */}
      <View
        style={[
          styles.markerCard,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
          },
          isDark ? styles.shadowDark : styles.shadowLight,
          activeState && activeTitle ? styles.activeExpandedCard : null,
        ]}
      >
        {activeState && activeTitle ? (
          <View style={styles.expandedContent}>
            <Text style={[styles.expandedTitle, { color: textColor }]} numberOfLines={1}>
              {displayTitle}
            </Text>
            {displaySubtitle ? (
              <Text style={[styles.expandedSubtitle, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }]} numberOfLines={1}>
                {displaySubtitle}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.markerContentRow}>
             <View style={[
              styles.iconCircle,
              {
                backgroundColor: activeState
                  ? 'rgba(255, 255, 255, 0.25)'
                  : isDark
                    ? 'rgba(255, 255, 255, 0.15)'
                    : 'rgba(28, 115, 180, 0.12)',
              }
            ]}>
              <Ionicons
                name={icon}
                size={10}
                color={activeState ? '#FFFFFF' : isDark ? '#FFFFFF' : '#1C73B4'}
              />
            </View>
            {showLabel ? (
              <Text style={[styles.markerLabelText, { color: textColor }]}>
                {showLabel}
              </Text>
            ) : null}
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
    prevProps.activeSubtitle === nextProps.activeSubtitle
  );
});

export default PremiumMapMarker;

const styles = StyleSheet.create({
  journeyBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  journeyBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cockpitContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 1,
  },
  markerCard: {
    minWidth: 46,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  iconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeExpandedCard: {
    minWidth: 100,
    maxWidth: 160,
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  markerLabelText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  expandedContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedTitle: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  expandedSubtitle: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
    textAlign: 'center',
  },
  shadowDark: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 8,
  },
  shadowLight: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  userMarkerContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  userMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

