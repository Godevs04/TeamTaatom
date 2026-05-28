import React from 'react';
import { ImageStyle, StyleProp } from 'react-native';
import { Image as ExpoImage, ImageProps as ExpoImageProps } from 'expo-image';

export interface FastImageProps extends Omit<ExpoImageProps, 'style'> {
  style?: StyleProp<ImageStyle>;
}

/**
 * FastImage
 * 
 * Shared image component wrapping expo-image to enforce:
 * - Persistent memory-disk caching policy by default
 * - Soft fade-in transitions (200ms) to eliminate white flashes
 * - Optimized content fit configurations
 */
export default function FastImage({
  source,
  style,
  cachePolicy = 'memory-disk',
  transition = 200,
  contentFit = 'cover',
  ...props
}: FastImageProps) {
  return (
    <ExpoImage
      source={source}
      style={style as any}
      cachePolicy={cachePolicy}
      transition={transition}
      contentFit={contentFit}
      {...props}
    />
  );
}
