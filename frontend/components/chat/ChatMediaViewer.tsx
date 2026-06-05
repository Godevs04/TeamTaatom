import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChatMediaViewerProps {
  visible?: boolean;
  type?: 'image' | 'video';
  uri?: string;
  onClose?: () => void;
  isGlobal?: boolean;
}

interface ViewerState {
  visible: boolean;
  type: 'image' | 'video';
  uri: string;
  onClose: () => void;
}

let globalState: ViewerState = {
  visible: false,
  type: 'image',
  uri: '',
  onClose: () => {},
};

const listeners = new Set<(state: ViewerState) => void>();

export function setGlobalViewerState(state: Partial<ViewerState>) {
  globalState = { ...globalState, ...state };
  listeners.forEach((l) => l(globalState));
}

export function subscribeToGlobalViewer(listener: (state: ViewerState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export default function ChatMediaViewer({
  visible,
  type: initialType,
  uri: initialUri,
  onClose: initialOnClose,
  isGlobal = false,
}: ChatMediaViewerProps) {
  if (!isGlobal) {
    // Local instance: sync its props to the global manager
    useEffect(() => {
      if (visible) {
        setGlobalViewerState({
          visible: true,
          type: initialType || 'image',
          uri: initialUri || '',
          onClose: initialOnClose || (() => {}),
        });
      }
    }, [visible, initialType, initialUri, initialOnClose]);

    return null;
  }

  // Global instance: renders the actual modal and manages state synchronized with global manager
  const [state, setState] = useState<ViewerState>(globalState);

  useEffect(() => {
    return subscribeToGlobalViewer((nextState) => {
      setState(nextState);
    });
  }, []);

  const { visible: isVisible, type, uri, onClose } = state;

  const videoRef = useRef<Video>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [videoReady, setVideoReady] = useState(false);

  // Zoom and Pan States
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Reset zoom on visibility changes
  useEffect(() => {
    if (!isVisible) {
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, [isVisible]);

  // Handle status bar visibility (immersive mode) for BUG-008
  useEffect(() => {
    if (isVisible) {
      StatusBar.setHidden(true, 'fade');
    }
    return () => {
      StatusBar.setHidden(false, 'fade');
    };
  }, [isVisible]);

  // Gestures definition
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      // Only process updates if exactly 2 fingers are touching to prevent focal point jumps on iOS
      if (event.numberOfPointers === 2) {
        scale.value = Math.min(3, Math.max(1, savedScale.value * event.scale));
      }
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + event.translationX / scale.value;
        translateY.value = savedTranslateY.value + event.translationY / scale.value;
      }
    })
    .onEnd(() => {
      if (scale.value <= 1.1) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Limit pan translation to maintain image within device bounds
        const maxTx = (SCREEN_WIDTH * (scale.value - 1)) / 2;
        const maxTy = (SCREEN_HEIGHT * (scale.value - 1)) / 2;

        translateX.value = withSpring(
          Math.min(maxTx, Math.max(-maxTx, translateX.value))
        );
        translateY.value = withSpring(
          Math.min(maxTy, Math.max(-maxTy, translateY.value))
        );

        savedTranslateX.value = Math.min(maxTx, Math.max(-maxTx, translateX.value));
        savedTranslateY.value = Math.min(maxTy, Math.max(-maxTy, translateY.value));
      }
    });

  const gesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateX: translateX.value * scale.value },
        { translateY: translateY.value * scale.value },
      ] as any,
    };
  });

  const handleClose = useCallback(async () => {
    try {
      await videoRef.current?.pauseAsync();
      await videoRef.current?.stopAsync();
    } catch {
      // ignore
    }
    if (onClose) {
      onClose();
    }
    setGlobalViewerState({ visible: false });
  }, [onClose]);

  useEffect(() => {
    if (!isVisible) {
      setImageLoading(true);
      setVideoReady(false);
      return;
    }
    if (type === 'video') {
      const t = setTimeout(async () => {
        try {
          await videoRef.current?.playAsync();
        } catch {
          // play on load as fallback
        }
      }, 80);
      return () => clearTimeout(t);
    }
  }, [isVisible, type, uri]);

  const onVideoStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.isLoaded && !videoReady) setVideoReady(true);
  }, [videoReady]);

  const presentNativeFullscreen = useCallback(async () => {
    try {
      if (videoRef.current) {
        await videoRef.current.presentFullscreenPlayer();
      }
    } catch {
      // fullscreen optional
    }
  }, []);

  return (
    <Modal
      visible={isVisible}
      transparent={false}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" hidden={isVisible} />
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={16}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>

        {type === 'image' ? (
          <View style={styles.mediaWrap}>
            {imageLoading ? (
              <LoadingGlobe size="large" color="#5BBCF8" style={styles.loader} />
            ) : null}
            <GestureDetector gesture={gesture}>
              <ReAnimated.Image
                source={{ uri }}
                style={[styles.fullImage, animatedStyle as any]}
                resizeMode="contain"
                onLoadEnd={() => setImageLoading(false)}
              />
            </GestureDetector>
          </View>
        ) : (
          <View style={styles.mediaWrap}>
            {!videoReady ? (
              <LoadingGlobe size="large" color="#5BBCF8" style={styles.loader} />
            ) : null}
            <Video
              ref={videoRef}
              source={{
                uri,
                overrideFileExtensionAndroid: (uri.toLowerCase().includes('m3u8') || uri.toLowerCase().includes('hls')) ? 'm3u8' : 'mp4'
              }}
              style={styles.fullVideo}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
              onPlaybackStatusUpdate={onVideoStatus}
              onLoad={async () => {
                setVideoReady(true);
                try {
                  await videoRef.current?.playAsync();
                } catch {
                  // ignore
                }
              }}
            />
            {Platform.OS !== 'web' ? (
              <TouchableOpacity style={styles.fsBtn} onPress={presentNativeFullscreen}>
                <Ionicons name="expand" size={22} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 40,
    right: 20,
    zIndex: 20,
    padding: 8,
  },
  mediaWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loader: {
    position: 'absolute',
  },
  fsBtn: {
    position: 'absolute',
    bottom: 48,
    right: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
    padding: 12,
  },
});
