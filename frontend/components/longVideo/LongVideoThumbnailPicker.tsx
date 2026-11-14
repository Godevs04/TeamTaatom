import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AspectImageCropper from '../post/AspectImageCropper';
import {
  THUMBNAIL_RATIOS,
  thumbnailRatioValue,
  type ThumbnailDraft,
  type ThumbnailRatioId,
} from '../../hooks/useLongVideoUpload';
import type { UserCropTransform } from '../../utils/imageOptimization';

const MAX_CROP_HEIGHT = 320;
const FRAME_TILE_HEIGHT = 58;
const PENDING_FRAME_SLOTS = 4;

interface ThumbnailPickerColors {
  text: string;
  meta: string;
  border: string;
  accent: string;
  field: string;
}

interface LongVideoThumbnailPickerProps {
  frames: string[];
  framesLoading: boolean;
  customThumbUri: string | null;
  thumbnail: ThumbnailDraft | null;
  disabled?: boolean;
  colors: ThumbnailPickerColors;
  onSelectFrame: (uri: string, source?: ThumbnailDraft['source']) => void;
  onSelectRatio: (ratioId: ThumbnailRatioId) => void;
  onTransformChange: (transform: UserCropTransform | null) => void;
  onPickCustom: () => void;
}

function RatioGlyph({ ratio, color }: { ratio: number; color: string }) {
  const box = 16;
  const width = ratio >= 1 ? box : Math.round(box * ratio);
  const height = ratio >= 1 ? Math.round(box / ratio) : box;
  return (
    <View style={styles.glyphBox}>
      <View style={[styles.glyph, { width, height, borderColor: color }]} />
    </View>
  );
}

export default function LongVideoThumbnailPicker({
  frames,
  framesLoading,
  customThumbUri,
  thumbnail,
  disabled = false,
  colors,
  onSelectFrame,
  onSelectRatio,
  onTransformChange,
  onPickCustom,
}: LongVideoThumbnailPickerProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setContainerWidth((prev) => (prev === w ? prev : w));
  }, []);

  const ratioId = thumbnail?.ratioId ?? '16:9';
  const ratio = thumbnailRatioValue(ratioId);
  const cropWidth =
    containerWidth > 0 ? Math.round(Math.min(containerWidth, MAX_CROP_HEIGHT * ratio)) : 0;
  const cropHeight = cropWidth > 0 ? Math.round(cropWidth / ratio) : 0;
  const pendingSlots = framesLoading ? Math.max(0, PENDING_FRAME_SLOTS - frames.length) : 0;

  const renderTile = (uri: string, source: ThumbnailDraft['source'], key: string) => {
    const selected = thumbnail?.sourceUri === uri;
    return (
      <Pressable
        key={key}
        onPress={() => onSelectFrame(uri, source)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={source === 'custom' ? 'Use uploaded thumbnail' : 'Use this frame as thumbnail'}
        style={[
          styles.tile,
          { borderColor: selected ? colors.accent : colors.border, borderWidth: selected ? 2 : 1 },
        ]}
      >
        <Image source={{ uri }} style={styles.tileImage} resizeMode="cover" />
        {selected ? (
          <View style={[styles.tileCheck, { backgroundColor: colors.accent }]}>
            <Ionicons name="checkmark" size={11} color="#fff" />
          </View>
        ) : null}
        {source === 'custom' ? (
          <View style={styles.tileTag}>
            <Text style={styles.tileTagText}>Yours</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.text }]}>Thumbnail</Text>
        <Text style={[styles.headerMeta, { color: colors.meta }]}>{ratioId}</Text>
      </View>
      <Text style={[styles.subLabel, { color: colors.meta }]}>
        Pick a frame or upload your own, then choose a ratio and frame it.
      </Text>

      <View onLayout={handleLayout} style={styles.cropArea}>
        {thumbnail && cropWidth > 0 ? (
          <View
            style={[styles.cropClip, { width: cropWidth, height: cropHeight }]}
            pointerEvents={disabled ? 'none' : 'auto'}
          >
            <AspectImageCropper
              uri={thumbnail.sourceUri}
              aspectRatio={ratio}
              viewportWidth={cropWidth}
              initialTransform={thumbnail.transform}
              onTransformChange={onTransformChange}
              showHint={false}
            />
          </View>
        ) : (
          <View
            style={[
              styles.cropPlaceholder,
              { backgroundColor: colors.field, borderColor: colors.border },
            ]}
          >
            {framesLoading ? <ActivityIndicator color={colors.accent} /> : null}
            <Text style={[styles.placeholderText, { color: colors.meta }]}>
              {framesLoading ? 'Generating thumbnails…' : 'Upload an image to use as the thumbnail'}
            </Text>
          </View>
        )}
      </View>
      {thumbnail ? (
        <Text style={[styles.hint, { color: colors.meta }]}>Pinch to zoom · drag to reposition</Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {THUMBNAIL_RATIOS.map((r) => {
          const active = r.id === ratioId;
          return (
            <Pressable
              key={r.id}
              onPress={() => onSelectRatio(r.id)}
              disabled={disabled || !thumbnail}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${r.label} ${r.id}`}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.accent : colors.field,
                  borderColor: active ? colors.accent : colors.border,
                  opacity: thumbnail ? 1 : 0.5,
                },
              ]}
            >
              <RatioGlyph ratio={r.value} color={active ? '#fff' : colors.meta} />
              <View>
                <Text style={[styles.chipRatio, { color: active ? '#fff' : colors.text }]}>{r.id}</Text>
                <Text style={[styles.chipLabel, { color: active ? 'rgba(255,255,255,0.8)' : colors.meta }]}>
                  {r.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tileRow}
      >
        <Pressable
          onPress={onPickCustom}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Upload a custom thumbnail"
          style={[styles.tile, styles.uploadTile, { borderColor: colors.accent, backgroundColor: colors.field }]}
        >
          <Ionicons name="image-outline" size={18} color={colors.accent} />
          <Text style={[styles.uploadText, { color: colors.accent }]}>Upload</Text>
        </Pressable>
        {customThumbUri ? renderTile(customThumbUri, 'custom', 'custom') : null}
        {frames.map((uri, index) => renderTile(uri, 'frame', `frame-${index}`))}
        {Array.from({ length: pendingSlots }).map((_, index) => (
          <View
            key={`pending-${index}`}
            style={[styles.tile, styles.pendingTile, { borderColor: colors.border, backgroundColor: colors.field }]}
          >
            <ActivityIndicator size="small" color={colors.meta} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
  subLabel: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 17,
  },
  cropArea: {
    width: '100%',
    alignItems: 'center',
  },
  cropClip: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#05090F',
  },
  cropPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  placeholderText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  hint: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  chipRow: {
    gap: 8,
    paddingTop: 14,
    paddingBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  chipRatio: {
    fontSize: 13,
    fontWeight: '800',
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  glyphBox: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    borderWidth: 1.5,
    borderRadius: 2,
  },
  tileRow: {
    gap: 8,
    paddingTop: 12,
  },
  tile: {
    height: FRAME_TILE_HEIGHT,
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTag: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tileTagText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  uploadTile: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  uploadText: {
    fontSize: 11,
    fontWeight: '800',
  },
  pendingTile: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
