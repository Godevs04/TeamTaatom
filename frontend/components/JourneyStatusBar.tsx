import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GROWTH_GREEN = '#22C55E';
const ALERT_RED = '#EF4444';
const ACTION_BLUE = '#3B82F6';

interface JourneyStatusBarProps {
  isTracking: boolean;
  isPaused: boolean;
  distance: number; // in meters
  duration: number; // in seconds
  onStop?: () => void;
  onContinue?: () => void;
}

/**
 * JourneyStatusBar
 *
 * Persistent floating bar shown across ALL screens when journey is active.
 * Shows recording status, distance, duration, and quick actions.
 *
 * Active: pulsing green dot + "Recording... | 12.4 km | 2h 15m" + Stop button
 * Paused: orange dot + "Journey paused | Tap to continue" + Continue/End buttons
 * Tap bar → navigate to tracking screen
 */
export default function JourneyStatusBar({
  isTracking,
  isPaused,
  distance,
  duration,
  onStop,
  onContinue,
}: JourneyStatusBarProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [pulseAnimation] = useState(new Animated.Value(1));
  const [formattedDistance, setFormattedDistance] = useState('0 km');
  const [formattedDuration, setFormattedDuration] = useState('0m');

  // Format distance
  useEffect(() => {
    if (distance < 1000) {
      setFormattedDistance(`${Math.round(distance)} m`);
    } else {
      setFormattedDistance(`${(distance / 1000).toFixed(1)} km`);
    }
  }, [distance]);

  // Format duration
  useEffect(() => {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
      setFormattedDuration(`${hours}h ${minutes}m`);
    } else if (minutes > 0) {
      setFormattedDuration(`${minutes}m ${seconds}s`);
    } else {
      setFormattedDuration(`${seconds}s`);
    }
  }, [duration]);

  // Pulse animation for active recording
  useEffect(() => {
    if (isTracking && !isPaused) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [isTracking, isPaused, pulseAnimation]);

  if (!isTracking && !isPaused) {
    return null;
  }

  const dotScale = pulseAnimation.interpolate({
    inputRange: [1, 1.3],
    outputRange: [1, 1.3],
  });

  const dotOpacity = pulseAnimation.interpolate({
    inputRange: [1, 1.3],
    outputRange: [1, 0.5],
  });

  const statusColor = isPaused ? ACTION_BLUE : GROWTH_GREEN;
  const statusText = isPaused ? 'Paused' : 'Recording';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
          top: insets.top + (Platform.OS === 'android' ? 56 : 44), // Below header
        },
      ]}
      activeOpacity={0.7}
      onPress={() => router.push('/navigate/tracking')}
    >
      {/* Status Indicator */}
      <View style={styles.statusContainer}>
        {isTracking && !isPaused && (
          <>
            {/* Outer pulsing ring */}
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: dotScale }],
                  opacity: dotOpacity,
                  borderColor: statusColor,
                },
              ]}
            />
            {/* Inner solid dot */}
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </>
        )}

        {isPaused && (
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        )}
      </View>

      {/* Status Text and Metrics */}
      <View style={styles.infoContainer}>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: statusColor }]}>
            {statusText}
          </Text>
        </View>

        <View style={styles.metricsRow}>
          <Text style={[styles.metric, { color: theme.colors.textSecondary }]}>
            {formattedDistance}
          </Text>
          <Text style={[styles.metricSeparator, { color: theme.colors.textSecondary }]}>
            •
          </Text>
          <Text style={[styles.metric, { color: theme.colors.textSecondary }]}>
            {formattedDuration}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {isPaused ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: statusColor }]}
              onPress={onContinue}
            >
              <Ionicons name="play-circle" size={20} color={statusColor} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: ALERT_RED }]}
              onPress={onStop}
            >
              <Ionicons name="stop-circle" size={20} color={ALERT_RED} />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: ALERT_RED }]}
            onPress={onStop}
          >
            <Ionicons name="pause-circle" size={20} color={ALERT_RED} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  statusContainer: {
    position: 'relative',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pulseRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  statusRow: {
    marginBottom: 2,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metric: {
    fontSize: 12,
    fontWeight: '500',
  },
  metricSeparator: {
    fontSize: 10,
    fontWeight: '400',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
});
