import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from './ui/MaskedView';
import { createSongSound, type SongSound } from '../utils/expoAudioSound';
import { useIsFocused } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { Song } from '../services/songs';

interface SongBarProps {
  song: Song;
  startTime: number;
  endTime: number;
  songDuration: number;
  onTrimChange: (startTime: number, endTime: number) => void;
  onOpenSelector: () => void;
  onRemove: () => void;
}

const BLUE_ICON_GRADIENT = ['#38BDF8', '#2563EB'] as const;

const GradientIonicon = ({
  name,
  size,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size: number;
}) => (
  <MaskedView
    style={{ width: size, height: size }}
    maskElement={<Ionicons name={name} size={size} color="#000" />}
  >
    <LinearGradient
      colors={BLUE_ICON_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    />
  </MaskedView>
);

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
  const soundRef = useRef<SongSound | null>(null);
  const isMountedRef = useRef(true);
  const isFocused = useIsFocused();

  // Pause preview when screen loses focus
  useEffect(() => {
    if (!isFocused && isPlaying && soundRef.current) {
      soundRef.current.pauseAsync().catch(() => {});
      setIsPlaying(false);
    }
  }, [isFocused, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  // Unload previous sound when song changes
  useEffect(() => {
    if (soundRef.current) {
      const oldSound = soundRef.current;
      soundRef.current = null;
      setIsPlaying(false);
      oldSound.stopAsync().catch(() => {});
      oldSound.unloadAsync().catch(() => {});
    }
  }, [song.s3Url]);

  // Play/pause preview
  const togglePlay = useCallback(async () => {
    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current?.pauseAsync().catch(() => {});
        setIsPlaying(false);
        return;
      }

      if (!soundRef.current) {
        const sound = await createSongSound(song.s3Url, {
          shouldPlay: true,
          isLooping: false,
          isMuted: false,
          volume: 1,
          positionMillis: 0,
          downloadFirst: Platform.OS === 'android', // Signed S3 URLs stream unreliably on Android
        });
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish && isMountedRef.current) setIsPlaying(false);
        });
        soundRef.current = sound;
      } else {
        await soundRef.current?.setPositionAsync(0).catch(() => {});
        await soundRef.current?.playAsync().catch(() => {});
      }

      setIsPlaying(true);
    } catch (e) {
      console.error('[SongBar] playback error:', e);
    }
  }, [isPlaying, song.s3Url]);

  const isDark = theme.colors.background === '#000000' || theme.colors.background === '#111114';
  const currentDuration = endTime - startTime;
  const is30 = currentDuration <= 30;

  const toggleDuration = (dur: number) => {
    const clamped = Math.min(dur, songDuration);
    onTrimChange(0, clamped);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0' }]}>
      <View style={styles.songInfoRow}>
        {/* Song artwork / icon */}
        <View style={[styles.artworkContainer, { backgroundColor: theme.colors.primary + '20' }]}>
          {song.thumbnailUrl || song.imageUrl ? (
            <Image
              source={{ uri: song.thumbnailUrl || song.imageUrl }}
              style={styles.artwork}
            />
          ) : (
            <GradientIonicon name="musical-notes" size={18} />
          )}
        </View>

        {/* Song title & artist */}
        <View style={styles.songTextContainer}>
          <Text style={[styles.songTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={[styles.songArtist, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {song.artist}
          </Text>
        </View>

        {/* Duration toggle: 30s / 60s */}
        <View style={styles.durationToggle}>
          <TouchableOpacity
            style={styles.durationChip}
            onPress={() => toggleDuration(30)}
            activeOpacity={0.7}
          >
            {is30 && (
              <LinearGradient
                colors={BLUE_ICON_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Text style={[styles.durationChipText, { color: is30 ? '#fff' : theme.colors.textSecondary }]}>30s</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.durationChip}
            onPress={() => toggleDuration(60)}
            activeOpacity={0.7}
          >
            {!is30 && (
              <LinearGradient
                colors={BLUE_ICON_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Text style={[styles.durationChipText, { color: !is30 ? '#fff' : theme.colors.textSecondary }]}>60s</Text>
          </TouchableOpacity>
        </View>

        {/* Play/Pause */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={togglePlay}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={BLUE_ICON_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name={isPlaying ? "pause" : "play"} size={16} color="white" />
        </TouchableOpacity>

        {/* Change */}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0', marginLeft: 6 }]}
          onPress={onOpenSelector}
          activeOpacity={0.7}
        >
          <GradientIonicon name="swap-horizontal" size={14} />
        </TouchableOpacity>

        {/* Remove */}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#ff3b3020', marginLeft: 4 }]}
          onPress={onRemove}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={14} color="#ff3b30" />
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
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  durationToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 8,
  },
  durationChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  durationChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SongBar;
