import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

export interface Journey {
  _id: string;
  title?: string;
  startCoords: { lat: number; lng: number };
  endCoords: { lat: number; lng: number };
  startedAt: string;
  completedAt?: string;
  distanceTraveled: number; // meters
  countries: string[];
  waypoints: Array<{ contentType: string }>;
  tripScoreAwarded: number;
  status?: 'active' | 'paused' | 'completed';
}

interface JourneyCardProps {
  journey: Journey;
  onPress: () => void;
}

const GROWTH_GREEN = '#22C55E';
const ACTION_BLUE = '#3B82F6';

/**
 * JourneyCard
 *
 * Summary card for a completed journey in a list
 * - Left: gradient placeholder with start→end arrow
 * - Right: title, location summary, date range, stats (distance, photos, score)
 * - Tappable to view full journey details on map
 */
export default function JourneyCard({ journey, onPress }: JourneyCardProps) {
  const { theme } = useTheme();

  // Format date range from ISO strings
  const startDate = new Date(journey.startedAt);
  const endDate = journey.completedAt ? new Date(journey.completedAt) : new Date();
  const isActive = journey.status === 'active' || journey.status === 'paused';

  const formatDateRange = () => {
    if (isActive) {
      const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
      const startDay = startDate.getDate();
      return `Started ${startMonth} ${startDay}`;
    }

    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const startDay = startDate.getDate();
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const endDay = endDate.getDate();
    const year = endDate.getFullYear();

    if (startMonth === endMonth && startDay === endDay) {
      return `${startMonth} ${startDay}, ${year}`;
    } else if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    }
  };

  // Format distance: convert meters to km or m
  const formatDistance = () => {
    if (journey.distanceTraveled >= 1000) {
      return `${(journey.distanceTraveled / 1000).toFixed(1)} km`;
    }
    return `${Math.round(journey.distanceTraveled)} m`;
  };

  const photoCount = journey.waypoints.length;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.colors.surface }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Left: Map Thumbnail / Gradient Placeholder */}
      <View style={[styles.thumbnailContainer, { backgroundColor: ACTION_BLUE + '10' }]}>
        <View style={styles.thumbnailContent}>
          {/* Start Pin */}
          <View style={styles.startPin}>
            <Ionicons name="location" size={16} color={GROWTH_GREEN} />
          </View>

          {/* Arrow */}
          <View style={styles.arrowContainer}>
            <Ionicons name="arrow-forward" size={20} color={ACTION_BLUE} />
          </View>

          {/* End Pin */}
          <View style={styles.endPin}>
            <Ionicons name="location" size={16} color="#EF4444" />
          </View>
        </View>

        {/* Coordinates text (small, secondary) */}
        <Text style={[styles.coordsText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {journey.countries.length > 0 ? journey.countries.join(', ') : 'Traveling'}
        </Text>
      </View>

      {/* Right: Details */}
      <View style={styles.detailsContainer}>
        {/* Title + Status */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
            {journey.title || 'Journey'}
          </Text>
          {isActive && (
            <View style={[styles.statusBadge, { backgroundColor: journey.status === 'active' ? GROWTH_GREEN + '15' : ACTION_BLUE + '15' }]}>
              <View style={[styles.statusDot, { backgroundColor: journey.status === 'active' ? GROWTH_GREEN : ACTION_BLUE }]} />
              <Text style={[styles.statusText, { color: journey.status === 'active' ? GROWTH_GREEN : ACTION_BLUE }]}>
                {journey.status === 'active' ? 'Live' : 'Paused'}
              </Text>
            </View>
          )}
        </View>

        {/* Location summary */}
        <Text style={[styles.locationSummary, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {journey.countries?.length > 0 ? journey.countries.join(', ') : 'Location'} • {formatDateRange()}
        </Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {/* Distance */}
          <View style={styles.statItem}>
            <Ionicons name="navigate" size={12} color={ACTION_BLUE} />
            <Text style={[styles.statText, { color: ACTION_BLUE }]}>
              {formatDistance()}
            </Text>
          </View>

          {/* Photo Count */}
          <View style={styles.statItem}>
            <Ionicons name="image" size={12} color={theme.colors.textSecondary} />
            <Text style={[styles.statText, { color: theme.colors.textSecondary }]}>
              {photoCount}
            </Text>
          </View>

          {/* Score Badge — only for completed */}
          {!isActive && (
            <View style={[styles.scoreBadge, { backgroundColor: GROWTH_GREEN + '15' }]}>
              <Text style={[styles.scoreText, { color: GROWTH_GREEN }]}>
                +{journey.tripScoreAwarded || 0}pts
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  thumbnailContainer: {
    width: 120,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  startPin: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  endPin: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  coordsText: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  detailsContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  locationSummary: {
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    fontWeight: '500',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
