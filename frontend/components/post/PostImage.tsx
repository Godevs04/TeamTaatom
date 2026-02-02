import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { PostType } from '../../types/post';
import { loadImageWithFallback, generateBlurUpUrl, generateWebPUrl } from '../../utils/imageLoader';
import { Platform } from 'react-native';
import SongPlayer from '../SongPlayer';
import { audioManager } from '../../utils/audioManager';
import { Audio } from 'expo-av';

const { width: screenWidth } = Dimensions.get('window');

interface PostImageProps {
  post: PostType;
  onPress: () => void;
  imageUri: string | null;
  imageLoading: boolean;
  imageError: boolean;
  onImageError: () => void;
  onRetry: () => void;
  pulseAnim: Animated.Value;
  isCurrentlyVisible?: boolean; // Whether this post is currently visible in viewport (for music playback)
  onDoubleTap?: () => void; // Callback for double-tap to like
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
  isCurrentlyVisible = false,
  onDoubleTap,
}: PostImageProps) {
  const { theme } = useTheme();
  const [blurUpUri, setBlurUpUri] = useState<string | null>(null);
  const [showBlur, setShowBlur] = useState(true);
  const [mainImageLoaded, setMainImageLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Default to muted
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const songPlayerRef = useRef<any>(null);
  const isTogglingMuteRef = useRef(false);
  const isMutedRef = useRef(true); // Use ref to track mute state to avoid dependency issues, default to muted
  
  // Double-tap detection
  const lastTapRef = useRef<number>(0);
  const doubleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

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

  // Track mute state for this post - reset to muted (default) when post changes
  useEffect(() => {
    setIsMuted(true);
    isMutedRef.current = true;
    setCurrentImageIndex(0); // Reset image index when post changes
  }, [post._id]);

  // Sync ref with state
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Handle double-tap to like
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // 300ms window for double-tap
    
    if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_TAP_DELAY) {
      // Double-tap detected - cancel single tap timer
      if (doubleTapTimerRef.current) {
        clearTimeout(doubleTapTimerRef.current);
        doubleTapTimerRef.current = null;
      }
      
      // Trigger like if callback is provided
      if (onDoubleTap) {
        onDoubleTap();
        
        // Show heart animation
        heartScale.setValue(0);
        heartOpacity.setValue(1);
        
        Animated.parallel([
          Animated.spring(heartScale, {
            toValue: 1.2,
            useNativeDriver: true,
            tension: 50,
            friction: 3,
          }),
          Animated.sequence([
            Animated.delay(100),
            Animated.timing(heartOpacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          heartScale.setValue(0);
          heartOpacity.setValue(0);
        });
      }
      
      lastTapRef.current = 0;
    } else {
      // First tap - wait for potential second tap
      lastTapRef.current = now;
      
      // Clear any existing timer
      if (doubleTapTimerRef.current) {
        clearTimeout(doubleTapTimerRef.current);
      }
      
      // Set timer for single tap (only if no second tap occurs)
      doubleTapTimerRef.current = setTimeout(() => {
        // Single tap - navigate to post detail
        lastTapRef.current = 0;
        doubleTapTimerRef.current = null;
        onPress();
      }, DOUBLE_TAP_DELAY);
    }
  }, [onDoubleTap, onPress, heartScale, heartOpacity]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (doubleTapTimerRef.current) {
        clearTimeout(doubleTapTimerRef.current);
      }
    };
  }, []);

  // Handle mute/unmute toggle with guard to prevent multiple simultaneous calls
  const handleToggleMute = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isTogglingMuteRef.current) {
      return;
    }

    try {
      isTogglingMuteRef.current = true;
      const currentPostId = audioManager.getCurrentPostId();
      const newMutedState = !isMutedRef.current; // Use ref instead of state
      
      // If muting, stop the audio first (Instagram-style: muted = no playback)
      if (newMutedState) {
        if (currentPostId === post._id.toString() && post.song?.songId) {
          try {
            await audioManager.stopAll();
          } catch (stopError) {
            console.error('Error stopping audio:', stopError);
          }
        }
      }
      
      // Update state - this will trigger SongPlayer's autoPlay prop change
      setIsMuted(newMutedState);
      isMutedRef.current = newMutedState;
      
      // When unmuting, the SongPlayer's useEffect should detect autoPlay change from false to true
      // and trigger playback. The autoPlay prop is: isCurrentlyVisible && !isMuted
      // So when isMuted changes from true to false, autoPlay changes from false to true
      // This should trigger the SongPlayer's useEffect to play the song
    } catch (error) {
      console.error('Error toggling mute:', error);
    } finally {
      // Reset the guard after a short delay to prevent rapid clicking
      setTimeout(() => {
        isTogglingMuteRef.current = false;
      }, 300);
    }
  }, [post._id, post.song?.songId, post.song?.volume]); // Removed isCurrentlyVisible - not needed in deps

  return (
    <View style={styles.imageContainer}>
      {imageLoading && (
        <View style={styles.imageLoader} pointerEvents="none">
          <ActivityIndicator color={theme.colors.primary} size="large" />
        </View>
      )}
      
      {imageUri && !imageError ? (
        <View style={styles.imageWrapper}>
          {/* Multiple images with horizontal scrolling */}
          {post.images && post.images.length > 1 ? (
            <View style={StyleSheet.absoluteFill}>
              <FlatList
                ref={flatListRef}
                data={post.images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={true}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                  setCurrentImageIndex(index);
                }}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    activeOpacity={1}
                    onPress={handleDoubleTap}
                    style={{ width: screenWidth, height: '100%' }}
                  >
                    <Image
                      source={{ uri: item }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                    {/* Heart animation overlay */}
                    <View style={styles.heartContainer} pointerEvents="none">
                      <Animated.View
                        style={[
                          styles.heartAnimation,
                          {
                            transform: [{ scale: heartScale }],
                            opacity: heartOpacity,
                          },
                        ]}
                      >
                        <Ionicons name="heart" size={80} color="#fff" />
                      </Animated.View>
                    </View>
                  </TouchableOpacity>
                )}
                keyExtractor={(item, index) => index.toString()}
              />
              
              {/* Image counter */}
              <View style={styles.imageCounter} pointerEvents="none">
                <Text style={styles.imageCounterText}>
                  {currentImageIndex + 1} / {post.images.length}
                </Text>
              </View>
              
              {/* Image dots indicator */}
              <View style={styles.dotsContainer} pointerEvents="none">
                {post.images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dotIndicator,
                      {
                        backgroundColor: index === currentImageIndex 
                          ? theme.colors.primary 
                          : 'rgba(255,255,255,0.5)'
                      }
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : (
            <TouchableOpacity 
              onPress={handleDoubleTap} 
              activeOpacity={0.9} 
              style={StyleSheet.absoluteFill}
            >
              {/* Single image with blur-up placeholder */}
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
              
              {/* Heart animation overlay */}
              <View style={styles.heartContainer} pointerEvents="none">
                <Animated.View
                  style={[
                    styles.heartAnimation,
                    {
                      transform: [{ scale: heartScale }],
                      opacity: heartOpacity,
                    },
                  ]}
                >
                  <Ionicons name="heart" size={80} color="#fff" />
                </Animated.View>
              </View>
            </TouchableOpacity>
          )}
        </View>
        ) : imageError ? (
          <TouchableOpacity 
            onPress={handleDoubleTap}
            activeOpacity={0.9}
            style={StyleSheet.absoluteFill}
          >
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
          </TouchableOpacity>
        ) : null}

      {/* Song Player - Hidden but active for audio playback */}
      {/* Music plays when post is visible and unmuted, pauses when scrolled away (Instagram-style) */}
      {post.song?.songId && imageUri && !imageError && (
        <View style={styles.hiddenSongPlayer} pointerEvents="box-none">
          <SongPlayer post={post} isVisible={isCurrentlyVisible} autoPlay={isCurrentlyVisible && !isMuted} showPlayPause={false} />
        </View>
      )}

      {/* Mute/Unmute Button - Bottom Right */}
      {post.song?.songId && imageUri && !imageError && (
        <TouchableOpacity 
          style={styles.muteButton}
          onPress={(e) => {
            e.stopPropagation();
            handleToggleMute();
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.muteButtonBackground, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
            <Ionicons 
              name={isMuted ? 'volume-mute' : 'volume-high'} 
              size={16} 
              color="#fff" 
            />
          </View>
        </TouchableOpacity>
      )}
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
  imageCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 10,
  },
  imageCounterText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  songPlayerContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 10,
  },
  hiddenSongPlayer: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  muteButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    zIndex: 15,
  },
  muteButtonBackground: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  heartContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  heartAnimation: {
    shadowColor: '#ff1744',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
});

