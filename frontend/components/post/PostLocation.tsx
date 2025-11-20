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
      if (address) {
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
        } else {
          router.push('/map/current-location');
        }
      } else {
        router.push('/map/current-location');
      }
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


