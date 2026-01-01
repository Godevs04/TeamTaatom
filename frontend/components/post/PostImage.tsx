import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { PostType } from '../../types/post';
import { loadImageWithFallback, generateBlurUpUrl, generateWebPUrl } from '../../utils/imageLoader';
import { Platform } from 'react-native';
import SongPlayer from '../SongPlayer';

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
  const [blurUpUri, setBlurUpUri] = useState<string | null>(null);
  const [showBlur, setShowBlur] = useState(true);
  const [mainImageLoaded, setMainImageLoaded] = useState(false);

  // Generate blur-up placeholder for progressive loading
  useEffect(() => {
    if (post.imageUrl && !blurUpUri) {
      const blurUrl = generateBlurUpUrl(post.imageUrl);
      setBlurUpUri(blurUrl);
    }
  }, [post.imageUrl, blurUpUri]);

  // Hide blur once main image is loaded
  const handleMainImageLoad = () => {
    setMainImageLoaded(true);
    // Small delay to ensure smooth transition
    setTimeout(() => {
      setShowBlur(false);
    }, 100);
  };

  return (
      <View style={styles.imageContainer}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-only">
      <TouchableOpacity 
        onPress={onPress} 
        activeOpacity={0.9} 
        style={StyleSheet.absoluteFill}
      >
        {imageLoading && (
          <View style={styles.imageLoader} pointerEvents="none">
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        )}
        
        {imageUri && !imageError ? (
          <View style={styles.imageWrapper} pointerEvents="none">
            {/* Blur-up placeholder for progressive loading */}
            {blurUpUri && showBlur && (
              <Image
                source={{ uri: blurUpUri }}
                style={[styles.image, styles.blurImage]}
                resizeMode="cover"
                blurRadius={Platform.OS === 'ios' ? 10 : 5}
              />
            )}
            
            {/* Main image with progressive loading */}
            {/* Image loading safety: fixed aspect ratio, resizeMode cover, error handler prevents retry loops */}
            <Image
              source={{ uri: imageUri }}
              style={[
                styles.image,
                mainImageLoaded ? styles.imageLoaded : styles.imageLoading
              ]}
              resizeMode="cover"
              // Fixed width/height via aspectRatio in container - no dynamic resizing on load
              onLoadStart={() => {
                // Loading state handled by parent
              }}
              onLoad={handleMainImageLoad}
              onError={(error) => {
                // Stop retrying failed image loads - onError handler prevents retry loops
                // Parent component handles retry logic with max attempts
                onImageError();
              }}
            />
            
            {/* Multiple Images Indicator */}
            {post.images && post.images.length > 1 && (
              <View style={styles.multipleImagesIndicator} pointerEvents="none">
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
          <View style={[styles.image, styles.imageError]} pointerEvents="box-none">
            <Ionicons name="image-outline" size={50} color={theme.colors.textSecondary} />
            <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>
              Failed to load image
            </Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={(e) => {
                e.stopPropagation();
                onRetry();
              }}
            >
              <Ionicons name="refresh" size={20} color={theme.colors.primary} />
              <Text style={[styles.retryText, { color: theme.colors.primary }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>

      {/* Song Player Overlay - Outside TouchableOpacity so it's clickable */}
      {post.song?.songId && imageUri && !imageError && (
        <View style={styles.songPlayerContainer} pointerEvents="box-none">
          <SongPlayer post={post} isVisible={true} autoPlay={false} showPlayPause={true} />
        </View>
      )}
      </View>
      </View>
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
  blurImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  imageLoading: {
    opacity: 0,
  },
  imageLoaded: {
    opacity: 1,
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
  songPlayerContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 10,
  },
});

