import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const isIOS = Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

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

export default function JourneyCard({ journey, onPress }: JourneyCardProps) {
  const { theme } = useTheme();

  const startDate = new Date(journey.startedAt);
  const endDate = journey.completedAt ? new Date(journey.completedAt) : new Date();
  const isActive = journey.status === 'active' || journey.status === 'paused';

  const formatDate = () => {
    if (isActive) {
      return `Started ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const sameDay = startDate.toDateString() === endDate.toDateString();
    if (sameDay) {
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return `${startStr} – ${endStr}`;
  };

  const formatDistance = () => {
    if (journey.distanceTraveled >= 1000) {
      return `${(journey.distanceTraveled / 1000).toFixed(1)} km`;
    }
    return `${Math.round(journey.distanceTraveled)} m`;
  };

  const photoCount = journey.waypoints?.length || 0;
  const title = journey.title || 'Untitled Journey';
  const countries = journey.countries?.length > 0 ? journey.countries.join(', ') : null;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.colors.surface }]}
      activeOpacity={0.65}
      onPress={onPress}
    >
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: GROWTH_GREEN + '12' }]}>
        <Ionicons name="map-outline" size={22} color={GROWTH_GREEN} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {isActive && (
            <View style={[styles.statusBadge, {
              backgroundColor: journey.status === 'active' ? GROWTH_GREEN + '15' : theme.colors.primary + '15'
            }]}>
              <View style={[styles.statusDot, {
                backgroundColor: journey.status === 'active' ? GROWTH_GREEN : theme.colors.primary
              }]} />
              <Text style={[styles.statusText, {
                color: journey.status === 'active' ? GROWTH_GREEN : theme.colors.primary
              }]}>
                {journey.status === 'active' ? 'Live' : 'Paused'}
              </Text>
            </View>
          )}
        </View>

        {/* Subtitle: date + country */}
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {formatDate()}{countries ? ` · ${countries}` : ''}
        </Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="navigate-outline" size={13} color={theme.colors.textSecondary} />
            <Text style={[styles.statText, { color: theme.colors.textSecondary }]}>
              {formatDistance()}
            </Text>
          </View>

          {photoCount > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="image-outline" size={13} color={theme.colors.textSecondary} />
              <Text style={[styles.statText, { color: theme.colors.textSecondary }]}>
                {photoCount}
              </Text>
            </View>
          )}

          {!isActive && (journey.tripScoreAwarded || 0) > 0 && (
            <View style={[styles.scoreBadge, { backgroundColor: GROWTH_GREEN + '12' }]}>
              <Text style={[styles.scoreText, { color: GROWTH_GREEN }]}>
                +{journey.tripScoreAwarded}pts
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Chevron */}
      <View style={styles.chevronWrap}>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
    ...(isWeb && {
      transition: 'all 0.2s ease',
    } as any),
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: isIOS ? 'System' : 'Roboto',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    fontFamily: isIOS ? 'System' : 'Roboto',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: '500',
  },
  scoreBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chevronWrap: {
    marginLeft: 8,
    justifyContent: 'center',
  },
});
