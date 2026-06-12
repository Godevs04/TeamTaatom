import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Image as RNImage, TouchableOpacity, StyleSheet, Animated, FlatList, Dimensions } from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { PostType } from '../../types/post';
import { generateBlurUpUrl } from '../../utils/imageLoader';
import { applyCloudinaryFilter } from '../../utils/imageCache';
import { FILTER_PREVIEW_OVERLAY, ImageFilterType } from '../../components/ImageEditModal';
import { Platform } from 'react-native';
import SongPlayer from '../SongPlayer';
import { audioManager } from '../../utils/audioManager';
import { Audio } from 'expo-av';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReAnimated, { useSharedValue, useAnimatedStyle, runOnJS, withSpring } from 'react-native-reanimated';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth - 24;

// Strip the query string from a signed URL so the cache key stays stable across
// sessions. Without this, a fresh signature on each backend response would miss
// the cache and force a re-download of an image we already have on disk.
const getStableCacheKey = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  const q = url.indexOf('?');
  return q >= 0 ? url.slice(0, q) : url;
};

// Module-level cache of measured natural aspect ratios for `aspectRatio: 'full'`
// posts. Without this, every FlashList recycle of the same image re-runs
// RNImage.getSize and the card snaps from a square placeholder to the real
// aspect — visible as feed jitter, especially when scrolling pauses.
const naturalAspectCache: Map<string, number> = new Map();

export const getImageAspectRatio = (post: any): number => {
  if (!post) return 1;
  if (!post.aspectRatio || post.aspectRatio === 'full') {
    const key = getStableCacheKey(post.imageUrl);
    return key ? (naturalAspectCache.get(key) ?? 1) : 1;
  }
  if (post.aspectRatio === '1:1') return 1;
  
  const rawAspect = post.aspectRatio;
  if (rawAspect === '1.91:1' || rawAspect === '1.91') return 1.91;
  
  if (typeof rawAspect === 'string') {
    if (rawAspect.includes(':')) {
      const parts = rawAspect.split(':');
      const w = parseFloat(parts[0]);
      const h = parseFloat(parts[1]);
      if (!isNaN(w) && !isNaN(h) && h !== 0) {
        return w / h;
      }
    }
    const parsedFloat = parseFloat(rawAspect);
    if (!isNaN(parsedFloat) && parsedFloat > 0) {
      return parsedFloat;
    }
  } else if (typeof rawAspect === 'number' && rawAspect > 0) {
    return rawAspect;
  }
  return 1;
};

interface CarouselItemProps {
  item: string;
  index: number;
  currentImageIndex: number;
  scale: any;
  focalX: any;
  focalY: any;
  composedGesture: any;
  animatedImageStyle: any;
  containerWidth: number;
  filter?: string;
  heartScale: Animated.Value;
  heartOpacity: Animated.Value;
}

