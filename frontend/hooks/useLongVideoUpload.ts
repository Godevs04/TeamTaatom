import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { uploadLongVideo } from '../services/longVideos';
import { cropImageToRatio, type UserCropTransform } from '../utils/imageOptimization';
import {
  getVideoCreatorStatus,
  type CreatorStatusResponse,
} from '../services/videoCreator';
import { parseError } from '../utils/errorCodes';
import { createLogger } from '../utils/logger';

const logger = createLogger('useLongVideoUpload');

export const LONG_VIDEO_MAX_DURATION_SEC = 60 * 60;
export const LONG_VIDEO_MAX_SIZE_MB = 500;

export type PickedLongVideo = {
  uri: string;
  name: string;
  type: string;
  duration?: number;
  width?: number;
  height?: number;
  fileSize?: number;
};

export type UploadStage = 'select' | 'details' | 'publishing';

export type ThumbnailRatioId = '16:9' | '4:3' | '1:1' | '4:5' | '9:16';

export const THUMBNAIL_RATIOS: { id: ThumbnailRatioId; label: string; value: number }[] = [
  { id: '16:9', label: 'Widescreen', value: 16 / 9 },
  { id: '4:3', label: 'Classic', value: 4 / 3 },
  { id: '1:1', label: 'Square', value: 1 },
  { id: '4:5', label: 'Portrait', value: 4 / 5 },
  { id: '9:16', label: 'Vertical', value: 9 / 16 },
];

export const thumbnailRatioValue = (id: ThumbnailRatioId): number =>
  THUMBNAIL_RATIOS.find((r) => r.id === id)?.value ?? 16 / 9;

export type ThumbnailDraft = {
  sourceUri: string;
  source: 'frame' | 'custom';
  ratioId: ThumbnailRatioId;
  transform: UserCropTransform | null;
};

/** Fractions of the duration to sample auto thumbnails from, like YouTube's suggestions. */
const FRAME_FRACTIONS = [0.05, 0.2, 0.35, 0.5, 0.65, 0.8];
const FALLBACK_FRAME_TIMES_MS = [1000, 3000, 6000, 10000, 15000, 20000];

const defaultRatioFor = (video: Pick<PickedLongVideo, 'width' | 'height'>): ThumbnailRatioId =>
  video.width && video.height && video.height > video.width ? '9:16' : '16:9';

