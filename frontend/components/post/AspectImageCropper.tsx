import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withTiming,
} from 'react-native-reanimated';

export interface CropTransform {
  userScale: number;
  viewportTx: number;
  viewportTy: number;
  viewportW: number;
  viewportH: number;
}

interface AspectImageCropperProps {
  /** Image source URI. */
  uri: string;
  /** Frame aspect — 1 for square, 9/16 for portrait 16:9, etc. */
  aspectRatio: number;
  /**
   * Optional fixed viewport width in pixels. If omitted, the cropper measures
   * its parent and fills the available width — recommended for inline use so
   * the cropper never overflows the container.
   */
  viewportWidth?: number;
  /** Border radius for the viewport. */
  borderRadius?: number;
  /** Called on gesture end with the user's transform (or null on reset). */
  onTransformChange?: (transform: CropTransform | null) => void;
  /** Show the small "Pinch to zoom · drag to reposition" hint below. */
  showHint?: boolean;
  /** Show the Reset button. */
  showReset?: boolean;
  /** Reset label color (defaults to white over the image). */
  resetColor?: string;
}

/**
 * Pinch + pan cropper that frames a source image inside a fixed-aspect viewport.
 * Pan is clamped so the image always fully covers the viewport (no empty edges).
 * The reported transform feeds directly into `processImageToAspect` at upload time.
 */
