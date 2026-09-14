import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  Dimensions,
  Image,
  Modal,
  StatusBar,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenOrientation from 'expo-screen-orientation';
import Video from 'react-native-video';
import LoadingGlobe from '../../components/LoadingGlobe';
import { useTheme } from '../../context/ThemeContext';
import { getLongVideo } from '../../services/longVideos';
import { toggleLike } from '../../services/posts';
import { trackPostView } from '../../services/analytics';
import PostComments from '../../components/post/PostComments';
import ShareModal from '../../components/ShareModal';
import { savedEvents, normalizeId } from '../../utils/savedEvents';
import { createLogger } from '../../utils/logger';
import { PostType } from '../../types/post';
import { buildLongVideoAdSchedule } from '../../utils/longVideoAdSchedule';
import { showLongVideoAdSlot } from '../../services/longVideoAds';

const logger = createLogger('WatchDetail');
const { width: screenWidth } = Dimensions.get('window');
const PLAYER_HEIGHT = Math.round(((screenWidth - 32) * 9) / 16);
const AD_SLOT_TIMEOUT_MS = 4500;

async function runAdSlot(slot: Parameters<typeof showLongVideoAdSlot>[0]) {
  try {
    await Promise.race([
      showLongVideoAdSlot(slot),
      new Promise<'skipped'>((resolve) =>
        setTimeout(() => resolve('skipped'), AD_SLOT_TIMEOUT_MS)
      ),
    ]);
  } catch (e) {
    logger.warn('Ad slot failed', e);
  }
}