export function formatLongVideoDuration(seconds?: number): string {
  if (seconds == null || Number.isNaN(seconds)) return '';
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function normalizeDuration(raw?: number | null): number | undefined {
  if (typeof raw !== 'number' || raw <= 0) return undefined;
  return raw > 1000 ? Math.round(raw / 1000) : Math.round(raw);
}

export function useLongVideoUpload() {
  const router = useRouter();
  const [caption, setCaption] = useState('');
  const [video, setVideo] = useState<PickedLongVideo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [creator, setCreator] = useState<CreatorStatusResponse | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [frames, setFrames] = useState<string[]>([]);
  const [framesLoading, setFramesLoading] = useState(false);
  const [customThumbUri, setCustomThumbUri] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<ThumbnailDraft | null>(null);
  const frameJobRef = useRef(0);

  const stage: UploadStage = useMemo(() => {
    if (uploading) return 'publishing';
    if (video) return 'details';
    return 'select';
  }, [uploading, video]);

  const canPublish = !!video && !!creator?.canUpload && !uploading;

  const refreshAccess = useCallback(async () => {
    setCheckingAccess(true);
    try {
      const status = await getVideoCreatorStatus();
      setCreator(status);
      if (!status.canUpload) {
        const pending = status.status === 'pending';
        const canApply = status.status === 'none' || status.status === 'rejected';
        Alert.alert(
          'Creator access required',
          pending
            ? 'Your creator request is still pending review.'
            : status.status === 'rejected' && status.rejectionReason
              ? `Rejected: ${status.rejectionReason}`
              : 'Request creator access from the Videos tab first.',
          canApply
            ? [
                { text: 'Apply', onPress: () => router.replace('/request-video-creator' as any) },
                { text: 'Close', style: 'cancel', onPress: () => router.back() },
              ]
            : [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (e: unknown) {
      logger.error('Creator status check failed', e);
      Alert.alert('Unable to verify access', 'Check your connection and try again.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setCheckingAccess(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      refreshAccess();
    }, [refreshAccess])
  );

  const resetThumbnail = useCallback(() => {
    frameJobRef.current += 1;
    setFrames([]);
    setFramesLoading(false);
    setCustomThumbUri(null);
    setThumbnail(null);
  }, []);

  const generateFrames = useCallback(async (picked: PickedLongVideo) => {
    const job = ++frameJobRef.current;
    setFramesLoading(true);
    const times = picked.duration
      ? FRAME_FRACTIONS.map((f) => Math.round(picked.duration! * 1000 * f))
      : FALLBACK_FRAME_TIMES_MS;
    const collected: string[] = [];
    // Sequential: decoding several frames of a long video at once spikes memory.
    for (const time of times) {
      if (frameJobRef.current !== job) return;
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(picked.uri, { time, quality: 0.8 });
        collected.push(uri);
        if (frameJobRef.current !== job) return;
        setFrames([...collected]);
        if (collected.length === 1) {
          setThumbnail((prev) =>
            prev ?? { sourceUri: uri, source: 'frame', ratioId: defaultRatioFor(picked), transform: null }
          );
        }
      } catch (e) {
        logger.debug('Thumbnail frame extraction failed', { time, e });
      }
    }
    if (frameJobRef.current === job) setFramesLoading(false);
  }, []);

  const clearVideo = useCallback(() => {
    if (uploading) return;
    setVideo(null);
    resetThumbnail();
  }, [uploading, resetThumbnail]);

  const selectFrame = useCallback((uri: string, source: ThumbnailDraft['source'] = 'frame') => {
    setThumbnail((prev) => ({
      sourceUri: uri,
      source,
      ratioId: prev?.ratioId ?? '16:9',
      transform: null,
    }));
  }, []);

  const setThumbnailRatio = useCallback((ratioId: ThumbnailRatioId) => {
    setThumbnail((prev) => (prev && prev.ratioId !== ratioId ? { ...prev, ratioId, transform: null } : prev));
  }, []);

  const setThumbnailTransform = useCallback((transform: UserCropTransform | null) => {
    setThumbnail((prev) => (prev ? { ...prev, transform } : prev));
  }, []);

  const pickerOpenRef = useRef(false);

  /** Opens the photo library once at a time; resolves to the picked asset, or null if cancelled. */
  const openLibrary = useCallback(
    async (mediaTypes: ImagePicker.MediaType[], permissionMessage: string) => {
      if (pickerOpenRef.current) return null;
      pickerOpenRef.current = true;
      try {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', permissionMessage);
          return null;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes,
          quality: 1,
          allowsEditing: false,
          // The iOS photo picker's X/Cancel doesn't dismiss it when shown as a page sheet
          presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
        });
        return result.canceled ? null : result.assets?.[0] ?? null;
      } catch (error) {
        logger.error('Media library picker failed', error);
        Alert.alert('Could not open library', 'Please try again.');
        return null;
      } finally {
        pickerOpenRef.current = false;
      }
    },
    []
  );

  const pickCustomThumbnail = useCallback(async () => {
    if (uploading) return;
    const asset = await openLibrary(['images'], 'Allow photo library access to pick a thumbnail.');
    if (!asset) return;
    setCustomThumbUri(asset.uri);
    selectFrame(asset.uri, 'custom');
  }, [uploading, selectFrame, openLibrary]);

  const pickVideo = useCallback(async () => {
    if (!creator?.canUpload || uploading) return;

    const asset = await openLibrary(['videos'], 'Allow photo library access to pick a video.');
    if (!asset) return;
    const durationSec = normalizeDuration(asset.duration);

    if (durationSec != null && durationSec > LONG_VIDEO_MAX_DURATION_SEC) {
      Alert.alert('Too long', 'Videos cannot exceed 60 minutes.');
      return;
    }

    const fileSize = (asset as { fileSize?: number }).fileSize;
    if (typeof fileSize === 'number' && fileSize > LONG_VIDEO_MAX_SIZE_MB * 1024 * 1024) {
      Alert.alert('File too large', `Please choose a video under ${LONG_VIDEO_MAX_SIZE_MB} MB.`);
      return;
    }

    const picked: PickedLongVideo = {
      uri: asset.uri,
      name: asset.fileName || `long-video-${Date.now()}.mp4`,
      type: asset.mimeType || 'video/mp4',
      duration: durationSec,
      width: asset.width,
      height: asset.height,
      fileSize,
    };
    setVideo(picked);
    resetThumbnail();
    generateFrames(picked);
  }, [creator?.canUpload, uploading, resetThumbnail, generateFrames, openLibrary]);

  const publish = useCallback(async () => {
    if (!video || uploading || !creator?.canUpload) return;
    setUploading(true);
    setProgress(0);
    try {
      let thumbnailUri: string | undefined;
      let thumbnailAspectRatio: number | undefined;
      if (thumbnail) {
        const ratio = thumbnailRatioValue(thumbnail.ratioId);
        try {
          thumbnailUri = await cropImageToRatio(thumbnail.sourceUri, ratio, thumbnail.transform ?? undefined);
          thumbnailAspectRatio = ratio;
        } catch (e) {
          // The server extracts a frame itself when no thumbnail is sent.
          logger.warn('Thumbnail crop failed; uploading without a custom thumbnail', e);
        }
      }
      const { post } = await uploadLongVideo(
        {
          videoUri: video.uri,
          videoName: video.name,
          videoType: video.type,
          caption: caption.trim(),
          durationSeconds: video.duration,
          thumbnailUri,
          thumbnailAspectRatio,
        },
        setProgress
      );
      Alert.alert('Uploaded', 'Your video is processing and will appear in Videos.', [
        { text: 'Open', onPress: () => router.replace(`/watch/${post._id}` as any) },
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      logger.error('Upload failed', e);
      const message =
        e instanceof Error ? e.message : parseError(e as any).userMessage || 'Please try again.';
      Alert.alert('Upload failed', message);
    } finally {
      setUploading(false);
    }
  }, [video, caption, thumbnail, uploading, creator?.canUpload, router]);

  return {
    platformOS: Platform.OS,
    caption,
    setCaption,
    video,
    uploading,
    progress,
    creator,
    checkingAccess,
    stage,
    canPublish,
    pickVideo,
    clearVideo,
    publish,
    frames,
    framesLoading,
    customThumbUri,
    thumbnail,
    selectFrame,
    setThumbnailRatio,
    setThumbnailTransform,
    pickCustomThumbnail,
    close: () => router.back(),
  };
}