export default function AspectImageCropper({
  uri,
  aspectRatio,
  viewportWidth: fixedViewportWidth,
  borderRadius = 0,
  onTransformChange,
  showHint = true,
  showReset = true,
  resetColor = '#fff',
}: AspectImageCropperProps) {
  // If no fixed width is provided, measure the parent container.
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(
    fixedViewportWidth ?? null
  );
  const viewportWidth = fixedViewportWidth ?? measuredWidth ?? 0;
  const viewportH = viewportWidth > 0 ? Math.round(viewportWidth / aspectRatio) : 0;
  const [imageNatural, setImageNatural] = useState<{ w: number; h: number } | null>(null);

  const coverScale = imageNatural
    ? Math.max(viewportWidth / imageNatural.w, viewportH / imageNatural.h)
    : 1;
  const baseWidth = imageNatural ? imageNatural.w * coverScale : viewportWidth;
  const baseHeight = imageNatural ? imageNatural.h * coverScale : viewportH;
  const left = (viewportWidth - baseWidth) / 2;
  const top = (viewportH - baseHeight) / 2;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // Reset transform when source or viewport aspect changes.
  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    ty.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
    onTransformChange?.({
      userScale: 1,
      viewportTx: 0,
      viewportTy: 0,
      viewportW: viewportWidth,
      viewportH,
    });
  }, [uri, aspectRatio, viewportWidth]);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => { if (!cancelled) setImageNatural({ w, h }); },
      () => { /* ignore */ },
    );
    return () => { cancelled = true; };
  }, [uri]);

  const reportTransform = (s: number, x: number, y: number) => {
    onTransformChange?.({
      userScale: s,
      viewportTx: x,
      viewportTy: y,
      viewportW: viewportWidth,
      viewportH,
    });
  };

  const clampPan = (s: number) => {
    'worklet';
    if (!imageNatural) return { maxX: 0, maxY: 0 };
    const coverScale = Math.max(viewportWidth / imageNatural.w, viewportH / imageNatural.h);
    const finalScale = coverScale * s;
    const scaledW = imageNatural.w * finalScale;
    const scaledH = imageNatural.h * finalScale;
    const maxX = Math.max(0, (scaledW - viewportWidth) / 2);
    const maxY = Math.max(0, (scaledH - viewportH) / 2);
    return { maxX, maxY };
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      // Only process updates if exactly 2 fingers are touching to prevent focal point jumps on iOS
      if (e.numberOfPointers === 2) {
        const next = Math.min(4, Math.max(1, savedScale.value * e.scale));
        scale.value = next;
        const { maxX, maxY } = clampPan(next);
        tx.value = Math.max(-maxX, Math.min(maxX, tx.value));
        ty.value = Math.max(-maxY, Math.min(maxY, ty.value));
      }
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
      runOnJS(reportTransform)(scale.value, tx.value, ty.value);
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const { maxX, maxY } = clampPan(scale.value);
      tx.value = Math.max(-maxX, Math.min(maxX, savedTx.value + e.translationX));
      ty.value = Math.max(-maxY, Math.min(maxY, savedTy.value + e.translationY));
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
      runOnJS(reportTransform)(scale.value, tx.value, ty.value);
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ] as any,
  }));

  const resetTransform = () => {
    scale.value = withTiming(1, { duration: 200 });
    savedScale.value = 1;
    tx.value = withTiming(0, { duration: 200 });
    ty.value = withTiming(0, { duration: 200 });
    savedTx.value = 0;
    savedTy.value = 0;
    onTransformChange?.({
      userScale: 1,
      viewportTx: 0,
      viewportTy: 0,
      viewportW: viewportWidth,
      viewportH,
    });
  };

  // If we don't yet know the width (waiting on layout), render a placeholder of the
  // correct aspect so the surrounding layout doesn't jump when the cropper appears.
  return (
    <View
      style={{ width: '100%', overflow: 'visible' }}
      onLayout={(e) => {
        if (fixedViewportWidth != null) return;
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== measuredWidth) setMeasuredWidth(w);
      }}
    >
      {viewportWidth === 0 ? (
        <View style={{ width: '100%', aspectRatio, backgroundColor: 'transparent', borderRadius }} />
      ) : (
      // No nested GestureHandlerRootView — the Expo app root already has one,
      // and nesting another inside it on RN-gesture-handler v2+ causes the
      // child to clip its content during the parent ScrollView's scroll,
      // which is what surfaced as "half image, half black" on 1:1 preview.
      <GestureDetector gesture={composedGesture}>
        <View
          style={{
            width: viewportWidth,
            height: viewportH,
            // Transparent — if the source bitmap is briefly unloaded mid-
            // transform, the page background shows through rather than a
            // hard black panel.
            backgroundColor: 'transparent',
            overflow: 'visible' as const,
            borderRadius,
          } as any}
        >
          <Animated.Image
            source={{ uri }}
            resizeMode="cover"
            style={[
              {
                position: 'absolute',
                width: baseWidth,
                height: baseHeight,
                left,
                top,
              },
              animatedImageStyle as any,
            ]}
          />

          {/* Dimming Overlays around the crop frame */}
          {/* Top */}
          <View style={[styles.dimOverlay, { bottom: '100%', left: -1000, right: -1000, height: 1000 }]} pointerEvents="none" />
          {/* Bottom */}
          <View style={[styles.dimOverlay, { top: '100%', left: -1000, right: -1000, height: 1000 }]} pointerEvents="none" />
          {/* Left */}
          <View style={[styles.dimOverlay, { right: '100%', top: 0, bottom: 0, width: 1000 }]} pointerEvents="none" />
          {/* Right */}
          <View style={[styles.dimOverlay, { left: '100%', top: 0, bottom: 0, width: 1000 }]} pointerEvents="none" />

          {/* Highlighted border around the crop area */}
          <View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.8)',
              borderRadius,
            }}
          />

          {/* 3x3 Grid Overlay */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Horizontal lines */}
            <View style={[styles.gridLineHorizontal, { top: '33.33%' }]} />
            <View style={[styles.gridLineHorizontal, { top: '66.66%' }]} />
            {/* Vertical lines */}
            <View style={[styles.gridLineVertical, { left: '33.33%' }]} />
            <View style={[styles.gridLineVertical, { left: '66.66%' }]} />
          </View>
          {showReset && (
            <TouchableOpacity
              onPress={resetTransform}
              hitSlop={8}
              style={styles.resetBtn}
            >
              <Text style={[styles.resetText, { color: resetColor }]}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </GestureDetector>
      )}
      {showHint && viewportWidth > 0 && (
        <Text style={styles.hint}>Pinch to zoom · drag to reposition</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  resetBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 10,
  },
  resetText: {
    fontSize: 12,
    fontWeight: '700',
  },
  hint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    color: 'rgba(255,255,255,0.7)',
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  dimOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
});
