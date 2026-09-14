import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { uploadLongVideo } from '../services/longVideos';
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

  const clearVideo = useCallback(() => {
    if (uploading) return;
    setVideo(null);
  }, [uploading]);

  const pickVideo = useCallback(async () => {
    if (!creator?.canUpload || uploading) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to pick a video.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
      videoMaxDuration: LONG_VIDEO_MAX_DURATION_SEC,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
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

    setVideo({
      uri: asset.uri,
      name: asset.fileName || `long-video-${Date.now()}.mp4`,
      type: asset.mimeType || 'video/mp4',
      duration: durationSec,
      width: asset.width,
      height: asset.height,
      fileSize,
    });
  }, [creator?.canUpload, uploading]);

  const publish = useCallback(async () => {
    if (!video || uploading || !creator?.canUpload) return;
    setUploading(true);
    setProgress(0);
    try {
      const { post } = await uploadLongVideo(
        {
          videoUri: video.uri,
          videoName: video.name,
          videoType: video.type,
          caption: caption.trim(),
          durationSeconds: video.duration,
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
  }, [video, caption, uploading, creator?.canUpload, router]);

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
    close: () => router.back(),
  };
}
