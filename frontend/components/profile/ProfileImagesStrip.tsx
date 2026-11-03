import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageStyle,
  Pressable,
  ScrollView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileImage } from '../../types/user';

interface ProfileImagesStripProps {
  images?: ProfileImage[];
  isDark: boolean;
}

const THUMB_WIDTH = 30;
const THUMB_HEIGHT = 22;

/**
 * Small flag-sized profile photos shown inline to the right of the full name.
 * Tapping a thumbnail opens a full-screen, swipeable viewer.
 */
export default function ProfileImagesStrip({ images = [], isDark }: ProfileImagesStripProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return null;
  }

  const closeViewer = () => setViewerIndex(null);

  return (
    <>
      <View style={styles.strip}>
        {images.map((image, index) => (
          <Pressable
            key={image._id}
            onPress={() => setViewerIndex(index)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Open profile photo ${index + 1} of ${images.length}`}
            style={({ pressed }) => [
              styles.thumb,
              { borderColor: isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(28, 115, 180, 0.2)', opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Image source={{ uri: image.url }} style={styles.thumbImage as ImageStyle} />
          </Pressable>
        ))}
      </View>

      <Modal
        visible={viewerIndex !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeViewer}
      >
        <View style={styles.viewerOverlay}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (viewerIndex ?? 0) * width, y: 0 }}
            onMomentumScrollEnd={(event) => {
              setViewerIndex(Math.round(event.nativeEvent.contentOffset.x / width));
            }}
          >
            {images.map((image) => (
              <Pressable key={image._id} onPress={closeViewer} style={{ width, height }}>
                <Image source={{ uri: image.url }} style={styles.viewerImage as ImageStyle} resizeMode="contain" />
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            onPress={closeViewer}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            style={[styles.viewerClose, { top: insets.top + 12 }]}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>

          {images.length > 1 && viewerIndex !== null ? (
            <Text style={[styles.viewerCounter, { bottom: insets.bottom + 24 }]}>
              {viewerIndex + 1} / {images.length}
            </Text>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    gap: 6,
  },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerClose: {
    position: 'absolute',
    right: 16,
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  viewerCounter: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
