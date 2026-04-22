import React, { useState } from 'react';
import {
  TouchableOpacity,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PhotoOverlayProps {
  imageUrl: string;
  label?: string;
  onPress?: () => void;
}

/**
 * PhotoOverlay
 *
 * Floating photo thumbnail that sits above a map marker
 * - Small rounded image (60x60)
 * - Optional label text below
 * - White border and subtle shadow
 * - Used as custom marker content on react-native-maps
 */
export default function PhotoOverlay({ imageUrl, label, onPress }: PhotoOverlayProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Photo Thumbnail */}
      {!imageError ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={[styles.image, styles.placeholderImage]}>
          <Ionicons name="image-outline" size={24} color="rgba(0, 0, 0, 0.3)" />
        </View>
      )}

      {/* Label */}
      {label && <Text style={styles.label} numberOfLines={1}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  label: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '500',
    color: '#333',
    maxWidth: 80,
    textAlign: 'center',
  },
});