const CarouselItem = React.memo(({
  item,
  index,
  currentImageIndex,
  scale,
  focalX,
  focalY,
  composedGesture,
  animatedImageStyle,
  containerWidth,
  filter,
  heartScale,
  heartOpacity,
}: CarouselItemProps) => {
  const slideContainerStyle = useAnimatedStyle(() => {
    const isActive = index === currentImageIndex;
    const isZooming = scale.value > 1.01;
    return {
      overflow: (isActive && isZooming) ? 'visible' : 'hidden',
      zIndex: (isActive && isZooming) ? 999 : 1,
    };
  });

  const isActive = index === currentImageIndex;

  return (
    <GestureDetector gesture={isActive ? composedGesture : Gesture.Tap()}>
      <ReAnimated.View
        style={[
          { width: containerWidth, height: '100%', position: 'relative' },
          slideContainerStyle,
        ]}
      >
        <ReAnimated.View
          style={[
            StyleSheet.absoluteFill,
            isActive ? animatedImageStyle : null,
          ]}
        >
          <ExpoImage
            source={{
              uri: applyCloudinaryFilter(item, filter),
              cacheKey: getStableCacheKey(item) ? `${getStableCacheKey(item)}:${filter || 'original'}` : undefined,
            }}
            placeholderContentFit="cover"
            cachePolicy="memory-disk"
            contentFit="cover"
            transition={250}
            priority={isActive ? "high" : "normal"}
            style={styles.image}
          />
          {filter && FILTER_PREVIEW_OVERLAY[filter as ImageFilterType] && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: FILTER_PREVIEW_OVERLAY[filter as ImageFilterType]! },
              ]}
            />
          )}

          {/* Heart animation overlay */}
          {isActive && (
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
                <MaskedView
                  style={{ width: 80, height: 80 }}
                  maskElement={
                    <Ionicons name="heart" size={80} color="#000000" />
                  }
                >
                  <LinearGradient
                    colors={['#50C878', '#1C73B4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1 }}
                  />
                </MaskedView>
              </Animated.View>
            </View>
          )}
        </ReAnimated.View>
      </ReAnimated.View>
    </GestureDetector>
  );
});

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
  shouldPreload?: boolean;
  onDoubleTap?: () => void; // Callback for double-tap to like
  onZoomStateChange?: (isZooming: boolean) => void; // Callback for pinch zoom state changes
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
  shouldPreload = false,
  onDoubleTap,
  onZoomStateChange,
}: PostImageProps) {
  const { theme } = useTheme();
  const [blurUpUri, setBlurUpUri] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(() => audioManager.getSessionMuted());
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [containerWidth, setContainerWidth] = useState(screenWidth - 32);
  const [isZoomed, setIsZoomed] = useState(false);

  const handleLayout = useCallback((event: any) => {
    const { width } = event.nativeEvent.layout;
    if (width && width > 0) {
      setContainerWidth(width);
    }
  }, []);
  const flatListRef = useRef<FlatList>(null);
  const songPlayerRef = useRef<any>(null);
  const isTogglingMuteRef = useRef(false);
  const isMutedRef = useRef(audioManager.getSessionMuted());

  // Heart pop animation values
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  // Trigger double-tap to like with heart animation
  const triggerDoubleTapLike = useCallback(() => {
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
  }, [onDoubleTap, heartScale, heartOpacity]);

  // RNGH Gestures
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_event, success) => {
      if (success) {
        runOnJS(triggerDoubleTapLike)();
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .requireExternalGestureToFail(doubleTapGesture)
    .onEnd((_event, success) => {
      if (success) {
        runOnJS(onPress)();
      }
    });

  // Gestures and animated style are defined below to ensure aspectRatioValue is in scope

  // expo-image handles caching natively; we just pass the array through.
  const resolvedImages = post.images && post.images.length > 1 ? post.images : (post.images || []);

  // Generate a low-res placeholder for Cloudinary URLs (legacy posts). For R2
  // signed URLs, generateBlurUpUrl returns the original URL unchanged — we
  // detect that and skip the placeholder so we don't double-fetch.
  useEffect(() => {
    if (post.imageUrl && !blurUpUri) {
      const blurUrl = generateBlurUpUrl(post.imageUrl);
      if (blurUrl && blurUrl !== post.imageUrl) {
        setBlurUpUri(blurUrl);
      }
    }
  }, [post.imageUrl, blurUpUri]);

  // Sync with session-wide mute when scrolling between posts
  useEffect(() => {
    const sessionMuted = audioManager.getSessionMuted();
    setIsMuted(sessionMuted);
    isMutedRef.current = sessionMuted;
    setCurrentImageIndex(0);
    scale.value = 1;
  }, [post._id]);

  // Keep in sync when user toggles mute on another post in the feed
  useEffect(() => {
    return audioManager.addSessionMuteListener((muted) => {
      setIsMuted(muted);
      isMutedRef.current = muted;
    });
  }, []);

  // Sync ref with state
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);



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
      
      // Persist mute preference for the whole feed session
      audioManager.setSessionMuted(newMutedState);
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

  // Measure natural aspect for 'full' display mode or when aspectRatio is missing/falsy (only when needed).
  // Seed from the module-level cache so recycled FlashList cells skip the
  // square→actual snap that causes scroll jitter.
  const shouldMeasure = !post.aspectRatio || post.aspectRatio === 'full';
  const [naturalAspect, setNaturalAspect] = useState<number | null>(() => {
    if (!shouldMeasure) return null;
    const key = getStableCacheKey(imageUri);
    return key ? (naturalAspectCache.get(key) ?? null) : null;
  });
  useEffect(() => {
    if (!shouldMeasure || !imageUri) return;
    const key = getStableCacheKey(imageUri);
    if (key && naturalAspectCache.has(key)) {
      const cached = naturalAspectCache.get(key)!;
      if (cached !== naturalAspect) setNaturalAspect(cached);
      return;
    }
    let cancelled = false;
    RNImage.getSize(
      imageUri,
      (w, h) => {
        if (cancelled || !w || !h) return;
        const ratio = w / h;
        if (key) naturalAspectCache.set(key, ratio);
        setNaturalAspect(ratio);
      },
      () => { /* ignore — falls back to 1 */ },
    );
    return () => { cancelled = true; };
  }, [post.aspectRatio, imageUri]);

  // 16:9 is portrait (1080×1920) → container aspectRatio = 9/16 (taller than wide).
  const getAspectRatio = () => {
    if (!post.aspectRatio) return naturalAspect ?? 1;
    if (post.aspectRatio === 'full') return naturalAspect ?? 1;
    if (post.aspectRatio === '1:1') return 1;
    
    // Cast to any to handle DB values that don't match the strict TS union
    const rawAspect = post.aspectRatio as any;
    if (rawAspect === '1.91:1' || rawAspect === '1.91') return 1.91;
    
    if (typeof rawAspect === 'string') {
      if (rawAspect.includes(':')) {
        const parts = rawAspect.split(':');
        const w = parseFloat(parts[0]);
        const h = parseFloat(parts[1]);
        if (!isNaN(w) && !isNaN(h) && h !== 0) {
          return w / h;
        }
      }
      const parsedFloat = parseFloat(rawAspect);
      if (!isNaN(parsedFloat) && parsedFloat > 0) {
        return parsedFloat;
      }
    } else if (typeof rawAspect === 'number' && rawAspect > 0) {
      return rawAspect;
    }
    return 1;
  };

  const aspectRatioValue = getAspectRatio();

  // Pinch-to-zoom shared values
  // Pinch-to-zoom shared values
  const scale = useSharedValue<number>(1);
  const originX = useSharedValue<number>(0);
  const originY = useSharedValue<number>(0);
  const focalX = useSharedValue<number>(0);
  const focalY = useSharedValue<number>(0);

  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      runOnJS(setIsZoomed)(true);
      runOnJS(setScrollEnabled)(false);
      originX.value = (e.focalX && !isNaN(e.focalX) && isFinite(e.focalX)) ? e.focalX : 0;
      originY.value = (e.focalY && !isNaN(e.focalY) && isFinite(e.focalY)) ? e.focalY : 0;
      focalX.value = originX.value;
      focalY.value = originY.value;
      if (onZoomStateChange) {
        runOnJS(onZoomStateChange)(true);
      }
    })
    .onUpdate((e) => {
      // Only process pinch updates if 2 fingers are touching to prevent focal jumps on iOS
      if (e.numberOfPointers === 2) {
        const currentScale = (e.scale && !isNaN(e.scale) && isFinite(e.scale)) ? e.scale : 1;
        scale.value = Math.max(1, Math.min(currentScale, 5));
        focalX.value = (e.focalX && !isNaN(e.focalX) && isFinite(e.focalX)) ? e.focalX : originX.value;
        focalY.value = (e.focalY && !isNaN(e.focalY) && isFinite(e.focalY)) ? e.focalY : originY.value;
      }
    })
    .onEnd(() => {
      scale.value = withSpring(1);
      focalX.value = withSpring(originX.value);
      focalY.value = withSpring(originY.value);
      runOnJS(setIsZoomed)(false);
      runOnJS(setScrollEnabled)(true);
      if (onZoomStateChange) {
        runOnJS(onZoomStateChange)(false);
      }
    });

  // Composed Gestures
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Exclusive(doubleTapGesture, singleTapGesture)
  );

  const listComposedGesture = Gesture.Exclusive(doubleTapGesture, singleTapGesture);

  const animatedImageStyle = useAnimatedStyle(() => {
    // Null reference and bounds guard
    const s = (scale.value && !isNaN(scale.value) && isFinite(scale.value)) ? scale.value : 1;
    const ox = (originX.value && !isNaN(originX.value) && isFinite(originX.value)) ? originX.value : 0;
    const oy = (originY.value && !isNaN(originY.value) && isFinite(originY.value)) ? originY.value : 0;
    const fx = (focalX.value && !isNaN(focalX.value) && isFinite(focalX.value)) ? focalX.value : 0;
    const fy = (focalY.value && !isNaN(focalY.value) && isFinite(focalY.value)) ? focalY.value : 0;

    const width = containerWidth;
    const height = aspectRatioValue ? (containerWidth / aspectRatioValue) : containerWidth;
    const safeHeight = (height && !isNaN(height) && isFinite(height)) ? height : containerWidth;

    // The shift caused by moving your fingers
    const px = fx - ox;
    const py = fy - oy;

    // Center-relative focal point offset
    const rawFocalXOffset = width / 2 - ox;
    const rawFocalYOffset = safeHeight / 2 - oy;

    const focalXOffset = (!isNaN(rawFocalXOffset) && isFinite(rawFocalXOffset)) ? rawFocalXOffset : 0;
    const focalYOffset = (!isNaN(rawFocalYOffset) && isFinite(rawFocalYOffset)) ? rawFocalYOffset : 0;

    return {
      transform: [
        { translateX: px },
        { translateY: py },
        { translateX: focalXOffset },
        { translateY: focalYOffset },
        { scale: s },
        { translateX: -focalXOffset },
        { translateY: -focalYOffset },
      ] as any,
    };
  });

  const containerAnimatedStyle = useAnimatedStyle(() => {
    return {
      overflow: scale.value > 1.01 ? 'visible' : 'hidden',
      zIndex: scale.value > 1.01 ? 999 : 1,
    };
  });

  const indicatorsAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withSpring(scale.value > 1.01 ? 0 : 1, { damping: 15 }),
    };
  });

  return (
    <ReAnimated.View onLayout={handleLayout} style={[styles.imageContainer, { aspectRatio: aspectRatioValue }, containerAnimatedStyle]}>
      {imageLoading && (
        <View style={styles.imageLoader} pointerEvents="none">
          <LoadingGlobe color={theme.colors.primary} size="large" />
        </View>
      )}
      
      {imageUri && !imageError ? (
        <View style={styles.imageWrapper}>
          {/* Multiple images with horizontal scrolling */}
          {post.images && post.images.length > 1 ? (
            <View style={StyleSheet.absoluteFill}>
              <FlatList
                ref={flatListRef}
                data={resolvedImages}
                horizontal
                pagingEnabled={true}
                snapToInterval={containerWidth}
                snapToAlignment="center"
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                scrollEnabled={scrollEnabled}
                style={{ margin: 0, padding: 0 }}
                contentContainerStyle={{ marginHorizontal: 0, paddingHorizontal: 0 }}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / containerWidth);
                  setCurrentImageIndex(index);
                  scale.value = 1;
                  focalX.value = 0;
                  focalY.value = 0;
                  setScrollEnabled(true);
                }}
                renderItem={({ item, index }) => (
                  <CarouselItem
                    item={item}
                    index={index}
                    currentImageIndex={currentImageIndex}
                    scale={scale}
                    focalX={focalX}
                    focalY={focalY}
                    composedGesture={composedGesture}
                    animatedImageStyle={animatedImageStyle}
                    containerWidth={containerWidth}
                    filter={post.filter}
                    heartScale={heartScale}
                    heartOpacity={heartOpacity}
                  />
                )}
                keyExtractor={(item, index) => index.toString()}
                getItemLayout={(data, index) => ({
                  length: containerWidth,
                  offset: containerWidth * index,
                  index,
                })}
              />
              
              {/* Image counter and dot indicators wrapped in animated view */}
              <ReAnimated.View style={[StyleSheet.absoluteFill, indicatorsAnimatedStyle]} pointerEvents="none">
                {/* Image counter */}
                <View style={styles.imageCounter}>
                  <Text style={styles.imageCounterText}>
                    {currentImageIndex + 1} / {post.images.length}
                  </Text>
                </View>
                
                {/* Image dots indicator */}
                <View style={styles.dotsContainer}>
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
              </ReAnimated.View>
            </View>
          ) : (
            <GestureDetector gesture={composedGesture}>
              <ReAnimated.View style={[StyleSheet.absoluteFill, animatedImageStyle]}>
                <ExpoImage
                  source={{
                    uri: applyCloudinaryFilter(imageUri, post.filter),
                    cacheKey: getStableCacheKey(imageUri) ? `${getStableCacheKey(imageUri)}:${post.filter || 'original'}` : undefined,
                  }}
                  placeholder={blurUpUri ? { uri: blurUpUri } : undefined}
                  placeholderContentFit="cover"
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  transition={250}
                  priority="high"
                  style={styles.image}
                  onError={() => onImageError()}
                />
                {post.filter && FILTER_PREVIEW_OVERLAY[post.filter as ImageFilterType] && (
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: FILTER_PREVIEW_OVERLAY[post.filter as ImageFilterType]! },
                    ]}
                  />
                )}

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
                    <MaskedView
                      style={{ width: 80, height: 80 }}
                      maskElement={
                        <Ionicons name="heart" size={80} color="#000000" />
                      }
                    >
                      <LinearGradient
                        colors={['#50C878', '#1C73B4']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ flex: 1 }}
                      />
                    </MaskedView>
                  </Animated.View>
                </View>
              </ReAnimated.View>
            </GestureDetector>
          )}
        </View>
        ) : imageError ? (
          <GestureDetector gesture={listComposedGesture}>
            <View style={StyleSheet.absoluteFill}>
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
            </View>
          </GestureDetector>
        ) : null}

      {/* Song Player - Hidden but active for audio playback */}
      {/* Music plays when post is visible and unmuted, pauses when scrolled away (Instagram-style) */}
      {post.song?.songId && imageUri && !imageError && (
        <View style={styles.hiddenSongPlayer} pointerEvents="box-none">
          <SongPlayer 
            post={post} 
            isVisible={isCurrentlyVisible} 
            shouldPreload={shouldPreload}
            autoPlay={isCurrentlyVisible && !isMuted} 
            showPlayPause={false} 
            externalMuted={isMuted}
          />
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
    </ReAnimated.View>
  );
}

// CarouselItem hoisted to top of file

const styles = StyleSheet.create({
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#000',
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
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
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