function formatDuration(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(Number(seconds))) return '';
  const s = Math.max(0, Math.floor(Number(seconds)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function formatCommentTime(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function isLandscapeOrientation(ori: ScreenOrientation.Orientation): boolean {
  return (
    ori === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
    ori === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
  );
}

export default function WatchDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { mode, isDark } = useTheme();
  const dark = isDark || mode === 'dark';

  const [post, setPost] = useState<PostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [paused, setPaused] = useState(true);
  const [adBusy, setAdBusy] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [rotateFallback, setRotateFallback] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playerEpoch, setPlayerEpoch] = useState(0);
  const [scrubPreview, setScrubPreview] = useState<number | null>(null);
  const [windowSize, setWindowSize] = useState(() => Dimensions.get('window'));
  const firedSlotsRef = useRef<Set<number>>(new Set());
  const prerollDoneRef = useRef(false);
  const resumeAtRef = useRef(0);
  const videoRef = useRef<any>(null);
  const fsVideoRef = useRef<any>(null);
  const chromeHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrubbingRef = useRef(false);
  const trackWidthRef = useRef(0);
  const totalDurationRef = useRef(0);
  const isFullscreenRef = useRef(false);
  const enteringFsSeekDoneRef = useRef(false);

  const fetchVideo = useCallback(async (isRefresh = false) => {
    try {
      if (!id) return;
      const { post: data } = await getLongVideo(id as string);
      if (savedEvents.isDeleted(data._id)) {
        router.back();
        return;
      }
      let next = data;
      if (!isRefresh) {
        const localLikes = savedEvents.getLikesState(data._id);
        if (localLikes) {
          next = { ...next, isLiked: localLikes.isLiked, likesCount: localLikes.likesCount };
        }
        const localComments = savedEvents.getCommentsCount(data._id);
        if (localComments !== undefined) {
          next = { ...next, commentsCount: localComments };
        }
      } else {
        savedEvents.setLikesState(data._id, data.isLiked || false, data.likesCount || 0);
        savedEvents.setCommentsCount(data._id, data.commentsCount || 0);
      }
      setPost(next);
      if (Array.isArray(next.comments)) {
        setComments(next.comments);
        // Prefer server comments length when present so Conversation never looks empty
        // while the action bar shows a non-zero count.
        if (next.comments.length > 0 && (next.commentsCount || 0) < next.comments.length) {
          setPost((p) => (p ? { ...p, commentsCount: next.comments.length } : p));
        }
      } else {
        setComments([]);
      }
      setPlaybackError(null);
      if (isRefresh) {
        firedSlotsRef.current = new Set();
        prerollDoneRef.current = true;
        setPaused(false);
        setChromeVisible(true);
        setPlayerEpoch((n) => n + 1);
      }
    } catch (error) {
      logger.error('Failed to fetch video:', error);
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  const schedule = useMemo(() => {
    const fromApi = (post as any)?.adSchedule?.slots;
    if (Array.isArray(fromApi) && fromApi.length) return fromApi;
    return buildLongVideoAdSchedule(post?.durationSeconds || 0).slots;
  }, [post]);

  const bumpChrome = useCallback(() => {
    setChromeVisible(true);
    if (chromeHideTimer.current) clearTimeout(chromeHideTimer.current);
    chromeHideTimer.current = setTimeout(() => {
      if (!paused) setChromeVisible(false);
    }, 2800);
  }, [paused]);

  const runPreroll = useCallback(async () => {
    if (prerollDoneRef.current) return;
    const pre = schedule.find((s) => s.atSeconds === 0);
    if (!pre) {
      prerollDoneRef.current = true;
      setPaused(false);
      bumpChrome();
      return;
    }
    setAdBusy(true);
    setPaused(true);
    await runAdSlot(pre);
    firedSlotsRef.current.add(0);
    prerollDoneRef.current = true;
    setAdBusy(false);
    setPaused(false);
    bumpChrome();
  }, [schedule, bumpChrome]);

  useEffect(() => {
    if (post && !prerollDoneRef.current) {
      runPreroll();
    }
  }, [post?._id, runPreroll]);

  useEffect(() => {
    return () => {
      if (chromeHideTimer.current) clearTimeout(chromeHideTimer.current);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    const unsub = savedEvents.addPostActionListener((likedPostId, action, data) => {
      if (normalizeId(likedPostId) !== normalizeId(id)) return;
      if (action === 'like' || action === 'unlike') {
        setPost((prev) =>
          prev
            ? { ...prev, isLiked: action === 'like', likesCount: data?.likesCount ?? prev.likesCount }
            : null
        );
      } else if (action === 'comment' && typeof data?.commentsCount === 'number') {
        setPost((prev) => (prev ? { ...prev, commentsCount: data.commentsCount } : null));
      } else if (action === 'delete') {
        router.back();
      }
    });
    return () => unsub();
  }, [id, router]);

  useEffect(() => {
    if (!post?._id) return;
    const timer = setTimeout(() => {
      trackPostView(post._id, { type: 'long_video', source: 'watch_detail' });
    }, 2000);
    return () => clearTimeout(timer);
  }, [post?._id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchVideo(true);
    setRefreshing(false);
  }, [fetchVideo]);

  const handleLike = useCallback(async () => {
    if (!post || liking) return;
    const prevLiked = !!post.isLiked;
    const prevCount = post.likesCount || 0;
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));
    setLiking(true);
    setPost({ ...post, isLiked: nextLiked, likesCount: nextCount });
    savedEvents.setLikesState(post._id, nextLiked, nextCount);
    savedEvents.emitPostAction(post._id, nextLiked ? 'like' : 'unlike', { likesCount: nextCount });
    try {
      const res = await toggleLike(post._id);
      const serverLiked = res?.isLiked ?? nextLiked;
      const serverCount = res?.likesCount ?? nextCount;
      setPost((p) => (p ? { ...p, isLiked: serverLiked, likesCount: serverCount } : null));
      savedEvents.setLikesState(post._id, serverLiked, serverCount);
    } catch (e) {
      setPost((p) => (p ? { ...p, isLiked: prevLiked, likesCount: prevCount } : null));
      savedEvents.setLikesState(post._id, prevLiked, prevCount);
      logger.error('Like failed', e);
    } finally {
      setLiking(false);
    }
  }, [post, liking]);

  const maybeFireMidroll = useCallback(
    async (t: number) => {
      if (adBusy || !prerollDoneRef.current) return;
      for (let i = 0; i < schedule.length; i++) {
        const slot = schedule[i];
        if (slot.atSeconds === 0 || slot.atSeconds === 'end') continue;
        if (typeof slot.atSeconds !== 'number') continue;
        if (firedSlotsRef.current.has(i)) continue;
        if (t >= slot.atSeconds) {
          firedSlotsRef.current.add(i);
          resumeAtRef.current = t;
          setAdBusy(true);
          setPaused(true);
          await runAdSlot(slot);
          setAdBusy(false);
          setPaused(false);
          bumpChrome();
          try {
            const target = isFullscreen ? fsVideoRef.current : videoRef.current;
            target?.seek?.(resumeAtRef.current);
          } catch {
            /* ignore */
          }
          break;
        }
      }
    },
    [schedule, adBusy, isFullscreen, bumpChrome]
  );

  const onEnd = useCallback(async () => {
    const endIdx = schedule.findIndex((s) => s.atSeconds === 'end');
    if (endIdx >= 0 && !firedSlotsRef.current.has(endIdx)) {
      firedSlotsRef.current.add(endIdx);
      setAdBusy(true);
      setPaused(true);
      await runAdSlot(schedule[endIdx]);
      setAdBusy(false);
    }
    setPaused(true);
    setChromeVisible(true);
  }, [schedule]);

  const enterLandscape = useCallback(async () => {
    const uri = post?.videoUrl || post?.mediaUrl || '';
    if (adBusy || !uri) return;
    resumeAtRef.current = currentTime;
    enteringFsSeekDoneRef.current = false;
    isFullscreenRef.current = true;
    setIsFullscreen(true);
    setPaused(false);
    setChromeVisible(true);
    setRotateFallback(false);
    try {
      await ScreenOrientation.unlockAsync();
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      // Wait for the OS rotation — only use CSS rotate if still stuck in portrait.
      setTimeout(async () => {
        try {
          const ori = await ScreenOrientation.getOrientationAsync();
          if (isLandscapeOrientation(ori)) {
            setRotateFallback(false);
            return;
          }
        } catch {
          /* fall through */
        }
        const { width, height } = Dimensions.get('window');
        if (height > width + 24) setRotateFallback(true);
      }, 700);
    } catch (e) {
      logger.warn('Landscape orientation lock failed — using rotate fallback', e);
      setRotateFallback(true);
    }
  }, [adBusy, currentTime, post?.videoUrl, post?.mediaUrl]);

  const exitLandscape = useCallback(async () => {
    isFullscreenRef.current = false;
    setRotateFallback(false);
    setChromeVisible(true);
    // Lock portrait BEFORE dismissing the Modal. Dismissing a landscape-only
    // Modal while the app Info.plist is portrait-only throws RCTFabricModalHostViewController.
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch (e) {
      logger.warn('Portrait orientation lock failed', e);
    }
    setIsFullscreen(false);
    requestAnimationFrame(() => {
      try {
        videoRef.current?.seek?.(resumeAtRef.current || currentTime);
      } catch {
        /* ignore */
      }
    });
  }, [currentTime]);

  // Seek fullscreen player ONCE when entering — never re-run on currentTime
  // (that caused the boomerang / stuck-second loop).
  useEffect(() => {
    if (!isFullscreen) {
      enteringFsSeekDoneRef.current = false;
      return;
    }
    const t = resumeAtRef.current;
    const timer = setTimeout(() => {
      if (enteringFsSeekDoneRef.current) return;
      enteringFsSeekDoneRef.current = true;
      try {
        fsVideoRef.current?.seek?.(t);
        setPaused(false);
      } catch {
        /* ignore */
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWindowSize(window);
      if (isFullscreenRef.current && window.width > window.height) {
        setRotateFallback(false);
      }
    });
    return () => sub.remove();
  }, []);

  const seekActivePlayer = useCallback((seconds: number) => {
    const capped = Math.max(0, seconds);
    resumeAtRef.current = capped;
    setCurrentTime(capped);
    try {
      const target = isFullscreenRef.current ? fsVideoRef.current : videoRef.current;
      target?.seek?.(capped);
    } catch {
      /* ignore */
    }
  }, []);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidthRef.current = e.nativeEvent.layout.width;
  }, []);

  const scrubFromX = useCallback((locationX: number) => {
    const w = trackWidthRef.current;
    const dur = totalDurationRef.current;
    if (!w || !dur) return 0;
    const ratio = Math.max(0, Math.min(1, locationX / w));
    return ratio * dur;
  }, []);

  const scrubPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          scrubbingRef.current = true;
          bumpChrome();
          const t = scrubFromX(evt.nativeEvent.locationX);
          setScrubPreview(t);
        },
        onPanResponderMove: (evt) => {
          const t = scrubFromX(evt.nativeEvent.locationX);
          setScrubPreview(t);
        },
        onPanResponderRelease: (evt) => {
          const t = scrubFromX(evt.nativeEvent.locationX);
          seekActivePlayer(t);
          scrubbingRef.current = false;
          setScrubPreview(null);
          bumpChrome();
        },
        onPanResponderTerminate: () => {
          scrubbingRef.current = false;
          setScrubPreview(null);
        },
      }),
    [bumpChrome, scrubFromX, seekActivePlayer]
  );

  const togglePlay = useCallback(() => {
    if (adBusy) return;
    setPaused((p) => {
      const next = !p;
      if (!next) bumpChrome();
      else setChromeVisible(true);
      return next;
    });
  }, [adBusy, bumpChrome]);

  const onPlayerPress = useCallback(() => {
    if (scrubbingRef.current) return;
    if (!chromeVisible) {
      bumpChrome();
      return;
    }
    togglePlay();
  }, [chromeVisible, bumpChrome, togglePlay]);

  const colors = useMemo(
    () => ({
      text: dark ? '#F4F8FC' : '#0B1F33',
      meta: dark ? 'rgba(244,248,252,0.58)' : 'rgba(11,31,51,0.55)',
      border: dark ? 'rgba(255,255,255,0.14)' : 'rgba(28,115,180,0.14)',
      accent: '#1C73B4',
      glass: dark ? 'rgba(12,20,32,0.55)' : 'rgba(255,255,255,0.62)',
      field: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.78)',
      actionBg: dark ? 'rgba(255,255,255,0.08)' : 'rgba(28,115,180,0.08)',
      heart: '#E11D48',
    }),
    [dark]
  );

  const bgColors = dark
    ? (['#06101C', '#0B1A2B', '#10283C'] as const)
    : (['#D8E8F6', '#EEF4FA', '#F7FAFC'] as const);

  const sharePost = useMemo(() => {
    if (!post) return undefined;
    return {
      _id: post._id,
      caption: post.caption,
      imageUrl: post.thumbnailUrl || post.imageUrl,
      mediaUrl: post.thumbnailUrl || post.imageUrl,
      user: post.user ? { fullName: post.user.fullName } : undefined,
    };
  }, [post]);

  const videoUri = post?.videoUrl || post?.mediaUrl || '';
  const isHlsSource =
    typeof videoUri === 'string' &&
    (videoUri.includes('hls=master') ||
      videoUri.includes('.m3u8') ||
      /ext=\.m3u8/i.test(videoUri));
  const videoSource = videoUri
    ? isHlsSource
      ? { uri: videoUri, type: 'm3u8' as const }
      : { uri: videoUri }
    : null;
  const previewComments = useMemo(() => comments.slice(-3).reverse(), [comments]);
  const totalDuration = duration || Number(post?.durationSeconds) || 0;
  totalDurationRef.current = totalDuration;
  const displayTime = scrubPreview != null ? scrubPreview : currentTime;
  const progressPct = useMemo(() => {
    if (!totalDuration || displayTime <= 0) return 0;
    return Math.min(100, (displayTime / totalDuration) * 100);
  }, [displayTime, totalDuration]);

  const renderPlayerChrome = (opts: { fullscreen?: boolean }) => {
    if (adBusy || !chromeVisible) return null;
    return (
      <View pointerEvents="box-none" style={opts.fullscreen ? styles.fsChromeWrap : styles.chromeWrap}>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.82)']}
          locations={[0, 0.45, 1]}
          style={styles.chromeGradient}
        >
          <View style={styles.chromeRow}>
            <Pressable
              onPress={togglePlay}
              style={styles.chromePlay}
              accessibilityRole="button"
              accessibilityLabel={paused ? 'Play' : 'Pause'}
              hitSlop={8}
            >
              <Ionicons
                name={paused ? 'play' : 'pause'}
                size={18}
                color="#fff"
                style={paused ? { marginLeft: 2 } : undefined}
              />
            </Pressable>

            <Text style={styles.chromeTime}>
              {formatDuration(Math.floor(displayTime)) || '0:00'}
              {formatDuration(totalDuration) ? ` / ${formatDuration(totalDuration)}` : ''}
            </Text>

            <View
              style={styles.chromeTrackHit}
              onLayout={onTrackLayout}
              {...scrubPanResponder.panHandlers}
              accessibilityRole="adjustable"
              accessibilityLabel="Seek video"
            >
              <View style={styles.chromeTrack}>
                <View style={[styles.chromeFill, { width: `${Math.max(1.5, progressPct || 0)}%` }]} />
              </View>
              <View
                pointerEvents="none"
                style={[
                  styles.chromeThumb,
                  { left: `${Math.max(0, Math.min(100, progressPct || 0))}%` },
                ]}
              />
            </View>

            <Pressable
              onPress={opts.fullscreen ? exitLandscape : enterLandscape}
              style={styles.chromeFs}
              accessibilityRole="button"
              accessibilityLabel={opts.fullscreen ? 'Exit landscape' : 'Watch in landscape'}
              hitSlop={8}
            >
              <Ionicons
                name={opts.fullscreen ? 'contract-outline' : 'resize-outline'}
                size={18}
                color="#fff"
              />
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    );
  };

  if (loading || !post) {
    return (
      <LinearGradient colors={[...bgColors]} style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          <View style={styles.loading}>
            <LoadingGlobe size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.meta }]}>Opening video…</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[...bgColors]} style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={[styles.headerShell, { borderColor: colors.border }]}>
          <BlurView
            intensity={dark ? 40 : 70}
            tint={dark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.header, { backgroundColor: colors.glass }]}>
            <Pressable
              onPress={() => router.back()}
              style={styles.iconBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={[styles.kicker, { color: colors.accent }]}>VIDEOS</Text>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                Now playing
              </Text>
            </View>
            <Pressable
              onPress={() => setShowShare(true)}
              style={styles.iconBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Share video"
            >
              <Ionicons name="share-outline" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        >
          <View
            style={[
              styles.playerCard,
              {
                borderColor: colors.border,
                backgroundColor: '#05080C',
                height: PLAYER_HEIGHT,
              },
            ]}
          >
            {videoUri && videoSource && !isFullscreen ? (
              <View style={styles.videoHit}>
                <Video
                  key={`inline-${playerEpoch}`}
                  ref={videoRef}
                  source={videoSource!}
                  style={styles.video}
                  resizeMode="contain"
                  paused={paused || adBusy || !!playbackError}
                  controls={false}
                  repeat={false}
                  playInBackground={false}
                  playWhenInactive={false}
                  ignoreSilentSwitch="ignore"
                  poster={post.thumbnailUrl || post.imageUrl}
                  onLoad={(meta) => {
                    if (meta?.duration) setDuration(meta.duration);
                    setPlaybackError(null);
                    if (resumeAtRef.current > 0.25) {
                      try {
                        videoRef.current?.seek?.(resumeAtRef.current);
                      } catch {
                        /* ignore */
                      }
                    }
                    if (prerollDoneRef.current && !adBusy) {
                      setPaused(false);
                      bumpChrome();
                    }
                  }}
                  onReadyForDisplay={() => {
                    if (prerollDoneRef.current && !adBusy) setPaused(false);
                  }}
                  progressUpdateInterval={250}
                  onProgress={(p) => {
                    if (scrubbingRef.current) return;
                    setCurrentTime(p.currentTime);
                    resumeAtRef.current = p.currentTime;
                    maybeFireMidroll(p.currentTime);
                  }}
                  onEnd={onEnd}
                  onError={(e) => {
                    const code = (e as any)?.error?.error?.code ?? (e as any)?.error?.code;
                    logger.warn('Inline video error', {
                      code,
                      uriPrefix: String(videoUri).slice(0, 80),
                    });
                    setPlaybackError(
                      code === -1008
                        ? 'Couldn’t load this stream. Tap retry.'
                        : 'Couldn’t play this video. Tap retry.'
                    );
                    setPaused(true);
                    setChromeVisible(true);
                  }}
                />
                <Pressable style={StyleSheet.absoluteFillObject} onPress={onPlayerPress} />
              </View>
            ) : !videoUri ? (
              <View style={styles.missing}>
                <Ionicons name="videocam-off-outline" size={28} color="rgba(255,255,255,0.55)" />
                <Text style={styles.missingText}>Video unavailable</Text>
              </View>
            ) : (
              <View style={styles.missing}>
                <Text style={styles.missingText}>Playing in landscape…</Text>
              </View>
            )}
            {playbackError && !adBusy ? (
              <View style={styles.adOverlay}>
                <Text style={styles.adText}>{playbackError}</Text>
                <Pressable
                  onPress={() => {
                    setRefreshing(true);
                    fetchVideo(true).finally(() => setRefreshing(false));
                  }}
                  style={styles.retryBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Retry playback"
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
            {adBusy ? (
              <View style={styles.adOverlay}>
                <Text style={styles.adText}>Advertisement…</Text>
              </View>
            ) : null}
            {renderPlayerChrome({ fullscreen: false })}
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {post.caption || 'Untitled journey'}
          </Text>

          <View style={[styles.creatorRow, { backgroundColor: colors.field, borderColor: colors.border }]}>
            {post.user?.profilePic ? (
              <Image source={{ uri: post.user.profilePic }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.actionBg }]}>
                <Ionicons name="person" size={16} color={colors.accent} />
              </View>
            )}
            <View style={styles.creatorMeta}>
              <Text style={[styles.creatorName, { color: colors.text }]} numberOfLines={1}>
                {post.user?.fullName || 'Creator'}
              </Text>
              <Text style={[styles.creatorSub, { color: colors.meta }]} numberOfLines={1}>
                Long-form on Videos
                {formatDuration(post.durationSeconds)
                  ? ` · ${formatDuration(post.durationSeconds)}`
                  : ''}
              </Text>
            </View>
          </View>

          <View style={[styles.actionsBar, { backgroundColor: colors.field, borderColor: colors.border }]}>
            <Pressable
              style={styles.actionItem}
              onPress={handleLike}
              disabled={liking}
              accessibilityRole="button"
              accessibilityLabel="Like"
            >
              <View
                style={[
                  styles.actionGlyph,
                  {
                    backgroundColor: post.isLiked ? 'rgba(225,29,72,0.12)' : colors.actionBg,
                  },
                ]}
              >
                <Ionicons
                  name={post.isLiked ? 'heart' : 'heart-outline'}
                  size={18}
                  color={post.isLiked ? colors.heart : colors.accent}
                />
              </View>
              <Text style={[styles.actionValue, { color: colors.text }]}>{post.likesCount || 0}</Text>
              <Text style={[styles.actionHint, { color: colors.meta }]}>Likes</Text>
            </Pressable>

            <Pressable
              style={styles.actionItem}
              onPress={() => setShowComments(true)}
              disabled={!!post.commentsDisabled}
              accessibilityRole="button"
              accessibilityLabel="Comments"
            >
              <View style={[styles.actionGlyph, { backgroundColor: colors.actionBg }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.accent} />
              </View>
              <Text style={[styles.actionValue, { color: colors.text }]}>
                {post.commentsCount || 0}
              </Text>
              <Text style={[styles.actionHint, { color: colors.meta }]}>Comments</Text>
            </Pressable>

            <Pressable
              style={styles.actionItem}
              onPress={() => setShowShare(true)}
              accessibilityRole="button"
              accessibilityLabel="Share"
            >
              <View style={[styles.actionGlyph, { backgroundColor: colors.actionBg }]}>
                <Ionicons name="paper-plane-outline" size={17} color={colors.accent} />
              </View>
              <Text style={[styles.actionValue, { color: colors.text }]}>Share</Text>
              <Text style={[styles.actionHint, { color: colors.meta }]}>Send</Text>
            </Pressable>
          </View>

          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Conversation</Text>
            {!post.commentsDisabled ? (
              <Pressable onPress={() => setShowComments(true)} hitSlop={8}>
                <Text style={[styles.sectionLink, { color: colors.accent }]}>Open all</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.commentsCard, { backgroundColor: colors.field, borderColor: colors.border }]}>
            {post.commentsDisabled ? (
              <View style={styles.emptyComments}>
                <Ionicons name="lock-closed-outline" size={22} color={colors.meta} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Comments closed</Text>
                <Text style={[styles.emptyBody, { color: colors.meta }]}>
                  The creator disabled comments on this video.
                </Text>
              </View>
            ) : previewComments.length === 0 ? (
              <Pressable style={styles.emptyComments} onPress={() => setShowComments(true)}>
                <Ionicons name="chatbubbles-outline" size={26} color={colors.accent} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Start the conversation</Text>
                <Text style={[styles.emptyBody, { color: colors.meta }]}>
                  Be the first to leave a note on this journey.
                </Text>
                <View style={[styles.replyChip, { backgroundColor: colors.accent }]}>
                  <Text style={styles.replyChipText}>Add a comment</Text>
                </View>
              </Pressable>
            ) : (
              <>
                {previewComments.map((item) => {
                  const user = item.user || {};
                  return (
                    <View key={item._id} style={styles.commentRow}>
                      {user.profilePic ? (
                        <Image source={{ uri: user.profilePic }} style={styles.commentAvatar} />
                      ) : (
                        <View
                          style={[
                            styles.commentAvatar,
                            styles.avatarFallback,
                            { backgroundColor: colors.actionBg },
                          ]}
                        >
                          <Ionicons name="person" size={12} color={colors.accent} />
                        </View>
                      )}
                      <View style={styles.commentBody}>
                        <View style={styles.commentTop}>
                          <Text style={[styles.commentName, { color: colors.text }]} numberOfLines={1}>
                            {user.fullName || 'Traveler'}
                          </Text>
                          <Text style={[styles.commentTime, { color: colors.meta }]}>
                            {formatCommentTime(item.createdAt)}
                          </Text>
                        </View>
                        <Text style={[styles.commentText, { color: colors.text }]} numberOfLines={3}>
                          {item.text}
                        </Text>
                      </View>
                    </View>
                  );
                })}
                <Pressable
                  style={[styles.viewAllBtn, { borderColor: colors.border }]}
                  onPress={() => setShowComments(true)}
                >
                  <Text style={[styles.viewAllText, { color: colors.accent }]}>
                    View all {(post.commentsCount || comments.length) as number} comments
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.accent} />
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <PostComments
        visible={showComments}
        onClose={() => setShowComments(false)}
        postId={post._id}
        comments={comments}
        commentsDisabled={!!post.commentsDisabled}
        onCommentAdded={(newComment, meta) => {
          setComments((prev) => {
            let next = prev;
            if (meta?.replaceId) {
              const replaced = prev.map((c) => (c._id === meta.replaceId ? newComment : c));
              next = replaced.some((c) => c._id === newComment._id)
                ? replaced
                : [...prev.filter((c) => c._id !== meta.replaceId), newComment];
            } else {
              const exists = prev.some((c) => c._id === newComment._id);
              next = exists
                ? prev.map((c) => (c._id === newComment._id ? newComment : c))
                : [...prev, newComment];
            }
            if (!String(newComment._id).startsWith('temp-')) {
              next = next.filter(
                (c) =>
                  !(
                    String(c._id).startsWith('temp-') &&
                    c.text === newComment.text &&
                    c.user?._id === newComment.user?._id
                  )
              );
            }
            const count = next.length;
            setPost((p) => (p ? { ...p, commentsCount: count } : null));
            savedEvents.setCommentsCount(post._id, count);
            savedEvents.emitPostAction(post._id, 'comment', { commentsCount: count });
            return next;
          });
        }}
        onCommentDeleted={(commentId) => {
          setComments((prev) => {
            const next = prev.filter((c) => c._id !== commentId);
            setPost((p) => (p ? { ...p, commentsCount: next.length } : null));
            savedEvents.setCommentsCount(post._id, next.length);
            savedEvents.emitPostAction(post._id, 'comment', { commentsCount: next.length });
            return next;
          });
        }}
      />

      <ShareModal visible={showShare} onClose={() => setShowShare(false)} post={sharePost} />

      <Modal
        visible={isFullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        supportedOrientations={[
          'portrait',
          'landscape',
          'landscape-left',
          'landscape-right',
        ]}
        onRequestClose={exitLandscape}
      >
        <StatusBar hidden />
        <View style={styles.fsRoot}>
          <View
            style={
              rotateFallback
                ? [
                    styles.fsRotateBox,
                    {
                      width: Math.max(windowSize.width, windowSize.height),
                      height: Math.min(windowSize.width, windowSize.height),
                    },
                  ]
                : styles.fsFill
            }
          >
            {videoUri ? (
              <View style={styles.fsVideoHit}>
                <Video
                  key={`fs-${playerEpoch}`}
                  ref={fsVideoRef}
                  source={videoSource!}
                  style={styles.fsVideo}
                  resizeMode="contain"
                  paused={paused || adBusy || !!playbackError}
                  controls={false}
                  repeat={false}
                  ignoreSilentSwitch="ignore"
                  progressUpdateInterval={250}
                  onLoad={(meta) => {
                    if (meta?.duration) setDuration(meta.duration);
                    const t = resumeAtRef.current || 0;
                    try {
                      fsVideoRef.current?.seek?.(t);
                      enteringFsSeekDoneRef.current = true;
                    } catch {
                      /* ignore */
                    }
                    setPlaybackError(null);
                    setPaused(false);
                    bumpChrome();
                  }}
                  onProgress={(p) => {
                    if (scrubbingRef.current) return;
                    setCurrentTime(p.currentTime);
                    resumeAtRef.current = p.currentTime;
                    maybeFireMidroll(p.currentTime);
                  }}
                  onEnd={() => {
                    onEnd();
                    exitLandscape();
                  }}
                  onError={(e) => {
                    const code = (e as any)?.error?.error?.code ?? (e as any)?.error?.code;
                    logger.warn('Fullscreen video error', { code });
                    setPlaybackError('Couldn’t play this video. Tap retry.');
                    setPaused(true);
                    setChromeVisible(true);
                  }}
                />
                <Pressable style={StyleSheet.absoluteFillObject} onPress={onPlayerPress} />
              </View>
            ) : null}

            {adBusy ? (
              <View style={styles.adOverlay}>
                <Text style={styles.adText}>Advertisement…</Text>
              </View>
            ) : null}

            <SafeAreaView style={styles.fsTopSafe} edges={['top', 'left', 'right']}>
              <View style={styles.fsTopBar}>
                <Pressable
                  onPress={exitLandscape}
                  style={styles.fsIconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Exit landscape"
                >
                  <Ionicons name="chevron-back" size={22} color="#fff" />
                </Pressable>
                <Text style={styles.fsTitle} numberOfLines={1}>
                  {post.caption || 'Videos'}
                </Text>
                <View style={{ width: 42 }} />
              </View>
            </SafeAreaView>

            {renderPlayerChrome({ fullscreen: true })}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '600' },
  headerShell: {
    marginHorizontal: 14,
    marginTop: 6,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
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
    letterSpacing: 1.5,
  },
  headerTitle: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },
  playerCard: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  videoHit: { width: '100%', height: '100%' },
  video: { width: '100%', height: '100%' },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  missingText: { color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: '600' },
  adOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  adText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center', paddingHorizontal: 24 },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  chromeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
  },
  fsChromeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    paddingBottom: 10,
  },
  chromeGradient: {
    paddingHorizontal: 12,
    paddingTop: 28,
    paddingBottom: 12,
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chromePlay: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chromeTime: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '700',
    minWidth: 72,
  },
  chromeTrackHit: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
    position: 'relative',
  },
  chromeTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  chromeFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#5EC8A0',
  },
  chromeThumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -7,
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#5EC8A0',
  },
  chromeFs: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsRoot: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsFill: {
    ...StyleSheet.absoluteFillObject,
  },
  fsRotateBox: {
    backgroundColor: '#000',
    transform: [{ rotate: '90deg' }],
    overflow: 'hidden',
  },
  fsVideoHit: {
    ...StyleSheet.absoluteFillObject,
  },
  fsVideo: {
    width: '100%',
    height: '100%',
  },
  fsTopSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  fsTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 10,
  },
  fsIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  creatorRow: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  creatorMeta: { flex: 1, minWidth: 0 },
  creatorName: { fontSize: 15, fontWeight: '800' },
  creatorSub: { marginTop: 2, fontSize: 12, fontWeight: '600' },
  actionsBar: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    flexDirection: 'row',
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  actionGlyph: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionValue: { fontSize: 14, fontWeight: '800' },
  actionHint: { fontSize: 11, fontWeight: '600' },
  sectionHead: {
    marginTop: 22,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  sectionLink: { fontSize: 13, fontWeight: '700' },
  commentsCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 12,
    gap: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 260,
  },
  replyChip: {
    marginTop: 10,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  replyChipText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentBody: { flex: 1, minWidth: 0 },
  commentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 3,
  },
  commentName: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  commentTime: { fontSize: 11, fontWeight: '600' },
  commentText: { fontSize: 13, lineHeight: 19 },
  viewAllBtn: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewAllText: { fontSize: 13, fontWeight: '800' },
});
