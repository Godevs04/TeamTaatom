import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { PostType } from '../../types/post';
import { loadImageWithFallback } from '../../utils/imageLoader';
import { Platform } from 'react-native';

interface PostImageProps {
  post: PostType;
  onPress: () => void;
  imageUri: string | null;
  imageLoading: boolean;
  imageError: boolean;
  onImageError: () => void;
  onRetry: () => void;
  pulseAnim: Animated.Value;
}

export default function PostImage({
  post,
  onPress,
  imageUri,
  imageLoading,
  imageError,
  onImageError,
  onRetry,
  pulseAnim,
}: PostImageProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageContainer}>
        {imageLoading && (
          <View style={styles.imageLoader}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        )}
        
        {imageUri && !imageError ? (
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="cover"
              onLoadStart={() => {
                // Loading state handled by parent
              }}
              onLoad={() => {
                // Loading state handled by parent
              }}
              onError={onImageError}
            />
            
            {/* Multiple Images Indicator */}
            {post.images && post.images.length > 1 && (
              <View style={styles.multipleImagesIndicator}>
                <Animated.View 
                  style={[
                    styles.imageCountBadge, 
                    { 
                      backgroundColor: theme.colors.background,
                      transform: [{ scale: pulseAnim }]
                    }
                  ]}
                >
                  <Ionicons name="images" size={16} color={theme.colors.primary} />
                  <Text style={[styles.imageCountText, { color: theme.colors.primary }]}>
                    {post.images.length}
                  </Text>
                </Animated.View>
                
                {/* Subtle animation dots */}
                <View style={styles.imageDots}>
                  {post.images.slice(0, 3).map((_, index) => (
                    <View 
                      key={index}
                      style={[
                        styles.dot, 
                        { 
                          backgroundColor: theme.colors.primary,
                          opacity: index === 0 ? 1 : 0.4
                        }
                      ]} 
                    />
                  ))}
                  {post.images.length > 3 && (
                    <Text style={[styles.moreDots, { color: theme.colors.primary }]}>
                      +{post.images.length - 3}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
        ) : imageError ? (
          <View style={[styles.image, styles.imageError]}>
            <Ionicons name="image-outline" size={50} color={theme.colors.textSecondary} />
            <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>
              Failed to load image
            </Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={onRetry}
            >
              <Ionicons name="refresh" size={20} color={theme.colors.primary} />
              <Text style={[styles.retryText, { color: theme.colors.primary }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderRadius: 0,
    overflow: 'hidden',
  },
  imageLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    zIndex: 1,
  },
  imageWrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  multipleImagesIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 4,
  },
  imageCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  imageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  moreDots: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  imageError: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    minHeight: 300,
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    gap: 6,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

