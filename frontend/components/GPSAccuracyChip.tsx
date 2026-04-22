import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface GPSAccuracyChipProps {
  accuracy: number | null;
}

/**
 * GPSAccuracyChip
 *
 * Fixed bottom bar component showing GPS accuracy status
 * - Green checkmark when accuracy is available
 * - Loading indicator when acquiring GPS signal
 * - Displays accuracy in meters (±Xm)
 */
export default function GPSAccuracyChip({ accuracy }: GPSAccuracyChipProps) {
  const { theme } = useTheme();
  const GROWTH_GREEN = '#22C55E';

  // Show nothing if accuracy is not available and we're not acquiring
  if (accuracy === null) {
    return (
      <View style={[styles.container, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}>
        <Ionicons
          name="ellipse"
          size={14}
          color={GROWTH_GREEN}
          style={styles.icon}
        />
        <Text style={[styles.text, { color: '#FFFFFF' }]}>
          Acquiring GPS...
        </Text>
      </View>
    );
  }

  // Show accuracy when available
  return (
    <View style={[styles.container, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}>
      <Ionicons
        name="checkmark-circle"
        size={14}
        color={GROWTH_GREEN}
        style={styles.icon}
      />
      <Text style={[styles.text, { color: '#FFFFFF' }]}>
        Accuracy: ±{Math.round(accuracy)}m
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    zIndex: 10,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
  },
});
