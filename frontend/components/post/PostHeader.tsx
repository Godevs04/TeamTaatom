import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';
import { geocodeAddress } from '../../utils/locationUtils';
import { PostType } from '../../types/post';

interface PostHeaderProps {
  post: PostType;
  onMenuPress: () => void;
}

export default function PostHeader({ post, onMenuPress }: PostHeaderProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const [isGeocoding, setIsGeocoding] = useState(false);

  const handleLocationPress = async () => {
    if (isGeocoding) return; // Prevent multiple clicks during geocoding
    
    setIsGeocoding(true);
    
    try {
      // Navigate to map with post location coordinates
      if (post.location?.address) {
        let finalCoordinates = null;
        
        // Always use API for geocoding
        finalCoordinates = await geocodeAddress(post.location.address);
        
        if (finalCoordinates) {
          router.push({
            pathname: '/map/current-location',
            params: {
              latitude: finalCoordinates.latitude.toString(),
              longitude: finalCoordinates.longitude.toString(),
              address: post.location.address,
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
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.userInfo}
        onPress={() => router.push(`/profile/${post.user._id}`)}
      >
        <Image
          source={{
            uri: post.user.profilePic || 'https://via.placeholder.com/40',
          }}
          style={styles.profilePic}
        />
        <View style={styles.userDetails}>
          <Text style={[styles.username, { color: theme.colors.text }]}>
            {post.user.fullName}
          </Text>
          {post.location && post.location.address && (
            <TouchableOpacity
              style={styles.locationContainer}
              onPress={handleLocationPress}
            >
              <Ionicons name="location-outline" size={12} color={theme.colors.textSecondary} />
              <Text style={[styles.locationText, { color: theme.colors.textSecondary }]}>
                {post.location.address}
              </Text>
              {isGeocoding && (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuButton}
        onPress={onMenuPress}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userDetails: {
    flex: 1,
  },
  profilePic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    marginLeft: 4,
  },
  menuButton: {
    padding: 4,
  },
});

