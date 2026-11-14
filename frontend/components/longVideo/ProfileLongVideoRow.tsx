import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PostType } from '../../types/post';
import { formatViewCount } from '../../utils/numberFormat';
import { formatDuration } from '../LongVideoCard';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function formatAge(createdAt?: string): string {
  const time = createdAt ? new Date(createdAt).getTime() : NaN;
  if (Number.isNaN(time)) return '';
  const diff = Math.max(0, Date.now() - time);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  if (diff < HOUR) return diff < MINUTE ? 'Just now' : plural(Math.floor(diff / MINUTE), 'minute');
  if (diff < DAY) return plural(Math.floor(diff / HOUR), 'hour');
  if (diff < 30 * DAY) return plural(Math.floor(diff / DAY), 'day');
  if (diff < 365 * DAY) return plural(Math.floor(diff / (30 * DAY)), 'month');
  return plural(Math.floor(diff / (365 * DAY)), 'year');
}

interface ProfileLongVideoRowProps {
  video: PostType;
  onPress: (video: PostType) => void;
  colors: { text: string; meta: string; placeholder: string };
}

function ProfileLongVideoRow({ video, onPress, colors }: ProfileLongVideoRowProps) {
  const thumb = video.thumbnailUrl || video.imageUrl;
  const duration = formatDuration(video.durationSeconds);
  const views = video.viewsCount ?? 0;
  const age = formatAge(video.createdAt);
  const title = video.caption || 'Untitled video';
  const processing = (video as any).status === 'processing';
  const thumbRatio = Number(video.thumbnailAspectRatio) || 0;
  const letterbox = thumbRatio > 0 && Math.abs(thumbRatio - 16 / 9) > 0.05;

  return (
    <Pressable
      onPress={() => onPress(video)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.thumbWrap, { backgroundColor: colors.placeholder }]}>
        {thumb && letterbox ? (
          <>
            <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={16} />
            <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="contain" />
          </>
        ) : thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={styles.thumbFallback}>
            <Ionicons name="film-outline" size={24} color={colors.meta} />
          </View>
        )}
        {processing ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Processing</Text>
          </View>
        ) : !!duration && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{duration}</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.meta, { color: colors.meta }]} numberOfLines={1}>
          {`${formatViewCount(views)} ${views === 1 ? 'view' : 'views'}${age ? ` · ${age}` : ''}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.75,
  },
  thumbWrap: {
    width: '44%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    paddingTop: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
  },
});

export default React.memo(ProfileLongVideoRow);
