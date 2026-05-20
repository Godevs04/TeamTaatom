import React from 'react';
import { View, StyleSheet, ImageStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

interface CloudAvatarStackProps {
  uris: string[];
  size?: number;
  max?: number;
}

export default function CloudAvatarStack({ uris, size = 28, max = 5 }: CloudAvatarStackProps) {
  const shown = uris.filter(Boolean).slice(0, max);
  if (!shown.length) return null;

  return (
    <View style={styles.row}>
      {shown.map((uri, i) => (
        <ExpoImage
          key={`${uri}-${i}`}
          source={{ uri }}
          style={[
            styles.avatar as ImageStyle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: i === 0 ? 0 : -(size * 0.28),
              zIndex: shown.length - i,
            },
          ]}
          cachePolicy="memory-disk"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#D9EFFF',
  },
});
