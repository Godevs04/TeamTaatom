import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, Platform, View, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { CanvasElement } from '../services/connect';

const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

interface Props {
  element: CanvasElement;
  isSelected: boolean;
  editable: boolean;
  frameWidth: number;
  frameHeight: number;
  onSelect?: () => void;
  onChange?: (updates: Partial<CanvasElement>) => void;
  onRequestEdit?: () => void;
  onDelete?: () => void;
}

const CanvasElementView: React.FC<Props> = ({
  element,
  isSelected,
  editable,
  frameWidth,
  frameHeight,
  onSelect,
  onChange,
  onRequestEdit,
  onDelete,
}) => {
  const isText = element.type === 'text';

  // Source of truth = element.{x,y,w,h,rotation}. Shared values overlay deltas during gestures.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const rot = useSharedValue(0);

  // Reset overlays whenever the canonical element changes (e.g. after saving a gesture).
  useEffect(() => {
    tx.value = 0;
    ty.value = 0;
    scale.value = 1;
    rot.value = 0;
  }, [
    element.x,
    element.y,
    element.w,
    element.h,
    element.rotation,
    element.fontSize,
    tx,
    ty,
    scale,
    rot,
  ]);

  // Text elements auto-size to their rendered content so the dashed selection
  // outline (and the gesture region) hug the visible text instead of a large
  // pre-allocated box that would intercept taps meant for other elements.
  const [textSize, setTextSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const handleTextLayout = (e: LayoutChangeEvent) => {
    if (!isText) return;
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - textSize.w) > 1 || Math.abs(height - textSize.h) > 1) {
      setTextSize({ w: width, h: height });
    }
  };

  const baseLeft = isText
    ? element.x * frameWidth - textSize.w / 2
    : (element.x - element.w / 2) * frameWidth;
  const baseTop = isText
    ? element.y * frameHeight - textSize.h / 2
    : (element.y - element.h / 2) * frameHeight;
  // For text, leave width/height undefined so the View auto-sizes to its content.
  const baseW = isText ? undefined : element.w * frameWidth;
  const baseH = isText ? undefined : element.h * frameHeight;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotateZ: `${(element.rotation || 0) + (rot.value * 180) / Math.PI}deg` },
      { scale: scale.value },
    ] as any,
  }));

  const commitPan = (deltaX: number, deltaY: number) => {
    if (!onChange) return;
    const newX = element.x + deltaX / frameWidth;
    const newY = element.y + deltaY / frameHeight;
    onChange({
      x: Math.max(0, Math.min(1, newX)),
      y: Math.max(0, Math.min(1, newY)),
    });
  };

  const commitScale = (factor: number) => {
    if (!onChange) return;
    if (isText) {
      // For text we drive size through fontSize only; the wrapping View auto-sizes
      // around the rendered glyphs so the selection outline stays tight.
      const newFont = Math.max(8, Math.min(300, (element.fontSize || 24) * factor));
      onChange({ fontSize: newFont });
    } else {
      // Allow images/videos to grow beyond the frame (parent clips). No upper cap.
      const newW = Math.max(0.05, element.w * factor);
      const newH = Math.max(0.03, element.h * factor);
      onChange({ w: newW, h: newH });
    }
  };

  const commitRotation = (radians: number) => {
    if (!onChange) return;
    const degrees = (radians * 180) / Math.PI;
    onChange({ rotation: (element.rotation || 0) + degrees });
  };

  const pan = Gesture.Pan()
    .enabled(editable)
    .minDistance(2)
    .onStart(() => {
      if (onSelect) runOnJS(onSelect)();
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(commitPan)(e.translationX, e.translationY);
    });

  const pinch = Gesture.Pinch()
    .enabled(editable)
    .onStart(() => {
      if (onSelect) runOnJS(onSelect)();
    })
    .onUpdate((e) => {
      scale.value = e.scale;
    })
    .onEnd((e) => {
      runOnJS(commitScale)(e.scale);
    });

  const rotation = Gesture.Rotation()
    .enabled(editable)
    .onStart(() => {
      if (onSelect) runOnJS(onSelect)();
    })
    .onUpdate((e) => {
      rot.value = e.rotation;
    })
    .onEnd((e) => {
      runOnJS(commitRotation)(e.rotation);
    });

  const tap = Gesture.Tap()
    .enabled(editable)
    .maxDuration(250)
    .onEnd(() => {
      if (!isSelected) {
        if (onSelect) runOnJS(onSelect)();
      } else if (element.type === 'text' && onRequestEdit) {
        runOnJS(onRequestEdit)();
      }
    });

  const composed = editable
    ? Gesture.Race(tap, Gesture.Simultaneous(pan, pinch, rotation))
    : Gesture.Tap().enabled(false);

  const inner = (() => {
    if (element.type === 'text') {
      return (
        <Text
          style={[
            styles.textContent,
            {
              color: element.color || '#FFFFFF',
              fontSize: element.fontSize || 24,
              fontWeight: (element.fontWeight as any) || '600',
              backgroundColor: element.backgroundColor || 'transparent',
              fontFamily: getFontFamily((element.fontWeight as any) || '600'),
            },
          ]}
          numberOfLines={0}
        >
          {element.content || ''}
        </Text>
      );
    }
    if (element.type === 'image') {
      return (
        <ExpoImage
          source={{ uri: element.content }}
          style={styles.media}
          contentFit="cover"
          transition={150}
        />
      );
    }
    // video
    return (
      <Video
        source={{ uri: element.content }}
        style={styles.media}
        resizeMode={ResizeMode.COVER}
        isLooping
        isMuted
        shouldPlay
      />
    );
  })();

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        onLayout={isText ? handleTextLayout : undefined}
        style={[
          styles.elementWrap,
          {
            left: baseLeft,
            top: baseTop,
            width: baseW,
            height: baseH,
            zIndex: element.zIndex || 0,
          },
          animatedStyle,
          isSelected && styles.selected,
        ]}
      >
        {inner}
        {isSelected && editable && onDelete && (
          <TouchableOpacity
            style={styles.deleteBadge}
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={26} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  elementWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    borderWidth: 1.5,
    borderColor: '#4A90E2',
    borderStyle: 'dashed',
    borderRadius: 4,
  },
  textContent: {
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  media: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  deleteBadge: {
    position: 'absolute',
    top: -14,
    right: -14,
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
  },
});

export default React.memo(CanvasElementView);
