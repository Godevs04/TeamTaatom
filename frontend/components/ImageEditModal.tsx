import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// Re-exported for callers that previously imported CropTransform from here.
export type { CropTransform } from './post/AspectImageCropper';

export type ImageFilterType = 'original' | 'vivid' | 'warm' | 'cool' | 'bw';
export type AspectRatioChoice = '1:1' | '16:9' | 'full';

export interface SelectedImageItem {
  uri: string;
  type: string;
  name: string;
}

const ASPECT_OPTIONS: { id: AspectRatioChoice; label: string; icon: string }[] = [
  { id: '1:1', label: '1:1', icon: 'square-outline' },
  { id: '16:9', label: '16:9', icon: 'tablet-portrait-outline' },
  { id: 'full', label: 'Full Image', icon: 'expand-outline' },
];

const FILTER_OPTIONS: { id: ImageFilterType; label: string; icon: string }[] = [
  { id: 'original', label: 'Original', icon: 'image' },
  { id: 'vivid', label: 'Vivid', icon: 'sunny' },
  { id: 'warm', label: 'Warm', icon: 'flame' },
  { id: 'cool', label: 'Cool', icon: 'snow' },
  { id: 'bw', label: 'B&W', icon: 'contrast' },
];

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
  const { theme } = useTheme();
  const searchAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
    };
  }, []);

  const isFilterSupported = (id: ImageFilterType) => id === 'original';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Edit photos</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Aspect ratio — Square / 16:9 / Full Image (zoom-to-fill, non-destructive) */}
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
                        backgroundColor: isActive ? theme.colors.primary : theme.colors.surface,
                        borderColor: isActive ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={20}
                      color={isActive ? '#fff' : theme.colors.text}
                    />
                    <Text style={[styles.aspectLabel, { color: isActive ? '#fff' : theme.colors.text }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Photos — informational thumbnails. Pinch+pan cropping happens on the post creation
                screen itself, not in this modal. */}
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary, marginTop: 16 }]}>
              Photos
            </Text>
            <View style={styles.thumbRow}>
              {images.map((img, index) => (
                <Image key={`${img.uri}-${index}`} source={{ uri: img.uri }} style={styles.thumbSmall} />
              ))}
            </View>

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
                        backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        opacity: supported ? 1 : 0.6,
                      },
                    ]}
                  >
                    <Ionicons
                      name={f.icon as any}
                      size={20}
                      color={selected ? '#fff' : theme.colors.text}
                    />
                    <Text
                      style={[
                        styles.filterLabel,
                        { color: selected ? '#fff' : theme.colors.text },
                      ]}
                    >
                      {f.label}
                    </Text>
                    {!supported && (
                      <Text style={[styles.comingSoon, { color: theme.colors.textSecondary }]}>Soon</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </ScrollView>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.doneBtn, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
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
    maxHeight: '85%',
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
    maxHeight: 400,
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
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  thumbSmall: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#eee',
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
