import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { PostType } from '../types/post';
import CloudGlassSurface from './cloud/CloudGlassSurface';

function formatDuration(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(Number(seconds))) return '';
  const s = Math.max(0, Math.floor(Number(seconds)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface LongVideoCardProps {
  post: PostType;
}

function LongVideoCard({ post }: LongVideoCardProps) {
  const router = useRouter();
  const { isDark, theme } = useTheme();
  const thumb = post.thumbnailUrl || post.imageUrl || post.mediaUrl;
  const duration = formatDuration(post.durationSeconds);
  const title = post.caption || 'Watch';

  const colors = useMemo(
    () => ({
      title: isDark ? '#FFFFFF' : '#121212',
      meta: isDark ? 'rgba(255,255,255,0.65)' : '#667085',
      badgeBg: 'rgba(0,0,0,0.72)',
    }),
    [isDark]
  );

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/watch/${post._id}` as any)}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <CloudGlassSurface borderRadius={20} style={styles.surface}>
        <View style={styles.thumbWrap}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: theme.colors.border }]} />
          )}
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 3 }} />
            </View>
          </View>
          {!!duration && (
            <View style={[styles.durationBadge, { backgroundColor: colors.badgeBg }]}>
              <Text style={styles.durationText}>{duration}</Text>
            </View>
          )}
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.title }]} numberOfLines={2}>
            {title}
          </Text>
          {!!post.user?.fullName && (
            <Text style={[styles.channel, { color: colors.meta }]} numberOfLines={1}>
              {post.user.fullName}
            </Text>
          )}
          {!!post.youtubeChannelTitle && !post.user?.fullName && (
            <Text style={[styles.channel, { color: colors.meta }]} numberOfLines={1}>
              {post.youtubeChannelTitle}
            </Text>
          )}
        </View>
      </CloudGlassSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
    marginHorizontal: 16,
  },
  surface: {
    overflow: 'hidden',
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#0a0a0a',
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  durationBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  channel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
  },
});

export default React.memo(LongVideoCard);
