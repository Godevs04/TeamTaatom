import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { height: screenHeight } = Dimensions.get('window');

export interface PlaceDetail {
  name: string;
  photo?: string;
  distance?: number; // in km
  spotType?: string; // e.g., "Beach", "Mountain"
  travelInfo?: string; // e.g., "Drivable", "Hiking"
  contentType?: 'photo' | 'video'; // Type of content associated
  lat: number;
  lng: number;
  verifiedDate?: string; // e.g., "Apr 12, 2026"
}

interface PlaceDetailModalProps {
  visible: boolean;
  place: PlaceDetail | null;
  onClose: () => void;
  onNavigate: () => void;
  onDirection: () => void;
}

const GROWTH_GREEN = '#22C55E';
const ACTION_BLUE = '#3B82F6';
const ALERT_RED = '#EF4444';

/**
 * PlaceDetailModal
 *
 * Bottom sheet modal showing details when a map pin is tapped
 * - Photo hero at top
 * - Place name, distance, spot type badges
 * - Travel info and verified date
 * - Direction and Navigate buttons
 */
export default function PlaceDetailModal({
  visible,
  place,
  onClose,
  onNavigate,
  onDirection,
}: PlaceDetailModalProps) {
  const { theme } = useTheme();
  const [imageLoadError, setImageLoadError] = useState(false);

  if (!place) return null;

  const modalHeight = screenHeight * 0.7; // 70% of screen

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Bottom Sheet */}
      <View style={[styles.bottomSheet, { backgroundColor: theme.colors.surface }]}>
        {/* Hero Photo */}
        {place.photo && !imageLoadError && (
          <Image
            source={{ uri: place.photo }}
            style={styles.heroPhoto}
            onError={() => setImageLoadError(true)}
          />
        )}
        {(!place.photo || imageLoadError) && (
          <View style={[styles.heroPhoto, styles.placeholderPhoto]}>
            <Ionicons name="image-outline" size={48} color={theme.colors.textSecondary} />
          </View>
        )}

        <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {/* Place Name */}
          <Text style={[styles.placeName, { color: theme.colors.text }]}>
            {place.name}
          </Text>

          {/* Distance Chip */}
          {place.distance !== undefined && (
            <View style={[styles.chip, { backgroundColor: ACTION_BLUE + '15' }]}>
              <Ionicons name="navigate" size={14} color={ACTION_BLUE} />
              <Text style={[styles.chipText, { color: ACTION_BLUE }]}>
                {place.distance < 1
                  ? `${Math.round(place.distance * 1000)} m away`
                  : `${place.distance.toFixed(1)} km away`}
              </Text>
            </View>
          )}

          {/* Spot Type Badge */}
          {place.spotType && (
            <View style={[styles.badge, { backgroundColor: GROWTH_GREEN + '20' }]}>
              <Text style={[styles.badgeText, { color: GROWTH_GREEN }]}>
                {place.spotType}
              </Text>
            </View>
          )}

          {/* Content Type Icon + Travel Info */}
          <View style={styles.infoRow}>
            {place.contentType && (
              <View style={styles.contentTypeIcon}>
                <Ionicons
                  name={place.contentType === 'video' ? 'play-circle' : 'camera'}
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={[styles.infoText, { color: theme.colors.textSecondary, marginLeft: 4 }]}>
                  {place.contentType === 'video' ? 'Video' : 'Photo'}
                </Text>
              </View>
            )}
            {place.travelInfo && (
              <View style={styles.travelInfo}>
                <Ionicons name="compass" size={16} color={theme.colors.primary} />
                <Text style={[styles.infoText, { color: theme.colors.textSecondary, marginLeft: 4 }]}>
                  {place.travelInfo}
                </Text>
              </View>
            )}
          </View>

          {/* Verified Date */}
          {place.verifiedDate && (
            <View style={styles.verifiedRow}>
              <Ionicons name="checkmark-done" size={14} color={GROWTH_GREEN} />
              <Text style={[styles.verifiedText, { color: GROWTH_GREEN, marginLeft: 4 }]}>
                Verified: {place.verifiedDate}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Action Buttons */}
        <View style={[styles.buttonContainer, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              onDirection();
              onClose();
            }}
          >
            <Ionicons name="map" size={20} color="white" />
            <Text style={styles.buttonText}>Direction</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: GROWTH_GREEN }]}
            onPress={() => {
              onNavigate();
              onClose();
            }}
          >
            <Ionicons name="location" size={20} color="white" />
            <Text style={styles.buttonText}>Navigate</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  bottomSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: screenHeight * 0.7,
    flexDirection: 'column',
  },
  heroPhoto: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  placeholderPhoto: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  placeName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  contentTypeIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  travelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    minHeight: 44,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
