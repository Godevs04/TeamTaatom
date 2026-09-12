import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

function formatDuration(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(Number(seconds))) return '';
  const s = Math.max(0, Math.floor(Number(seconds)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
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
  const firedSlotsRef = useRef<Set<number>>(new Set());
  const prerollDoneRef = useRef(false);
  const resumeAtRef = useRef(0);
  const videoRef = useRef<any>(null);

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
      if (Array.isArray(next.comments)) setComments(next.comments);
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

  const runPreroll = useCallback(async () => {
    if (prerollDoneRef.current || adBusy) return;
    const pre = schedule.find((s) => s.atSeconds === 0);
    if (!pre) {
      prerollDoneRef.current = true;
      setPaused(false);
      return;
    }
    setAdBusy(true);
    setPaused(true);
    await showLongVideoAdSlot(pre);
    firedSlotsRef.current.add(0);
    prerollDoneRef.current = true;
    setAdBusy(false);
    setPaused(false);
  }, [schedule, adBusy]);

  useEffect(() => {
    if (post && !prerollDoneRef.current) {
      runPreroll();
    }
  }, [post?._id]);

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
          await showLongVideoAdSlot(slot);
          setAdBusy(false);
          setPaused(false);
          try {
            videoRef.current?.seek?.(resumeAtRef.current);
          } catch {
            /* ignore */
          }
          break;
        }
      }
    },
    [schedule, adBusy]
  );

  const onEnd = useCallback(async () => {
    const endIdx = schedule.findIndex((s) => s.atSeconds === 'end');
    if (endIdx >= 0 && !firedSlotsRef.current.has(endIdx)) {
      firedSlotsRef.current.add(endIdx);
      setAdBusy(true);
      setPaused(true);
      await showLongVideoAdSlot(schedule[endIdx]);
      setAdBusy(false);
    }
  }, [schedule]);

  const colors = useMemo(
    () => ({
      bg: dark ? '#000' : '#fff',
      text: dark ? '#fff' : '#121212',
      meta: dark ? 'rgba(255,255,255,0.65)' : '#667085',
      border: dark ? 'rgba(255,255,255,0.12)' : '#e0e0e0',
      icon: dark ? '#fff' : '#121212',
    }),
    [dark]
  );

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

  if (loading || !post) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.icon} />
          </TouchableOpacity>
        </View>
        <View style={styles.loading}>
          <LoadingGlobe size="large" color={colors.icon} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Videos
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.icon} />
        }
      >
        <View style={[styles.playerWrap, { height: Math.round((screenWidth * 9) / 16) }]}>
          {videoUri ? (
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={styles.video}
              resizeMode="contain"
              paused={paused || adBusy}
              controls={!adBusy}
              onProgress={(p) => {
                setCurrentTime(p.currentTime);
                maybeFireMidroll(p.currentTime);
              }}
              onEnd={onEnd}
              poster={post.thumbnailUrl || post.imageUrl}
              ignoreSilentSwitch="ignore"
            />
          ) : (
            <View style={styles.missing}>
              <Text style={{ color: colors.meta }}>Video unavailable</Text>
            </View>
          )}
          {adBusy && (
            <View style={styles.adOverlay}>
              <Text style={styles.adText}>Advertisement…</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>{post.caption}</Text>
          <View style={styles.metaRow}>
            {!!post.user?.fullName && (
              <Text style={[styles.meta, { color: colors.meta }]}>{post.user.fullName}</Text>
            )}
            {!!formatDuration(post.durationSeconds) && (
              <Text style={[styles.meta, { color: colors.meta }]}>
                · {formatDuration(post.durationSeconds)}
              </Text>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleLike} disabled={liking}>
              <Ionicons
                name={post.isLiked ? 'heart' : 'heart-outline'}
                size={26}
                color={post.isLiked ? '#E11D48' : colors.icon}
              />
              <Text style={[styles.actionLabel, { color: colors.text }]}>
                {post.likesCount || 0}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setShowComments(true)}
              disabled={!!post.commentsDisabled}
            >
              <Ionicons name="chatbubble-outline" size={24} color={colors.icon} />
              <Text style={[styles.actionLabel, { color: colors.text }]}>
                {post.commentsCount || 0}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowShare(true)}>
              <Ionicons name="paper-plane-outline" size={24} color={colors.icon} />
              <Text style={[styles.actionLabel, { color: colors.text }]}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setPaused((p) => !p)}
              disabled={adBusy}
            >
              <Ionicons name={paused ? 'play' : 'pause'} size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>
          {Platform.OS !== 'web' && currentTime > 0 ? (
            <Text style={[styles.meta, { color: colors.meta, marginTop: 8 }]}>
              {formatDuration(Math.floor(currentTime))}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <PostComments
        visible={showComments}
        onClose={() => setShowComments(false)}
        postId={post._id}
        comments={comments}
        commentsDisabled={!!post.commentsDisabled}
        onCommentAdded={(newComment) => {
          setComments((prev) => {
            const exists = prev.some((c) => c._id === newComment._id);
            const next = exists
              ? prev.map((c) => (c._id === newComment._id ? newComment : c))
              : [...prev, newComment];
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playerWrap: { width: '100%', backgroundColor: '#000', position: 'relative' },
  video: { width: '100%', height: '100%' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  adOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4 },
  meta: { fontSize: 13, fontWeight: '500' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 20,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionLabel: { fontSize: 14, fontWeight: '600' },
});
