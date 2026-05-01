import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { Song } from '../services/songs';
import { triggerHaptic } from '../utils/hapticFeedback';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_COUNT = 30;
const MIN_SELECTION_DURATION = 0.5;

const hapticLight = () => {
  try { triggerHaptic('light'); } catch (e) {}
};

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

interface SongBarProps {
  song: Song;
  startTime: number;
  endTime: number;
  songDuration: number;
  onTrimChange: (startTime: number, endTime: number) => void;
  onOpenSelector: () => void;
  onRemove: () => void;
}

export const SongBar: React.FC<SongBarProps> = ({
  song,
  startTime,
  endTime,
  songDuration,
  onTrimChange,
  onOpenSelector,
  onRemove,
}) => {
  const { theme } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Use refs for values needed inside PanResponder (avoids stale closures)
  const propsRef = useRef({ startTime, endTime, songDuration, onTrimChange });
  useEffect(() => {
    propsRef.current = { startTime, endTime, songDuration, onTrimChange };
  }, [startTime, endTime, songDuration, onTrimChange]);

  const dragStartRef = useRef({ startTime: 0, endTime: 0, startX: 0 });

  // Trimmer dimensions
  const trimmerWidth = SCREEN_WIDTH - 56; // account for container padding

  const timeToX = (time: number, duration: number) => {
    if (duration <= 0) return 0;
    return (time / duration) * trimmerWidth;
  };

  const xToTime = (x: number, duration: number) => {
    if (trimmerWidth <= 0) return 0;
    return Math.max(0, Math.min(duration, (x / trimmerWidth) * duration));
  };

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  // Play/pause preview
  const togglePlay = useCallback(async () => {
    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
        return;
      }

      const { startTime: st, endTime: et } = propsRef.current;

      if (!soundRef.current) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: song.s3Url },
          { positionMillis: st * 1000, shouldPlay: true, isLooping: false }
        );
        soundRef.current = sound;
      } else {
        await soundRef.current.setPositionAsync(st * 1000);
        await soundRef.current.playAsync();
      }

      setIsPlaying(true);

      // Poll status for looping within trim range
      statusIntervalRef.current = setInterval(async () => {
        if (!soundRef.current || !isMountedRef.current) return;
        try {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded) {
            const pos = status.positionMillis / 1000;
            const { startTime: curSt, endTime: curEt } = propsRef.current;
            if (pos >= curEt) {
              await soundRef.current.setPositionAsync(curSt * 1000);
            }
          }
        } catch (e) {}
      }, 200);
    } catch (e) {
      console.error('[SongBar] playback error:', e);
    }
  }, [isPlaying, song.s3Url]);

  // Left handle pan responder
  const leftPanResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        hapticLight();
        const { startTime: st, endTime: et, songDuration: dur } = propsRef.current;
        dragStartRef.current = { startTime: st, endTime: et, startX: timeToX(st, dur) };
      },
      onPanResponderRelease: (_, gestureState) => {
        const { endTime: et, songDuration: dur, onTrimChange: cb } = propsRef.current;
        const newX = Math.max(0, dragStartRef.current.startX + gestureState.dx);
        const newTime = xToTime(newX, dur);
        const maxStart = dragStartRef.current.endTime - MIN_SELECTION_DURATION;
        const clampedTime = Math.max(0, Math.min(newTime, maxStart));
        cb(clampedTime, dragStartRef.current.endTime);
      },
    }), []);

  // Right handle pan responder
  const rightPanResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        hapticLight();
        const { startTime: st, endTime: et, songDuration: dur } = propsRef.current;
        dragStartRef.current = { startTime: st, endTime: et, startX: timeToX(et, dur) };
      },
      onPanResponderRelease: (_, gestureState) => {
        const { songDuration: dur, onTrimChange: cb } = propsRef.current;
        const newX = Math.min(trimmerWidth, dragStartRef.current.startX + gestureState.dx);
        const newTime = xToTime(newX, dur);
        const minEnd = dragStartRef.current.startTime + MIN_SELECTION_DURATION;
        const clampedTime = Math.min(dur, Math.max(newTime, minEnd));
        cb(dragStartRef.current.startTime, clampedTime);
      },
    }), []);

  // Center drag pan responder
  const centerPanResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5,
      onPanResponderGrant: () => {
        hapticLight();
        const { startTime: st, endTime: et } = propsRef.current;
        dragStartRef.current = { startTime: st, endTime: et, startX: 0 };
      },
      onPanResponderRelease: (_, gestureState) => {
        const { songDuration: dur, onTrimChange: cb } = propsRef.current;
        const selDuration = dragStartRef.current.endTime - dragStartRef.current.startTime;
        const timeDelta = (gestureState.dx / trimmerWidth) * dur;
        let newStart = dragStartRef.current.startTime + timeDelta;
        let newEnd = newStart + selDuration;

        if (newStart < 0) { newStart = 0; newEnd = selDuration; }
        if (newEnd > dur) { newEnd = dur; newStart = dur - selDuration; }

        cb(newStart, newEnd);
      },
    }), []);

  // Generate waveform bars
  const waveformBars = useMemo(() =>
    Array.from({ length: BAR_COUNT }, (_, i) => {
      const height = 12 + Math.sin(i * 0.4) * 8 + Math.cos(i * 0.6) * 6;
      return { height };
    }), []);

  const selectionDuration = endTime - startTime;
  const isDark = theme.colors.background === '#000000' || theme.colors.background === '#111114';
  const safeDuration = songDuration > 0 ? songDuration : 1;

  // Calculate positions as percentages
  const leftPct = (startTime / safeDuration) * 100;
  const rightPct = ((safeDuration - endTime) / safeDuration) * 100;
  const selectionWidthPct = Math.max(0, 100 - leftPct - rightPct);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0' }]}>
      {/* Song Info Row */}
      <View style={styles.songInfoRow}>
        {/* Song artwork / icon */}
        <TouchableOpacity
          onPress={onOpenSelector}
          activeOpacity={0.7}
          style={[styles.artworkContainer, { backgroundColor: theme.colors.primary + '20' }]}
        >
          {song.thumbnailUrl || song.imageUrl ? (
            <Image
              source={{ uri: song.thumbnailUrl || song.imageUrl }}
              style={styles.artwork}
            />
          ) : (
            <Ionicons name="musical-notes" size={18} color={theme.colors.primary} />
          )}
        </TouchableOpacity>

        {/* Song title & artist */}
        <TouchableOpacity
          onPress={onOpenSelector}
          activeOpacity={0.7}
          style={styles.songTextContainer}
        >
          <Text style={[styles.songTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={[styles.songArtist, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {song.artist}
          </Text>
        </TouchableOpacity>

        {/* Duration badge */}
        <View style={[styles.durationBadge, { backgroundColor: theme.colors.primary + '15' }]}>
          <Text style={[styles.durationText, { color: theme.colors.primary }]}>
            {Math.round(selectionDuration)}s
          </Text>
        </View>

        {/* Play/Pause */}
        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: theme.colors.primary }]}
          onPress={togglePlay}
          activeOpacity={0.8}
        >
          <Ionicons name={isPlaying ? "pause" : "play"} size={16} color="white" />
        </TouchableOpacity>
      </View>

      {/* Waveform Trimmer */}
      <View style={styles.trimmerContainer}>
        {/* Full waveform background */}
        <View style={styles.waveformRow}>
          {waveformBars.map((bar, index) => {
            const barTime = (index / BAR_COUNT) * safeDuration;
            const isInSelection = barTime >= startTime && barTime <= endTime;
            return (
              <View
                key={index}
                style={{
                  width: 3,
                  height: bar.height,
                  borderRadius: 1.5,
                  backgroundColor: isInSelection ? theme.colors.primary : (isDark ? '#444' : '#ccc'),
                  opacity: isInSelection ? 1 : 0.4,
                }}
              />
            );
          })}
        </View>

        {/* Selection overlay with trim handles */}
        <View style={StyleSheet.absoluteFill}>
          {/* Left dimmed area */}
          {leftPct > 0 && (
            <View style={{
              position: 'absolute', top: 0, bottom: 0, left: 0,
              width: `${leftPct}%` as any,
              backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)',
              zIndex: 1,
            }} />
          )}

          {/* Right dimmed area */}
          {rightPct > 0 && (
            <View style={{
              position: 'absolute', top: 0, bottom: 0, right: 0,
              width: `${rightPct}%` as any,
              backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)',
              zIndex: 1,
            }} />
          )}

          {/* Selection frame */}
          <View
            style={{
              position: 'absolute',
              top: -4,
              bottom: -4,
              left: `${leftPct}%` as any,
              width: `${selectionWidthPct}%` as any,
              borderWidth: 2,
              borderRadius: 6,
              borderColor: isDark ? '#FFFFFF' : '#333333',
              zIndex: 2,
            }}
            {...centerPanResponder.panHandlers}
          >
            {/* Left trim handle */}
            <View
              style={{
                position: 'absolute', left: -2, top: 0, bottom: 0, width: 16,
                backgroundColor: isDark ? '#FFFFFF' : '#333333',
                borderTopLeftRadius: 6, borderBottomLeftRadius: 6,
                justifyContent: 'center', alignItems: 'center',
                zIndex: 3,
              }}
              {...leftPanResponder.panHandlers}
            >
              <View style={{ width: 2, height: 12, borderRadius: 1, backgroundColor: isDark ? '#333' : '#fff' }} />
            </View>

            {/* Right trim handle */}
            <View
              style={{
                position: 'absolute', right: -2, top: 0, bottom: 0, width: 16,
                backgroundColor: isDark ? '#FFFFFF' : '#333333',
                borderTopRightRadius: 6, borderBottomRightRadius: 6,
                justifyContent: 'center', alignItems: 'center',
                zIndex: 3,
              }}
              {...rightPanResponder.panHandlers}
            >
              <View style={{ width: 2, height: 12, borderRadius: 1, backgroundColor: isDark ? '#333' : '#fff' }} />
            </View>
          </View>
        </View>

        {/* Time labels */}
        <View style={styles.timeLabels}>
          <Text style={[styles.timeLabel, { color: theme.colors.textSecondary }]}>
            {formatTime(startTime)}
          </Text>
          <Text style={[styles.timeLabel, { color: theme.colors.textSecondary }]}>
            {formatTime(endTime)}
          </Text>
        </View>
      </View>

      {/* Bottom actions: Change / Remove */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0' }]}
          onPress={onOpenSelector}
          activeOpacity={0.7}
        >
          <Ionicons name="swap-horizontal" size={14} color={theme.colors.textSecondary} />
          <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>Change</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#ff3b3020' }]}
          onPress={onRemove}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={14} color="#ff3b30" />
          <Text style={[styles.actionText, { color: '#ff3b30' }]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  songInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  artworkContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  artwork: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  songTextContainer: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  songTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  songArtist: {
    fontSize: 12,
    fontWeight: '400',
  },
  durationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '700',
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trimmerContainer: {
    marginBottom: 8,
    position: 'relative',
    minHeight: 32,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
    paddingHorizontal: 4,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SongBar;
