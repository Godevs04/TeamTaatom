import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

// Re-exported for callers that previously imported CropTransform from here.
export type { CropTransform } from './post/AspectImageCropper';

export type ImageFilterType = 'original' | 'vivid' | 'warm' | 'cool' | 'bw';
export type AspectRatioChoice = '1.91:1' | '1:1';

export interface SelectedImageItem {
  uri: string;
  type: string;
  name: string;
}

const ASPECT_OPTIONS: { id: AspectRatioChoice; label: string; icon: string }[] = [
  { id: '1:1', label: '1:1', icon: 'square-outline' },
  { id: '1.91:1', label: '1.91:1', icon: 'image-outline' },
];

const FILTER_OPTIONS: { id: ImageFilterType; label: string; icon: string }[] = [
  { id: 'original', label: 'Original', icon: 'image' },
  { id: 'vivid', label: 'Vivid', icon: 'sunny' },
  { id: 'warm', label: 'Warm', icon: 'flame' },
  { id: 'cool', label: 'Cool', icon: 'snow' },
  { id: 'bw', label: 'B&W', icon: 'contrast' },
];

// Preview overlays shown while the user picks a filter inside this modal.
// These are cosmetic tints only — the real filter is permanently baked into
// the image pixel data by applyImageFilter (utils/applyImageFilter.ts) just
// before the multipart upload starts, so what lands in storage is already
// the filtered image. The tint overlay here gives instant visual feedback
// without the cost of running expo-image-manipulator on every chip tap.
export const FILTER_PREVIEW_OVERLAY: Record<ImageFilterType, string | null> = {
  original: null,
  vivid: 'rgba(255, 200, 100, 0.15)',
  warm: 'rgba(255, 140, 50, 0.22)',
  cool: 'rgba(70, 130, 220, 0.22)',
  bw: 'rgba(128, 128, 128, 0.55)',
};

interface ImageEditModalProps {
  visible: boolean;
  onClose: () => void;
  images: SelectedImageItem[];
  onImagesChange: (images: SelectedImageItem[]) => void;
  selectedFilter: ImageFilterType;
  onFilterChange: (filter: ImageFilterType) => void;
  selectedAspectRatio?: AspectRatioChoice;
  onAspectRatioChange?: (ratio: AspectRatioChoice) => void;
}

