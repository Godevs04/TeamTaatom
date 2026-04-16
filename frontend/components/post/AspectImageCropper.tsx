import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
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
    onTransformChange?.(null);
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
      const next = Math.min(4, Math.max(1, savedScale.value * e.scale));
      scale.value = next;
      const { maxX, maxY } = clampPan(next);
      tx.value = Math.max(-maxX, Math.min(maxX, tx.value));
      ty.value = Math.max(-maxY, Math.min(maxY, ty.value));
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
    onTransformChange?.(null);
  };

  // If we don't yet know the width (waiting on layout), render a placeholder of the
  // correct aspect so the surrounding layout doesn't jump when the cropper appears.
  return (
    <View
      style={{ width: '100%' }}
      onLayout={(e) => {
        if (fixedViewportWidth != null) return;
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== measuredWidth) setMeasuredWidth(w);
      }}
    >
      {viewportWidth === 0 ? (
        <View style={{ width: '100%', aspectRatio, backgroundColor: '#000', borderRadius }} />
      ) : (
      <GestureHandlerRootView style={{ width: viewportWidth, height: viewportH }}>
        <GestureDetector gesture={composedGesture}>
          <View
            style={{
              width: viewportWidth,
              height: viewportH,
              backgroundColor: '#000',
              overflow: 'hidden' as const,
              borderRadius,
            } as any}
          >
            <Animated.Image
              source={{ uri }}
              resizeMode="cover"
              style={[
                { width: viewportWidth, height: viewportH },
                animatedImageStyle as any,
              ]}
            />
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
      </GestureHandlerRootView>
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
});
