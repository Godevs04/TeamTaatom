import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';
import { geocodeAddress } from '../../utils/locationUtils';
import { PostType } from '../../types/post';

interface PostLocationProps {
  post: PostType;
}

export default function PostLocation({ post }: PostLocationProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const [isGeocoding, setIsGeocoding] = useState(false);

  if (!post.location || !post.location.address) {
    return null;
  }

  const handleLocationPress = async () => {
    if (isGeocoding) return;

    setIsGeocoding(true);

    try {
      const address = post.location?.address;
      const storedLat = post.location?.coordinates?.latitude;
      const storedLng = post.location?.coordinates?.longitude;
      const hasStoredCoords = storedLat && storedLng &&
        storedLat !== 0 && storedLng !== 0 &&
        !isNaN(storedLat) && !isNaN(storedLng);

      // Use stored coordinates from the post first — most accurate, no API call needed
      if (hasStoredCoords) {
        router.push({
          pathname: '/map/current-location',
          params: {
            latitude: storedLat!.toString(),
            longitude: storedLng!.toString(),
            address: address || '',
          }
        });
        return;
      }

      if (!address) {
        router.push('/map/current-location');
        return;
      }

      // No stored coords — geocode the address text
      const coordinates = await geocodeAddress(address);
      if (coordinates) {
        router.push({
          pathname: '/map/current-location',
          params: {
            latitude: coordinates.latitude.toString(),
            longitude: coordinates.longitude.toString(),
            address,
          }
        });
        return;
      }

      // Exact address not found — try progressively broader queries by stripping
      // the most specific parts (house number, street name) from the front
      const parts = address.split(',').map((p: string) => p.trim()).filter(Boolean);
      for (let i = 1; i < parts.length; i++) {
        const broaderQuery = parts.slice(i).join(', ');
        const fallbackCoords = await geocodeAddress(broaderQuery);
        if (fallbackCoords) {
          router.push({
            pathname: '/map/current-location',
            params: {
              latitude: fallbackCoords.latitude.toString(),
              longitude: fallbackCoords.longitude.toString(),
              address,
              approximateLabel: broaderQuery,
              isApproximate: 'true',
            }
          });
          return;
        }
      }

      // Nothing worked — open map without coordinates (shows current device location)
      router.push('/map/current-location');
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.locationContainer}
      onPress={handleLocationPress}
      disabled={isGeocoding}
    >
      <View style={styles.locationContent}>
        <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} />
        <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
          {post.location.address}
        </Text>
      </View>
      {isGeocoding && (
        <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loader} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  locationText: {
    fontSize: 12,
    marginLeft: 4,
  },
  loader: {
    marginLeft: 6,
  },
});