export default function ImageEditModal({
  visible,
  onClose,
  images,
  onImagesChange,
  selectedFilter,
  onFilterChange,
  selectedAspectRatio = '1:1',
  onAspectRatioChange,
}: ImageEditModalProps) {
  const { theme, mode } = useTheme();
  const searchAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
    };
  }, []);

  // All filters are now applied server-side via Cloudinary URL
  // transformations, so every chip is selectable. The chosen filter is
  // stored on the post and re-applied on every render.
  const isFilterSupported = (_id: ImageFilterType) => true;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[
          styles.container,
          {
            borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.45)',
            borderWidth: 1,
            overflow: 'hidden',
            backgroundColor: mode === 'dark' ? 'rgba(10, 18, 32, 0.75)' : 'rgba(255, 255, 255, 0.65)',
            ...theme.shadows.large,
          }
        ]}>
          <BlurView
            intensity={80}
            tint={mode === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={
              mode === 'dark'
                ? ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.02)']
                : ['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.1)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 0.4, y: 0.4 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={{ flex: 1, zIndex: 1 }}>
            <View style={[styles.header, { borderBottomColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Edit photos</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={28} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              {/* Aspect ratio */}
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
                Aspect ratio
              </Text>
              <View style={styles.aspectRow}>
                {ASPECT_OPTIONS.map((opt) => {
                  const isActive = selectedAspectRatio === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => onAspectRatioChange?.(opt.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      style={[
                        styles.aspectChip,
                        {
                          backgroundColor: isActive ? 'transparent' : (mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.3)'),
                          borderColor: isActive ? 'transparent' : theme.colors.border,
                          overflow: 'hidden',
                        },
                      ]}
                    >
                      {isActive && (
                        <LinearGradient
                          colors={['#38BDF8', '#14B8A6', '#34D399']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={StyleSheet.absoluteFillObject}
                        />
                      )}
                      {isActive && (
                        <LinearGradient
                          colors={['rgba(255, 255, 255, 0.25)', 'transparent']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 0.4 }}
                          style={StyleSheet.absoluteFillObject}
                          pointerEvents="none"
                        />
                      )}
                      <Ionicons
                        name={opt.icon as any}
                        size={20}
                        color={isActive ? '#fff' : theme.colors.text}
                        style={{ zIndex: 1 }}
                      />
                      <Text style={[styles.aspectLabel, { color: isActive ? '#fff' : theme.colors.text, zIndex: 1 }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Photos — informational thumbnails. Pinch+pan cropping happens on the post creation
                  screen itself, not in this modal. */}
              {/* Filter preview — first selected image with approximate overlay. */}
              {images.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary, marginTop: theme.spacing.lg }]}>
                    Preview
                  </Text>
                  <View style={{
                    width: '100%',
                    height: 240,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.3)',
                    borderRadius: 16,
                    marginBottom: 6,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}>
                    <View style={[
                      styles.previewContainer,
                      {
                        height: '100%',
                        aspectRatio: selectedAspectRatio === '1.91:1' ? 1.91 / 1 : 1 / 1,
                        width: undefined,
                      }
                    ]}>
                      <ExpoImage source={{ uri: images[0].uri }} style={styles.previewImage} />
                      {FILTER_PREVIEW_OVERLAY[selectedFilter] && (
                        <View
                          pointerEvents="none"
                          style={[
                            StyleSheet.absoluteFillObject,
                            { backgroundColor: FILTER_PREVIEW_OVERLAY[selectedFilter]! },
                          ]}
                        />
                      )}
                    </View>
                  </View>
                </>
              )}

              {/* Filters */}
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary, marginTop: theme.spacing.lg }]}>
                Filter
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                {FILTER_OPTIONS.map((f) => {
                  const selected = selectedFilter === f.id;
                  const supported = isFilterSupported(f.id);
                  return (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => supported && onFilterChange(f.id)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: selected ? 'transparent' : (mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.3)'),
                          borderColor: selected ? 'transparent' : theme.colors.border,
                          opacity: supported ? 1 : 0.6,
                          overflow: 'hidden',
                        },
                      ]}
                    >
                      {selected && (
                        <LinearGradient
                          colors={['#38BDF8', '#14B8A6', '#34D399']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={StyleSheet.absoluteFillObject}
                        />
                      )}
                      {selected && (
                        <LinearGradient
                          colors={['rgba(255, 255, 255, 0.25)', 'transparent']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 0.4 }}
                          style={StyleSheet.absoluteFillObject}
                          pointerEvents="none"
                        />
                      )}
                      <Ionicons
                        name={f.icon as any}
                        size={20}
                        color={selected ? '#fff' : theme.colors.text}
                        style={{ zIndex: 1 }}
                      />
                      <Text
                        style={[
                          styles.filterLabel,
                          { color: selected ? '#fff' : theme.colors.text, zIndex: 1 },
                        ]}
                      >
                        {f.label}
                      </Text>
                      {!supported && (
                        <Text style={[styles.comingSoon, { color: theme.colors.textSecondary, zIndex: 1 }]}>Soon</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </ScrollView>

            <TouchableOpacity
              onPress={onClose}
              style={{
                marginHorizontal: 20,
                marginTop: 8,
                borderRadius: 9999,
                shadowColor: '#14B8A6',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 4,
                overflow: 'hidden',
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#38BDF8', '#14B8A6', '#34D399']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 16,
                  borderRadius: 9999,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.35)',
                }}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.25)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 0.4 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '700',
                  zIndex: 1,
                }}>
                  Done
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aspectRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  aspectChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  aspectLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  previewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 6,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  filterScroll: {
    marginBottom: 20,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  comingSoon: {
    fontSize: 10,
    marginLeft: 2,
  },
  doneBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
