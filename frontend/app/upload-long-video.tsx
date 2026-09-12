import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { uploadLongVideo } from '../services/longVideos';
import {
  getVideoCreatorStatus,
  type CreatorStatusResponse,
} from '../services/videoCreator';
import { createLogger } from '../utils/logger';
import { cloudDesign } from '../constants/cloudDesign';
import { parseError } from '../utils/errorCodes';

const logger = createLogger('UploadLongVideo');
const MAX_DURATION_SEC = 60 * 60;
const MAX_SIZE_HINT_MB = 500;

type PickedVideo = {
  uri: string;
  name: string;
  type: string;
  duration?: number;
  width?: number;
  height?: number;
};

function formatDuration(seconds?: number): string {
  if (seconds == null || Number.isNaN(seconds)) return '';
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function UploadLongVideoScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [caption, setCaption] = useState('');
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [creator, setCreator] = useState<CreatorStatusResponse | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const colors = useMemo(
    () => ({
      bg: isDark ? '#0B1220' : '#F4F7FB',
      card: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
      text: isDark ? '#FFFFFF' : '#0F172A',
      meta: isDark ? 'rgba(255,255,255,0.62)' : '#64748B',
      border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)',
      accent: '#1C73B4',
      accentSoft: isDark ? 'rgba(28,115,180,0.22)' : 'rgba(28,115,180,0.10)',
    }),
    [isDark]
  );

  const refreshAccess = useCallback(async () => {
    setCheckingAccess(true);
    try {
      const status = await getVideoCreatorStatus();
      setCreator(status);
      if (!status.canUpload) {
        Alert.alert(
          'Creator access required',
          status.status === 'pending'
            ? 'Your creator request is still pending review.'
            : 'Request creator access from the Videos tab first.',
          [{ text: 'OK', onPress: () => router.back() }]
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
      videoMaxDuration: MAX_DURATION_SEC,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    let durationSec: number | undefined;
    if (typeof asset.duration === 'number' && asset.duration > 0) {
      durationSec =
        asset.duration > 1000 ? Math.round(asset.duration / 1000) : Math.round(asset.duration);
    }

    if (durationSec != null && durationSec > MAX_DURATION_SEC) {
      Alert.alert('Too long', 'Videos cannot exceed 60 minutes.');
      return;
    }

    const fileSize = (asset as { fileSize?: number }).fileSize;
    if (typeof fileSize === 'number' && fileSize > MAX_SIZE_HINT_MB * 1024 * 1024) {
      Alert.alert('File too large', `Please choose a video under ${MAX_SIZE_HINT_MB} MB.`);
      return;
    }

    setVideo({
      uri: asset.uri,
      name: asset.fileName || `long-video-${Date.now()}.mp4`,
      type: asset.mimeType || 'video/mp4',
      duration: durationSec,
      width: asset.width,
      height: asset.height,
    });
  }, [creator?.canUpload, uploading]);

  const onUpload = useCallback(async () => {
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
        {
          text: 'Open',
          onPress: () => router.replace(`/watch/${post._id}`),
        },
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

  if (checkingAccess) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.checkingText, { color: colors.meta }]}>Checking creator access…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close upload"
          >
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Upload long video</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={isDark ? ['#12324A', '#0B1220'] : ['#D7EBFA', '#F4F7FB']}
            style={[styles.hero, { borderColor: colors.border }]}
          >
            <Text style={[styles.heroEyebrow, { color: colors.accent }]}>VIDEOS</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              Share a long-form travel story
            </Text>
            <Text style={[styles.heroBody, { color: colors.meta }]}>
              Up to 60 minutes · {MAX_SIZE_HINT_MB} MB max · ads placed automatically by duration
            </Text>
          </LinearGradient>

          <TouchableOpacity
            style={[
              styles.pickCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                ...cloudDesign.shadowCard,
              },
            ]}
            onPress={pickVideo}
            disabled={uploading || !creator?.canUpload}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Choose long video"
          >
            {video ? (
              <View style={styles.pickedRow}>
                <View style={[styles.thumb, { backgroundColor: colors.accentSoft }]}>
                  {video.uri ? (
                    <Image source={{ uri: video.uri }} style={styles.thumbImage} />
                  ) : (
                    <Ionicons name="videocam" size={28} color={colors.accent} />
                  )}
                  <View style={styles.playBadge}>
                    <Ionicons name="play" size={14} color="#fff" />
                  </View>
                </View>
                <View style={styles.pickedMeta}>
                  <Text style={[styles.pickedName, { color: colors.text }]} numberOfLines={2}>
                    {video.name}
                  </Text>
                  <Text style={{ color: colors.meta, marginTop: 4, fontSize: 13 }}>
                    {[formatDuration(video.duration), video.width && video.height ? `${video.width}×${video.height}` : null]
                      .filter(Boolean)
                      .join(' · ') || 'Ready to upload'}
                  </Text>
                  <Text style={{ color: colors.accent, marginTop: 8, fontWeight: '700', fontSize: 13 }}>
                    Tap to change
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.pickEmpty}>
                <View style={[styles.pickIconWrap, { backgroundColor: colors.accentSoft }]}>
                  <Ionicons name="cloud-upload-outline" size={28} color={colors.accent} />
                </View>
                <Text style={[styles.pickTitle, { color: colors.text }]}>Choose long video</Text>
                <Text style={{ color: colors.meta, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
                  Select a video from your library to publish on Videos
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.label, { color: colors.meta }]}>Caption</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="What should viewers know about this trip?"
            placeholderTextColor={colors.meta}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            multiline
            maxLength={1000}
            editable={!uploading}
          />
          <Text style={[styles.counter, { color: colors.meta }]}>{caption.length}/1000</Text>

          {uploading ? (
            <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.progressHeader}>
                <ActivityIndicator color={colors.accent} />
                <Text style={{ color: colors.text, fontWeight: '700', marginLeft: 10 }}>
                  Uploading {progress}%
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.max(4, progress)}%`, backgroundColor: colors.accent },
                  ]}
                />
              </View>
              <Text style={{ color: colors.meta, marginTop: 8, fontSize: 12 }}>
                Keep the app open until the upload finishes
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.uploadBtn, { opacity: !video || uploading || !creator?.canUpload ? 0.45 : 1 }]}
            onPress={onUpload}
            disabled={!video || uploading || !creator?.canUpload}
            accessibilityRole="button"
            accessibilityLabel="Upload long video"
          >
            <LinearGradient
              colors={['#1C73B4', '#50C878']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.uploadGradient}
            >
              <Ionicons name="arrow-up-circle" size={20} color="#fff" />
              <Text style={styles.uploadText}>{uploading ? 'Uploading…' : 'Publish to Videos'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  checkingText: { fontSize: 14, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40 },
  hero: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
  },
  pickCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
  },
  pickEmpty: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8 },
  pickIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  pickTitle: { fontSize: 16, fontWeight: '700' },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: {
    width: 92,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: '100%', height: '100%' },
  playBadge: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickedMeta: { flex: 1, minWidth: 0 },
  pickedName: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 110,
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 21,
  },
  counter: { alignSelf: 'flex-end', marginTop: 6, fontSize: 12 },
  progressCard: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center' },
  progressTrack: {
    marginTop: 12,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  uploadBtn: { marginTop: 20, borderRadius: 16, overflow: 'hidden' },
  uploadGradient: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  uploadText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
