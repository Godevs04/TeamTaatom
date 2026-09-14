import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import {
  formatLongVideoDuration,
  LONG_VIDEO_MAX_SIZE_MB,
  useLongVideoUpload,
} from '../hooks/useLongVideoUpload';

const STEPS = [
  { id: 'select', label: 'Select' },
  { id: 'details', label: 'Details' },
  { id: 'publishing', label: 'Publish' },
] as const;

function StepRail({
  activeIndex,
  text,
  meta,
  accent,
  track,
}: {
  activeIndex: number;
  text: string;
  meta: string;
  accent: string;
  track: string;
}) {
  return (
    <View style={styles.stepRail}>
      {STEPS.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        const filled = done || active;
        return (
          <View key={step.id} style={styles.stepCol}>
            <View style={styles.stepRow}>
              {index > 0 ? (
                <View
                  style={[
                    styles.stepConnector,
                    styles.stepConnectorLeft,
                    { backgroundColor: index <= activeIndex ? accent : track },
                  ]}
                />
              ) : (
                <View style={styles.stepConnectorSpacer} />
              )}
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: filled ? accent : 'transparent',
                    borderColor: filled ? accent : track,
                  },
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : (
                  <Text style={[styles.stepNum, { color: active ? '#fff' : meta }]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              {index < STEPS.length - 1 ? (
                <View
                  style={[
                    styles.stepConnector,
                    styles.stepConnectorRight,
                    { backgroundColor: index < activeIndex ? accent : track },
                  ]}
                />
              ) : (
                <View style={styles.stepConnectorSpacer} />
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                {
                  color: filled ? text : meta,
                  fontWeight: active ? '700' : '500',
                },
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function UploadLongVideoScreen() {
  const { isDark } = useTheme();
  const {
    caption,
    setCaption,
    video,
    uploading,
    progress,
    checkingAccess,
    stage,
    canPublish,
    pickVideo,
    clearVideo,
    publish,
    close,
  } = useLongVideoUpload();

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (video || uploading) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [video, uploading, pulse]);

  const colors = useMemo(
    () => ({
      text: isDark ? '#F4F8FC' : '#0B1F33',
      meta: isDark ? 'rgba(244,248,252,0.58)' : 'rgba(11,31,51,0.52)',
      border: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(28,115,180,0.14)',
      accent: '#1C73B4',
      accentDeep: '#0E4F7A',
      mint: '#3DBE8B',
      glass: isDark ? 'rgba(12,20,32,0.62)' : 'rgba(255,255,255,0.62)',
      track: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,40,70,0.10)',
      field: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.78)',
      mutedBtn: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,40,70,0.08)',
      mutedBtnText: isDark ? 'rgba(244,248,252,0.55)' : 'rgba(11,31,51,0.45)',
      dash: isDark ? 'rgba(28,115,180,0.45)' : 'rgba(28,115,180,0.35)',
    }),
    [isDark]
  );

  const bgColors = isDark
    ? (['#06101C', '#0B1A2B', '#10283C'] as const)
    : (['#D8E8F6', '#EEF4FA', '#F7FAFC'] as const);

  const activeStep = stage === 'select' ? 0 : stage === 'details' ? 1 : 2;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.65] });

  if (checkingAccess) {
    return (
      <LinearGradient colors={[...bgColors]} style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.checkingText, { color: colors.meta }]}>
              Preparing your studio…
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[...bgColors]} style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.headerShell, { borderColor: colors.border }]}>
            <BlurView
              intensity={isDark ? 40 : 70}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={[styles.header, { backgroundColor: colors.glass }]}>
              <Pressable
                onPress={close}
                hitSlop={12}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Close upload"
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
              <View style={styles.headerCenter}>
                <Text style={[styles.kicker, { color: colors.accent }]}>CREATOR STUDIO</Text>
                <Text style={[styles.title, { color: colors.text }]}>Long video</Text>
              </View>
              <View style={styles.iconBtn} />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.headline, { color: colors.text }]}>
              Frame a journey worth watching
            </Text>
            <Text style={[styles.subhead, { color: colors.meta }]}>
              Share a long-form travel story on Videos
            </Text>

            <View style={styles.specRow}>
              {[`Up to 60 min`, `${LONG_VIDEO_MAX_SIZE_MB} MB max`, 'Ads by duration'].map(
                (label) => (
                  <View
                    key={label}
                    style={[styles.specPill, { backgroundColor: colors.field, borderColor: colors.border }]}
                  >
                    <Text style={[styles.specText, { color: colors.meta }]}>{label}</Text>
                  </View>
                )
              )}
            </View>

            <StepRail
              activeIndex={activeStep}
              text={colors.text}
              meta={colors.meta}
              accent={colors.accent}
              track={colors.track}
            />

            <Pressable
              onPress={pickVideo}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel={video ? 'Change long video' : 'Choose long video'}
              style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}
            >
              <Animated.View
                style={[
                  styles.stage,
                  {
                    borderColor: video ? colors.border : colors.dash,
                    backgroundColor: colors.field,
                    borderStyle: video ? 'solid' : 'dashed',
                    transform: [{ scale: video || uploading ? 1 : scale }],
                  },
                ]}
              >
                {video ? (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: video.uri }} style={styles.previewImage} />
                    <LinearGradient
                      colors={['transparent', 'rgba(5,12,22,0.78)']}
                      style={styles.previewScrim}
                    />
                    <View style={styles.previewMeta}>
                      <View style={styles.previewBadge}>
                        <Ionicons name="play" size={12} color="#fff" />
                        <Text style={styles.previewBadgeText}>
                          {formatLongVideoDuration(video.duration) || 'Ready'}
                        </Text>
                      </View>
                      <Text style={styles.previewName} numberOfLines={1}>
                        {video.name}
                      </Text>
                      <Text style={styles.previewHint}>Tap to replace</Text>
                    </View>
                    {!uploading ? (
                      <Pressable
                        onPress={clearVideo}
                        style={styles.clearBtn}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Remove selected video"
                      >
                        <Ionicons name="trash-outline" size={16} color="#fff" />
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.emptyStage}>
                    <View style={styles.glyphStack}>
                      <Animated.View
                        style={[
                          styles.orbit,
                          { opacity: glow, borderColor: colors.accent },
                        ]}
                      />
                      <View
                        style={[
                          styles.uploadGlyph,
                          {
                            backgroundColor: isDark
                              ? 'rgba(28,115,180,0.28)'
                              : 'rgba(28,115,180,0.12)',
                          },
                        ]}
                      >
                        <Ionicons name="film-outline" size={28} color={colors.accent} />
                      </View>
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      Choose your long video
                    </Text>
                    <Text style={[styles.emptyBody, { color: colors.meta }]}>
                      Pick a polished travel cut from your library
                    </Text>
                    <View style={[styles.ctaChip, { backgroundColor: colors.accent }]}>
                      <Ionicons name="images-outline" size={15} color="#fff" />
                      <Text style={styles.ctaChipText}>Browse library</Text>
                    </View>
                  </View>
                )}
              </Animated.View>
            </Pressable>

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Caption</Text>
              <View
                style={[
                  styles.captionShell,
                  { backgroundColor: colors.field, borderColor: colors.border },
                ]}
              >
                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Destination, season, or the story behind the frame"
                  placeholderTextColor={colors.meta}
                  style={[styles.input, { color: colors.text }]}
                  multiline
                  maxLength={1000}
                  editable={!uploading}
                />
                <Text style={[styles.counter, { color: colors.meta }]}>
                  {caption.length}/1000
                </Text>
              </View>
            </View>

            {uploading ? (
              <View
                style={[
                  styles.progressCard,
                  { backgroundColor: colors.field, borderColor: colors.border },
                ]}
              >
                <View style={styles.progressHeader}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={[styles.progressTitle, { color: colors.text }]}>
                    Uploading {progress}%
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.track }]}>
                  <LinearGradient
                    colors={[colors.accent, colors.mint]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${Math.max(6, progress)}%` }]}
                  />
                </View>
                <Text style={[styles.progressHint, { color: colors.meta }]}>
                  Keep the app open — processing starts after upload
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <SafeAreaView edges={['bottom']} style={[styles.dockSafe, { borderColor: colors.border }]}>
            <BlurView
              intensity={isDark ? 36 : 64}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={[styles.dock, { backgroundColor: colors.glass }]}>
              {canPublish ? (
                <Pressable
                  onPress={publish}
                  accessibilityRole="button"
                  accessibilityLabel="Publish to Videos"
                >
                  <LinearGradient
                    colors={[colors.accentDeep, colors.accent, colors.mint]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.publishBtn}
                  >
                    {uploading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="rocket-outline" size={18} color="#fff" />
                        <Text style={styles.publishText}>Publish to Videos</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              ) : (
                <Pressable
                  onPress={uploading ? undefined : pickVideo}
                  disabled={uploading}
                  accessibilityRole="button"
                  accessibilityLabel="Select a video to continue"
                  style={[styles.publishBtn, styles.publishBtnMuted, { backgroundColor: colors.mutedBtn }]}
                >
                  {uploading ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <>
                      <Ionicons name="videocam-outline" size={18} color={colors.mutedBtnText} />
                      <Text style={[styles.publishText, { color: colors.mutedBtnText }]}>
                        Select a video to continue
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  checkingText: { fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
  headerShell: {
    marginHorizontal: 12,
    marginTop: 4,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  title: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  subhead: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  specRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    marginBottom: 20,
  },
  specPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  specText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stepRail: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  stepCol: {
    flex: 1,
    alignItems: 'center',
  },
  stepRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepConnector: {
    flex: 1,
    height: 2,
    borderRadius: 999,
  },
  stepConnectorLeft: {
    marginRight: 6,
  },
  stepConnectorRight: {
    marginLeft: 6,
  },
  stepConnectorSpacer: {
    flex: 1,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { fontSize: 11, fontWeight: '700' },
  stepLabel: { fontSize: 12, letterSpacing: 0.1 },
  stage: {
    borderRadius: 26,
    borderWidth: 1.5,
    overflow: 'hidden',
    minHeight: 228,
  },
  emptyStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 38,
    paddingHorizontal: 24,
  },
  glyphStack: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  orbit: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
  },
  uploadGlyph: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 250,
  },
  ctaChip: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ctaChipText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  previewWrap: {
    height: 240,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  previewMeta: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  previewBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  previewBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  previewName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  previewHint: {
    color: 'rgba(255,255,255,0.72)',
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  clearBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginTop: 22 },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  captionShell: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    minHeight: 124,
  },
  input: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 84,
    textAlignVertical: 'top',
    paddingBottom: 4,
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  progressCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTitle: { fontSize: 15, fontWeight: '800' },
  progressTrack: {
    marginTop: 12,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
  progressHint: { marginTop: 10, fontSize: 12, lineHeight: 17 },
  dockSafe: {
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  dock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  publishBtn: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  publishBtnMuted: {
    borderWidth: 0,
  },
  publishText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
