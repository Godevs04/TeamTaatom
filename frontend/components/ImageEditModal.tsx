import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export type ImageFilterType = 'original' | 'vivid' | 'warm' | 'cool' | 'bw';

export interface SelectedImageItem {
  uri: string;
  type: string;
  name: string;
}

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
}

export default function ImageEditModal({
  visible,
  onClose,
  images,
  onImagesChange,
  selectedFilter,
  onFilterChange,
}: ImageEditModalProps) {
  const { theme } = useTheme();
  const [croppingIndex, setCroppingIndex] = useState<number | null>(null);

  const handleCropImage = async (index: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert('Permission needed', 'Please grant photo library access to crop.');
      return;
    }
    setCroppingIndex(index);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        // No fixed aspect ratio: user can freely drag the crop box.
        quality: 1,
      });
      if (result && !result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const ext = asset.fileName?.split('.').pop()?.toLowerCase();
        const isPng = ext === 'png';
        const isWebp = ext === 'webp';
        // Re-encode the cropped image so the output file exactly matches the selected crop.
        const saved = await ImageManipulator.manipulateAsync(
          asset.uri,
          [],
          {
            compress: 0.95,
            format: isPng
              ? ImageManipulator.SaveFormat.PNG
              : isWebp
                ? ImageManipulator.SaveFormat.WEBP
                : ImageManipulator.SaveFormat.JPEG,
          }
        );
        let mimeType = 'image/jpeg';
        if (isPng) mimeType = 'image/png';
        if (isWebp) mimeType = 'image/webp';
        const newImage: SelectedImageItem = {
          uri: saved.uri,
          type: mimeType,
          name: asset.fileName || `image_${Date.now()}.jpg`,
        };
        const next = [...images];
        next[index] = newImage;
        onImagesChange(next);
      }
    } catch {
      Alert.alert('Error', 'Failed to crop image. Please try again.');
    } finally {
      setCroppingIndex(null);
    }
  };

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
            {/* Crop / Full image per photo */}
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
              Crop or use full image
            </Text>
            {images.map((img, index) => (
              <View
                key={`${img.uri}-${index}`}
                style={[styles.imageRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              >
                <Image source={{ uri: img.uri }} style={styles.thumb} />
                <View style={styles.imageActions}>
                  <Text style={[styles.imageLabel, { color: theme.colors.text }]}>Photo {index + 1}</Text>
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }]}
                      onPress={() => handleCropImage(index)}
                      disabled={croppingIndex !== null}
                    >
                      {croppingIndex === index ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : (
                        <>
                          <Ionicons name="crop" size={18} color={theme.colors.primary} />
                          <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Crop</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <View style={[styles.actionBtn, styles.fullBtn, { backgroundColor: theme.colors.border + '40' }]}>
                      <Ionicons name="expand" size={18} color={theme.colors.textSecondary} />
                      <Text style={[styles.actionBtnText, { color: theme.colors.textSecondary }]}>Full image</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}

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
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  imageActions: {
    flex: 1,
    marginLeft: 12,
  },
  imageLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  fullBtn: {
    borderColor: 'transparent',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
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
