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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChatMediaViewerProps {
  visible: boolean;
  type: 'image' | 'video';
  uri: string;
  onClose: () => void;
}

export default function ChatMediaViewer({ visible, type, uri, onClose }: ChatMediaViewerProps) {
  const videoRef = useRef<Video>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [videoReady, setVideoReady] = useState(false);

  const handleClose = useCallback(async () => {
    try {
      await videoRef.current?.pauseAsync();
      await videoRef.current?.stopAsync();
    } catch {
      // ignore
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!visible) {
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
  }, [visible, type, uri]);

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
      visible={visible}
      transparent={false}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={16}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>

        {type === 'image' ? (
          <View style={styles.mediaWrap}>
            {imageLoading ? (
              <ActivityIndicator size="large" color="#5BBCF8" style={styles.loader} />
            ) : null}
            <Image
              source={{ uri }}
              style={styles.fullImage}
              resizeMode="contain"
              onLoadEnd={() => setImageLoading(false)}
            />
          </View>
        ) : (
          <View style={styles.mediaWrap}>
            {!videoReady ? (
              <ActivityIndicator size="large" color="#5BBCF8" style={styles.loader} />
            ) : null}
            <Video
              ref={videoRef}
              source={{ uri }}
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
