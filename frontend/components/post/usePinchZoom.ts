import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { TransformsStyle } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const MAX_SCALE = 5;
// Timing, not spring: a spring overshoots below 1 and, if interrupted, leaves the image shrunk.
const RESET_ANIMATION = { duration: 180 };

const finiteOr = (value: number, fallback: number) => {
  'worklet';
  return Number.isFinite(value) ? value : fallback;
};

interface PinchZoomOptions {
  width: number;
  height: number;
  enabled: boolean;
  onZoomChange?: (isZooming: boolean) => void;
  onSingleTap?: () => void;
  onDoubleTap?: () => void;
}

/**
 * Instagram-style pinch-to-zoom that always springs back to 1x on release or cancel.
 * Each zoomable image must own its own instance so transforms never leak between carousel slides.
 */
export function usePinchZoom({
  width,
  height,
  enabled,
  onZoomChange,
  onSingleTap,
  onDoubleTap,
}: PinchZoomOptions) {
  const scale = useSharedValue(1);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const pinching = useSharedValue(false);

  // Gestures are memoized, so callbacks go through a ref; recreating a gesture mid-pinch cancels it.
  const callbacksRef = useRef({ onZoomChange, onSingleTap, onDoubleTap });
  useEffect(() => {
    callbacksRef.current = { onZoomChange, onSingleTap, onDoubleTap };
  }, [onZoomChange, onSingleTap, onDoubleTap]);

  const emitZoomChange = useCallback((isZooming: boolean) => {
    callbacksRef.current.onZoomChange?.(isZooming);
  }, []);
  const emitSingleTap = useCallback(() => {
    callbacksRef.current.onSingleTap?.();
  }, []);
  const emitDoubleTap = useCallback(() => {
    callbacksRef.current.onDoubleTap?.();
  }, []);

  const reset = useCallback(() => {
    cancelAnimation(scale);
    cancelAnimation(focalX);
    cancelAnimation(focalY);
    scale.value = 1;
    originX.value = 0;
    originY.value = 0;
    focalX.value = 0;
    focalY.value = 0;
  }, [scale, originX, originY, focalX, focalY]);

  useEffect(() => {
    if (!enabled) reset();
  }, [enabled, reset]);

  const gesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .enabled(enabled)
      .onStart((e) => {
        cancelAnimation(scale);
        cancelAnimation(focalX);
        cancelAnimation(focalY);
        originX.value = finiteOr(e.focalX, 0);
        originY.value = finiteOr(e.focalY, 0);
        focalX.value = originX.value;
        focalY.value = originY.value;
        pinching.value = true;
        runOnJS(emitZoomChange)(true);
      })
      .onUpdate((e) => {
        // A single remaining finger reports a jumpy focal point on iOS.
        if (e.numberOfPointers !== 2) return;
        scale.value = Math.min(Math.max(finiteOr(e.scale, 1), 1), MAX_SCALE);
        focalX.value = finiteOr(e.focalX, originX.value);
        focalY.value = finiteOr(e.focalY, originY.value);
      })
      // onFinalize also runs when the pinch is cancelled (scroll takeover, re-render), unlike onEnd.
      .onFinalize(() => {
        scale.value = withTiming(1, RESET_ANIMATION);
        focalX.value = withTiming(originX.value, RESET_ANIMATION);
        focalY.value = withTiming(originY.value, RESET_ANIMATION);
        if (pinching.value) {
          pinching.value = false;
          runOnJS(emitZoomChange)(false);
        }
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((_e, success) => {
        if (success) runOnJS(emitDoubleTap)();
      });

    const singleTap = Gesture.Tap()
      .numberOfTaps(1)
      .maxDuration(250)
      .requireExternalGestureToFail(doubleTap)
      .onEnd((_e, success) => {
        if (success) runOnJS(emitSingleTap)();
      });

    return Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, singleTap));
  }, [enabled, scale, originX, originY, focalX, focalY, pinching, emitZoomChange, emitSingleTap, emitDoubleTap]);

  const animatedStyle = useAnimatedStyle(() => {
    const s = Math.max(1, finiteOr(scale.value, 1));
    const h = height > 0 && Number.isFinite(height) ? height : width;
    const ox = finiteOr(originX.value, 0);
    const oy = finiteOr(originY.value, 0);
    const fx = finiteOr(focalX.value, ox);
    const fy = finiteOr(focalY.value, oy);
    const centerOffsetX = finiteOr(width / 2 - ox, 0);
    const centerOffsetY = finiteOr(h / 2 - oy, 0);

    const transform: TransformsStyle['transform'] = [
      { translateX: fx - ox },
      { translateY: fy - oy },
      { translateX: centerOffsetX },
      { translateY: centerOffsetY },
      { scale: s },
      { translateX: -centerOffsetX },
      { translateY: -centerOffsetY },
    ];
    return { transform };
  }, [width, height]);

  return { gesture, animatedStyle, scale, reset };
}
